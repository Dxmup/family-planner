// Local development server. In production the same app runs as a Vercel
// serverless function (api/index.js) with static files served by Vercel.
const express = require('express');
const path = require('path');
const app = require('./api/index');

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Family Planner running at http://localhost:${PORT}`);
});
