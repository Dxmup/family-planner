/* Hensel Family Adventure Atlas: shared core. Plain script, one global: window.Atlas.
   Baked-in data below is moved verbatim from the original index.html. See CORE.md. */
(function () {
let THEMES={
  wa:["Water","var(--t-wa)"], sc:["Science","var(--t-sc)"], an:["Animals","var(--t-an)"],
  na:["Nature","var(--t-na)"], hi:["History","var(--t-hi)"], tp:["Theme Parks","var(--t-tp)"],
  fo:["Food","var(--t-fo)"], wk:["Walkability","var(--t-wk)"]
};
let SPOKES={
  NW:"NW · Tennessee Valley → Gateway West", N:"N · Blue Ridge → Ohio Valley",
  NE:"NE · Shenandoah → Mid-Atlantic", SE:"SE · Lowcountry → First Coast",
  S:"S · I-75 → Nature Coast"
};
let CITIES={
  Atlanta:{spoke:"S",drive:"~2h",overlook:"Doll's Head Trail — a free folk-art walk through an old quarry made of salvaged doll heads."},
  Chattanooga:{spoke:"NW",drive:"~2.5h",overlook:"Reflection Riding — red wolves & raptors on 15 miles of quiet trails."},
  Nashville:{spoke:"NW",drive:"~4h",overlook:"Lane Motor Museum's free rides in the world's weirdest cars."},
  Huntsville:{spoke:"NW",drive:"~3.75h",overlook:"Lowe Mill ARTS — a textile mill packed with 200+ working artists."},
  Knoxville:{spoke:"N",drive:"~2h",overlook:"Fort Dickerson Quarry — a turquoise swimming hole minutes from downtown."},
  "St. Louis":{spoke:"NW",drive:"~9.5h",overlook:"Turtle Playground — free giant turtles by City Museum's own creator."},
  Louisville:{spoke:"N",drive:"~5.5h",overlook:"Falls of the Ohio — walk 390-million-year-old fossil beds."},
  Cincinnati:{spoke:"N",drive:"~6h",overlook:"American Sign Museum's live Saturday neon-bending demos."},
  Columbus:{spoke:"N",drive:"~7h",overlook:"The Wilds open-air safari & Slate Run's living 1880s farm."},
  Indianapolis:{spoke:"N",drive:"~7.5h",overlook:"Garfield Park Conservatory & the City Market Catacombs."},
  "Washington DC":{spoke:"NE",drive:"~7h",overlook:"Planet Word — a free, voice-activated language museum."},
  Williamsburg:{spoke:"NE",drive:"~7h",overlook:"Virginia Living Museum — zoo + aquarium + nature + fossil dig in one."},
  Pittsburgh:{spoke:"NE",drive:"~7h",overlook:"Idlewild & SoakZone — the original Mister Rogers trolley."},
  Philadelphia:{spoke:"NE",drive:"~9.5h",overlook:"Elmwood Park Zoo — hand-feed giraffes & zipline over the bison."},
  Savannah:{spoke:"SE",drive:"~3.75h",overlook:"UGA Aquarium on Skidaway — a cheap, crowd-free hands-on marine day."},
  Charleston:{spoke:"SE",drive:"~3.5h",overlook:"Center for Birds of Prey — owls gliding inches over your head."},
  "St. Augustine":{spoke:"SE",drive:"~5.5h",overlook:"Free ranger-led fossil shark-tooth walks at low tide."},
  Orlando:{spoke:"S",drive:"~7h",overlook:"Blue Spring's winter manatee gathering, 40 min off the park grid."},
  "Tampa / St. Pete":{spoke:"S",drive:"~7.5h",overlook:"Sunken Gardens + Great Explorations, a calm walkable St. Pete half-day."},
  "Nature Coast (Crystal River)":{spoke:"S",drive:"~7h",overlook:"Homosassa's underwater Fish Bowl — manatees face-to-glass in any season."},
  Charlotte:{spoke:"NE",drive:"~1.5h",overlook:"U.S. National Whitewater Center — free riverside trails, paid rafting on an Olympic-caliber course."},
  "Gatlinburg / Pigeon Forge":{spoke:"N",drive:"~2.25h",overlook:"Fighting Creek Trail at Sugarlands — flip a mossy rock in the world's salamander capital."},
  "NC Triangle (Raleigh–Durham)":{spoke:"NE",drive:"~3.5h",overlook:"Duke Lemur Center — the world's largest lemur sanctuary, by advance reservation."}
};
// Live event-calendar resources per city (verified Jul 2026). Artifacts can't fetch, so these
// open the real calendars in a new tab — check them dynamically for a given travel weekend.
let EVENTS={
  "Atlanta":[{n:"Time Out Atlanta",u:"https://www.timeout.com/atlanta/things-to-do",d:"curated things-to-do & events"},{n:"Discover Atlanta Events",u:"https://discoveratlanta.com/events/all/",d:"official CVB events calendar"},{n:"Atlanta Parent Top Events",u:"https://www.atlantaparent.com/topevents/",d:"family things-to-do this week"},{n:"Creative Loafing Atlanta",u:"https://creativeloafing.com/events",d:"alt-weekly events calendar"}],
  "Chattanooga":[{n:"The Pulse Events",u:"https://www.chattanoogapulse.com/local-events-calendar",d:"alt-weekly arts & entertainment"},{n:"Visit Chattanooga Events",u:"https://www.visitchattanooga.com/events/",d:"official CVB events calendar"},{n:"Macaroni KID Chattanooga",u:"https://chattanooga.macaronikid.com/",d:"family & kids events"},{n:"NOOGAtoday Events",u:"https://6amcity.com/tn/chattanooga/events",d:"local daily things-to-do"}],
  "Nashville":[{n:"Do615",u:"https://do615.com/",d:"curated things-to-do listings"},{n:"Visit Music City Events",u:"https://www.visitmusiccity.com/events",d:"official CVB events calendar"},{n:"Nashville Parent Calendar",u:"https://www.nashvilleparent.com/calendar/",d:"family & kids events calendar"},{n:"Nashville Scene Calendar",u:"https://www.nashvillescene.com/calendar/",d:"alt-weekly events calendar"}],
  "Huntsville":[{n:"We Are Huntsville",u:"https://wearehuntsville.com/event-calendar/",d:"local things-to-do calendar"},{n:"Visit Huntsville Events",u:"https://www.huntsville.org/events/",d:"official CVB events calendar"},{n:"Rocket City Mom Events",u:"https://www.rocketcitymom.com/events/",d:"family & kids events calendar"}],
  "Knoxville":[{n:"Visit Knoxville Events",u:"https://www.visitknoxville.com/events/",d:"official CVB & this-weekend calendar"},{n:"Downtown Knoxville Calendar",u:"https://www.downtownknoxville.org/events/",d:"downtown festivals & markets"},{n:"Inside of Knoxville Events",u:"https://insideofknoxville.com/category/events/",d:"local things-to-do blog"},{n:"Macaroni KID Knoxville",u:"https://knoxville.macaronikid.com/events/calendar",d:"family & kids events calendar"}],
  "Gatlinburg / Pigeon Forge":[{n:"My Pigeon Forge Events",u:"https://www.mypigeonforge.com/events/",d:"official Pigeon Forge festivals"},{n:"Gatlinburg Events",u:"https://www.gatlinburg.com/events/",d:"official Gatlinburg CVB calendar"},{n:"Dollywood Festivals",u:"https://www.dollywood.com/themepark/festivals/",d:"Dollywood seasonal festivals"}],
  "St. Louis":[{n:"St. Louis Magazine Calendar",u:"https://www.stlmag.com/calendar/",d:"city magazine curated events"},{n:"Explore St. Louis Events",u:"https://explorestlouis.com/events/",d:"official CVB events & festivals"},{n:"Fun 4 STL Kids",u:"https://fun4stlkids.com/calendar",d:"family events calendar"},{n:"Riverfront Times Events",u:"https://www.riverfronttimes.com/st-louis/EventSearch",d:"alt-weekly events listings"}],
  "Louisville":[{n:"Do502",u:"https://do502.com/events/weekend",d:"things to do this weekend"},{n:"Go To Louisville Events",u:"https://www.gotolouisville.com/events/",d:"official tourism events calendar"},{n:"Macaroni KID Louisville",u:"https://centrallouisville.macaronikid.com/events/calendar",d:"family & kids events calendar"},{n:"LEO Weekly Things to Do",u:"https://www.leoweekly.com/events/",d:"alt-weekly events & things to do"}],
  "Cincinnati":[{n:"Cincinnati Magazine",u:"https://www.cincinnatimagazine.com/things-to-do/",d:"city magazine weekend picks"},{n:"Visit Cincy Events",u:"https://www.visitcincy.com/events/",d:"official CVB events calendar"},{n:"Macaroni KID Cincinnati",u:"https://cincinnatimetro.macaronikid.com/events",d:"family & kids events calendar"},{n:"CityBeat Events",u:"https://community.citybeat.com/cincinnati/EventSearch",d:"alt-weekly searchable listings"}],
  "Columbus":[{n:"614NOW Events",u:"https://614now.com/events",d:"city magazine things-to-do"},{n:"Experience Columbus Events",u:"https://www.experiencecolumbus.com/events/",d:"official CVB events calendar"},{n:"Macaroni KID Columbus",u:"https://nwcolumbus.macaronikid.com/events/calendar",d:"family & kids events calendar"},{n:"Columbus Underground",u:"https://columbusunderground.com/event-calendar/",d:"local alt events calendar"}],
  "Indianapolis":[{n:"Indianapolis Monthly",u:"https://www.indianapolismonthly.com/things-to-do/events",d:"city magazine events calendar"},{n:"Visit Indy Events",u:"https://www.visitindy.com/events/",d:"official CVB events calendar"},{n:"Macaroni KID Indianapolis",u:"https://indianapolis.macaronikid.com/events",d:"family & kids events calendar"},{n:"Do317 Events",u:"https://do317.com/events",d:"local things-to-do calendar"}],
  "Pittsburgh":[{n:"Pittsburgh Magazine",u:"https://www.pittsburghmagazine.com/things-to-do/",d:"city magazine events & picks"},{n:"Visit Pittsburgh Events",u:"https://www.visitpittsburgh.com/events/",d:"official CVB events calendar"},{n:"Macaroni KID Pittsburgh",u:"https://cityofpittsburgh.macaronikid.com/events/calendar",d:"family & kids events calendar"},{n:"Pittsburgh City Paper",u:"https://www.pghcitypaper.com/pittsburgh/EventSearch",d:"alt-weekly events listings"}],
  "Washington DC":[{n:"Time Out Washington DC",u:"https://www.timeout.com/washington-dc/things-to-do",d:"city magazine things-to-do"},{n:"Destination DC Events",u:"https://washington.org/find-dc-listings/dc-events",d:"official DC tourism calendar"},{n:"Washington Parent Weekend",u:"https://washingtonparent.com/things-to-do-with-kids-in-the-dmv-this-weekend/",d:"family things-to-do this weekend"},{n:"Kids Out and About DMV",u:"https://dmv.kidsoutandabout.com/",d:"kids & family events guide"}],
  "Williamsburg":[{n:"Colonial Williamsburg Events",u:"https://www.colonialwilliamsburg.org/events/",d:"historic-area daily calendar"},{n:"Visit Williamsburg Events",u:"https://www.visitwilliamsburg.com/events",d:"official tourism events & festivals"},{n:"Macaroni KID Williamsburg",u:"https://williamsburg.macaronikid.com/events",d:"family & kids events calendar"}],
  "Philadelphia":[{n:"Time Out Philadelphia",u:"https://www.timeout.com/philadelphia/things-to-do",d:"city magazine things-to-do"},{n:"Visit Philadelphia Events",u:"https://www.visitphilly.com/events/",d:"official tourism events guide"},{n:"Mommy Poppins Philly",u:"https://mommypoppins.com/things-to-do-in-Philly-this-weekend-kids-families",d:"family things-to-do this weekend"}],
  "Charlotte":[{n:"Axios Charlotte",u:"https://www.axios.com/local/charlotte",d:"local news & things-to-do"},{n:"Charlotte's Got A Lot",u:"https://www.charlottesgotalot.com/events",d:"official CVB events calendar"},{n:"Fun 4 Charlotte Kids",u:"https://fun4charlottekids.com/calendar",d:"family events calendar"},{n:"Charlotte On The Cheap",u:"https://www.charlotteonthecheap.com/",d:"free & cheap local happenings"}],
  "NC Triangle (Raleigh–Durham)":[{n:"INDY Week Calendar",u:"https://indyweek.com/calendar/",d:"alt-weekly Triangle events guide"},{n:"Triangle on the Cheap",u:"https://triangleonthecheap.com/",d:"free/cheap family weekend picks"},{n:"visitRaleigh Events",u:"https://www.visitraleigh.com/events/",d:"official CVB events calendar"}],
  "Savannah":[{n:"Connect Savannah Events",u:"https://community.connectsavannah.com/savannah/EventSearch?v=list",d:"alt-weekly events listings"},{n:"Southern Mamas",u:"http://www.southernmamas.com/event-calendar-kids-savannah-activities/",d:"local kids-activity calendar"},{n:"Macaroni KID Savannah",u:"https://savannahga.macaronikid.com/events",d:"family & kids events calendar"},{n:"Visit Savannah Events",u:"https://www.visitsavannah.com/events",d:"official CVB events calendar"}],
  "Charleston":[{n:"Charleston City Paper",u:"https://charlestoncitypaper.com/calendar/",d:"alt-weekly Lowcountry events"},{n:"Charleston Moms Events",u:"https://charlestonmoms.com/events/",d:"family & kids events calendar"},{n:"Explore Charleston Events",u:"https://www.charlestoncvb.com/events/",d:"official CVB events calendar"}],
  "St. Augustine":[{n:"Visit St. Augustine Events",u:"https://www.visitstaugustine.com/events/all",d:"local visitor-guide calendar"},{n:"Fun 4 Auggie Kids",u:"https://fun4auggiekids.com/calendar/",d:"family & kids calendar"},{n:"Macaroni KID St. Augustine",u:"https://staugustine.macaronikid.com/events",d:"family & kids events calendar"},{n:"Florida's Historic Coast",u:"https://www.floridashistoriccoast.com/events/",d:"official CVB events & festivals"}],
  "Orlando":[{n:"Time Out Orlando",u:"https://www.timeout.com/orlando/things-to-do",d:"city magazine best things-to-do"},{n:"Visit Orlando Events",u:"https://www.visitorlando.com/events/",d:"official CVB events calendar"},{n:"Orlando Informer Events",u:"https://orlandoinformer.com/universal/events/",d:"theme-park events guide"},{n:"Macaroni KID Orlando",u:"https://seorlando.macaronikid.com/events/calendar",d:"family & kids events"}],
  "Tampa / St. Pete":[{n:"That's So Tampa Events",u:"https://thatssotampa.com/events/",d:"local things-to-do calendar"},{n:"Visit Tampa Bay Events",u:"https://www.visittampabay.com/events/",d:"official CVB events calendar"},{n:"Visit St. Pete-Clearwater",u:"https://www.visitstpeteclearwater.com/events",d:"official CVB events calendar"},{n:"Creative Loafing Tampa",u:"https://community.cltampa.com/tampa/EventSearch",d:"alt-weekly events calendar"}],
  "Nature Coast (Crystal River)":[{n:"Discover Crystal River",u:"https://www.discovercrystalriverfl.com/events/",d:"official Citrus County calendar"},{n:"Fun 4 Nature Coast Kids",u:"https://fun4naturecoastkids.com/calendar",d:"family & kids events calendar"},{n:"Citrus County Chronicle",u:"https://www.citruscountychronicle.com/events/",d:"local newspaper events calendar"}]
};
// Baked event research for a specific trip weekend, keyed by city. Perishable by design:
// each set carries an `expires` date and auto-hides its listings once that date passes
// (the evergreen EVENTS links above always remain). Refresh via a stop's "Copy events request".
let TRIP_EVENTS={
  "NC Triangle (Raleigh–Durham)":{window:"Aug 1–8, 2026",foundNice:"Jul 4, 2026",expires:"2026-08-08",items:[
    {d:"2026-08-03",n:"“Watermelon Day” @ Museum of Life & Science",m:"Durham · Mon Aug 3 · w/ admission · animals get watermelon + Hideaway Woods water play — top pick"},
    {d:"2026-08-04",n:"Movie night @ Pullen Park",m:"Raleigh · Tue Aug 4 · 7p · free · carousel, train & pedal boats on site (a Triangle atlas pick)"},
    {d:"2026-08-07",n:"First Friday Market & Movie (Zootopia 2) @ Moore Square",m:"Raleigh · Fri Aug 7 · ~7:15p · free · on-site splash pad + outdoor movie"},
    {d:"2026-08-02",n:"Durham Bulls vs. Gwinnett @ DBAP",m:"Durham · Sat Aug 1 6:45p (fireworks) & Sun Aug 2 5:05p · ~$11–20"},
    {d:"2026-08-07",n:"$1–$3 kids matinees all week",m:"Regal Summer Movie Express $1 (Mon) · Cary Paragon Minecraft $2 · Chapel Hill Lumina $3 — heat/rain breaks"}
  ]},
  "Charlotte":{window:"Aug 6–8, 2026 (stopover)",foundNice:"Jul 4, 2026",expires:"2026-08-08",items:[
    {d:"2026-08-08",n:"Charlotte Knights vs. Durham Bulls @ Truist Field",m:"Uptown · Fri Aug 7 ~7:04p / Sat Aug 8 6:05p (Sat = fireworks + kids run bases) · from ~$12 · verify promo"},
    {d:"2026-08-06",n:"Thu Aug 6 combo (if there Thursday)",m:"free River Jam concert @ Whitewater Center + free “Wizard of Oz” outdoor movie @ Camp North End"},
    {d:"2026-08-08",n:"First Ward Park sprayground",m:"Uptown, walkable to Truist Field · free splash play before the game"},
    {d:"2026-08-08",n:"Charlotte Regional Farmers Market",m:"1801 Yorkmont Rd · Sat Aug 8 8a–5p · free · easy stop before the drive home"}
  ]}
};
// Pricing is refreshed on demand, city by city. When you ask me to update a city,
// I research current admission + a typical hotel rate and drop entries here, plus
// the date in PRICE_DATES. Everything else in the page stays untouched.
let PRICE_DATES={
  "Atlanta":"Jul 2026","Louisville":"Jul 2026","Cincinnati":"Jul 2026","Columbus":"Jul 2026",
  "Indianapolis":"Jul 2026","St. Louis":"Jul 2026","Savannah":"Jul 2026","Charleston":"Jul 2026",
  "St. Augustine":"Jul 2026","Orlando":"Jul 2026","Tampa / St. Pete":"Jul 2026",
  "Nature Coast (Crystal River)":"Jul 2026",
  "Chattanooga":"Jul 2026","Nashville":"Jul 2026","Huntsville":"Jul 2026","Knoxville":"Jul 2026",
  "Washington DC":"Jul 2026","Williamsburg":"Jul 2026","Pittsburgh":"Jul 2026","Philadelphia":"Jul 2026",
  "Charlotte":"Jul 2026","Gatlinburg / Pigeon Forge":"Jul 2026","NC Triangle (Raleigh–Durham)":"Jul 2026"
};
let HOTELS={
  "Atlanta":165,"Louisville":150,"Cincinnati":150,"Columbus":160,"Indianapolis":150,"St. Louis":150,
  "Savannah":180,"Charleston":220,"St. Augustine":200,"Orlando":150,"Tampa / St. Pete":160,
  "Nature Coast (Crystal River)":130,
  "Chattanooga":165,"Nashville":250,"Huntsville":145,"Knoxville":185,
  "Washington DC":240,"Williamsburg":210,"Pittsburgh":185,"Philadelphia":260,
  "Charlotte":175,"Gatlinburg / Pigeon Forge":195,"NC Triangle (Raleigh–Durham)":155
};
let PRICES={
  // Atlanta
  "Georgia Aquarium":"From $54.99/person dated","Zoo Atlanta":"From $37/person dated",
  "Fernbank Museum":"$25.95 adult / $23.95 child 3-12","Stone Mountain Park":"$20/vehicle parking",
  "World of Coca-Cola":"$26 adult / $22 child 3-12","Children's Museum of Atlanta":"~$18-22/person",
  "LEGO Discovery Center":"From $24.99/person","Six Flags White Water":"From $29/person dated",
  "BeltLine: Ponce City + Krog St Markets":"Free","Center for Puppetry Arts":"$26 adult / $20 child",
  "Chattahoochee Nature Center":"$20 adult / $14 child 3-12","Delta Flight Museum":"Free",
  "Museum of Illusions":"$29 adult / $24 child 5-12","East Palisades Bamboo Forest":"Free",
  "Doll's Head Trail":"Free","Cascade Springs Nature Preserve":"Free",
  "Margaritaville at Lanier — Fins Up":"From $44.99 (gate $59.99 age 8+)",
  "Great Wolf Lodge (LaGrange)":"Day pass from $40; room from $94",
  // Louisville
  "Louisville Mega Cavern":"$19.99/person tram tour","Kentucky Science Center":"$24/person (movie extra)",
  "Louisville Zoo & HerpAquarium":"$18 adult / $13 child (3-11) +$7 park",
  "Kentucky Kingdom & Hurricane Bay":"~$40/person (dynamic)","Louisville Slugger Museum":"$16 adult / $9 youth (6-12)",
  "Waterfront Park + Big Four Bridge":"Free","Falls of the Ohio State Park":"$9 adult / $7 child +$2 parking",
  "Bernheim Forest (Forest Giants)":"Free wkday / $15/vehicle wkend","Louisville Nature Center":"Free",
  "Parklands of Floyds Fork":"Free","NuLu District":"Free","Frazier History Museum":"$16 adult / $10 child (5-17)",
  // Cincinnati
  "Cincinnati Zoo":"$17.50-26 adult / $11.50-20 child (3-12)","Newport Aquarium":"~$32 adult / ~$25 child (2-12)",
  "Cincinnati Museum Center":"$22.50 adult / $15.50 child (3-12)","Great Wolf Lodge (Mason)":"Day pass from $40",
  "Smale Riverfront Park":"Free","Findlay Market & OTR":"Free","Newport on the Levee / Box Park":"Free",
  "Krohn Conservatory":"$7 adult / $5 youth; $10/$7 shows","American Sign Museum":"$20 adult / free under 13",
  "Jungle Jim's International Market":"Free","Loveland Castle":"$5 adult / $3 child (12 & under)",
  "Cincinnati Nature Center — Rowe Woods":"$10 adult / $6 child","Trammel Fossil Park":"Free",
  "Pyramid Hill Sculpture Park":"$10 adult / $5 child (6-12)",
  // Columbus
  "COSI":"$20 adult / $15 child (2-12)","Columbus Zoo and Aquarium":"$33 adult / $27 child (3-9) online",
  "Zoombezi Bay":"$35 adult / $32 child (3-9) online","The Wilds":"$45/person open-air safari",
  "Franklin Park Conservatory":"$14 adult / $7 child (3-17)","North Market":"Free",
  "German Village & The Book Loft":"Free","Topiary Park":"Free","Otherworld":"$30 adult / $24 child (3-12)",
  "Scioto Mile / Riverfront":"Free","Slate Run Living Historical Farm":"Free","Billy Ireland Cartoon Library":"Free",
  // Indianapolis
  "Children's Museum of Indianapolis":"$24+ adult / $19+ child 2-17 (dynamic)",
  "Indianapolis Zoo":"$15-34 adult / $15-32 child 2-12 (dynamic)","Newfields / IMA":"$20 adult / $13 child 6-17",
  "Conner Prairie":"$24 adult / $18 youth (2-12) online","Indy Motor Speedway Museum":"$25 adult / $18 kids 6-16",
  "Eagle Creek Park":"$6/vehicle IN, $8 non-resident","Canal Walk & White River SP":"Free","Mass Ave":"Free",
  "Garfield Park Conservatory":"$4/person, $14 family","Holliday Park & Ruins":"Free",
  "Fort Harrison State Park":"$7/vehicle IN, $15 out-of-state","Indy Island Aquatic Center":"$6 adult / $3 child",
  "Big Splash Adventure":"$29.95 over 46in / $24.95 under","City Market Catacombs":"Closed 2026-27 (construction)",
  "Teeny Statue of Liberty Museum":"50¢ (free w/ donation)",
  // St. Louis
  "City Museum":"$22 general (2 & under free)","Saint Louis Zoo":"Free (parking $15)",
  "The Magic House":"$14/person (under 1 free)","Gateway Arch":"$19-23 adult / $14-18 child (3-15)",
  "Saint Louis Science Center":"Free (add-ons extra)","Missouri Botanical — Children's Garden":"$5 child (3-12), 13+ free",
  "St. Louis Aquarium at Union Station":"$25 adult / $18 child (3-12)","Grant's Farm":"Free ($18/vehicle parking)",
  "Forest Park":"Free","Ted Drewes Frozen Custard":"~$5-8/treat","Turtle Playground":"Free",
  "Sophia Sachs Butterfly House":"$6 adult / $4 child (3-12)","Purina Farms":"Free","World Bird Sanctuary":"$5/person",
  "Suson Park":"Free","Cahokia Mounds":"Free (donation)","The Delmar Loop":"Free",
  "Raging Rivers WaterPark":"$30 adult / $26 child (48\" & under)","City Foundry STL":"Free",
  // Savannah
  "Tybee Island Marine Science Center":"$15 adult / $12 child (5-12)","UGA Marine Ed Center & Aquarium":"$6 adult / $3 child (3-12)",
  "Oatland Island Wildlife Center":"$7 adult / $5 child (4-17)","Savannah Children's Museum":"$12/person, under 18mo free",
  "Tybee Island Light Station":"$12/person, 4 & under free","Dolphin Adventure Boat Tour":"$34.95 adult / $22.95 child (≤12)",
  "Tybee Island Beach & Pier":"Free; parking $4/hr or $25/day","Forsyth Park":"Free",
  "Wormsloe Historic Site":"$12 adult / $5.75 child (6-17)","Pin Point Heritage Museum":"$9 adult / $5 child (2-12)",
  "River Street":"Free","Leopold's Ice Cream":"~$6/scoop","Savannah Bananas":"From $35/ticket (if available)",
  "Crab Shack at Chimney Creek":"Entrees ~$15-30",
  // Charleston
  "South Carolina Aquarium":"$30 adult / $23 child (3-12)","Patriots Point / USS Yorktown":"$24 adult / $16 child (6-11)",
  "Isle of Palms":"Free; parking $15-25/vehicle","Folly Beach":"Free; parking $2.50/hr",
  "Sullivan's Island + Fort Moultrie":"Beach free; Fort $10 (16+), kids free","Splash Zone Waterpark":"$16 adult / $14 child +$2 entry",
  "Whirlin' Waters":"$25.99 / $20.99 under 48\"","Children's Museum of the Lowcountry":"$13 online / $15 door",
  "Charles Towne Landing":"$12 adult / $7 youth (6-15)","Center for Birds of Prey":"$18 adult / $12 child (6-18)",
  "Angel Oak Tree":"Free","Shem Creek Park & Boardwalk":"Free","Cypress Gardens":"$10 adult / $5 child (6-17)",
  "Joe Riley Waterfront Park":"Free",
  // St. Augustine
  "St. Augustine Alligator Farm":"$36 adult / $21 child (3-11)","Castillo de San Marcos":"$15 adult / free under 16",
  "Pirate & Treasure Museum":"$19 adult / $10 child (5-12)","Colonial Quarter":"$16 adult / $10 child (5-12)",
  "Fountain of Youth Park":"$23 adult / $10 child (6-12)","St. Augustine Lighthouse":"$15 adult / $13 child (4-12)",
  "Anastasia State Park":"$8/vehicle","St. Augustine Beach":"Free; ~$10/day parking",
  "Marineland Dolphin Adventure":"$20/person; under 5 free","Whetstone Chocolates Tour":"~$11/person",
  "Fossil Shark Tooth Hunting":"check site","GTM Estuary Kayak Tours":"$45 adult / $35 child (6-12)",
  "The Old Jail":"$17 adult / $9 child (4-12)",
  // Orlando
  "Universal's Volcano Bay":"~$80-110/person (dynamic)","Aquatica":"~$47-75/person (dynamic)",
  "Discovery Cove":"~$200-280/person day resort","LEGOLAND Florida + Water Park":"~$70-137/person (dynamic)",
  "Peppa Pig Theme Park":"$29+ kids online, $64 gate","Gatorland":"$32 adult / $22 child (3-12)",
  "Blue Spring State Park":"$6/vehicle","Wekiwa Springs State Park":"$6/vehicle (reserv. req'd)",
  // Tampa / St. Pete
  "Busch Gardens Tampa Bay":"~$170 gate, ~$78+ online","Mote SEA":"~$41 adult (plan-ahead varies)",
  "The Florida Aquarium":"$36.50 adult / $31.50 child (3-11)","Clearwater Marine Aquarium":"$41.95 adult / $32.95 child (3-11)",
  "Glazer Children's Museum":"$24.95/person, under 1 free","Great Explorations":"$12 adult / $15 child (1-17)",
  "Sunken Gardens":"$18 adult / $8 child (2-12)",
  // Nature Coast
  "Swim with Manatees — Three Sisters Springs":"~$65-80/person tour","Weeki Wachee Springs":"$13 adult / $8 child (6-12)",
  "Giraffe Ranch":"~$29 adult / $24 child (2-11)","Ellie Schiller Homosassa Springs":"$13 adult / $5 child (6-12)",
  "Rainbow Springs State Park":"$2/person","Silver Springs State Park":"$2/person",
  "Devil's Den Prehistoric Spring":"$15 wkday / $20 wknd/person",
  // Chattanooga
  "Tennessee Aquarium — River Journey":"$39.95 adult / $29.95 child 5-17 (both bldgs)",
  "Tennessee Aquarium — Ocean Journey":"$39.95 adult / $29.95 child 5-17 (both bldgs)",
  "Creative Discovery Museum":"$19.95/person, under 2 free","Rock City Gardens":"$43-45 adult / $33-35 child 3-12",
  "Ruby Falls":"$28.95 adult / $18.95 child 4-12","Lookout Mountain Incline Railway":"$17.60 adult / $8 child 3-12 round trip",
  "Coolidge Park":"Free","Chattanooga Zoo":"$15.95 adult / $12.95 child 3-12",
  "TN Valley Railroad Museum":"From $25 adult / $16 child 2-12","High Point Climbing":"$24 adult / $22 child 10-under (+gear)",
  "Lake Winnie & SOAKya":"From $33.95/person combo","Reflection Riding":"Free (donations welcome)",
  "Raccoon Mountain Caverns":"$28.99 adult / $18.99 child 4-12","Bluff View Art District":"Free",
  "Walnut Street Bridge":"Free","Chattanooga Choo Choo":"Free (campus/grounds)",
  // Nashville
  "Nashville Zoo at Grassmere":"$16-26 adult / -$4 youth 2-12; under 2 free","Adventure Science Center":"$22 adult / $18 child 2-12; under 2 free",
  "SoundWaves at Opryland":"From $62 non-peak/$85 peak (resort guests)","Cheekwood Estate & Gardens":"$20-26 adult / $13-19 youth 3-17",
  "The Parthenon":"$10 adult / $8 child 4-17 (closed thru mid-Jul)","Nashville Shores + Treetop":"Waterpark from ~$52/person; Treetop extra",
  "Wave Country":"$12 adult / $10 child 3-12; under 2 free","Lane Motor Museum":"$15 adult / $3 youth 6-17; under 5 free",
  "Bicentennial Mall + Farmers' Market":"Free","Marathon Village":"Free",
  "Adventureworks Ziplines":"$65.90 adult / $49.90 youth 8-17","Fort Nashborough":"Free",
  "Two Rivers & Shelby splash pads":"Free",
  // Huntsville
  "U.S. Space & Rocket Center / Space Camp":"$30 adult / $20 child","Cook Museum of Natural Science":"$20 adult / $15 child 3-14",
  "Huntsville Botanical Garden":"$20 adult / $13 child 3-15","EarlyWorks Children's Museum":"$12 age 4+ / $7 ages 1-3",
  "Point Mallard Water Park":"$28/person (+$9 online fee)","Lowe Mill ARTS":"Free",
  "Monte Sano State Park":"$5 adult / $2 child 4-11","Burritt on the Mountain":"$12 adult / $8 child & student",
  "Campus No. 805":"Free (venue)","INTUITIVE Planetarium":"Incl. with $30 gen. admission",
  // Knoxville
  "Zoo Knoxville":"$26.95 adult / $21.95 child 3-12 & 65+ (+$2 gate)","Ijams Nature Center & Meads Quarry":"Free (parking $5/day)",
  "Muse Knoxville":"$12/person (under 1 free)","World's Fair Park & Sunsphere":"Park free; Sunsphere $10 adult / $5 child 12&under",
  "Market Square":"Free","Urban Wilderness":"Free","Fort Dickerson Quarry":"Free",
  "Knoxville Botanical Garden":"Free (donation)","Three Rivers Rambler":"$60 adult / $35 child 5-14",
  "Soaky Mountain Waterpark":"From $54.99 (over 42in) / $43.99 under 42in online","Ripley's Aquarium of the Smokies":"~$50 adult / $32 child 6-11 (under 5 free)",
  "Great Smoky Mountains NP":"Free entry; $5/vehicle parking tag",
  // Washington DC
  "Nat'l Air & Space Museum":"Free (timed entry pass)","Nat'l Museum of Natural History":"Free",
  "Smithsonian's National Zoo":"Free (timed pass; parking extra)","Planet Word Museum":"Free ($15 suggested donation)",
  "National Postal Museum":"Free","U.S. Botanic Garden":"Free","Rock Creek Park Nature Center":"Free",
  "Gravelly Point Park":"Free","Kayak to Roosevelt Island":"$16/hr single, $22/hr tandem",
  "Tudor Place (Georgetown)":"$10 adult / $8 senior","Kenilworth Aquatic Gardens":"Free",
  "National Aquarium (Baltimore)":"$49.95 adult / $39.95 youth 5-20","Great Waves Waterpark":"$18.50-20.50 adult / $15-17 child (non-res)",
  "Volcano Island Waterpark":"$12-16 adult / $9.50-12 child under 48\"",
  // Williamsburg
  "Colonial Williamsburg":"$37.50 adult / $10 youth 6-12","Busch Gardens Williamsburg":"From $59.99/person (promo)",
  "Water Country USA":"From $54.99/person","Great Wolf Lodge (Williamsburg)":"Day pass from $40; rooms ~$300+/night",
  "Jamestown Settlement":"$30 adult / $15 child 6-12","Amer. Revolution Museum at Yorktown":"$18 adult / $9 child 6-12",
  "Virginia Living Museum":"$22.95 adult / kids under 2 free","Yorktown Beach & Riverwalk":"Free",
  "York River State Park":"$5/vehicle weekday (more weekends)","Waller Mill Park":"$2/vehicle",
  "Freedom Park & Botanical Garden":"Free","William & Mary campus":"Free",
  "Merchants Square dining":"Free to stroll; varies by restaurant","Jamestown-Scotland Ferry":"Free",
  "Sweethaven Lavender Farm":"$5 Tue-Fri / $7 Sat",
  // Pittsburgh
  "Carnegie / Kamin Science Center":"$24.95 adult / $16.95 child 3-12","Children's Museum of Pittsburgh":"$21 adult / $19 child 2-18",
  "Carnegie Museum of Natural History":"$25 adult / $13 child 3-18","National Aviary":"$20.95 adult / $17.95 child 2-12",
  "Pittsburgh Zoo & Aquarium":"$30 adult / $25 child 2-13 (online)","Duquesne Incline":"$5 adult / $2.50 child 6-11 round trip",
  "Phipps Conservatory":"$21.95 adult / $13.95 child 2-18","Randyland":"Free",
  "Heinz History Center":"$20 adult / free kids 17 & under","Kennywood":"From $39.99/person online",
  "Idlewild & SoakZone":"From $39.99/person online","Sandcastle Waterpark":"From $29.99 (reg $59.99)",
  "Moonshot Museum":"$10 adult / $5 child 3-17",
  // Philadelphia
  "The Franklin Institute":"$29 adult / $23 child 3-12","Please Touch Museum":"$24/person, under 1 free",
  "Philadelphia Zoo":"From ~$28/person, varies by day","Adventure Aquarium (Camden)":"From $27.99, dynamic (age 2+)",
  "Liberty Bell & Independence Hall":"Free","Reading Terminal Market":"Free entry",
  "Sesame Place":"From $110.99 online (age 2+)","Franklin Square":"Free; mini golf $15 adult/$12 child",
  "Spruce Street Harbor Park":"Free","Elmwood Park Zoo":"$15.95/person, under 3 free",
  "Morris Arboretum":"$20 adult / $10 child 3-17","Penn Museum":"$23 adult / $14 youth 6-17",
  "Eastern State Penitentiary":"$21 adult / $17 youth 7-17 online",
  // Charlotte
  "Discovery Place Science":"$23.96 adult / $18.97 child 2-13 online","U.S. National Whitewater Center":"Free trails; day pass $79 ($69 age 9-under); $13 parking",
  "Carowinds":"Gate $80; online from ~$35; parking extra","SEA LIFE Charlotte-Concord Aquarium":"From $14 adult / $12 child 2-12 online",
  "Carolina Raptor Center":"$16 adult / $12 child 3-13; under 3 free","Daniel Stowe Botanical Garden":"$16.95 adult / $9.95 child 2-12",
  "ImaginOn":"Free","Discovery Place Kids-Huntersville":"$14/person (online $11); under 1 free",
  "Reed Gold Mine":"Free; gold panning $5/person","Schiele Museum of Natural History & Planetarium":"$7 adult / $6 youth 4-18; planetarium +$5",
  "Charlotte Museum of Nature":"check site (reopening late summer 2026)","Charlotte Museum of History":"$10 adult / $7 child 6-17; under 6 free",
  "Ray's Splash Planet":"~$15/day non-resident adult; less for kids","Latta Nature Preserve & Quest Nature Center":"Free (Quest center free)",
  "Freedom Park & Little Sugar Creek Greenway":"Free",
  // Gatlinburg / Pigeon Forge
  "Dollywood":"$94.99+ adult, less kids 4-9 (dynamic)","Dollywood's Splash Country":"From ~$74.99 (dynamic); 3 & under free",
  "Anakeesta":"$39.99 adult / $27.99 kids 4-11","Gatlinburg SkyLift Park & SkyBridge":"$34.95 adult / $15.95 kids 6-11; under 6 free",
  "WonderWorks":"From ~$38.69/person; 0-3 free","Ober Mountain":"Fun Pass from $39 (advance); tram varies",
  "Cades Cove Loop":"Free; $5/day parking tag","Clingmans Dome (Kuwohi)":"Free; $5/day parking tag",
  "Sugarlands Visitor Center & Salamander Creeks":"Free (Junior Ranger booklet ~$2.50)","The Island in Pigeon Forge":"Free entry; Wheel $16.99 adult / $11.99 kids",
  "Smoky Mountain Alpine Coaster":"~$18 adult; kids' discounts","Titanic Museum Attraction":"$34.99 adult / $14.99 kids 5-12",
  "Ripley's Believe It or Not! Odditorium":"$29.99 adult / $16.99 kids 6-11","Dollywood's DreamMore Resort":"~$400+/night summer; TimeSaver perks",
  // NC Triangle (Raleigh–Durham)
  "NC Museum of Natural Sciences":"Free","Museum of Life and Science":"$23 adult / $18 child 3-12",
  "Duke Lemur Center":"$17 adult / $15 child; reserve ahead","Marbles Kids Museum":"From $9/person; under 1 free",
  "Morehead Planetarium & Science Center":"~$15-17 incl. show; $2 off summer wkdays","NC Museum of History":"Free",
  "Sarah P. Duke Gardens":"Free (parking ~$2/hr)","NC Museum of Art Park":"Free (park & collection)",
  "Pullen Park":"Free entry; rides $2 each","NC Botanical Garden":"Free","JC Raulston Arboretum":"Free",
  "Durham Bulls Baseball":"From $4; ~$12-16 typical","Frankie's Fun Park":"Attractions from $11 each",
  "William B. Umstead State Park":"Free","American Tobacco Trail":"Free","Jordan Lake State Recreation Area":"~$7/vehicle entry"
};

// [name, city, tags, type, age, why]
let A=[
["Georgia Aquarium","Atlanta","an,wa,sc","SIG","both","Top-5 world aquarium — whale sharks, belugas, otters; summer Glow Nights."],
["Zoo Atlanta","Atlanta","an,na","SIG","both","1,000+ animals incl. a huge gorilla troop; walkable, any season."],
["Fernbank Museum","Atlanta","sc,na,hi","SIG","both","World's largest dinosaur + hands-on NatureQuest + 2 mi of forest trails."],
["Stone Mountain Park","Atlanta","na,hi,tp","SIG","both","Skyride, Dinosaur Explore, railroad; free Pre-K pass summer '26."],
["World of Coca-Cola","Atlanta","fo,sc","SOL","both","Scent Discovery + mix-your-own tasting room; pairs with the aquarium."],
["Children's Museum of Atlanta","Atlanta","sc","SOL","little","3-story climber + water play; best weighted to the Kindergartner."],
["LEGO Discovery Center","Atlanta","sc,tp","SOL","both","Indoor LEGO rides & build zones; great rainy-day option."],
["Six Flags White Water","Atlanta","wa","SOL","both","20+ slides; the go-to outdoor water park for a hot day."],
["BeltLine: Ponce City + Krog St Markets","Atlanta","fo,wk","SOL","both","Two food halls on a flat, stroller-friendly trail — ramen to Jeni's."],
["Center for Puppetry Arts","Atlanta","hi,sc","GEM","both","Largest US puppetry org + a Jim Henson wing & build-a-puppet workshops."],
["Chattahoochee Nature Center","Atlanta","na,an","GEM","both","River boardwalk, native wildlife, butterfly & native-plant gardens."],
["Delta Flight Museum","Atlanta","sc,hi","GEM","both","Sit in cockpits and walk on the wing of a 747; strong for a curious 9-yr-old."],
["Museum of Illusions","Atlanta","sc","GEM","both","Illusion rooms & brain teasers — quick, giggly, photogenic filler."],
["East Palisades Bamboo Forest","Atlanta","na","GEM","older","A hidden riverside bamboo grove; ~4 mi loop suits the older girl."],
["Doll's Head Trail","Atlanta","na,hi","OFF","older","Free folk-art trail of salvaged doll heads through an old brick quarry."],
["Cascade Springs Nature Preserve","Atlanta","na,hi","OFF","both","Waterfall trails + preserved Civil War trenches; a quiet SW-Atlanta pocket."],
["Margaritaville at Lanier — Fins Up","Atlanta","wa,na","SOL","both","Lakeside water park w/ a water coaster + beach; a resort stay ~45 min N."],
["Great Wolf Lodge (LaGrange)","Atlanta","wa","SOL","both","84° indoor water park; all-weather overnight toward the Florida route."],

["Tennessee Aquarium — River Journey","Chattanooga","an,na,sc","SIG","both","Freshwater building: otters, turtles, a walk-through forest."],
["Tennessee Aquarium — Ocean Journey","Chattanooga","an,wa,sc","SIG","both","Second building — sharks overhead + penguins. Buy the combo, do both."],
["Creative Discovery Museum","Chattanooga","sc","SIG","both","Two-story water-play zone + simulated fossil dig; splits both ages."],
["Rock City Gardens","Chattanooga","na,hi","SIG","both","Swinging bridge, gnome-filled Fairyland Caverns, See-7-States."],
["Ruby Falls","Chattanooga","na","SIG","both","145-ft underground waterfall — tallest public underground falls in the US."],
["Lookout Mountain Incline Railway","Chattanooga","hi,na","SOL","both","One of the world's steepest passenger railways."],
["Coolidge Park","Chattanooga","wa,na,wk","SOL","both","Free splash fountains + a restored 100-year-old carousel."],
["Chattanooga Zoo","Chattanooga","an","SOL","both","Small, walkable zoo you can finish in a couple hours."],
["TN Valley Railroad Museum","Chattanooga","hi,na","SOL","older","Ride restored vintage trains through the Missionary Ridge tunnel."],
["High Point Climbing","Chattanooga","sc","SOL","both","Indoor climbing with a Kids Zone; a great energy-burner."],
["Lake Winnie & SOAKya","Chattanooga","tp,wa","SOL","both","Classic amusement park + attached water park (summer)."],
["Reflection Riding","Chattanooga","na,an","GEM","both","317-acre preserve with red wolves, raptors & 15 mi of trails."],
["Raccoon Mountain Caverns","Chattanooga","na","GEM","both","58° year-round cave tours + playground & gem panning."],
["Bluff View Art District","Chattanooga","fo,wk,na","GEM","both","Riverside galleries, sculpture garden & Clumpies ice cream."],
["Walnut Street Bridge","Chattanooga","wk,na","SOL","both","One of the world's longest pedestrian bridges to Coolidge Park."],
["Chattanooga Choo Choo","Chattanooga","fo,hi,wk","OFF","both","Historic rail station turned dining & lodging hub."],

["Nashville Zoo at Grassmere","Nashville","an,na","SIG","both","Kangaroo walk-through + one of the largest wooden playgrounds in the US."],
["Adventure Science Center","Nashville","sc","SIG","both","Hands-on physics/space/body exhibits + a planetarium."],
["SoundWaves at Opryland","Nashville","wa","SIG","both","Upscale 4-acre indoor/outdoor water park (needs a resort package)."],
["Cheekwood Estate & Gardens","Nashville","na,hi","SIG","both","Storybook TRAINS! trail & children's garden + sculpture trails."],
["The Parthenon","Nashville","hi","SOL","older","Full-scale replica w/ 42-ft gilded Athena. <span class='warn'>Closed thru mid-Jul '26.</span>"],
["Nashville Shores + Treetop","Nashville","wa,na","SOL","both","Lakeside water park + an aerial ropes course for the older girl."],
["Wave Country","Nashville","wa","SOL","both","City wave pool, flumes & kiddie slide; cheap (summer)."],
["Lane Motor Museum","Nashville","sc,hi","GEM","both","World's weirdest cars + summer Fun Days with free vehicle rides."],
["Bicentennial Mall + Farmers' Market","Nashville","hi,fo,wk","GEM","both","Free 19-acre park beside a food hall with 20+ international eateries."],
["Marathon Village","Nashville","hi,fo,wk","OFF","both","Restored 1900s auto plant turned artsy village with shops & food."],
["Adventureworks Ziplines","Nashville","na","OFF","older","Old-growth-forest zipline tours by the Harpeth River."],
["Fort Nashborough","Nashville","hi,wk","GEM","both","Free reconstructed 1780 frontier fort on the Cumberland."],
["Two Rivers & Shelby splash pads","Nashville","wa,na","GEM","little","Free seasonal splash pads locals use to wear out young kids."],

["U.S. Space & Rocket Center / Space Camp","Huntsville","sc,hi","SIG","both","Real Apollo/Saturn V rockets + simulators; a Space Camp day for the older girl."],
["Cook Museum of Natural Science","Huntsville","sc,an,na","SIG","both","Ultra-modern hands-on: live saltwater tanks, jellyfish, gators + splash play. (Decatur, 25 min)"],
["Huntsville Botanical Garden","Huntsville","na,an","SOL","both","The country's largest open-air butterfly house + a miniature train village."],
["EarlyWorks Children's Museum","Huntsville","sc,hi","SOL","little","Talking tree, kid-sized cafe, build-and-climb zones; ideal for K."],
["Point Mallard Water Park","Huntsville","wa","SOL","both","One of America's first wave pools + slides & sandy beach. (Decatur, summer)"],
["Lowe Mill ARTS","Huntsville","wk,fo","GEM","both","Largest US privately-owned arts center — 200+ studios + quirky food."],
["Monte Sano State Park","Huntsville","na","GEM","both","Mountaintop trails, big playground, Japanese garden + planetarium."],
["Burritt on the Mountain","Huntsville","hi,an,na","GEM","both","Living-history farm with animals & sweeping ridge-top views."],
["Campus No. 805","Huntsville","fo,wk","OFF","older","Old high school reborn as a food/arcade/brewery complex."],
["INTUITIVE Planetarium","Huntsville","sc","SOL","both","Full-dome astronomy shows; an easy AC add-on to your Rocket Center day."],

["Zoo Knoxville","Knoxville","an,wa,na","SIG","both","Gorillas, elephants & giraffes, animatronic dinos + a safari splash pad."],
["Ijams Nature Center & Meads Quarry","Knoxville","na,wa,an,wk","SIG","both","Nature playscape, live animals + kayak/paddleboard on the quarry lake."],
["Muse Knoxville","Knoxville","sc","SOL","little","Hands-on children's museum with a planetarium; ideal for the Kindergartner."],
["World's Fair Park & Sunsphere","Knoxville","wa,hi,wk","SIG","both","Free park with the city's biggest splash pad + a 360° Sunsphere deck."],
["Market Square","Knoxville","fo,wk,wa","SOL","both","Historic pedestrian square: restaurants, splash fountains & live music."],
["Urban Wilderness","Knoxville","na,wk","GEM","both","1,500 acres & 60+ mi of trails with adventure playgrounds, inside the city."],
["Fort Dickerson Quarry","Knoxville","wa,na","OFF","both","A stunning turquoise swimming-hole quarry minutes from downtown."],
["Knoxville Botanical Garden","Knoxville","na,wk","GEM","little","Free 44-acre garden with a cave-like Bamboo Forest & Secret Garden."],
["Three Rivers Rambler","Knoxville","hi,na","SOL","both","~90-min heritage train ride along the Tennessee River."],
["Soaky Mountain Waterpark","Knoxville","wa,tp","SIG","both","50-acre park, 20+ slides + wave attractions. (Sevierville, ~45 min)"],
["Ripley's Aquarium of the Smokies","Knoxville","an,wa","SIG","both","350+ species with a shark tunnel. (Gatlinburg, ~50 min)"],
["Great Smoky Mountains NP","Knoxville","na","SIG","both","Easy waterfall hikes, wildlife & river play just south of the city."],

["Louisville Mega Cavern","Louisville","na,sc,hi","SIG","both","Underground tram for all ages + a 6-line underground zipline (age 7+)."],
["Kentucky Science Center","Louisville","sc","SIG","both","3 floors of hands-on + a toddler zone + a 4-story digital theater."],
["Louisville Zoo & HerpAquarium","Louisville","an,na","SIG","both","Full zoo + 100+ herp species incl. a rare 9.5-ft albino gator."],
["Kentucky Kingdom & Hurricane Bay","Louisville","wa,tp","SIG","both","Theme + water park with a 750k-gal wave pool & 4-story playground. (summer)"],
["Louisville Slugger Museum","Louisville","hi,sc","SOL","both","Working bat-factory tour, batting cages + a free mini-bat souvenir."],
["Waterfront Park + Big Four Bridge","Louisville","na,wk","SOL","both","Free riverfront playgrounds & splash pad; walk the bridge into Indiana."],
["Falls of the Ohio State Park","Louisville","na,sc,hi","GEM","both","Walk 390-million-year-old fossil beds + a Fossil Challenge scavenger hunt."],
["Bernheim Forest (Forest Giants)","Louisville","na","GEM","both","16,000 acres with giant troll sculptures + a natural playground."],
["Louisville Nature Center","Louisville","na,an","GEM","both","Free urban forest with a Nature Play Area, bird blind & turtle programs."],
["Parklands of Floyds Fork","Louisville","na,wa","OFF","both","Creek-following parks with wading spots & canoeing — where locals go."],
["NuLu District","Louisville","fo,wk","SOL","both","Walkable blocks of interesting eats + an indoor food hall."],
["Frazier History Museum","Louisville","hi","SOL","older","Family-friendly history + the official start of the Bourbon Trail."],

["Cincinnati Zoo","Cincinnati","an,na","SIG","both","Home of Fiona the hippo + a top-ranked botanical garden."],
["Newport Aquarium","Cincinnati","an,wa,sc","SIG","both","Walk the 75-ft Shark Bridge rope walk over sharks; penguins + acrylic tunnels."],
["Cincinnati Museum Center","Cincinnati","sc,hi","SIG","both","Three museums in an Art Deco station — top-10 children's museum + natural history."],
["Great Wolf Lodge (Mason)","Cincinnati","wa,tp","SIG","both","50,000-sq-ft indoor water park (84°) + arcade & MagiQuest."],
["Smale Riverfront Park","Cincinnati","na,wa,wk","SOL","both","Free riverfront fountains, adventure playground & carousel."],
["Findlay Market & OTR","Cincinnati","fo,wk,hi","SOL","both","Ohio's oldest market via the free streetcar through historic Over-the-Rhine."],
["Newport on the Levee / Box Park","Cincinnati","fo,wk","SOL","both","Open-air shipping-container food park next to the aquarium."],
["Krohn Conservatory","Cincinnati","na","SOL","both","Art Deco glasshouse with 3,500 plants + a seasonal butterfly show."],
["American Sign Museum","Cincinnati","hi,sc","GEM","both","Immersive neon 'street' + live Saturday neon-making demos."],
["Jungle Jim's International Market","Cincinnati","fo","OFF","both","A 200,000-sq-ft 'theme park of food' — animatronics, a fire truck; free & weird."],
["Loveland Castle","Cincinnati","hi,na","GEM","both","A real castle hand-built by one man over 50 years; kids play knights."],
["Cincinnati Nature Center — Rowe Woods","Cincinnati","na","GEM","little","Free Nature PlayScape for unstructured play — logs, boulders, water."],
["Trammel Fossil Park","Cincinnati","sc,na","OFF","older","Free park where kids dig real fossils and keep what they find."],
["Pyramid Hill Sculpture Park","Cincinnati","na,hi","OFF","both","300+ acres of large-scale sculpture + a kids' scavenger hunt."],

["COSI","Columbus","sc,hi","SIG","both","300k sq ft of hands-on science + a dinosaur gallery with a T. rex cast."],
["Columbus Zoo and Aquarium","Columbus","an,wa","SIG","both","Jack Hanna's world-class zoo + a big aquarium & manatee coast."],
["Zoombezi Bay","Columbus","wa,tp","SIG","both","Award-winning water park at the zoo — wave pool + Cyclone slides. (summer)"],
["The Wilds","Columbus","an,na","OFF","both","A ~10,000-acre open-air safari bus among rhinos & giraffes. (~90 min, book ahead)"],
["Franklin Park Conservatory","Columbus","na,sc","SOL","both","Glass biomes + free-flying Blooms & Butterflies + Chihuly glass."],
["North Market","Columbus","fo,wk","SOL","both","Historic 1876 food hall with ~35 vendors; Jeni's Ice Cream originated here."],
["German Village & The Book Loft","Columbus","wk,fo","GEM","both","Cobblestone district + a bookstore of 32 winding rooms to get lost in."],
["Topiary Park","Columbus","na,hi","GEM","both","The world's only topiary of a painting — Seurat in living shrubs. Free."],
["Otherworld","Columbus","sc","OFF","both","32,000 sq ft of immersive art with 40+ interactive scenes & secret passages."],
["Scioto Mile / Riverfront","Columbus","na,wk,wa","SOL","both","145 riverfront acres with an interactive fountain kids run through."],
["Slate Run Living Historical Farm","Columbus","hi,an,na","GEM","both","Working 1880s farm with costumed staff & hands-on chores. Free."],
["Billy Ireland Cartoon Library","Columbus","hi","GEM","older","World's largest cartoon-art collection; a free, niche gem for the 4th-grader."],

["Children's Museum of Indianapolis","Indianapolis","sc,hi,na","SIG","both","World's largest children's museum; Dinosphere with real fossil labs."],
["Indianapolis Zoo","Indianapolis","an,wa,na","SIG","both","A rare zoo/aquarium/botanical combo with dolphins & orangutans."],
["Newfields / IMA","Indianapolis","na,hi,wk","SIG","both","A whimsical Fairy Trail for the 5-yr-old + WinterLights in season."],
["Conner Prairie","Indianapolis","hi,an,na","SIG","both","Top living-history museum — soar in an 1859 tethered balloon; farm animals."],
["Indy Motor Speedway Museum","Indianapolis","sc,hi","SOL","older","Freshly reopened ($61M reno): race sims, pit-stop practice + a track lap."],
["Eagle Creek Park","Indianapolis","na,wa,an","SOL","both","Indiana's largest park with a sandy swim beach, nature centers & eagles."],
["Canal Walk & White River SP","Indianapolis","wk,wa,fo","SOL","both","3-mi waterside loop with pedal boats + the Colts Canal Playground."],
["Mass Ave","Indianapolis","wk,fo","SOL","both","Walkable arts-and-dining strip; kids pour custom candles at Penn & Beech."],
["Garfield Park Conservatory","Indianapolis","na","GEM","both","10,000-sq-ft tropical glasshouse with waterfalls + a Children's Garden."],
["Holliday Park & Ruins","Indianapolis","na,hi","GEM","both","A reimagined playground + the surreal limestone 'Ruins' water table."],
["Fort Harrison State Park","Indianapolis","na","GEM","both","Uncrowded former military post; a flat, stroller-friendly paved trail."],
["Indy Island Aquatic Center","Indianapolis","wa","SOL","little","Year-round indoor water park w/ zero-depth entry; a rainy-day fallback."],
["Big Splash Adventure","Indianapolis","wa,tp","OFF","both","Indoor waterpark resort with a lazy river + pirate play. (French Lick, ~1h)"],
["City Market Catacombs","Indianapolis","hi","OFF","older","Saturday-only guided tours of eerie passages beneath the market."],
["Teeny Statue of Liberty Museum","Indianapolis","hi","OFF","older","700+ Statue-of-Liberty oddities for 50¢ — the definition of off-guidebook."],

["City Museum","St. Louis","sc,na,wk","SIG","both","A 600,000-sq-ft warehouse turned wild playground: caves + 30+ slides. Plan 3-4 hrs."],
["Saint Louis Zoo","St. Louis","an,na,wk","SIG","both","Consistently a top US zoo — and FREE admission."],
["The Magic House","St. Louis","sc","SIG","both","Beloved hands-on museum + a MADE maker-space annex for the older girl."],
["Gateway Arch","St. Louis","hi,wk","SIG","both","Ride the tram 630 ft up + an excellent underground museum. Book ahead."],
["Saint Louis Science Center","St. Louis","sc","SOL","both","FREE hands-on exhibits + planetarium + OMNIMAX."],
["Missouri Botanical — Children's Garden","St. Louis","na,wa","SOL","both","Kids work locks & dams, cross a rope bridge & cool off in a limestone cave."],
["St. Louis Aquarium at Union Station","St. Louis","an,wa","SOL","both","13,000+ animals + a wheel, carousel, mirror maze & ropes course."],
["Grant's Farm","St. Louis","an,na","SOL","both","Free animal park — tram through pastures, goat-feeding & Clydesdales."],
["Forest Park","St. Louis","na,hi,wk","SOL","both","Bigger than Central Park; hub for the free zoo, science center & art museum."],
["Ted Drewes Frozen Custard","St. Louis","fo","SOL","both","Iconic Route 66 'concrete' — so thick they hand it to you upside-down."],
["Turtle Playground","St. Louis","na,wk","GEM","little","Free giant climbable turtles by City Museum's creator — pair the two."],
["Sophia Sachs Butterfly House","St. Louis","na,an","GEM","both","A tropical conservatory where free-flying butterflies land on you."],
["Purina Farms","St. Louis","an,na","GEM","both","FREE hands-on farm + the Incredible Dog Show. (Apr–Oct)"],
["World Bird Sanctuary","St. Louis","an,na","GEM","both","305+ acres, 200+ birds — meet eagles, parrots & emus up close."],
["Suson Park","St. Louis","an,na","GEM","little","Free working animal farm + catch-and-release fishing + playground."],
["Cahokia Mounds","St. Louis","hi,na","OFF","older","UNESCO site — largest pre-Columbian city N of Mexico; climb Monks Mound. Free."],
["The Delmar Loop","St. Louis","fo,wk","OFF","both","Walkable strip with a Walk of Fame + Fitz's root beer bottled on-site."],
["Raging Rivers WaterPark","St. Louis","wa,tp","OFF","both","Wave pool + tube rides via a scenic Great River Road drive. (~45 min, summer)"],
["City Foundry STL","St. Louis","fo,wk","OFF","both","A buzzy food-hall district in a former foundry with room to roam."],

["Nat'l Air & Space Museum","Washington DC","sc,hi","SIG","both","Newly renovated galleries ('26); touch a moon rock. Free, timed entry."],
["Nat'l Museum of Natural History","Washington DC","sc,an,na","SIG","both","Dinosaur hall + a live Insect Zoo & Butterfly Pavilion. Free & hands-on."],
["Smithsonian's National Zoo","Washington DC","an,na","SIG","both","Free (timed ticket); pandas are back + a new elephant calf."],
["Planet Word Museum","Washington DC","sc,hi","GEM","older","World's first voice-activated museum — karaoke, talking library. Free."],
["National Postal Museum","Washington DC","hi,sc","GEM","little","A suspended airmail plane, drivable mail truck & walk-in train car. Free."],
["U.S. Botanic Garden","Washington DC","na,sc","SOL","both","Free living-plant museum with a Children's Garden & kid tools."],
["Rock Creek Park Nature Center","Washington DC","na,sc,an","GEM","both","Free; live turtles & snakes + a planetarium show tuned for ages 4-10."],
["Gravelly Point Park","Washington DC","na","OFF","both","A riverside lawn where jets roar overhead landing at Reagan — pure delight."],
["Kayak to Roosevelt Island","Washington DC","wa,na","OFF","older","Rent kayaks and paddle the Potomac around wooded Teddy Roosevelt Island."],
["Tudor Place (Georgetown)","Washington DC","hi,na","GEM","little","Free 5-acre historic garden; kids grab an explorer map & spot bunnies."],
["Kenilworth Aquatic Gardens","Washington DC","na,wa","OFF","both","The only NPS site devoted to aquatic gardens; a quiet off-radar morning."],
["National Aquarium (Baltimore)","Washington DC","wa,an","SOL","both","DC's real aquarium option — dolphins & top-tier tanks. (~45 min)"],
["Great Waves Waterpark","Washington DC","wa","SOL","both","Wave pool + five slides + a gentle Kids Zone. (Alexandria, ~20 min)"],
["Volcano Island Waterpark","Washington DC","wa","GEM","both","A riverside regional water park locals love. (Sterling, VA)"],

["Colonial Williamsburg","Williamsburg","hi,wk,fo,an","SIG","both","Living 18th-c town, costumed trades, carriage rides + a boxwood maze; kids often free in summer."],
["Busch Gardens Williamsburg","Williamsburg","tp,an,fo","SIG","both","Sesame Street & Land of the Dragons for the 5-yr-old + coasters; 3-5 ride free."],
["Water Country USA","Williamsburg","wa","SIG","both","Virginia's largest water park — a play structure + gentle wave pool."],
["Great Wolf Lodge (Williamsburg)","Williamsburg","wa","SOL","both","84° indoor water park + the interactive MagiQuest game; rain-proof."],
["Jamestown Settlement","Williamsburg","hi,na,wk","SOL","both","Board a re-created 1607 ship and help raise the sail."],
["Amer. Revolution Museum at Yorktown","Williamsburg","hi","SOL","older","Interactive galleries + a living-history Continental Army encampment."],
["Virginia Living Museum","Williamsburg","an,sc,na","GEM","both","Zoo + aquarium + nature center + a Dino Dig fossil pit. (Newport News, 30 min)"],
["Yorktown Beach & Riverwalk","Williamsburg","wa,wk,fo,hi","GEM","both","A gentle river beach + walkable waterfront with a free trolley."],
["York River State Park","Williamsburg","na","GEM","older","Hike to Fossil Beach and hunt real fossils along the estuary."],
["Waller Mill Park","Williamsburg","na,wa","OFF","both","A 360-acre reservoir with kayaking & pedal boats; a locals' spot."],
["Freedom Park & Botanical Garden","Williamsburg","na","OFF","both","A free arboretum with easy trails & events like full-moon hikes."],
["William & Mary campus","Williamsburg","wk,na,hi","OFF","both","The Sunken Garden + storybook Crim Dell Bridge make a pretty free walk."],
["Merchants Square dining","Williamsburg","fo,wk","SOL","both","A walkable brick dining district — bistro, seafood, tacos + ice cream."],
["Jamestown-Scotland Ferry","Williamsburg","na","OFF","both","A free James River car ferry (every ~25 min, 365 days) — an underrated maritime ride most skip."],
["Sweethaven Lavender Farm","Williamsburg","na,fo","OFF","little","Pick-your-own lavender bouquets late May–July; a sensory, photogenic detour."],

["Carnegie / Kamin Science Center","Pittsburgh","sc,wa","SIG","both","Five floors of 100+ hands-on exhibits + a real submarine kids can board."],
["Children's Museum of Pittsburgh","Pittsburgh","sc,na","SIG","both","Voted #1 US children's museum ('26); open-ended, tinker-heavy play."],
["Carnegie Museum of Natural History","Pittsburgh","sc,hi,na","SIG","both","Giant dinosaur skeletons + a gem & mineral hall; adjoins the art museum."],
["National Aviary","Pittsburgh","an,na","SIG","both","The only independent US aviary — 500+ birds in walk-through rooms + shows."],
["Pittsburgh Zoo & Aquarium","Pittsburgh","an,wa,na","SOL","both","A classic zoo-plus-aquarium day with broad animal variety."],
["Duquesne Incline","Pittsburgh","hi,wk","SIG","both","An 1877 cable railway up Mt. Washington to the iconic city view."],
["Phipps Conservatory","Pittsburgh","na","SOL","both","A 15-acre glasshouse with 23 gardens + a seasonal Butterfly Forest."],
["Randyland","Pittsburgh","wk,fo","GEM","both","A free, joyfully weird outdoor folk-art courtyard on the North Side."],
["Heinz History Center","Pittsburgh","hi","GEM","both","Home to the original Mister Rogers' set + a hands-on Kidsburgh exhibit."],
["Kennywood","Pittsburgh","tp,wa","SOL","both","A historic 150-acre amusement park with 45+ rides across ages."],
["Idlewild & SoakZone","Pittsburgh","tp,wa","GEM","both","Repeatedly named best kids' park in the world + the Mister Rogers trolley. (~50 mi)"],
["Sandcastle Waterpark","Pittsburgh","wa","SOL","both","20+ themed water attractions along the Monongahela."],
["Moonshot Museum","Pittsburgh","sc","OFF","older","Watch real lunar spacecraft being built + run interactive space missions."],

["The Franklin Institute","Philadelphia","sc,wk","SIG","both","Three floors of hands-on science + the walk-through two-story Giant Heart."],
["Please Touch Museum","Philadelphia","sc,wk","SIG","little","A play-based children's museum built entirely around touching; ideal for K."],
["Philadelphia Zoo","Philadelphia","an,na","SIG","both","America's first zoo, with Zoo360 trails that let animals roam overhead."],
["Adventure Aquarium (Camden)","Philadelphia","wa,an","SIG","both","The only aquarium with Nile hippos + a walk-over Shark Bridge."],
["Liberty Bell & Independence Hall","Philadelphia","hi,wk","SIG","older","Birthplace of American democracy; free & quick — best for the 4th-grader."],
["Reading Terminal Market","Philadelphia","fo,wk","SIG","both","Historic covered market — Amish pretzels + dozens of vendors."],
["Sesame Place","Philadelphia","wa,tp","SOL","little","The only fully Sesame Street-themed park on the East Coast + a water park. (~30 min)"],
["Franklin Square","Philadelphia","na,wk","SOL","little","A restored square with a carousel, mini-golf & fountain show; a free breather."],
["Spruce Street Harbor Park","Philadelphia","na,fo,wk","GEM","both","Summer waterfront with hammocks in the trees + floating gardens & food."],
["Elmwood Park Zoo","Philadelphia","an,na","GEM","both","Hand-feed giraffes + zipline over bison & elk. (Norristown, ~40 min)"],
["Morris Arboretum","Philadelphia","na","GEM","both","92 acres with a 300-ft garden railway + an 'Out on a Limb' canopy walk."],
["Penn Museum","Philadelphia","hi","GEM","older","Real Egyptian mummies + a monumental sphinx; quieter than the big museums."],
["Eastern State Penitentiary","Philadelphia","hi","OFF","older","A dramatic ruined 19th-c prison (held Al Capone); best for the older girl."],

["Tybee Island Marine Science Center","Savannah","an,sc,wa,na","SIG","both","Touch tanks, live sea turtles + a pirate-ship playground on the sand."],
["UGA Marine Ed Center & Aquarium","Savannah","an,sc,na,wa","GEM","both","Georgia's first saltwater aquarium — cheap, crowd-free. (Skidaway, 30 min)"],
["Oatland Island Wildlife Center","Savannah","an,na,wk","GEM","both","A 2-mi moss-draped trail to native wolves, bobcats, gators & raptors."],
["Savannah Children's Museum","Savannah","sc,hi","SOL","little","An outdoor interactive yard — maze, climbing, building — among rail structures."],
["Tybee Island Light Station","Savannah","hi,na,wk","SIG","both","Climb 178 steps up Georgia's oldest lighthouse + a fort museum."],
["Dolphin Adventure Boat Tour","Savannah","an,wa,na","SOL","both","A small-boat cruise to spot wild bottlenose dolphins."],
["Tybee Island Beach & Pier","Savannah","wa,na,wk","SIG","both","A wide, gentle-surf beach for shelling, splashing & flat-island biking."],
["Forsyth Park","Savannah","na,wk","SIG","both","The iconic fountain + two playgrounds & summer sprinklers."],
["Wormsloe Historic Site","Savannah","na,hi,wk","SOL","both","An unforgettable 1.5-mi live-oak avenue + tabby ruins & marsh trails."],
["Pin Point Heritage Museum","Savannah","hi,na,fo","OFF","older","The Gullah-Geechee story told at a former oyster & crab factory."],
["River Street","Savannah","fo,wk,hi","SOL","both","Cobblestone riverfront — taffy pulled in the window + praline samples."],
["Leopold's Ice Cream","Savannah","fo,wk","SIG","both","A 1919 soda fountain — a genuine local landmark, not a tourist trap."],
["Savannah Bananas","Savannah","fo,wk,hi","SIG","both","Half baseball, half comedy at a historic stadium. <span class='warn'>2026 ticket lottery.</span>"],
["Crab Shack at Chimney Creek","Savannah","fo,an,na","GEM","both","Marsh-side seafood + a live baby-alligator lagoon & a rescue-cat house."],

["South Carolina Aquarium","Charleston","an,sc,na,wk","SIG","both","Touch tank, a 385k-gal Great Ocean Tank + a live Sea Turtle Recovery hospital."],
["Patriots Point / USS Yorktown","Charleston","hi,sc,wk","SIG","older","Climb through a real WWII carrier with flight sims + scavenger hunts."],
["Isle of Palms","Charleston","wa,na","SIG","both","The most family-friendly beach — wide sand, calmer waves, lifeguards."],
["Folly Beach","Charleston","wa,na,fo","SOL","both","A laid-back surf town closest to downtown with a lively pier."],
["Sullivan's Island + Fort Moultrie","Charleston","wa,na,hi","GEM","both","A quieter beach with tidal gullies + the off-radar alternative to Fort Sumter."],
["Splash Zone Waterpark","Charleston","wa,tp","SOL","both","Lazy river + two 200-ft slides at James Island County Park. (summer)"],
["Whirlin' Waters","Charleston","wa,tp","SOL","both","The county's largest water park — big slides + an Otter Bay kiddie area. (summer)"],
["Children's Museum of the Lowcountry","Charleston","sc,wk","SOL","little","Nine hands-on exhibits, a pirate ship + an outdoor splash pad."],
["Charles Towne Landing","Charleston","an,na,hi","GEM","both","A 22-acre natural-habitat zoo (bison, bears, pumas) + a colonial ship."],
["Center for Birds of Prey","Charleston","an,na,sc","OFF","both","A jaw-dropping live flight demo — owls gliding inches overhead. (Awendaw)"],
["Angel Oak Tree","Charleston","na,wk","GEM","both","A free, awe-inspiring 300-400-year-old live oak, largest east of the Mississippi."],
["Shem Creek Park & Boardwalk","Charleston","na,an,wa,fo,wk","GEM","both","A marsh boardwalk where dolphins work the creek beside shrimp boats."],
["Cypress Gardens","Charleston","na,an","OFF","both","A self-guided flat-bottom boat ride through a blackwater gator swamp."],
["Joe Riley Waterfront Park","Charleston","wa,wk","SOL","little","The iconic Pineapple Fountain doubles as a free downtown splash pad."],

["St. Augustine Alligator Farm","St. Augustine","an,na,sc","SIG","both","Hundreds of gators, a bird rookery, lemurs + a zip line over live crocs."],
["Castillo de San Marcos","St. Augustine","hi,wk","SIG","both","Kids climb the ramparts of America's oldest masonry fort; cannon demos."],
["Pirate & Treasure Museum","St. Augustine","hi,sc","SIG","both","800+ real artifacts + hands-on decks & a 12-item treasure hunt."],
["Colonial Quarter","St. Augustine","hi,wk","SOL","both","A living-history village with blacksmiths, musket drills + a climbable watchtower."],
["Fountain of Youth Park","St. Augustine","hi,na,an","SOL","both","15 acres of Old Florida with ~30 free-roaming peacocks + a planetarium."],
["St. Augustine Lighthouse","St. Augustine","hi,sc,na,wk","SOL","older","A 219-step climb (44\" min) + hands-on maritime exhibits & nature trails."],
["Anastasia State Park","St. Augustine","na,wa,an,sc","SIG","both","1,600 acres of uncrowded beach + a calm tidal lagoon for first-time kayaking."],
["St. Augustine Beach","St. Augustine","wa,na","SOL","both","Wide, low-key, drive-on sand — relaxed for sandcastles & boogie boarding."],
["Marineland Dolphin Adventure","St. Augustine","an,wa,sc","GEM","both","The world's original oceanarium (1938) — intimate up-close dolphin encounters."],
["Whetstone Chocolates Tour","St. Augustine","fo","GEM","both","A 45-minute factory tasting tour with ~6 free samples."],
["Fossil Shark Tooth Hunting","St. Augustine","na,sc,wa","OFF","both","Free ranger-led walks teach families to spot fossil teeth at low tide."],
["GTM Estuary Kayak Tours","St. Augustine","na,an,wa,sc","OFF","older","Guided eco-tours through a protected National Estuarine Research Reserve."],
["The Old Jail","St. Augustine","hi","SOL","older","A costumed 'deputy' marches you past the 1891 cells — theatrical & funny."],

["Universal's Volcano Bay","Orlando","wa,tp","SIG","both","Best-themed water park — an aqua coaster + a no-height-limit river. <span class='warn'>Closed Oct 26 '26–Mar 24 '27.</span>"],
["Aquatica","Orlando","wa,an","SIG","both","The animal-lover's water park — a slide passes through a ray tank; all-ages."],
["Discovery Cove","Orlando","wa,an,na","SIG","both","All-inclusive reef snorkel + aviary & beaches; dolphin swim is 6+."],
["LEGOLAND Florida + Water Park","Orlando","tp,wa","SOL","both","Rides scaled exactly to ages 2-10 — nobody ages out, nobody's scared."],
["Peppa Pig Theme Park","Orlando","tp,wa","SOL","little","A 4.5-acre park built for 2-6-yr-olds; pair it with LEGOLAND."],
["Gatorland","Orlando","an,na","GEM","both","The anti-mega-park — a 110-acre gator preserve with boardwalks & zip lines."],
["Blue Spring State Park","Orlando","na,an,wa","OFF","both","Hundreds of wild manatees huddle here mid-Nov–March; boardwalk viewing."],
["Wekiwa Springs State Park","Orlando","na,wa","OFF","both","72° azure spring swimming & paddling 25 min from downtown."],

["Busch Gardens Tampa Bay","Tampa / St. Pete","tp,an","SIG","both","200+ species + coasters; new Lion & Hyena Ridge (spring '26)."],
["Mote SEA","Tampa / St. Pete","sc,an,wa","SIG","both","Brand-new 3-floor aquarium ('25) — a 400k-gal Gulf habitat overhead. Go to UTC, not the old site."],
["The Florida Aquarium","Tampa / St. Pete","an,wa,sc","SOL","both","Downtown & hands-on; pairs perfectly with Glazer on the Riverwalk."],
["Clearwater Marine Aquarium","Tampa / St. Pete","an,na","SOL","both","A working rescue hospital (not a show park); mission-driven."],
["Glazer Children's Museum","Tampa / St. Pete","sc,wk","SOL","little","20+ interactive exhibits + a two-story water climber on the Riverwalk."],
["Great Explorations","Tampa / St. Pete","sc","GEM","little","Hands-on & 'designed for 10 and under'; pair with Sunken Gardens."],
["Sunken Gardens","Tampa / St. Pete","na,wk","GEM","both","A 100-year-old sunken tropical garden with flamingos in walkable St. Pete."],

["Swim with Manatees — Three Sisters Springs","Nature Coast (Crystal River)","wa,an,na","SIG","both","The only place in the US to legally swim with wild manatees. (Nov 15–Mar 31)"],
["Weeki Wachee Springs","Nature Coast (Crystal River)","wa,hi,an","SIG","both","The legendary underwater mermaid show + Buccaneer Bay spring slides. (summer)"],
["Giraffe Ranch","Nature Coast (Crystal River)","an,na","GEM","both","Feed giraffes from a safari truck on a 47-acre preserve. (Dade City, reservation-only)"],
["Ellie Schiller Homosassa Springs","Nature Coast (Crystal River)","an,na,wa","GEM","both","Walk underwater into the 'Fish Bowl' — manatees year-round + a wildlife boardwalk."],
["Rainbow Springs State Park","Nature Coast (Crystal River)","wa,na","SOL","both","A crystal 72° swimming hole + waterfalls & tubing. <span class='warn'>Reservations from Apr 29 '26.</span>"],
["Silver Springs State Park","Nature Coast (Crystal River)","na,an,hi","SOL","both","World-famous glass-bottom boat tours + a wild rhesus macaque troop."],
["Devil's Den Prehistoric Spring","Nature Coast (Crystal River)","wa,na","OFF","older","Snorkel a sunken cavern spring lit by a beam of daylight. (6+, strong swimmers)"],
["Discovery Place Science","Charlotte","sc","SIG","both","Four floors of hands-on wonder — a two-story rainforest, live animals, and IMAX."],
["U.S. National Whitewater Center","Charlotte","wa,na","SIG","both","Raft an Olympic whitewater channel, then free-roam miles of woodland trails."],
["Carowinds","Charlotte","tp,wa","SIG","both","Massive amusement park on the NC/SC line with its own Carolina Harbor water park."],
["SEA LIFE Charlotte-Concord Aquarium","Charlotte","an,wa","SOL","both","Walk-through ocean tunnel, rays, seahorses, and a kid-height touch pool at Concord Mills."],
["Carolina Raptor Center","Charlotte","an,na","GEM","both","Eye-level eagles, owls, and vultures along a wooded trail — a raptor hospital you can walk."],
["Daniel Stowe Botanical Garden","Charlotte","na","SOL","both","Fountains, a butterfly-friendly canal garden, and a kids' cottage across 380 acres."],
["ImaginOn","Charlotte","wk","GEM","both","A free storytelling wonderland — children's library, play spaces, and a puppet-lined theater."],
["Discovery Place Kids-Huntersville","Charlotte","sc","SOL","little","Pint-sized science playground built for toddlers-to-8 to climb, build, and splash."],
["Reed Gold Mine","Charlotte","hi,na","GEM","both","Site of America's first gold rush — tour real underground tunnels, then pan for gold."],
["Schiele Museum of Natural History & Planetarium","Charlotte","sc,na","GEM","both","Dinosaurs, a nature trail, a re-created Catawba village, and a domed planetarium in Gastonia."],
["Charlotte Museum of Nature","Charlotte","an,na","SOL","both","Newly reopened nature museum with live critters, otters, and a butterfly pavilion."],
["Charlotte Museum of History","Charlotte","hi","SOL","older","Tour Charlotte's oldest building, the 1774 Hezekiah Alexander stone house, on 8 wooded acres."],
["Ray's Splash Planet","Charlotte","wa","SOL","both","Indoor water park with a lazy river, slides, and a zero-depth zone — rain-proof splashing."],
["Latta Nature Preserve & Quest Nature Center","Charlotte","na,an","OFF","both","1,460 lakeside acres with free trails and a nature center's 6,000-gallon native-fish tank."],
["Freedom Park & Little Sugar Creek Greenway","Charlotte","na,wk","GEM","both","Ducks, a big playground, and a paved creekside greenway loop in the heart of the city."],
["Dollywood","Gatlinburg / Pigeon Forge","tp,fo","SIG","both","Appalachian-themed rides, crafts, and cinnamon bread that thrill a 5- and 9-year-old alike."],
["Dollywood's Splash Country","Gatlinburg / Pigeon Forge","wa","SIG","both","A mountain-fed water park with a wave pool and toddler zones for the family's water-lovers."],
["Anakeesta","Gatlinburg / Pigeon Forge","na,wk","SIG","both","A chondola to a mountaintop of treetop walks, a kids' Treehouse Village, and long-range views."],
["Gatlinburg SkyLift Park & SkyBridge","Gatlinburg / Pigeon Forge","na,wk","SIG","both","North America's longest pedestrian suspension bridge with a glass-floor panel over the valley."],
["WonderWorks","Gatlinburg / Pigeon Forge","sc","SOL","both","An upside-down house of 100+ hands-on science exhibits — hurricane simulator to bed of nails."],
["Ober Mountain","Gatlinburg / Pigeon Forge","na,wa","SOL","both","Aerial tram to year-round snow tubing, an alpine slide, and a black-bear wildlife encounter."],
["Cades Cove Loop","Gatlinburg / Pigeon Forge","an,na","SIG","both","An 11-mile loop of black bears, deer, and 1800s cabins — go at dawn for wildlife."],
["Clingmans Dome (Kuwohi)","Gatlinburg / Pigeon Forge","na","GEM","older","A spiraling ramp to the Smokies' highest point rewards a half-mile climb with 360° views."],
["Sugarlands Visitor Center & Salamander Creeks","Gatlinburg / Pigeon Forge","sc,na","GEM","both","Grab a free Junior Ranger booklet, then hunt salamanders along Fighting Creek and Cataract Falls."],
["The Island in Pigeon Forge","Gatlinburg / Pigeon Forge","wk,fo","SOL","both","Free-to-stroll plaza with dancing fountains kids can splash in and the 200-ft Smoky Mountain Wheel."],
["Smoky Mountain Alpine Coaster","Gatlinburg / Pigeon Forge","na","SOL","both","The longest downhill coaster in the U.S. lets riders control their own speed through the forest."],
["Titanic Museum Attraction","Gatlinburg / Pigeon Forge","hi","SIG","both","Board a half-scale ship, get a real passenger's boarding pass, and touch a real iceberg."],
["Ripley's Believe It or Not! Odditorium","Gatlinburg / Pigeon Forge","sc","OFF","both","A quirky rainy-day romp of oddities, illusions, and a moving-floor tunnel that wows both girls."],
["Dollywood's DreamMore Resort","Gatlinburg / Pigeon Forge","tp,wa","SOL","both","A family base with splash pad, pools, and shuttle-and-perk access to both Dollywood parks."],
["NC Museum of Natural Sciences","NC Triangle (Raleigh–Durham)","sc,an,na","SIG","both","Four floors of live animals, whale skeletons, and real dinosaur fossils — and it's completely free."],
["Museum of Life and Science","NC Triangle (Raleigh–Durham)","sc,an,na","SIG","both","Ride a train past black bears and lemurs, then hit dinosaurs and a giant outdoor science playground."],
["Duke Lemur Center","NC Triangle (Raleigh–Durham)","an,sc","SIG","both","Walk within feet of leaping ring-tailed lemurs at the world's premier lemur sanctuary."],
["Marbles Kids Museum","NC Triangle (Raleigh–Durham)","sc,wk","SIG","little","All-day hands-on play city built for tiny hands, with a giant IMAX dome attached."],
["Morehead Planetarium & Science Center","NC Triangle (Raleigh–Durham)","sc","SOL","both","The dome where NASA astronauts trained now beams full-dome star shows over Chapel Hill."],
["NC Museum of History","NC Triangle (Raleigh–Durham)","hi","SOL","older","Free galleries walk kids from Native peoples to space flight in the heart of Raleigh."],
["Sarah P. Duke Gardens","NC Triangle (Raleigh–Durham)","na,wk","SIG","both","55 acres of ponds, koi, terraces, and streams — a storybook garden, free to roam."],
["NC Museum of Art Park","NC Triangle (Raleigh–Durham)","na,wk","GEM","both","Miles of trails woven through giant outdoor sculptures the kids can walk right up to."],
["Pullen Park","NC Triangle (Raleigh–Durham)","wa,wk","SOL","little","America's fifth-oldest amusement park with a 1912 carousel, kiddie boats, and a pint-sized train."],
["NC Botanical Garden","NC Triangle (Raleigh–Durham)","na","GEM","both","Carnivorous-plant bogs and a woodland kids' trail make this Chapel Hill's free nature classroom."],
["JC Raulston Arboretum","NC Triangle (Raleigh–Durham)","na","GEM","both","A quiet, free NC State garden with a whimsical winding lath house and butterfly-filled borders."],
["Durham Bulls Baseball","NC Triangle (Raleigh–Durham)","hi,fo","SOL","both","Bull-snorting home runs, dollar dogs, and fireworks at the ballpark from the movie."],
["Frankie's Fun Park","NC Triangle (Raleigh–Durham)","tp","SOL","both","Go-karts, mini golf, laser tag, and bumper boats when the girls need pure adrenaline."],
["William B. Umstead State Park","NC Triangle (Raleigh–Durham)","na,wa","GEM","both","5,600 forested acres with easy lake trails and rowboat rentals minutes from the highway."],
["American Tobacco Trail","NC Triangle (Raleigh–Durham)","na,wk","OFF","both","A flat rail-trail on an old tobacco line — perfect for a stroller-and-scooter family ramble."],
["Jordan Lake State Recreation Area","NC Triangle (Raleigh–Durham)","wa,na,an","GEM","both","Sandy swim beaches plus one of the East's biggest bald-eagle populations overhead."]
];

// corridor diagrams: [title, tag, nodes[[label,kind]], connectors[], branch]
let COR=[
 ["Tennessee Valley → Gateway West","NW · Spoke 01",
  [["Greenville","home"],["Chattanooga","stay"],["Nashville","stay"],["St. Louis","stay"]],
  ["2.5h","2h","4.5h"],
  "Branch: <b>Chattanooga</b> ▸ 1.5h ▸ <b>Huntsville</b> (Space & Rocket Center)"],
 ["Blue Ridge → Ohio Valley","N · Spoke 02",
  [["Greenville","home"],["Knoxville","stay"],["Gatlinburg / Pigeon Forge","stay"],["Louisville","stay"],["Cincinnati","stay"],["Columbus / Indy","pass"]],
  ["2h","1h","3h","1.5h","1.75h"],
  "Knoxville is the gateway — <b>Gatlinburg / Pigeon Forge</b> (Dollywood + the Smokies) sit 45 min off it."],
 ["Piedmont → Mid-Atlantic","NE · Spoke 03",
  [["Greenville","home"],["Charlotte","stay"],["NC Triangle","stay"],["Roanoke / Shenandoah","pass"],["Washington DC","stay"],["Williamsburg / Philly","pass"]],
  ["1.5h","2h","3h","2.5h","2.5h"],
  "Branch: <b>Charlotte</b> ▸ WV route ▸ <b>Pittsburgh</b> (~7h). <b>Charlotte</b> & the <b>NC Triangle</b> (Raleigh–Durham) are now overnight hubs in their own right."],
 ["Lowcountry → First Coast","SE · Spoke 04",
  [["Greenville","home"],["Charleston / Savannah","stay"],["St. Augustine","stay"],["Orlando","stay"]],
  ["3.5h","2h","2h"],
  "The east-Florida coastal run — Charleston & Savannah are twin gateways."],
 ["I-75 → Nature Coast","S · Spoke 05",
  [["Greenville","home"],["Atlanta","stay"],["Macon","pass"],["Ocala / Crystal River","stay"],["Tampa","stay"]],
  ["2h","1.5h","3h","1.5h"],
  "The inland/west-Florida run — Atlanta is the launch point most trips skip."]
];
let COORDS={
  "Greenville":[34.85,-82.39],"Atlanta":[33.75,-84.39],"Chattanooga":[35.05,-85.31],
  "Nashville":[36.16,-86.78],"Huntsville":[34.73,-86.59],"Knoxville":[35.96,-83.92],
  "St. Louis":[38.63,-90.20],"Louisville":[38.25,-85.76],"Cincinnati":[39.10,-84.51],
  "Columbus":[39.96,-82.99],"Indianapolis":[39.77,-86.16],"Washington DC":[38.90,-77.04],
  "Williamsburg":[37.27,-76.71],"Pittsburgh":[40.44,-80.00],"Philadelphia":[39.95,-75.16],
  "Savannah":[32.08,-81.09],"Charleston":[32.78,-79.93],"St. Augustine":[29.90,-81.31],
  "Orlando":[28.54,-81.38],"Tampa / St. Pete":[27.95,-82.46],"Nature Coast (Crystal River)":[28.88,-82.59],
  "Charlotte":[35.23,-80.84],"Gatlinburg / Pigeon Forge":[35.79,-83.55],"NC Triangle (Raleigh–Durham)":[35.90,-78.78]
};
let PRESETS={
  "Gateway West":["Chattanooga","Nashville","St. Louis"],
  "Ohio Valley":["Knoxville","Louisville","Cincinnati","Columbus"],
  "Mid-Atlantic":["Charlotte","NC Triangle (Raleigh–Durham)","Washington DC","Williamsburg"],
  "Lowcountry → First Coast":["Charleston","St. Augustine","Orlando"],
  "Nature Coast":["Atlanta","Nature Coast (Crystal River)","Tampa / St. Pete"],
  "Smoky Mountains":["Knoxville","Gatlinburg / Pigeon Forge"]
};
let PLAYBOOKS=[
  {"city":"Atlanta","pitch":"Your closest big-city hit: a top-5 world aquarium, a gorilla-packed zoo, and the world's largest dinosaur all inside two hours of the driveway.","perfectDay":[{"when":"Morning","stop":"Georgia Aquarium","note":"Rope-drop it — whale sharks and belugas first while both girls are fresh; buy timed tickets in advance."},{"when":"Midday","stop":"World of Coca-Cola","note":"Right next door in Pemberton Place — the Scent Discovery and mix-your-own tasting room is a quick, low-energy pairing after the aquarium."},{"when":"Afternoon","stop":"Zoo Atlanta","note":"Save the big gorilla troop and pandas for after a car-ride reset; walkable and shaded."},{"when":"Evening","stop":"BeltLine: Ponce City + Krog St Markets","note":"Flat stroller path plus food halls — let the 9-yo pick ramen, the 5-yo gets Jeni's, everyone unwinds."}],"signature":"Georgia Aquarium","rainyDay":"Fernbank Museum","foodStop":"The food stalls inside Ponce City Market's Central Food Hall — something for every picky palate under one roof.","kidTip":"Do the aquarium at opening before the school-group crush, then use the midday Coca-Cola stop as an air-conditioned buffer so the 5-yo can recharge before the zoo's afternoon walking.","stayArea":"Midtown — walkable to the aquarium/Coke, near the BeltLine, easy highway access to the zoo."},
  {"city":"Chattanooga","pitch":"A two-building aquarium, an underground waterfall, and a gnome-filled clifftop garden make this the most kid-dense weekend on any Hensel corridor.","perfectDay":[{"when":"Morning","stop":"Tennessee Aquarium — River Journey","note":"Start in the freshwater building with otters and the walk-through forest; buy the combo ticket so you can do both."},{"when":"Midday","stop":"Tennessee Aquarium — Ocean Journey","note":"Sharks overhead and penguins — the second building is steps away across the plaza."},{"when":"Afternoon","stop":"Rock City Gardens","note":"Swinging bridge and the glowing Fairyland Caverns gnomes delight the 5-yo; the older girl loves the See-7-States overlook."},{"when":"Evening","stop":"Coolidge Park","note":"Free splash fountains and a 100-year-old carousel to burn off the last of the day right on the river."}],"signature":"Tennessee Aquarium (both buildings)","rainyDay":"Creative Discovery Museum","foodStop":"Clumpies Ice Cream in the Bluff View Art District — river views and a walkable little arts pocket.","kidTip":"Both aquarium buildings in one morning is a lot of standing — bring the stroller for the 5-yo and plan Rock City for after a lunch reset, since its clifftop paths need fresh legs.","stayArea":"Downtown near the riverfront — walk to the aquarium, Walnut Street Bridge, and Coolidge Park."},
  {"city":"Nashville","pitch":"A kangaroo walk-through zoo with a giant wooden fortress of a playground, plus splash pads and a hands-on science center, keep Music City firmly kid-first.","perfectDay":[{"when":"Morning","stop":"Nashville Zoo at Grassmere","note":"Walk-through kangaroo yard and one of the largest wooden playgrounds in the US — get there at open before the heat."},{"when":"Midday","stop":"Adventure Science Center","note":"Hands-on physics and space floors plus a planetarium — a cool, dim reset for early afternoon."},{"when":"Afternoon","stop":"Cheekwood Estate & Gardens","note":"The storybook TRAINS! trail and children's garden are perfect wander-pace for both ages."},{"when":"Evening","stop":"Bicentennial Mall + Farmers' Market","note":"Free park to run, next to a food hall with 20+ international eateries for an easy dinner."}],"signature":"Nashville Zoo at Grassmere","rainyDay":"Adventure Science Center","foodStop":"Nashville Farmers' Market food hall beside Bicentennial Mall — global stalls, casual, kid-paced.","kidTip":"Note the Parthenon is closed for HVAC through mid-July '26 — skip it and hit the free splash pads at Two Rivers or Shelby to wear the 5-yo out on a hot afternoon.","stayArea":"Near Opryland/East Nashville if you want SoundWaves water park access, or downtown-adjacent for the science center and parks."},
  {"city":"Huntsville","pitch":"The single best science-and-engineering day within driving range — real Saturn V rockets for the 4th-grader, a hands-on natural-science museum with splash play for the Kindergartner.","perfectDay":[{"when":"Morning","stop":"U.S. Space & Rocket Center / Space Camp","note":"Stand under the Saturn V first thing; the older girl can do simulators while the 5-yo does the kid areas."},{"when":"Midday","stop":"INTUITIVE Planetarium","note":"An easy air-conditioned full-dome show on-site — perfect midday cool-down between rocket exploring."},{"when":"Afternoon","stop":"Cook Museum of Natural Science","note":"Worth the 25-min hop to Decatur — live saltwater tanks, jellyfish, gators, and splash play that levels the ages."},{"when":"Evening","stop":"Lowe Mill ARTS","note":"200+ working-artist studios plus quirky food — a browse-and-snack wind-down."}],"signature":"U.S. Space & Rocket Center","rainyDay":"Cook Museum of Natural Science","foodStop":"Campus No. 805 — an old high school turned food/arcade/brewery complex, room for kids to roam.","kidTip":"The Rocket Center is huge and mostly outdoors — do rockets in the cool morning, bank the planetarium for the hot midday slump, and split the Cook Museum to a second half-day if the 5-yo fades.","stayArea":"Cummings Research Park / near the Space Center for shortest morning drive."},
  {"city":"Knoxville","pitch":"An underrated water-and-nature hub where a splash-pad safari zoo, a turquoise quarry swimming hole, and the Smokies 45 minutes on all share one base.","perfectDay":[{"when":"Morning","stop":"Zoo Knoxville","note":"Gorillas, elephants, and a safari splash pad — go early so the 5-yo hits the water when it's warm enough."},{"when":"Midday","stop":"Ijams Nature Center & Meads Quarry","note":"Nature playscape and live animals; the 9-yo can kayak or paddleboard the quarry lake."},{"when":"Afternoon","stop":"World's Fair Park & Sunsphere","note":"The city's biggest splash pad plus the 360° Sunsphere deck — free and central."},{"when":"Evening","stop":"Market Square","note":"Pedestrian square with restaurants, splash fountains, and live music for dinner."}],"signature":"Ijams Nature Center & Meads Quarry","rainyDay":"Muse Knoxville","foodStop":"Market Square's patios — walkable, casual, with fountains for the kids between courses.","kidTip":"Pack swimsuits every day here — three of the four stops involve water. If you add the Smokies, do it as its own dawn-start day so the drive doesn't eat a hub afternoon.","stayArea":"Downtown near Market Square and World's Fair Park — walkable, central to the zoo and Ijams."},
  {"city":"St. Louis","pitch":"A 600,000-sq-ft warehouse-turned-playground and a genuinely free world-class zoo make this the highest fun-per-dollar hub — just remember it only pencils out chained through Chattanooga and Nashville.","perfectDay":[{"when":"Morning","stop":"City Museum","note":"Plan 3-4 hours — caves, 30+ slides, rooftop madness; go at open before it packs and both girls have peak energy."},{"when":"Midday","stop":"Turtle Playground","note":"Free giant climbable turtles by City Museum's own creator, minutes away — pair them to cap the morning."},{"when":"Afternoon","stop":"Saint Louis Zoo","note":"Consistently a top US zoo and free admission; shady Forest Park setting for a calmer afternoon."},{"when":"Evening","stop":"Ted Drewes Frozen Custard","note":"The iconic Route 66 'concrete' — so thick they hand it to you upside-down."}],"signature":"City Museum","rainyDay":"Saint Louis Science Center","foodStop":"Ted Drewes Frozen Custard on Chippewa — a genuine St. Louis institution.","kidTip":"City Museum is physically demanding and easy to lose a 5-yo in — go right at opening, keep the crew together on the slides, and do the mellow free zoo afterward when everyone's spent. It's a 9.5h drive, so break it over Chattanooga and Nashville.","stayArea":"Central West End / near Forest Park — walkable to the free zoo, science center, and botanical garden."},
  {"city":"Louisville","pitch":"Zip an underground cavern, walk 390-million-year-old fossil beds, and cross a bridge on foot into another state — Louisville is quietly stacked for curious kids.","perfectDay":[{"when":"Morning","stop":"Louisville Mega Cavern","note":"Underground tram is all-ages; the 9-yo (age 7+) can do the underground zipline while the 5-yo rides along."},{"when":"Midday","stop":"Kentucky Science Center","note":"Three floors of hands-on plus a toddler zone splits the ages perfectly on a hot afternoon."},{"when":"Afternoon","stop":"Falls of the Ohio State Park","note":"Walk exposed fossil beds and do the Fossil Challenge scavenger hunt — hands-on wonder for both."},{"when":"Evening","stop":"Waterfront Park + Big Four Bridge","note":"Free playgrounds and splash pad, then walk the bridge into Indiana at sunset."}],"signature":"Louisville Mega Cavern","rainyDay":"Kentucky Science Center","foodStop":"NuLu District — walkable blocks of interesting eats plus an indoor food hall.","kidTip":"The cavern stays a cool 58° year-round, so bring light jackets even in July; save the outdoor Falls fossil beds for late afternoon when the river rocks aren't blazing hot.","stayArea":"Downtown/NuLu — walkable to the waterfront, close to the cavern and science center."},
  {"city":"Cincinnati","pitch":"Fiona the hippo, a rope bridge over live sharks, and a top-10 children's museum in an Art Deco train station — a compact riverfront hub that punches way up.","perfectDay":[{"when":"Morning","stop":"Cincinnati Zoo","note":"Meet Fiona the hippo early; the botanical setting is one of the best-ranked in the country."},{"when":"Midday","stop":"Newport Aquarium","note":"Cross the river to walk the 75-ft Shark Bridge rope walk over sharks — thrilling for the 9-yo, penguins for the 5-yo."},{"when":"Afternoon","stop":"Smale Riverfront Park","note":"Free fountains, an adventure playground, and a carousel to burn energy riverside."},{"when":"Evening","stop":"Newport on the Levee / Box Park","note":"Open-air shipping-container food park right by the aquarium — easy dinner."}],"signature":"Newport Aquarium","rainyDay":"Cincinnati Museum Center","foodStop":"Findlay Market in Over-the-Rhine — Ohio's oldest market, reachable on the free streetcar.","kidTip":"The zoo and aquarium sit across the river from each other; do the zoo at open before the heat, then the aquarium is indoors and cool for the afternoon slump. Kids under 13 are free at the American Sign Museum if you need a Saturday rainy pivot.","stayArea":"Downtown/Over-the-Rhine or across the river in Newport — both put the aquarium and food parks in walking range."},
  {"city":"Columbus","pitch":"A giant hands-on science center, Jack Hanna's world-class zoo, and an open-air safari among rhinos and giraffes — Columbus out-punches the bigger Midwest hubs for this family's themes.","perfectDay":[{"when":"Morning","stop":"Columbus Zoo and Aquarium","note":"Jack Hanna's zoo plus a manatee coast and aquarium — arrive at open to beat both crowds and heat."},{"when":"Midday","stop":"Zoombezi Bay","note":"The award-winning water park is right at the zoo (summer) — wave pool and slides for a hot midday."},{"when":"Afternoon","stop":"COSI","note":"300k sq ft of hands-on science and a T. rex dino gallery — an indoor, energy-flexible afternoon."},{"when":"Evening","stop":"North Market","note":"Historic 1876 food hall where Jeni's Ice Cream was born — a vendor for every taste."}],"signature":"Columbus Zoo and Aquarium","rainyDay":"COSI","foodStop":"North Market — 35 vendors and the original Jeni's Ice Cream.","kidTip":"Zoo plus water park is a full sun-soaked day; combo-ticket them and rotate — animals early, water at midday peak heat. The Wilds safari is ~90 min out and must be booked ahead, so make it its own day, not a squeeze-in.","stayArea":"Downtown near the Scioto riverfront and North Market, or Powell/Dublin if you want to be next to the zoo."},
  {"city":"Indianapolis","pitch":"The world's largest children's museum — with a real fossil lab and dinosaurs — anchors a hub of living history balloon rides and a dolphin-and-orangutan zoo.","perfectDay":[{"when":"Morning","stop":"Children's Museum of Indianapolis","note":"World's largest — hit Dinosphere and the real fossil labs at open; easily a half-day for both ages."},{"when":"Midday","stop":"Garfield Park Conservatory","note":"A calm tropical glasshouse with a Children's Garden — a green, low-key midday breather."},{"when":"Afternoon","stop":"Indianapolis Zoo","note":"A rare zoo/aquarium/botanical combo with dolphins and orangutans; late-day when it cools."},{"when":"Evening","stop":"Canal Walk & White River SP","note":"Pedal boats and the Colts Canal Playground on a flat waterside loop to end the day."}],"signature":"Children's Museum of Indianapolis","rainyDay":"Children's Museum of Indianapolis","foodStop":"Mass Ave — walkable dining strip where kids pour custom candles at Penn & Beech between courses.","kidTip":"The children's museum is enormous; plan a whole morning and don't try to also do the zoo the same block of time. If the 5-yo needs a nap, the conservatory is a quiet, stroller-friendly place to let her ride the stroller while the 9-yo explores.","stayArea":"Downtown near the Canal Walk / White River State Park — central to the zoo and walkable to Mass Ave."},
  {"city":"Washington DC","pitch":"An entire city of free, hands-on wonder — touch a moon rock, meet pandas, and stand under a dinosaur without paying admission anywhere.","perfectDay":[{"when":"Morning","stop":"Nat'l Air & Space Museum","note":"Newly renovated galleries; touch a moon rock. Free but reserve a timed entry the moment they release."},{"when":"Midday","stop":"Nat'l Museum of Natural History","note":"Dinosaur hall plus a live Insect Zoo and Butterfly Pavilion — hands-on and steps up the Mall."},{"when":"Afternoon","stop":"Smithsonian's National Zoo","note":"Free with a timed ticket — pandas are back and there's a new elephant calf."},{"when":"Evening","stop":"Gravelly Point Park","note":"Lie on the lawn while jets roar overhead landing at Reagan — pure, free delight to end the day."}],"signature":"Nat'l Air & Space Museum","rainyDay":"Nat'l Museum of Natural History","foodStop":"A picnic grabbed near the Mall, or the food halls at nearby markets — museum cafeterias are pricey and slow with kids.","kidTip":"The Mall is deceptively huge — bring the stroller and pick just TWO museums a day, or you'll melt down both girls. Nab free timed-entry tickets for Air & Space and the zoo weeks ahead.","stayArea":"Near a Metro stop (e.g. around the Mall/Penn Quarter or a quieter Arlington base) so you're not fighting downtown parking."},
  {"city":"Williamsburg","pitch":"Costumed 18th-century streets, a Sesame Street theme park for the little one, and a Virginia's-largest water park — living history and pure play sharing one compact base.","perfectDay":[{"when":"Morning","stop":"Colonial Williamsburg","note":"Costumed trades, carriage rides, and a boxwood maze; go early before midday heat on the open streets. Kids often free in summer."},{"when":"Midday","stop":"Merchants Square dining","note":"Walkable brick district right beside the historic area — bistro to tacos plus ice cream for a reset."},{"when":"Afternoon","stop":"Busch Gardens Williamsburg","note":"Land of the Dragons and Sesame Street for the 5-yo, coasters for the 9-yo; ages 3-5 ride free."},{"when":"Evening","stop":"Yorktown Beach & Riverwalk","note":"A gentle river beach and walkable waterfront with a free trolley to wind down."}],"signature":"Colonial Williamsburg","rainyDay":"Virginia Living Museum","foodStop":"Merchants Square — a walkable dining district beside Colonial Williamsburg with ice cream at the end.","kidTip":"Don't try Colonial Williamsburg and Busch Gardens the same day; do history in the cool morning and save a full separate day for the theme park. Great Wolf Lodge is the all-weather bailout if a summer storm rolls in.","stayArea":"Near Colonial Williamsburg / Merchants Square — central to the historic area, Busch Gardens, and Water Country."},
  {"city":"Pittsburgh","pitch":"A five-floor science center with a boardable submarine, the #1-voted children's museum, and the original Mister Rogers trolley — a river city built for tinkering kids.","perfectDay":[{"when":"Morning","stop":"Carnegie / Kamin Science Center","note":"Five floors of 100+ hands-on exhibits plus a real submarine kids can board — start when doors open."},{"when":"Midday","stop":"Children's Museum of Pittsburgh","note":"Voted #1 US children's museum ('26) — open-ended, tinker-heavy play right across the North Side."},{"when":"Afternoon","stop":"Duquesne Incline","note":"Ride the 1877 cable railway up Mt. Washington for the iconic three-rivers view — a quick thrill both love."},{"when":"Evening","stop":"Randyland","note":"A free, joyfully weird folk-art courtyard on the North Side to explore before dinner."}],"signature":"Children's Museum of Pittsburgh","rainyDay":"Carnegie Museum of Natural History","foodStop":"A stop near the North Shore or the Strip District markets — casual, plentiful, kid-friendly.","kidTip":"The science center and children's museum are both on the North Side within walking distance — pair them and skip the car. Idlewild & SoakZone (best kids' park in the world, with the Mister Rogers trolley) is ~50 min out and deserves its own day.","stayArea":"North Shore — walkable to the science center, children's museum, aviary, and Randyland."},
  {"city":"Philadelphia","pitch":"A walk-through Giant Heart, a touch-everything children's museum, and the birthplace of American democracy — but at 9.5h, treat it as a fly-not-drive trip or a DC add-on.","perfectDay":[{"when":"Morning","stop":"The Franklin Institute","note":"Three floors of hands-on science and the walk-through two-story Giant Heart — a classic for both ages."},{"when":"Midday","stop":"Reading Terminal Market","note":"Historic covered market — Amish pretzels and dozens of vendors for a pick-your-own lunch."},{"when":"Afternoon","stop":"Philadelphia Zoo","note":"America's first zoo, with Zoo360 mesh trails that let animals roam overhead — magic for kids."},{"when":"Evening","stop":"Franklin Square","note":"Carousel, mini-golf, and a fountain show — a free, relaxed cap to a big day."}],"signature":"The Franklin Institute","rainyDay":"Please Touch Museum","foodStop":"Reading Terminal Market — Amish pretzels, cheesesteaks, and endless vendor variety.","kidTip":"For the 5-yo, the Please Touch Museum is the best single stop in the city — build a day around it. Given the 9.5h drive, seriously consider flying or bolting this onto a DC trip rather than a standalone quarterly.","stayArea":"Center City near Logan Square — walkable to the Franklin Institute, Reading Terminal, and historic sites."},
  {"city":"Savannah","pitch":"Touch a sea turtle, spot wild dolphins, and climb Georgia's oldest lighthouse — a Lowcountry hub where every stop mixes water, animals, and easy walkability.","perfectDay":[{"when":"Morning","stop":"Tybee Island Marine Science Center","note":"Touch tanks, live sea turtles, and a pirate-ship playground right on the sand — great first stop on Tybee."},{"when":"Midday","stop":"Tybee Island Beach & Pier","note":"Wide, gentle-surf beach for shelling and splashing — stay out on the island for the midday hours."},{"when":"Afternoon","stop":"Dolphin Adventure Boat Tour","note":"A small-boat cruise to spot wild bottlenose dolphins — the afternoon light is good for it."},{"when":"Evening","stop":"Forsyth Park","note":"The iconic fountain, two playgrounds, and summer sprinklers back in town for a wind-down."}],"signature":"Tybee Island Marine Science Center","rainyDay":"Savannah Children's Museum","foodStop":"Leopold's Ice Cream — a 1919 soda fountain that's a genuine local landmark, not a tourist trap.","kidTip":"Tybee is 20 min from downtown, so batch the island stops together in one day rather than driving back and forth. Bring sun cover for the open dolphin boat and time it to avoid the harshest midday sun.","stayArea":"Historic District near Forsyth Park for walkability, or on Tybee Island itself if you want beach-and-turtle days."},
  {"city":"Charleston","pitch":"A sea-turtle hospital inside the aquarium, dolphins working a marsh creek, and the calmest family beach on the coast — Charleston earns a Tier-1 spot for water-and-animal kids.","perfectDay":[{"when":"Morning","stop":"South Carolina Aquarium","note":"Touch tank, the 385k-gal Great Ocean Tank, and a live Sea Turtle Recovery hospital — go at open on the harbor."},{"when":"Midday","stop":"Shem Creek Park & Boardwalk","note":"A marsh boardwalk where dolphins work the creek beside shrimp boats — walkable and often free."},{"when":"Afternoon","stop":"Isle of Palms","note":"The most family-friendly beach — wide sand, calmer waves, lifeguards for the afternoon."},{"when":"Evening","stop":"Joe Riley Waterfront Park","note":"The Pineapple Fountain doubles as a free downtown splash pad to rinse off the day."}],"signature":"South Carolina Aquarium","rainyDay":"Children's Museum of the Lowcountry","foodStop":"A casual seafood spot on Shem Creek — dolphin-watching from the deck while you eat.","kidTip":"Beach parking at Isle of Palms fills early and costs $15-25 — arrive before 10 or go late afternoon. The Center for Birds of Prey flight demo (in Awendaw) is jaw-dropping but a 40-min drive, so slot it as its own morning.","stayArea":"Downtown near Waterfront Park for walkability, or Mount Pleasant to be between Shem Creek and the Isle of Palms beaches."},
  {"city":"St. Augustine","pitch":"America's oldest city stacks a zip line over live crocs, a climb-the-ramparts Spanish fort, and free ranger-led fossil shark-tooth hunts into one salt-air weekend.","perfectDay":[{"when":"Morning","stop":"St. Augustine Alligator Farm","note":"Hundreds of gators, a bird rookery, and lemurs; the 9-yo can zip line over live crocs while the 5-yo watches."},{"when":"Midday","stop":"Castillo de San Marcos","note":"Kids climb the ramparts of America's oldest masonry fort; time it for a cannon demo. Free under 16."},{"when":"Afternoon","stop":"Anastasia State Park","note":"1,600 acres of uncrowded beach plus a calm tidal lagoon for first-time kayaking — cool off here."},{"when":"Evening","stop":"Colonial Quarter","note":"Living-history village with blacksmiths and a climbable watchtower before dinner in the old town."}],"signature":"St. Augustine Alligator Farm","rainyDay":"Pirate & Treasure Museum","foodStop":"Whetstone Chocolates factory tour — a 45-minute tasting with about six free samples doubles as a sweet-tooth stop.","kidTip":"The historic district is walkable but sun-exposed and cobblestoned — do the fort and Colonial Quarter in cooler hours and bank the shaded Alligator Farm and beach for peak midday. Fossil shark-tooth walks depend on low tide, so check the ranger schedule.","stayArea":"Historic downtown near the fort for walkability, or Anastasia Island to be next to the beach and state park."},
  {"city":"Orlando","pitch":"Skip the mega-parks and play to your family's water-and-animal streak: a ray-tank slide, a gator preserve, and wild manatees in a spring 40 minutes off the tourist grid.","perfectDay":[{"when":"Morning","stop":"Aquatica","note":"The animal-lover's water park — a slide passes right through a ray tank; all-ages and gentler than the mega-parks. (Check: Volcano Bay is closed Oct 26 '26–Mar 24 '27.)"},{"when":"Midday","stop":"LEGOLAND Florida + Water Park","note":"Rides scaled exactly to ages 2-10 — nobody ages out, nobody's scared. A calmer alternative day if you want dry rides."},{"when":"Afternoon","stop":"Gatorland","note":"The anti-mega-park — a 110-acre gator preserve with boardwalks and zip lines, easy afternoon pace."},{"when":"Evening","stop":"Blue Spring State Park","note":"In winter (mid-Nov–March) hundreds of wild manatees huddle here; boardwalk viewing 40 min off the grid."}],"signature":"Discovery Cove","rainyDay":"LEGOLAND Florida (indoor build zones and rides run rain or shine)","foodStop":"Skip the park food traps once a day — grab a casual meal near your resort area to reset budgets and moods.","kidTip":"Discovery Cove's dolphin swim is 6+, so the 5-yo can't do that specific activity — but the reef snorkel, aviary, and beaches work for her. Pick one park a day and start at rope drop; Florida afternoon storms make water parks a morning game.","stayArea":"Near the resort corridor (International Drive area) for water-park access, or DeLand-adjacent if you're prioritizing the Blue Spring manatees."},
  {"city":"Tampa / St. Pete","pitch":"A brand-new three-floor aquarium with a Gulf habitat swimming overhead, a rescue-dolphin hospital, and a century-old flamingo garden — Bay-area marine wonder for both girls.","perfectDay":[{"when":"Morning","stop":"Mote SEA","note":"The brand-new ('25) aquarium with a 400k-gal Gulf habitat overhead — go to UTC, NOT the closed old City Island site."},{"when":"Midday","stop":"The Florida Aquarium","note":"Downtown and hands-on; pairs perfectly with the Riverwalk if you want a second marine stop."},{"when":"Afternoon","stop":"Sunken Gardens","note":"A 100-year-old sunken tropical garden with flamingos in walkable St. Pete — a calm, shaded afternoon."},{"when":"Evening","stop":"Great Explorations","note":"Hands-on and 'designed for 10 and under' — an easy energy-burner near Sunken Gardens before dinner."}],"signature":"Mote SEA","rainyDay":"Glazer Children's Museum","foodStop":"A casual spot along the Tampa Riverwalk near the Florida Aquarium and Glazer museum.","kidTip":"Double-check you're routing to Mote SEA's new UTC location, not the old shuttered aquarium. Busch Gardens is a full separate day — combine it with an animal focus, and hit coasters early before the older girl tires and the sun peaks.","stayArea":"St. Pete for the walkable Sunken Gardens/Great Explorations cluster, or downtown Tampa near the Riverwalk aquarium."},
  {"city":"Nature Coast (Crystal River)","pitch":"The only place in America you can legally swim with wild manatees, plus a real underwater mermaid show — Old Florida's spring country delivers water and animals in one shot.","perfectDay":[{"when":"Morning","stop":"Swim with Manatees — Three Sisters Springs","note":"The only legal wild-manatee swim in the US; book an early guided tour (Nov 15–Mar 31) when the water's calmest."},{"when":"Midday","stop":"Ellie Schiller Homosassa Springs","note":"Walk underwater into the 'Fish Bowl' for face-to-glass manatees year-round plus a wildlife boardwalk — the off-season backup."},{"when":"Afternoon","stop":"Weeki Wachee Springs","note":"The legendary underwater mermaid show plus Buccaneer Bay spring slides (summer) for the girls to cool off."},{"when":"Evening","stop":"Giraffe Ranch","note":"Feed giraffes from a safari truck on a 47-acre preserve — reservation-only, a memorable wind-down if booked ahead."}],"signature":"Swim with Manatees — Three Sisters Springs","rainyDay":"Ellie Schiller Homosassa Springs (the underwater Fish Bowl is a covered, all-weather manatee view)","foodStop":"A casual seafood or springs-town cafe in Crystal River or Homosassa — the Nature Coast is low-key and local.","kidTip":"The manatee swim runs only Nov 15–Mar 31 and involves cold spring water — kids need wetsuits (provided) and comfort in the water; if you're visiting off-season or the 5-yo balks, the Homosassa Fish Bowl gives face-to-glass manatees any time. Devil's Den snorkel is 6+ and for strong swimmers only.","stayArea":"Crystal River / Homosassa for the manatee springs, or split toward Weeki Wachee if the mermaid show and summer slides are the priority."},
  {"city":"Charlotte","pitch":"Charlotte hands this family a whitewater raft ride, eagles at eye level, gold to pan, and a two-story science rainforest — all an easy 1.5-hour hop from the driveway.","perfectDay":[{"when":"Morning","stop":"U.S. National Whitewater Center","note":"Arrive at opening while it's cool; free trails first, then a guided family raft trip."},{"when":"Midday","stop":"U.S. National Whitewater Center","note":"Lunch riverside at the Center's grill so nobody loses momentum."},{"when":"Afternoon","stop":"Daniel Stowe Botanical Garden","note":"Shady paths and a fountain the 5-yo can splash in, ~20 min west in Belmont."},{"when":"Evening","stop":"Freedom Park & Little Sugar Creek Greenway","note":"Feed the ducks and burn off energy on the greenway loop before dinner."}],"signature":"U.S. National Whitewater Center","rainyDay":"Discovery Place Science","foodStop":"Amélie's French Bakery in NoDa — a quirky 24-hour spot with kid-loved macarons and hot chocolate.","kidTip":"Pair one big-ticket morning attraction with a free greenway or playground each afternoon so the Kindergartner can decompress while the 9-yo keeps moving; the LYNX Blue Line light rail between Uptown and South End is itself a cheap novelty ride.","stayArea":"South End / Uptown — walkable, restaurant-dense, and on the LYNX Blue Line light rail."},
  {"city":"Gatlinburg / Pigeon Forge","pitch":"A 2.25-hour drive drops this water-, animal- and wonder-loving family into a rare combo of world-class theme parks and the wild, salamander-filled heart of America's most-visited national park.","perfectDay":[{"when":"Morning","stop":"Cades Cove Loop","note":"Enter at dawn for the best shot at black bears and deer before crowds and heat build."},{"when":"Midday","stop":"Sugarlands Visitor Center & Salamander Creeks","note":"Cool off creekside on the flat Fighting Creek trail; grab Junior Ranger booklets for the girls."},{"when":"Afternoon","stop":"Ripley's Aquarium of the Smokies","note":"Beat afternoon storms indoors; the glass shark tunnel and stingray touch tank are AC-cooled hits."},{"when":"Evening","stop":"The Island in Pigeon Forge","note":"Free splash fountains let the 5-yo run wild while the family rides the Wheel at sunset and grabs dinner."}],"signature":"Dollywood","rainyDay":"WonderWorks","foodStop":"The Old Mill Restaurant in Pigeon Forge — Southern comfort plates beside a working 1830s gristmill.","kidTip":"Alternate one big-ticket park day with one low-key nature day so the Kindergartner doesn't melt down; carry water shoes for creek stops and pack the stroller for Dollywood's hills.","stayArea":"Base in Pigeon Forge — central to Dollywood, both water parks, and The Island, with more mid-range family hotels and a straight shot to the national park via Gatlinburg."},
  {"city":"NC Triangle (Raleigh–Durham)","pitch":"An easy 3.5-hour hop where free world-class science and history museums stack up against lemurs, ballgames, and lake beaches — a wonder-per-dollar jackpot for a curious 5- and 9-year-old.","perfectDay":[{"when":"Morning","stop":"Museum of Life and Science","note":"Arrive at 10 open; ride the train to the bears and lemurs before the heat and crowds build."},{"when":"Midday","stop":"Sarah P. Duke Gardens","note":"Picnic and feed the koi; shady terraces give the little one a stroller-nap window."},{"when":"Afternoon","stop":"Duke Lemur Center","note":"Book a mid-afternoon tour weeks ahead — it's reservation-only and the marquee memory."},{"when":"Evening","stop":"Durham Bulls Baseball","note":"Dollar-dog dinner at the ballpark; leave after the fireworks or the 7th if bedtime looms."}],"signature":"Duke Lemur Center","rainyDay":"NC Museum of Natural Sciences","foodStop":"Food-truck lunch or Bull City pizza at Durham's American Tobacco Campus, steps from the ballpark and Life & Science.","kidTip":"Bank the free museums for flexible afternoons — a 5-yo fades by 2pm, so front-load the one timed, reservation-only stop (Lemur Center) and keep the rest walk-in.","stayArea":"Base in Durham: central to the Lemur Center, Life & Science, Duke Gardens, and the Bulls, with Chapel Hill 15 min west and Raleigh 25 min east."}
];

  /* ================================================================
     Everything below is code, not data. Pages read data through
     Atlas.data.X at call time (never cache it): a successful hydrate
     replaces whole collections.
     ================================================================ */
  var HOME = "Greenville";
  var data = {
    THEMES: THEMES, SPOKES: SPOKES, CITIES: CITIES, EVENTS: EVENTS, TRIP_EVENTS: TRIP_EVENTS,
    PRICE_DATES: PRICE_DATES, HOTELS: HOTELS, PRICES: PRICES, A: A, COR: COR,
    COORDS: COORDS, PRESETS: PRESETS, PLAYBOOKS: PLAYBOOKS
  };
  var DATA_KEYS = Object.keys(data);
  var Atlas = { HOME: HOME, data: data, hydrated: false };

  /* ---------- small utilities ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function readAuth() {
    try { return JSON.parse(localStorage.getItem("fp_auth")) || null; } catch (e) { return null; }
  }

  /* ---------- fetch with the planner's session ---------- */
  // Sends the planner's access token; on a 401 it refreshes once and retries.
  async function atlasFetch(url, opts) {
    var get = readAuth;
    var go = function () {
      var s = get();
      var h = Object.assign({}, opts && opts.headers, s && s.access_token ? { Authorization: "Bearer " + s.access_token } : {});
      return fetch(url, Object.assign({}, opts, { headers: h }));
    };
    var r = await go();
    if (r.status !== 401) return r;
    var s = get();
    if (!s || !s.refresh_token) return r;
    try {
      var rr = await fetch("/api/auth/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!rr.ok) return r;
      localStorage.setItem("fp_auth", JSON.stringify(await rr.json()));
    } catch (e) { return r; }
    return go();
  }

  /* ---------- auth (read live from fp_auth) ---------- */
  Object.defineProperty(Atlas, "auth", {
    enumerable: true,
    get: function () {
      var s = readAuth();
      return { signedIn: !!(s && s.access_token), parent: !!(s && s.parent), email: (s && s.email) || "" };
    }
  });

  /* ---------- settings ---------- */
  var SETTING_DEFAULTS = {
    gas: 3.15, mpg: 25, food: 90, hotel: 150, nights: 2, buffer: 10,
    carRate: 65, localMi: 30, adults: 2, kids: 2
  };
  // [key, label, prefix, step, min]
  var SETTING_FIELDS = [
    ["gas", "Gas / gal", "$", 0.05, 0], ["mpg", "Miles / gal", "", 1, 1],
    ["food", "Food / day", "$", 5, 0], ["hotel", "Hotel / night", "$", 10, 0],
    ["nights", "Nights / stop", "", 1, 0], ["buffer", "Buffer %", "", 1, 0],
    ["carRate", "Car rental / day", "$", 5, 0], ["localMi", "Local mi / day", "", 5, 0],
    ["adults", "Adults", "", 1, 1], ["kids", "Kids", "", 1, 0]
  ];
  var settingsNow = Object.assign({}, SETTING_DEFAULTS);
  var settingsListeners = [];
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }   // same as the old num(): parseFloat || 0
  function loadSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem("atlas_settings"));
      if (saved && typeof saved === "object") {
        Object.keys(SETTING_DEFAULTS).forEach(function (k) {
          if (saved[k] !== undefined && saved[k] !== null && saved[k] !== "") settingsNow[k] = num(saved[k]);
        });
      }
    } catch (e) { /* storage blocked or bad JSON: stay on defaults */ }
  }
  function saveSettings() {
    try { localStorage.setItem("atlas_settings", JSON.stringify(settingsNow)); } catch (e) { /* ignore */ }
  }
  function notifySettings() {
    var snap = Object.assign({}, settingsNow);
    settingsListeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { console.error(e); } });
  }
  loadSettings();
  Atlas.settings = {
    defaults: Object.assign({}, SETTING_DEFAULTS),
    fields: SETTING_FIELDS,
    get: function () { return Object.assign({}, settingsNow); },
    set: function (partial) {
      var changed = false;
      Object.keys(partial || {}).forEach(function (k) {
        if (!(k in SETTING_DEFAULTS)) return;
        var v = num(partial[k]);
        if (settingsNow[k] !== v) { settingsNow[k] = v; changed = true; }
      });
      if (changed) { saveSettings(); notifySettings(); }
      return Object.assign({}, settingsNow);
    },
    reset: function () { Atlas.settings.set(SETTING_DEFAULTS); }
  };
  Atlas.onSettings = function (fn) {
    settingsListeners.push(fn);
    return function () { settingsListeners = settingsListeners.filter(function (f) { return f !== fn; }); };
  };
  try {
    window.addEventListener("storage", function (e) {   // another tab changed the settings
      if (e.key !== "atlas_settings") return;
      var before = JSON.stringify(settingsNow);
      settingsNow = Object.assign({}, SETTING_DEFAULTS); loadSettings();
      if (JSON.stringify(settingsNow) !== before) notifySettings();
    });
  } catch (e) { /* ignore */ }

  /* ---------- distance / money / dates (moved from index.html) ---------- */
  function hav(a, b) {
    var R = 3959, r = function (x) { return x * Math.PI / 180; };
    var dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
    var s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function dist(a, b) { return hav(data.COORDS[a], data.COORDS[b]) * 1.2; }
  function money(n) { return "$" + Math.round(n).toLocaleString(); }
  function hotelRate(city) { return data.HOTELS[city] != null ? data.HOTELS[city] : settingsNow.hotel; }
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtD(dt) { return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function fmtRange(a, b) {
    return a.getMonth() === b.getMonth()
      ? a.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + "–" + b.getDate()
      : fmtD(a) + " – " + fmtD(b);
  }

  /* ---------- cost engine (pure; reads Atlas.settings) ---------- */
  // What the old recompute() did for one city: round trip from home + nights + food + buffer.
  function cityCost(city, nights) {
    var s = settingsNow, gas = s.gas, mpg = s.mpg || 25, food = s.food, pct = s.buffer;
    var n = Math.max(0, Math.round(nights == null ? s.nights : num(nights)));
    var rt = dist(HOME, city) * 2, fuel = rt / mpg * gas;
    var hr = hotelRate(city), lodge = hr * n, foodc = food * (n + 1);
    var tot = (fuel + lodge + foodc) * (1 + pct / 100);
    return {
      city: city, nights: n, miles: rt, fuel: fuel,
      hotelRate: hr, hotelEstimated: data.HOTELS[city] == null, lodge: lodge,
      foodDays: n + 1, food: foodc, pct: pct, total: tot
    };
  }
  function tripMiles(seq) {
    var r = [HOME].concat((seq || []).map(function (c) { return typeof c === "string" ? c : c.city; }), [HOME]);
    var m = 0;
    for (var i = 1; i < r.length; i++) m += dist(r[i - 1], r[i]);
    return m;
  }
  // What the old computeTrip() did: stops = [{city, nights}].
  // Optional second argument `opts.hotelRates = {city: nightlyUsd}` overrides the nightly rate for
  // those cities in this one call (a searched rate a user chose to use). Valid overrides (finite, > 0)
  // win over researched and default rates and mark the stop `hotelOverride: true` (that key is only
  // present on overridden stops). Called without opts, the result is identical to before.
  function tripCost(stops, opts) {
    stops = stops || [];
    var ov = (opts && opts.hotelRates) || null;
    function ovRate(city) {
      var v = ov && Object.prototype.hasOwnProperty.call(ov, city) ? parseFloat(ov[city]) : NaN;
      return isFinite(v) && v > 0 ? v : null;
    }
    function rate(city) { var o = ovRate(city); return o != null ? o : hotelRate(city); }
    var s = settingsNow, gas = s.gas, mpg = s.mpg || 25, food = s.food, pct = s.buffer;
    var miles = tripMiles(stops.map(function (x) { return x.city; }));
    var fuel = miles / mpg * gas;
    var lodge = stops.reduce(function (t, x) { return t + rate(x.city) * x.nights; }, 0);
    var totalNights = stops.reduce(function (t, x) { return t + x.nights; }, 0);
    var days = totalNights + 1, foodc = food * days;
    var sub = fuel + lodge + foodc, buf = sub * pct / 100, tot = sub + buf;
    return {
      stops: stops.map(function (x) {
        var o = ovRate(x.city), r = o != null ? o : hotelRate(x.city);
        var row = { city: x.city, nights: x.nights, hotelRate: r, lodge: r * x.nights,
                    hotelEstimated: o != null ? false : data.HOTELS[x.city] == null };
        if (o != null) row.hotelOverride = true;
        return row;
      }),
      miles: miles, fuel: fuel, lodge: lodge, totalNights: totalNights, days: days, food: foodc,
      subtotal: sub, buffer: buf, pct: pct, total: tot, gas: gas, mpg: mpg
    };
  }
  // Nearest-neighbour from home, then 2-opt (the loop returns home). Takes and returns city names.
  function recommendRoute(cities) {
    var pool = (cities || []).map(function (c) { return typeof c === "string" ? c : c.city; });
    if (pool.length < 2) return pool;
    var seq = [], cur = HOME;
    while (pool.length) {
      var bi = 0, bd = Infinity;
      pool.forEach(function (c, i) { var d = dist(cur, c); if (d < bd) { bd = d; bi = i; } });
      cur = pool.splice(bi, 1)[0]; seq.push(cur);
    }
    var improved = true;
    while (improved) {
      improved = false;
      for (var i = 0; i < seq.length - 1; i++) for (var j = i + 1; j < seq.length; j++) {
        var cand = seq.slice(0, i).concat(seq.slice(i, j + 1).reverse(), seq.slice(j + 1));
        if (tripMiles(cand) < tripMiles(seq) - 0.01) { seq = cand; improved = true; }
      }
    }
    return seq;
  }

  /* ---------- drive vs fly ---------- */
  // Departure airports: GSP is home (no drive); ATL/CLT need a round-trip drive.
  var DEP_OPTS = [["GSP", null], ["ATL", "Atlanta"], ["CLT", "Charlotte"]];
  function depCity(code) { var o = DEP_OPTS.filter(function (x) { return x[0] === code; })[0]; return o ? o[1] : null; }
  function airportDriveFuel(code, gas, mpg) {
    var c = depCity(code);
    return c ? dist(HOME, c) * 2 / (mpg || 25) * gas : 0;
  }
  function farthestStop(stops) {
    if (!stops || !stops.length) return null;
    var best = null, bd = -1;
    stops.forEach(function (s) { var d = dist(HOME, s.city); if (d > bd) { bd = d; best = s.city; } });
    if (!best) return null;
    return { city: best, airport: (data.CITIES[best] && data.CITIES[best].airport) || null };
  }
  // The old computeFly() maths. opts: {stops, dep ("GSP"), airfare (party RT $, 0 = unknown), trip (optional tripCost result)}
  function flyCost(opts) {
    opts = opts || {};
    var s = settingsNow;
    var o = opts.trip || tripCost(opts.stops || [], { hotelRates: opts.hotelRates });
    var far = farthestStop(opts.stops || []);
    var dep = opts.dep || "GSP";
    var airfare = num(opts.airfare), carRate = s.carRate, localMi = s.localMi;
    var toAirport = airportDriveFuel(dep, o.gas, o.mpg);
    var rental = carRate * o.days, localGas = localMi * o.days / (o.mpg || 25) * o.gas;
    var flyTot = (airfare + toAirport + rental + localGas + o.lodge + o.food) * (1 + o.pct / 100);
    var win = airfare > 0 ? (flyTot < o.total ? "fly" : "drive") : "";
    return {
      far: far, dep: dep, airfare: airfare, toAirport: toAirport, carRate: carRate, rental: rental,
      localGas: localGas, days: o.days, lodge: o.lodge, food: o.food, pct: o.pct,
      driveTotal: o.total, flyTotal: flyTot, winner: win, delta: Math.abs(o.total - flyTot)
    };
  }

  /* ---------- trip finder ---------- */
  // Every single destination + every preset, costed like tripCost, within budget, best 8.
  function findTrips(opts) {
    opts = opts || {};
    var budget = num(opts.budget);
    var N = Math.max(1, Math.round(num(opts.nights)));
    var s = settingsNow, gas = s.gas, mpg = s.mpg || 25, food = s.food, pct = s.buffer;
    var routes = Object.keys(data.CITIES).map(function (c) { return [c]; }).concat(Object.keys(data.PRESETS).map(function (k) { return data.PRESETS[k]; }));
    var kept = [];
    routes.forEach(function (route) {
      var stops = route.length;
      if (stops > N) return;
      var base = Math.floor(N / stops), rem = N % stops;
      var nightsArr = route.map(function (_, i) { return base + (i < rem ? 1 : 0); });
      var seq = [HOME].concat(route, [HOME]);
      var miles = 0; for (var i = 1; i < seq.length; i++) miles += dist(seq[i - 1], seq[i]);
      var fuel = miles / mpg * gas;
      var lodge = route.reduce(function (t, c, i) { return t + hotelRate(c) * nightsArr[i]; }, 0);
      var days = N + 1, foodc = food * days;
      var sub = fuel + lodge + foodc, buf = sub * pct / 100, tot = sub + buf;
      if (tot <= budget) kept.push({ route: route, nightsArr: nightsArr, N: N, miles: miles, fuel: fuel, lodge: lodge, foodc: foodc, tot: tot, headroom: budget - tot, stops: stops });
    });
    kept.sort(function (a, b) { return b.stops - a.stops || a.tot - b.tot; });
    return kept.slice(0, 8);
  }

  /* ---------- saved trips + visited marks (api/index.js) ---------- */
  async function api(method, url, body) {
    var r;
    try {
      r = await atlasFetch(url, {
        method: method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error("Could not reach the server. Check your connection and try again.");
    }
    var d = null;
    try { d = await r.json(); } catch (e) { /* non-JSON body */ }
    if (!r.ok) {
      var msg = (d && d.error) || (r.status === 401 ? "Please sign in on the Planner first." : "Request failed (" + r.status + ")");
      var err = new Error(msg); err.status = r.status; throw err;
    }
    return d;
  }
  Atlas.trips = {
    list: function () { return api("GET", "/api/trips"); },
    create: function (trip) { return api("POST", "/api/trips", trip); },
    update: function (id, patch) { return api("PUT", "/api/trips/" + encodeURIComponent(id), patch); },
    remove: function (id) { return api("DELETE", "/api/trips/" + encodeURIComponent(id)); }
  };
  Atlas.marks = {
    list: function () { return api("GET", "/api/city-marks"); },
    set: function (city, m) {
      m = m || {};
      return api("PUT", "/api/city-marks/" + encodeURIComponent(city), { visited: !!m.visited, visited_on: m.visited_on || null });
    }
  };

  /* ---------- hydrate from /api/atlas/content ---------- */
  var dataListeners = [];
  Atlas.onData = function (fn) {
    dataListeners.push(fn);
    try { fn(); } catch (e) { console.error(e); }
  };
  // Any failure (offline, non-200, {error}, partial JSON) leaves the baked-in data untouched.
  Atlas.ready = (async function () {
    try {
      var r = await atlasFetch("/api/atlas/content", { cache: "no-store" });
      if (!r.ok) return;
      var d = await r.json();
      if (!d || d.error || !d.CITIES) return;
      DATA_KEYS.forEach(function (k) { if (d[k]) data[k] = d[k]; });
      Atlas.hydrated = true;
      dataListeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    } catch (e) { /* keep baked-in data */ }
  })();

  /* ---------- misc helpers ---------- */
  function cityUrl(city) { return "/atlas/city.html?c=" + encodeURIComponent(city); }
  var toastTimer;
  function toast(html) {
    var el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    el.innerHTML = html; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 4200);
  }
  async function copyText(msg) {
    try { await navigator.clipboard.writeText(msg); return true; }
    catch (e) {
      var ta = document.createElement("textarea"); ta.value = msg; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta); return ok;
    }
  }

  /* ---------- shared header + settings drawer ---------- */
  function mountChrome(activeKey) {
    var host = document.getElementById("atlas-chrome");
    if (!host) return;
    var links = [["explore", "Explore", "/atlas/"], ["plan", "Plan", "/atlas/plan.html"], ["trips", "Trips", "/atlas/trips.html"]];
    if (Atlas.auth.parent) links.push(["tools", "Tools", "/atlas/tools.html"]);
    var active = activeKey === "city" ? "explore" : activeKey;   // a city page lives under Explore
    var nav = links.map(function (l) {
      return '<a class="ac-link' + (l[0] === active ? " active" : "") + '" href="' + l[2] + '"' + (l[0] === active ? ' aria-current="page"' : "") + ">" + esc(l[1]) + "</a>";
    }).join("");
    var fields = SETTING_FIELDS.map(function (f) {
      return '<div class="assume"><label for="ac-set-' + f[0] + '">' + esc(f[1]) + '</label><div class="ip">' +
        (f[2] ? "<span>" + esc(f[2]) + "</span>" : "") +
        '<input id="ac-set-' + f[0] + '" data-key="' + f[0] + '" type="number" inputmode="decimal" step="' + f[3] + '" min="' + f[4] + '"></div></div>';
    }).join("");
    host.innerHTML =
      '<header class="ac-bar"><div class="ac-wrap">' +
        '<a class="ac-back" href="/">← Planner</a>' +
        '<a class="ac-title" href="/atlas/">Adventure Atlas</a>' +
        '<button type="button" class="ac-gear" aria-label="Travel assumptions" aria-expanded="false" aria-controls="ac-drawer">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        '</button>' +
        '<nav class="ac-nav" aria-label="Atlas sections">' + nav + '</nav>' +
      '</div></header>' +
      '<div class="ac-scrim" hidden></div>' +
      '<aside class="ac-drawer" id="ac-drawer" role="dialog" aria-label="Travel assumptions" aria-modal="true" hidden>' +
        '<div class="ac-drawer-head"><h2>Travel assumptions</h2><button type="button" class="ac-close" aria-label="Close">✕</button></div>' +
        '<p class="ac-drawer-note">Every price and trip estimate uses these. They are saved on this device. A city’s real hotel rate replaces the hotel default once it has been researched.</p>' +
        '<div class="ac-fields">' + fields + '</div>' +
        '<button type="button" class="linkbtn ac-reset">Reset to defaults</button>' +
      '</aside>';

    var gear = host.querySelector(".ac-gear"), drawer = host.querySelector(".ac-drawer"), scrim = host.querySelector(".ac-scrim");
    var inputs = host.querySelectorAll(".ac-fields input");
    function sync() {
      var s = settingsNow;
      inputs.forEach(function (inp) { if (inp !== document.activeElement) inp.value = s[inp.dataset.key]; });
    }
    function open() {
      sync(); drawer.hidden = false; scrim.hidden = false; gear.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", onKey);
      host.querySelector(".ac-close").focus();
    }
    function close() {
      drawer.hidden = true; scrim.hidden = true; gear.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onKey); gear.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    gear.addEventListener("click", function () { drawer.hidden ? open() : close(); });
    scrim.addEventListener("click", close);
    host.querySelector(".ac-close").addEventListener("click", close);
    host.querySelector(".ac-reset").addEventListener("click", function () { Atlas.settings.reset(); sync(); });
    inputs.forEach(function (inp) {
      inp.addEventListener("input", function () { var p = {}; p[inp.dataset.key] = inp.value; Atlas.settings.set(p); });
      inp.addEventListener("blur", sync);
    });
    Atlas.onSettings(sync);
    sync();
  }

  Atlas.fetch = atlasFetch;
  Atlas.esc = esc;
  Atlas.hav = hav; Atlas.dist = dist; Atlas.money = money; Atlas.hotelRate = hotelRate;
  Atlas.isoDate = isoDate; Atlas.fmtD = fmtD; Atlas.fmtRange = fmtRange;
  Atlas.cityCost = cityCost; Atlas.tripMiles = tripMiles; Atlas.tripCost = tripCost;
  Atlas.recommendRoute = recommendRoute; Atlas.flyCost = flyCost; Atlas.findTrips = findTrips;
  Atlas.DEP_OPTS = DEP_OPTS; Atlas.airportDriveFuel = airportDriveFuel; Atlas.farthestStop = farthestStop;
  Atlas.cityUrl = cityUrl; Atlas.toast = toast; Atlas.copyText = copyText;
  Atlas.mountChrome = mountChrome;

  window.Atlas = Atlas;
})();
