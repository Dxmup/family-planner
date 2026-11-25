// OpenID Connect provider for the family apps (Audiobookshelf).
//
// The planner already knows who is logged in (the signed hensels_sso cookie),
// so it can act as the identity provider: Audiobookshelf sends people here, we
// recognise the cookie, and send them back with a signed ID token, so they never
// see Audiobookshelf's own login screen.
//
// Stateless: authorization codes are short-lived signed tokens, so nothing is
// stored. PKCE (S256) is required, redirect URIs are an exact allowlist, and the
// client authenticates with a secret.
//
// Config (Vercel env): OIDC_PRIVATE_KEY  RSA PKCS8 key, base64 DER
//                      OIDC_CLIENT_SECRET_ABS  client secret for Audiobookshelf
//                      SSO_PRIVATE_KEY  (already used by the login cookie)
//                      OIDC_ISSUER_BASE  override for local testing only
// With no OIDC_PRIVATE_KEY the provider answers 503 and nothing else changes.

const crypto = require('crypto');
const express = require('express');

const ISSUER_BASE = process.env.OIDC_ISSUER_BASE || 'https://hensels.app';
const ISSUER = ISSUER_BASE + '/oidc';

const CLIENTS = {
  audiobookshelf: {
    secretEnv: 'OIDC_CLIENT_SECRET_ABS',
    redirectUris: [
      'https://audio.hensels.app/audiobookshelf/auth/openid/callback',
      'https://audio.hensels.app/auth/openid/callback',
    ],
  },
};

const CODE_SECONDS = 60;
const TOKEN_SECONDS = 3600;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

// Constant-time string comparison.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

let keyCache;
function keys() {
  if (keyCache !== undefined) return keyCache;
  const raw = process.env.OIDC_PRIVATE_KEY;
  if (!raw) return (keyCache = null);
  try {
    const priv = crypto.createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' });
    const pub = crypto.createPublicKey(priv);
    const jwk = pub.export({ format: 'jwk' });
    const kid = crypto.createHash('sha256').update(jwk.n).digest('base64url').slice(0, 16);
    keyCache = { priv, pub, kid, jwk: { kty: jwk.kty, n: jwk.n, e: jwk.e, kid, use: 'sig', alg: 'RS256' } };
  } catch (e) {
    console.error('oidc key load failed:', e.message);
    keyCache = null;
  }
  return keyCache;
}

function signJwt(payload, typ) {
  const k = keys();
  const data = b64u(JSON.stringify({ alg: 'RS256', typ, kid: k.kid })) + '.' + b64u(JSON.stringify(payload));
  return data + '.' + b64u(crypto.sign('RSA-SHA256', Buffer.from(data), k.priv));
}

// Returns the payload if the token is ours, of the expected type, and unexpired.
function verifyJwt(token, typ) {
  try {
    const k = keys();
    const [h, p, s] = String(token).split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    if (header.alg !== 'RS256' || header.typ !== typ || header.kid !== k.kid) return null;
    if (!crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), k.pub, Buffer.from(s, 'base64url'))) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    return typeof payload.exp === 'number' && payload.exp > now() ? payload : null;
  } catch {
    return null;
  }
}

// Who is logged in to the planner? Verifies the hensels_sso cookie (ES256).
function emailFromSsoCookie(req) {
  try {
    const raw = process.env.SSO_PRIVATE_KEY;
    const m = /(?:^|;\s*)hensels_sso=([^;]+)/.exec(req.headers.cookie || '');
    if (!raw || !m) return null;
    const [payload, sig] = m[1].split('.');
    if (!payload || !sig) return null;
    const pub = crypto.createPublicKey(
      crypto.createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' }));
    const good = crypto.verify('sha256', Buffer.from(payload),
      { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
    if (!good) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof claims.exp === 'number' && claims.exp > now() && claims.e ? String(claims.e).toLowerCase() : null;
  } catch {
    return null;
  }
}

const profile = (email) => ({
  sub: email,
  email,
  email_verified: true,
  preferred_username: email.split('@')[0],
  name: email.split('@')[0],
});

function mount(app) {
  const off = (res) => res.status(503).json({ error: 'temporarily_unavailable' });

  app.get('/oidc/.well-known/openid-configuration', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json({
      issuer: ISSUER,
      authorization_endpoint: ISSUER + '/authorize',
      token_endpoint: ISSUER + '/token',
      userinfo_endpoint: ISSUER + '/userinfo',
      jwks_uri: ISSUER + '/jwks',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      claims_supported: ['sub', 'email', 'email_verified', 'preferred_username', 'name'],
    });
  });

  app.get('/oidc/jwks', (req, res) => {
    const k = keys();
    if (!k) return off(res);
    res.set('Cache-Control', 'public, max-age=300').json({ keys: [k.jwk] });
  });

  app.get('/oidc/authorize', (req, res) => {
    if (!keys()) return off(res);
    const q = req.query;
    const client = CLIENTS[q.client_id];
    // A bad client or redirect URI must never be redirected to.
    if (!client || !client.redirectUris.includes(q.redirect_uri)) {
      return res.status(400).type('text/plain').send('Invalid client or redirect_uri');
    }
    const back = (params) => {
      const u = new URL(q.redirect_uri);
      for (const [key, val] of Object.entries(params)) u.searchParams.set(key, val);
      if (q.state) u.searchParams.set('state', String(q.state));
      res.redirect(302, u.href);
    };
    if (q.response_type !== 'code') return back({ error: 'unsupported_response_type' });
    if (!q.code_challenge || q.code_challenge_method !== 'S256') {
      return back({ error: 'invalid_request', error_description: 'PKCE with S256 is required' });
    }
    if (!String(q.scope || '').split(' ').includes('openid')) return back({ error: 'invalid_scope' });

    const email = emailFromSsoCookie(req);
    if (!email) {
      // Not logged in to the planner: log in there, then come straight back here.
      return res.redirect(302, '/?next=' + encodeURIComponent(req.originalUrl || req.url));
    }
    const code = signJwt({
      iss: ISSUER, sub: email, aud: q.client_id, redirect_uri: q.redirect_uri,
      cc: String(q.code_challenge), nonce: q.nonce ? String(q.nonce) : undefined,
      jti: crypto.randomBytes(12).toString('base64url'), exp: now() + CODE_SECONDS,
    }, 'code+jwt');
    back({ code });
  });

  app.post('/oidc/token', express.urlencoded({ extended: false }), (req, res) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    if (!keys()) return off(res);
    const fail = (status, error, error_description) =>
      res.status(status).json(error_description ? { error, error_description } : { error });

    // Client authentication: HTTP Basic or form fields.
    let id, secret;
    const basic = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
    if (basic) {
      const decoded = Buffer.from(basic[1], 'base64').toString();
      const i = decoded.indexOf(':');
      try {
        id = decodeURIComponent(decoded.slice(0, i));
        secret = decodeURIComponent(decoded.slice(i + 1));
      } catch { return fail(401, 'invalid_client'); }
    } else {
      id = req.body.client_id;
      secret = req.body.client_secret;
    }
    const client = CLIENTS[id];
    const expected = client && process.env[client.secretEnv];
    if (!client || !expected || !secret || !safeEqual(secret, expected)) return fail(401, 'invalid_client');

    if (req.body.grant_type !== 'authorization_code') return fail(400, 'unsupported_grant_type');
    const code = verifyJwt(req.body.code, 'code+jwt');
    if (!code || code.aud !== id || code.redirect_uri !== req.body.redirect_uri) return fail(400, 'invalid_grant');
    const challenge = crypto.createHash('sha256').update(String(req.body.code_verifier || '')).digest('base64url');
    if (!req.body.code_verifier || !safeEqual(challenge, code.cc)) {
      return fail(400, 'invalid_grant', 'PKCE verification failed');
    }

    const t = now();
    const base = { iss: ISSUER, sub: code.sub, aud: id, iat: t, exp: t + TOKEN_SECONDS };
    res.json({
      access_token: signJwt({ ...base, scope: 'openid profile email' }, 'at+jwt'),
      token_type: 'Bearer',
      expires_in: TOKEN_SECONDS,
      scope: 'openid profile email',
      id_token: signJwt({ ...base, auth_time: t, nonce: code.nonce, ...profile(code.sub) }, 'JWT'),
    });
  });

  const userinfo = (req, res) => {
    if (!keys()) return off(res);
    const m = /^Bearer\s+(\S+)/i.exec(req.headers.authorization || '');
    const token = m && verifyJwt(m[1], 'at+jwt');
    if (!token) {
      return res.set('WWW-Authenticate', 'Bearer error="invalid_token"').status(401).json({ error: 'invalid_token' });
    }
    res.set('Cache-Control', 'no-store').json(profile(token.sub));
  };
  app.get('/oidc/userinfo', userinfo);
  app.post('/oidc/userinfo', userinfo);
}

module.exports = { mount };
