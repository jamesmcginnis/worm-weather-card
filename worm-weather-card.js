// ================================================================
// WORM WEATHER CARD
// Dark glass aesthetic · Atmospheric canvas · Stable editor
// ================================================================
(function () {
'use strict';

/* ─────────────────────────── LEAFLET ─────────────────────────── */
let _lfP = null;
function loadLeaflet(sr) {
  if (!_lfP) {
    _lfP = new Promise(res => {
      if (window.L) { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = res; document.head.appendChild(s);
    });
  }
  if (sr && !sr.querySelector('#lf-css')) {
    const l = document.createElement('link');
    l.id = 'lf-css'; l.rel = 'stylesheet';
    l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    sr.prepend(l);
  }
  return _lfP;
}

/* ─────────────────────────── GEOCODE ─────────────────────────── */
async function geocode(postcode, cc) {
  try {
    let q = encodeURIComponent((postcode || '').trim());
    if (cc) q += '&countrycodes=' + cc.toLowerCase().trim();
    const r = await fetch('https://nominatim.openstreetmap.org/search?q=' + q + '&format=json&limit=1', { headers: { 'Accept-Language': 'en' } });
    const d = await r.json();
    if (d && d[0]) return { lat: +d[0].lat, lon: +d[0].lon, name: d[0].display_name };
  } catch (_) {}
  return null;
}

/* ─────────────────────────── CONSTANTS ─────────────────────────── */
const W_ICONS = {
  'clear-night':'mdi:weather-night','cloudy':'mdi:weather-cloudy',
  'exceptional':'mdi:weather-sunny-alert','fog':'mdi:weather-fog',
  'hail':'mdi:weather-hail','lightning':'mdi:weather-lightning',
  'lightning-rainy':'mdi:weather-lightning-rainy','partlycloudy':'mdi:weather-partly-cloudy',
  'pouring':'mdi:weather-pouring','rainy':'mdi:weather-rainy',
  'snowy':'mdi:weather-snowy','snowy-rainy':'mdi:weather-snowy-rainy',
  'sunny':'mdi:weather-sunny','windy':'mdi:weather-windy',
  'windy-variant':'mdi:weather-windy-variant',
};
const W_LABELS = {
  'clear-night':'Clear Night','cloudy':'Cloudy','exceptional':'Exceptional',
  'fog':'Foggy','hail':'Hail','lightning':'Lightning','lightning-rainy':'Thunderstorm',
  'partlycloudy':'Partly Cloudy','pouring':'Heavy Rain','rainy':'Rainy',
  'snowy':'Snowy','snowy-rainy':'Sleet','sunny':'Sunny','windy':'Windy','windy-variant':'Windy',
};
const W_SKY = {   // night / dark-theme sky RGB (top of gradient)
  'clear-night':[5,8,25],'cloudy':[38,50,80],'exceptional':[28,95,215],
  'fog':[58,68,88],'hail':[18,26,48],'lightning':[13,18,38],
  'lightning-rainy':[13,18,38],'partlycloudy':[28,82,175],
  'pouring':[14,32,72],'rainy':[18,52,108],'snowy':[48,62,98],
  'snowy-rainy':[33,48,82],'sunny':[28,95,215],'windy':[33,68,138],
  'windy-variant':[33,68,138],'default':[28,58,118],
};
const W_SKY_L = { // day / light-theme sky (top color, gradient sweeps to lighter bottom)
  'sunny':[74,149,214],'partlycloudy':[102,165,217],'exceptional':[56,132,210],
  'cloudy':[128,166,198],'fog':[190,202,216],'hail':[100,125,148],
  'lightning':[98,115,132],'lightning-rainy':[98,115,132],
  'pouring':[105,130,150],'rainy':[110,140,162],'snowy':[168,194,218],
  'snowy-rainy':[148,175,200],'windy':[88,155,202],'windy-variant':[88,155,202],
  'default':[88,145,200],
};
const W_PRECIP = {
  'hail':{ rain:true, count:120 },
  'lightning':{ rain:true, count:160, thunder:true },
  'lightning-rainy':{ rain:true, count:130, thunder:true },
  'pouring':{ rain:true, count:200 },
  'rainy':{ rain:true, count:120 },
  'snowy':{ snow:true, count:65 },
  'snowy-rainy':{ rain:true, snow:true, count:80 },
};
const W_CLOUDS = {
  'clear-night':0,'cloudy':5,'exceptional':0,'fog':6,'hail':5,
  'lightning':6,'lightning-rainy':6,'partlycloudy':3,'pouring':6,
  'rainy':5,'snowy':5,'snowy-rainy':5,'sunny':0,'windy':4,'windy-variant':4,
};
const TILES = {
  dark:    { url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',  attr:'© OpenStreetMap © CARTO', sub:'abcd' },
  light:   { url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attr:'© OpenStreetMap © CARTO', sub:'abcd' },
  standard:{ url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',          attr:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', sub:'abc' },
};
const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const TWO_PI = Math.PI * 2;

/* ─────────────────────────── HELPERS ─────────────────────────── */
const wdir = b => b == null ? '—' : WIND_DIRS[Math.round(b / 22.5) % 16];
const fmtT = iso => { const d = new Date(iso), h = d.getHours(); return (h % 12 || 12) + (h >= 12 ? 'pm' : 'am'); };
const fmtD = iso => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso).getDay()];
const cvt  = (v,u) => v == null ? '—' : u === '°F' ? Math.round(v * 9/5 + 32) : Math.round(v);
// One decimal place — used for the mini card temperature
const cvtD = (v,u) => v == null ? '—' : u === '°F' ? (v * 9/5 + 32).toFixed(1) : parseFloat(v).toFixed(1);

// Convert temperature from its native source unit to the display unit the user chose.
// HA exposes the entity's native unit via attributes.temperature_unit.
// If the entity already reports in the display unit, no conversion is needed.
const cvtTemp = (v, displayUnit, sourceUnit) => {
  if (v == null) return '—';
  const src = sourceUnit || '°C';
  // Normalise to °C first
  const c = src === '°F' ? (v - 32) * 5/9 : src === 'K' ? v - 273.15 : v;
  return displayUnit === '°F' ? Math.round(c * 9/5 + 32) : Math.round(c);
};
const cvtTempD = (v, displayUnit, sourceUnit) => {
  if (v == null) return '—';
  const src = sourceUnit || '°C';
  const c = src === '°F' ? (v - 32) * 5/9 : src === 'K' ? v - 273.15 : v;
  return (displayUnit === '°F' ? c * 9/5 + 32 : c).toFixed(1);
};

// Convert wind speed from its native source unit to the display unit the user chose.
// HA exposes the entity's native unit via attributes.wind_speed_unit.
// Supported HA wind units: km/h, m/s, mph, kn (knots), ft/s
const cvtWind = (v, displayUnit, sourceUnit) => {
  if (v == null) return null;
  const src = sourceUnit || 'km/h';
  // Convert source → m/s as canonical intermediate
  let ms;
  switch (src) {
    case 'm/s':   ms = v;           break;
    case 'km/h':  ms = v / 3.6;     break;
    case 'mph':   ms = v * 0.44704; break;
    case 'kn':    ms = v * 0.514444;break;
    case 'ft/s':  ms = v * 0.3048;  break;
    default:      ms = v / 3.6;     break; // assume km/h
  }
  // Convert m/s → display unit
  switch (displayUnit) {
    case 'm/s':  return ms.toFixed(1);
    case 'mph':  return Math.round(ms * 2.23694) + '';
    case 'km/h':
    default:     return Math.round(ms * 3.6) + '';
  }
};
const uvl  = u => !u ? '' : u <= 2 ? 'Low' : u <= 5 ? 'Moderate' : u <= 7 ? 'High' : u <= 10 ? 'Very High' : 'Extreme';
const wico = (state, sz=24, style='') => `<ha-icon icon="${W_ICONS[state]||'mdi:weather-cloudy'}" style="--mdc-icon-size:${sz}px;display:inline-flex;align-items:center;${style}"></ha-icon>`;
const ico  = (icon, sz=20, style='') => `<ha-icon icon="${icon}" style="--mdc-icon-size:${sz}px;display:inline-flex;align-items:center;${style}"></ha-icon>`;

/* ═══════════════════════ ATMOSPHERIC CANVAS ═══════════════════════
 * Full port of visual effects from Atmospheric Weather Card v3.3
 * Clouds · Stars · Sun · Moon · Rain · Snow · Lightning · Fog
 * ══════════════════════════════════════════════════════════════════ */
class AtmCanvas {
  constructor(canvas) {
    this._cv = canvas; this._ctx = null;
    this._animId = null; this._lastFrame = 0;
    // Particle systems
    this._stars        = []; this._clouds     = []; this._rain = [];
    this._snow         = []; this._bolts      = []; this._fog  = [];
    this._birds        = []; this._windVapor  = [];
    this._shootStars   = []; this._comets     = [];
    this._planes       = []; this._dustMotes  = [];
    this._ufos         = []; this._enterprise = [];
    this._whales       = []; this._wormhole   = null;
    this._aurora       = null;
    this._birdTimer = 0; this._planeTimer = 0; this._ufoTimer = 0;
    this._enterpriseTimer = 0; this._borgTimer   = 0; this._wormholeTimer = 0; this._angryBirdTimer = 0;
    // Sci-fi individual flags
    this._scifiUFO=true; this._scifiEnterprise=true; this._scifiBorg=true; this._scifiWormhole=true; this._angryBirds=true;
    // State
    this._cond = 'sunny'; this._isNight = false; this._isDark = true;
    this._w = 0; this._h = 0;
    // Phase counters
    this._frame = 0; this._gustPh = 0; this._sunPh = 0; this._moonPh = 0;
    this._flashOp = 0; this._flashHold = 0;
    this._shimmerPh = 0;
  }

  /* ── Public API ──────────────────────────────────────────────── */
  init(cond, isNight, isDark, w, h, sf = {}) {
    this._cond = cond || 'cloudy';
    this._isNight = !!isNight; this._isDark = !!isDark;
    this._scifiUFO=sf.ufo!==false; this._scifiEnterprise=sf.enterprise!==false; this._scifiBorg=sf.borg!==false; this._scifiWormhole=sf.wormhole!==false; this._angryBirds=sf.angryBirds!==false;
    this._w = w; this._h = h;
    this._cv.width = w; this._cv.height = h;
    this._ctx = this._cv.getContext('2d');
    this._build();
  }

  update(cond, isNight, isDark, sf = {}) {
    const nu=sf.ufo!==false, ne=sf.enterprise!==false, nb=sf.borg!==false, nwo=sf.wormhole!==false, nab=sf.angryBirds!==false;
    const ch = this._cond !== cond || this._isNight !== !!isNight || this._isDark !== !!isDark || this._scifiUFO!==nu || this._scifiEnterprise!==ne || this._scifiBorg!==nb || this._scifiWormhole!==nwo || this._angryBirds!==nab;
    this._cond = cond; this._isNight = !!isNight; this._isDark = !!isDark;
    this._scifiUFO=nu; this._scifiEnterprise=ne; this._scifiBorg=nb; this._scifiWormhole=nwo; this._angryBirds=nab;
    if (ch) this._build();
  }

  resize(w, h) {
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    this._cv.width = w; this._cv.height = h;
    this._ctx = this._cv.getContext('2d');
    this._build();
  }

  start() {
    if (this._animId) return;
    const TARGET = 1000 / 30;
    const loop = (ts) => {
      if (ts - this._lastFrame >= TARGET) {
        this._lastFrame = ts - ((ts - this._lastFrame) % TARGET);
        this._draw();
      }
      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }

  /* ── Seeded random ───────────────────────────────────────────── */
  _sRand(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  /* ── Build all particle systems ──────────────────────────────── */
  _build() {
    const c = this._cond, w = this._w, h = this._h;
    this._stars=[]; this._clouds=[]; this._rain=[];
    this._snow=[]; this._bolts=[]; this._fog=[];
    this._birds=[]; this._windVapor=[];
    this._shootStars=[]; this._comets=[]; this._planes=[];
    this._dustMotes=[]; this._ufos=[]; this._enterprise=[];
    this._borg=[]; this._borgTint=0; this._borgWobblePh=0; this._wormhole=null; this._angryBirdFlock=[]; this._abQueue=null; this._abLaunchDelay=0; this._aurora=null;
    this._flashOp=0;

    this._buildStars(c, w, h);
    this._buildClouds(c, w, h);
    this._buildPrecip(c, w, h);
    if (c==='fog') this._buildFog(w, h);
    this._buildWindVapor(w, h);

    // Aurora: dark-theme night on clear/partly-cloudy, rare (4% chance)
    if (this._isNight && this._isDark && (c==='clear-night'||c==='partlycloudy'||c==='cloudy') && Math.random()<0.04) {
      this._buildAurora(w, h);
    }
    // Dust motes: daytime sunny/fair conditions only
    if (!this._isNight && (c==='sunny'||c==='exceptional'||c==='partlycloudy')) {
      this._buildDustMotes(w, h);
    }
    // Birds: 35% chance on non-severe daytime
    if (!this._isNight && Math.random()<0.35) this._spawnBirds(w, h);
    // Plane: 25% chance always
    if (Math.random()<0.25) this._spawnPlane(w, h);
  }

  /* ── Stars ───────────────────────────────────────────────────── */
  _buildStars(c, w, h) {
    if (!this._isNight) return;
    const counts = { 'clear-night':240,'exceptional':200,'partlycloudy':85,
      'windy':70,'windy-variant':65,'cloudy':35,'fog':18,'rainy':18,
      'snowy':28,'snowy-rainy':18,'lightning':8,'lightning-rainy':8,'pouring':6,'hail':10 };
    const n = counts[c] ?? 55;
    const PI2 = Math.PI*2;
    for (let i = 0; i < n; i++) {
      const isBg = i<n*.68, isHero = i>=n*.90;
      const tier = isHero?'hero':isBg?'bg':'mid';
      const [sz,br,rate] = isHero ? [1.4+Math.random(),.78+Math.random()*.18,.003+Math.random()*.006]
                         : isBg   ? [0.4+Math.random()*.7,.28+Math.random()*.22,.012+Math.random()*.015]
                         :          [.85+Math.random()*.85,.52+Math.random()*.24,.008+Math.random()*.01];
      const rv = Math.random();
      this._stars.push({ x:Math.random()*w, y:Math.random()*h*.88,
        r:sz, brightness:br, rate, phase:Math.random()*PI2, tier,
        hue:rv<.15?35:rv<.55?215:200, sat:rv<.15?60:rv<.55?25:8 });
    }
  }

  /* ── Clouds ──────────────────────────────────────────────────── */
  _buildClouds(c, w, h) {
    const nc = ({'clear-night':0,'sunny':0,'exceptional':0,'partlycloudy':4,'cloudy':9,
      'fog':7,'hail':8,'lightning':10,'lightning-rainy':9,'pouring':10,'rainy':8,
      'snowy':8,'snowy-rainy':7,'windy':6,'windy-variant':6})[c] ?? 5;
    const storm = c==='lightning'||c==='lightning-rainy'||c==='pouring'||c==='hail';
    const rainy  = c==='rainy'||c==='snowy'||c==='snowy-rainy';

    for (let i=0; i<nc; i++) {
      const rand = this._sRand(Math.random()*9999 + i*1337);
      // Depth layers: foreground clouds are bigger and lower
      const layer = 1 + (i % 3);             // 1=bg, 2=mid, 3=fg
      const depthScale = 0.55 + layer * 0.22; // bg smaller, fg larger
      const x = Math.random()*(w*1.6) - w*.3;
      const yRange = storm ? 0.42 : rainy ? 0.48 : 0.54;
      const y = h*(0.02 + rand()*(storm?0.38:yRange));
      const baseR = h*(0.10 + rand()*0.22) * depthScale;
      const vSq  = storm ? 0.38 : 0.42;    // vertical squash

      // Build organic cloud from many overlapping puffs
      // More puffs = rounder, more detailed shape
      const pc = 10 + Math.floor(rand()*7);  // 10-16 puffs per cloud
      const puffs = [];

      // Main body ring of puffs
      for (let p=0; p<pc; p++) {
        const ang = (p/pc)*Math.PI*2 + rand()*.6;
        const dist = rand()*.55 + .22;
        const dx = Math.cos(ang)*baseR*.58*dist;
        const dy = Math.sin(ang)*baseR*.58*dist*vSq;
        const r  = baseR*(.18 + rand()*.26);
        const normY = (dy + baseR*vSq) / (baseR*vSq*2);
        puffs.push({dx, dy, r, shade: Math.min(1, 0.38+(1-normY)*0.50), isRim:false});
      }
      // Crown puffs — extra large, bright top
      puffs.push({dx:0,         dy:-baseR*vSq*.25, r:baseR*.42, shade:.96, isRim:false});
      puffs.push({dx:-baseR*.18,dy:-baseR*vSq*.18, r:baseR*.30, shade:.90, isRim:false});
      puffs.push({dx: baseR*.18,dy:-baseR*vSq*.18, r:baseR*.30, shade:.90, isRim:false});
      // Side puffs for width
      puffs.push({dx:-baseR*.52,dy: baseR*vSq*.08, r:baseR*.28, shade:.72, isRim:false});
      puffs.push({dx: baseR*.52,dy: baseR*vSq*.08, r:baseR*.28, shade:.72, isRim:false});
      // Rim highlight — very subtle bright edge on top
      puffs.push({dx:0,         dy:-baseR*vSq*.35, r:baseR*.18, shade:1.0, isRim:true});

      puffs.sort((a,b)=>a.shade-b.shade);  // draw dark first, bright on top

      // Wind speed: fg clouds move faster than bg
      const spd = (0.04 + rand()*0.10) * depthScale;

      this._clouds.push({x, y, puffs, speed:spd, op:0.72+rand()*0.24,
        breathPh:rand()*Math.PI*2, breathSpd:0.002+rand()*0.003,
        layer, flashInt:0, depthScale});
    }
  }

  /* ── Precipitation ───────────────────────────────────────────── */
  _buildPrecip(c, w, h) {
    const pm = {'hail':{rain:80},'lightning':{rain:160},'lightning-rainy':{rain:130},
      'pouring':{rain:200},'rainy':{rain:120},'snowy':{snow:60},'snowy-rainy':{rain:55,snow:35}};
    const p = pm[c]||{};
    for (let i=0;i<(p.rain||0);i++) {
      const z=.42+Math.random()*.58;
      this._rain.push({x:Math.random()*w,y:Math.random()*h,vy:(5.5+Math.random()*5.5)*z,
        vx:(-.55-Math.random()*.75)*z,len:(9+Math.random()*14)*z,op:.22+Math.random()*.38,z});
    }
    for (let i=0;i<(p.snow||0);i++) {
      const z=.42+Math.random()*.58, sr=Math.random();
      const sz=sr<.28?(.38+Math.random()*.55)*z:sr<.68?(1.1+Math.random()*1.1)*z:(2.0+Math.random()*1.8)*z;
      this._snow.push({x:Math.random()*w,y:Math.random()*h,vy:(.28+Math.random()*.65)*z*(sz/2.2),
        vx:(Math.random()-.5)*.38,size:sz,op:.5+Math.random()*.42,z,
        wobPh:Math.random()*Math.PI*2,wobSpd:.016+Math.random()*.016});
    }
  }

  /* ── Fog ─────────────────────────────────────────────────────── */
  _buildFog(w, h) {
    for (let i=0;i<8;i++) {
      this._fog.push({x:Math.random()*w,y:h*(.28+Math.random()*.58),
        bw:w*(.9+Math.random()*.85),bh:30+Math.random()*42,
        spd:(.06+Math.random()*.10)*(Math.random()>.5?1:-1),
        op:.22+Math.random()*.14,ph:Math.random()*Math.PI*2,layer:i/8});
    }
  }

  /* ── Wind vapor ──────────────────────────────────────────────── */
  _buildWindVapor(w, h) {
    for (let i=0;i<18;i++) {
      const tier=i<6?0:i<12?1:2, depth=0.5+tier*0.25;
      this._windVapor.push({x:Math.random()*w*2-w*.5,y:h*.05+Math.random()*h*.85,
        w:w*(.7+Math.random()*.9)*depth,speed:(0.8+Math.random()*1.4)*depth,
        tier,ph:Math.random()*Math.PI*2,phSpd:.004+Math.random()*.004,
        drift:1.5+Math.random()*3,squash:.06+tier*.03+Math.random()*.02});
    }
  }

  /* ── Aurora borealis ─────────────────────────────────────────── */
  _buildAurora(w, h) {
    this._aurora = {
      ph: 0,
      waves: Array.from({length:6},(_,i) => ({
        y: h*.06+i*9,
        speed: .005+Math.random()*.010,
        amp: 5+Math.random()*8,
        wl: .010+Math.random()*.008,
        color: ['rgba(80,255,160,.18)','rgba(100,200,255,.18)','rgba(180,100,255,.14)','rgba(255,120,200,.12)'][Math.floor(Math.random()*4)],
        offset: Math.random()*Math.PI*2,
      }))
    };
  }

  /* ── Dust motes ──────────────────────────────────────────────── */
  _buildDustMotes(w, h) {
    const cx=w*.74, cy=h*.25;
    for (let i=0;i<28;i++) {
      this._dustMotes.push({
        x:cx+(Math.random()-.5)*280, y:cy+(Math.random()-.5)*140,
        size:.4+Math.random()*1.4,
        vx:(Math.random()-.5)*.28, vy:(Math.random()-.5)*.18,
        ph:Math.random()*Math.PI*2, op:.12+Math.random()*.22,
      });
    }
  }

  /* ── Birds ───────────────────────────────────────────────────── */
  _spawnBirds(w, h) {
    const c=this._cond;
    if (c==='lightning'||c==='lightning-rainy'||c==='pouring'||c==='hail') return;
    const dir=Math.random()>.5?1:-1, depth=.75+Math.random()*.5;
    const speed=(0.7+Math.random()*.55)*dir*depth;
    const startX=dir>0?-70:w+70, startY=h*.10+Math.random()*h*.38;
    const count=1+Math.floor(Math.random()*10);
    const formation=Math.floor(Math.random()*3);
    for (let i=0;i<count;i++) {
      let offX=0,offY=0;
      if (count>1) {
        if (formation===0){const row=Math.floor((i+1)/2),side=i%2===0?1:-1;offX=-15*row*dir;offY=8*row*side;}
        else if (formation===1){offX=-18*i*dir;offY=10*i*(Math.random()>.5?1:-1);}
        else{offX=(Math.random()-.5)*60*dir;offY=(Math.random()-.5)*45;}
      }
      this._birds.push({x:startX+offX*depth,y:startY+offY*depth,vx:speed,vy:(Math.random()-.5)*.06,
        flapPh:i+Math.random()*2,flapSpd:.13+Math.random()*.06,size:(2.0+Math.random()*.7)*depth});
    }
  }

  /* ── Plane ───────────────────────────────────────────────────── */
  _spawnPlane(w, h) {
    const goRight=Math.random()>.5, dir=goRight?1:-1;
    const climbAng = Math.random()<.33 ? (1+Math.random()*4)*Math.PI/180 : 0;
    const speed = 0.55+Math.random()*.45;
    const TRAIL = 360;
    this._planes.push({
      x:goRight?-110:w+110, y:h*.12+Math.random()*h*.40,
      vx:dir*Math.cos(climbAng)*speed, vy:-Math.sin(climbAng)*speed,
      climbAng, scale:.45+Math.random()*.35,
      blinkPh:Math.random()*10,
      trailBuf:new Float32Array(TRAIL*3), trailHead:0, trailLen:0,
      gapTimer:0, dir,
    });
  }

  /* ── Cloud colour palette ────────────────────────────────────── */
  _pal() {
    const c=this._cond,n=this._isNight,d=this._isDark;
    const storm=c==='lightning'||c==='lightning-rainy'||c==='pouring';
    if (n&&d)     return {lit:[215,225,240],shd:[10,16,30], amb:.72};
    if (n)        return {lit:[200,215,240],shd:[40,52,78], amb:.85};
    if (d&&storm) return {lit:[110,118,135],shd:[12,15,22], amb:.85};
    if (d)        return {lit:[228,238,255],shd:[24,29,48], amb:.80};
    if (storm)    return {lit:[255,255,255],shd:[120,132,158],amb:.92};
    if (c==='rainy'||c==='snowy'||c==='snowy-rainy') return {lit:[255,255,255],shd:[155,166,190],amb:1.0};
    if (c==='cloudy'||c==='fog') return {lit:[255,255,255],shd:[120,134,162],amb:1.0};
    return {lit:[255,255,255],shd:[176,187,207],amb:1.0};
  }

  /* ── Master draw ─────────────────────────────────────────────── */
  _draw() {
    const ctx=this._ctx; if(!ctx) return;
    const w=this._w, h=this._h, c=this._cond;
    this._frame++; this._gustPh+=.008; this._sunPh+=.006; this._moonPh+=.003; this._shimmerPh+=.018;
    if (this._scifiWormhole) {
      this._wormholeTimer++;
      if (!this._wormhole && this._wormholeTimer > 600 && Math.random() < .0008) {
        this._wormholeTimer = 0;
        this._wormhole = this._makeWormhole(w, h);
      }
    }
    ctx.clearRect(0,0,w,h);
    this._dSky(ctx,w,h);
    // Background layers
    if (this._aurora)                    this._dAurora(ctx,w,h);
    if (this._isNight&&this._stars.length) this._dStars(ctx,w,h);
    if (this._isNight&&this._isDark)     this._dShootingStars(ctx,w,h);
    if (this._isDark)                    this._dComets(ctx,w,h);
    if (this._isNight) this._dMoon(ctx,w,h); else this._dSun(ctx,w,h);
    // Mid layers
    this._dWindVapor(ctx,w,h);
    // Background + mid clouds (layers 1-2) drawn first — UFO flies in front of these
    if (this._clouds.length)  this._dClouds(ctx,w,h, 1, 2);
    if (this._fog.length)     this._dFog(ctx,w,h);
    if (!this._isNight)       this._dBirds(ctx,w,h);
    this._dPlanes(ctx,w,h);
    this._dUFO(ctx,w,h);
    this._dEnterprise(ctx,w,h);
    this._dBorg(ctx,w,h);
    if (this._scifiWormhole && this._wormhole) this._dWormhole(ctx,w,h);
    this._dAngryBirds(ctx,w,h);
    // Foreground clouds (layer 3) drawn on top — UFO passes behind these
    if (this._clouds.length)  this._dClouds(ctx,w,h, 3, 3);
    if (this._dustMotes.length&&!this._isNight) this._dDustMotes(ctx,w,h);
    if (!this._isNight&&(c==='sunny'||c==='exceptional')) this._dHeatShimmer(ctx,w,h);
    // Foreground precipitation
    if (this._rain.length)   this._dRain(ctx,w,h);
    if (this._snow.length)   this._dSnow(ctx,w,h);
    if (c==='lightning'||c==='lightning-rainy') this._dLightning(ctx,w,h);
  }

  /* ── Sky ─────────────────────────────────────────────────────── */
  _dSky(ctx, w, h) {
    const c=this._cond, n=this._isNight, d=this._isDark;
    const useLight=!n&&!d;
    const skyMap=useLight?W_SKY_L:W_SKY;
    const [sr,sg,sb]=skyMap[c]||skyMap.default||[28,58,118];
    const g=ctx.createLinearGradient(0,0,0,h);
    if (useLight) {
      // Extra stops for smoother light-sky transition
      g.addColorStop(0,   `rgb(${Math.max(0,sr-22)},${Math.max(0,sg-22)},${Math.max(0,sb-16)})`);
      g.addColorStop(.18, `rgb(${Math.max(0,sr-12)},${Math.max(0,sg-12)},${Math.max(0,sb-8)})`);
      g.addColorStop(.40, `rgb(${sr},${sg},${sb})`);
      g.addColorStop(.62, `rgb(${Math.min(255,sr+20)},${Math.min(255,sg+22)},${Math.min(255,sb+12)})`);
      g.addColorStop(.82, `rgb(${Math.min(255,sr+42)},${Math.min(255,sg+44)},${Math.min(255,sb+26)})`);
      g.addColorStop(1,   `rgb(${Math.min(255,sr+72)},${Math.min(255,sg+70)},${Math.min(255,sb+38)})`);
    } else if (n) {
      g.addColorStop(0,   `rgb(${Math.max(0,sr-4)},${Math.max(0,sg-4)},${Math.max(0,sb-4)})`);
      g.addColorStop(.30, `rgb(${Math.max(0,sr-2)},${Math.max(0,sg-2)},${Math.max(0,sb-2)})`);
      g.addColorStop(.65, `rgb(${sr},${sg},${sb})`);
      g.addColorStop(.85, `rgb(${Math.min(255,sr+3)},${Math.min(255,sg+3)},${Math.min(255,sb+3)})`);
      g.addColorStop(1,   `rgb(${Math.min(255,sr+6)},${Math.min(255,sg+6)},${Math.min(255,sb+6)})`);
    } else {
      g.addColorStop(0,   `rgb(${Math.max(0,sr-22)},${Math.max(0,sg-22)},${Math.max(0,sb-20)})`);
      g.addColorStop(.25, `rgb(${Math.max(0,sr-12)},${Math.max(0,sg-12)},${Math.max(0,sb-11)})`);
      g.addColorStop(.55, `rgb(${sr},${sg},${sb})`);
      g.addColorStop(.78, `rgb(${Math.min(255,sr+5)},${Math.min(255,sg+6)},${Math.min(255,sb+8)})`);
      g.addColorStop(1,   `rgb(${Math.min(255,sr+10)},${Math.min(255,sg+12)},${Math.min(255,sb+16)})`);
    }
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

    // Warm horizon haze on light clear/fair days
    if (useLight&&(c==='sunny'||c==='partlycloudy'||c==='exceptional'||c==='windy'||c==='windy-variant')) {
      const hz=ctx.createLinearGradient(0,h*.60,0,h);
      hz.addColorStop(0,'rgba(255,230,180,0)'); hz.addColorStop(1,'rgba(255,215,148,0.13)');
      ctx.fillStyle=hz; ctx.fillRect(0,0,w,h);
    }

    // Film-grain noise overlay — breaks up gradient banding
    // Uses a seeded pattern that changes slowly so it's not distracting
    const grainOp = useLight ? 0.028 : (n ? 0.018 : 0.022);
    this._dGrain(ctx, w, h, grainOp);
  }

  /* ── Film grain — eliminates canvas gradient banding ────────── */
  _dGrain(ctx, w, h, opacity) {
    // Draw a sparse scatter of tiny semi-transparent pixels
    // Using a fast pseudo-random walk rather than ImageData for performance
    const count = Math.floor(w * h * 0.08); // ~8% pixel coverage
    const seed  = (this._frame * 1.618 + 137) | 0; // slowly drifting seed
    ctx.save();
    ctx.globalAlpha = opacity;
    // Alternate between light and dark grain for true dithering
    for (let i = 0; i < count; i++) {
      // LCG fast random inline
      const r = (seed * 1664525 + (i * 22695477 + 1013904223)) >>> 0;
      const x = (r >>> 17) % w;
      const y = (r >>> 5)  % h;
      const bright = (r & 1) ? 255 : 0;
      ctx.fillStyle = `rgba(${bright},${bright},${bright},1)`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }

  /* ── Aurora borealis ─────────────────────────────────────────── */
  _dAurora(ctx, w, h) {
    if (!this._aurora) return;
    const PI2=Math.PI*2;
    this._aurora.ph+=.005;
    ctx.save(); ctx.globalCompositeOperation=this._isDark?'lighter':'source-over';
    for (const wave of this._aurora.waves) {
      ctx.fillStyle=wave.color;
      ctx.beginPath();
      for (let x=0;x<=w;x+=5) {
        const y=wave.y+Math.sin(x*wave.wl+this._aurora.ph*wave.speed*80+wave.offset)*wave.amp;
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.lineTo(w,wave.y+55); ctx.lineTo(0,wave.y+55); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ── Stars ───────────────────────────────────────────────────── */
  _dStars(ctx, w, h) {
    const dark=this._isDark, PI2=Math.PI*2;
    for (const s of this._stars) {
      s.phase+=s.rate;
      const tw=Math.sin(s.phase)+Math.sin(s.phase*2.85)*.38;
      const op=Math.max(0,Math.min(1,s.brightness*(1+tw*.18)));
      if (op<.04) continue;
      const r=s.r*(1+tw*.22);
      const fill=dark?`hsla(${s.hue},${s.sat}%,93%,${op})`:`hsla(${s.hue<100?36:42},72%,${s.hue<100?42:38}%,${op*.82})`;
      if (s.tier==='hero') {
        if (dark) {
          ctx.globalCompositeOperation='lighter';
          const gr=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,r*3);
          gr.addColorStop(0,`hsla(${s.hue},${s.sat}%,95%,${op*.88})`);
          gr.addColorStop(.45,`hsla(${s.hue},${s.sat}%,90%,${op*.14})`);
          gr.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(s.x,s.y,r*3,0,PI2); ctx.fill();
          ctx.globalCompositeOperation='source-over';
        }
        ctx.globalAlpha=op; ctx.fillStyle=fill;
        ctx.beginPath(); ctx.arc(s.x,s.y,r*.58,0,PI2); ctx.fill();
        ctx.globalAlpha=op*.28; ctx.strokeStyle=fill; ctx.lineWidth=.5;
        ctx.beginPath();
        ctx.moveTo(s.x-r*1.9,s.y); ctx.lineTo(s.x+r*1.9,s.y);
        ctx.moveTo(s.x,s.y-r*1.9); ctx.lineTo(s.x,s.y+r*1.9);
        ctx.stroke();
      } else {
        ctx.globalCompositeOperation=dark?'lighter':'source-over';
        ctx.globalAlpha=op*(dark?1:.78); ctx.fillStyle=fill;
        ctx.beginPath(); ctx.arc(s.x,s.y,r*.50,0,PI2); ctx.fill();
      }
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  }

  /* ── Shooting stars ──────────────────────────────────────────── */
  _dShootingStars(ctx, w, h) {
    // Spawn
    if (Math.random()<.0012 && this._shootStars.length<2) {
      const spX = Math.random()<.7 ? Math.random()*w*.6 : w*.6+Math.random()*w*.4;
      this._shootStars.push({
        x:spX, y:Math.random()*h*.5,
        vx:4.5+Math.random()*2.8, vy:1.8+Math.random()*1.8,
        life:1.0, size:1.2+Math.random()*1.4,
        trail:[], maxTrail:20,
      });
    }
    ctx.lineCap='round';
    const dark=this._isDark;
    for (let i=this._shootStars.length-1;i>=0;i--) {
      const s=this._shootStars[i];
      s.trail.push([s.x,s.y]);
      if (s.trail.length>s.maxTrail) s.trail.shift();
      s.x+=s.vx; s.y+=s.vy; s.life-=.042;
      if (s.life<=0){this._shootStars.splice(i,1);continue;}
      const op=s.life;
      ctx.globalAlpha=op*(dark?1:.55);
      ctx.fillStyle=dark?'rgba(255,255,255,1)':'rgba(50,55,65,1)';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.size,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=dark?'rgba(255,255,240,1)':'rgba(60,65,80,1)';
      for (let j=1;j<s.trail.length;j++) {
        ctx.globalAlpha=op*(1-j/s.trail.length)*(dark?.55:.30);
        ctx.lineWidth=s.size*.7;
        ctx.beginPath(); ctx.moveTo(s.trail[j-1][0],s.trail[j-1][1]);
        ctx.lineTo(s.trail[j][0],s.trail[j][1]); ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  }

  /* ── Comets ──────────────────────────────────────────────────── */
  _dComets(ctx, w, h) {
    // Only on night clear/partly
    const c=this._cond;
    const ok=this._isNight&&(c==='clear-night'||c==='partlycloudy'||c==='exceptional');
    if (ok && this._comets.length===0 && Math.random()<.00018) {
      const goRight=Math.random()>.5;
      const spd=2.0+Math.random()*1.2;
      this._comets.push({
        x:goRight?-60:w+60, y:Math.random()*h*.42,
        vx:spd*(goRight?1:-1), vy:spd*.14,
        life:1.2, size:1.4+Math.random()*.8,
        trail:[], maxTrail:90,
      });
    }
    const dark=this._isDark;
    ctx.lineCap='round';
    for (let i=this._comets.length-1;i>=0;i--) {
      const co=this._comets[i];
      co.trail.push([co.x,co.y]);
      if (co.trail.length>co.maxTrail) co.trail.shift();
      co.x+=co.vx; co.y+=co.vy; co.life-=.004;
      if (co.life<=0||(co.x<-120||co.x>w+120)){this._comets.splice(i,1);continue;}
      const op=Math.min(1,co.life);
      // Head glow
      ctx.save(); ctx.globalCompositeOperation=dark?'lighter':'source-over';
      const gr=ctx.createRadialGradient(co.x,co.y,0,co.x,co.y,co.size*4);
      dark ? (gr.addColorStop(0,`rgba(220,240,255,${op})`),gr.addColorStop(.4,`rgba(100,200,255,${op*.4})`),gr.addColorStop(1,'rgba(100,200,255,0)'))
           : (gr.addColorStop(0,`rgba(50,60,75,${op})`),gr.addColorStop(.4,`rgba(70,85,105,${op*.4})`),gr.addColorStop(1,'rgba(70,85,105,0)'));
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(co.x,co.y,co.size*4,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // Tail
      ctx.strokeStyle=dark?'rgba(160,210,255,1)':'rgba(65,80,100,1)';
      for (let j=1;j<co.trail.length;j++) {
        const p=j/co.trail.length;
        ctx.globalAlpha=op*(1-p)*.55;
        ctx.lineWidth=co.size*(1-p*.8);
        ctx.beginPath(); ctx.moveTo(co.trail[j-1][0],co.trail[j-1][1]);
        ctx.lineTo(co.trail[j][0],co.trail[j][1]); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
  }

  /* ── Moon ────────────────────────────────────────────────────── */
  _dMoon(ctx, w, h) {
    const wobble = this._borgTint > 0 ? Math.sin(this._borgWobblePh) * 3.5 * this._borgTint : 0;
    const mx=w*.73 + wobble, my=h*.26, dark=this._isDark, PI2=Math.PI*2;
    const moonR=Math.min(h*.115,22), pulse=1+Math.sin(this._moonPh*.8)*.016;
    ctx.globalCompositeOperation=dark?'screen':'source-over';
    const glowR=moonR*(dark?3.5:2.8);
    const glow=ctx.createRadialGradient(mx,my,0,mx,my,glowR);
    dark?(glow.addColorStop(0,'rgba(185,208,255,.62)'),glow.addColorStop(.38,'rgba(165,192,248,.20)'),glow.addColorStop(1,'rgba(148,175,220,0)'))
        :(glow.addColorStop(0,'rgba(140,178,255,.72)'),glow.addColorStop(.32,'rgba(158,192,255,.30)'),glow.addColorStop(1,'rgba(175,208,255,0)'));
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(mx,my,glowR,0,PI2); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    if (dark){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,1)';ctx.beginPath();ctx.arc(mx,my,moonR*pulse-.5,0,PI2);ctx.fill();ctx.restore();}
    const disc=ctx.createRadialGradient(mx-moonR*.3,my-moonR*.3,0,mx,my,moonR*pulse);
    dark?(disc.addColorStop(0,'rgba(255,255,252,.97)'),disc.addColorStop(.62,'rgba(232,240,255,.93)'),disc.addColorStop(1,'rgba(210,225,248,.86)'))
        :(disc.addColorStop(0,'rgba(255,255,255,.90)'),disc.addColorStop(.62,'rgba(242,248,255,.80)'),disc.addColorStop(1,'rgba(218,232,252,.65)'));
    ctx.fillStyle=disc; ctx.beginPath(); ctx.arc(mx,my,moonR*pulse,0,PI2); ctx.fill();
    if (moonR>8){
      ctx.save(); ctx.beginPath(); ctx.arc(mx,my,moonR,0,PI2); ctx.clip();
      ctx.globalAlpha=dark?.14:.11; ctx.fillStyle=dark?'rgba(28,33,52,1)':'rgba(175,188,210,1)';
      ctx.beginPath(); ctx.ellipse(mx-moonR*.40,my+moonR*.10,moonR*.30,moonR*.40,.22,0,PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx+moonR*.33,my-moonR*.24,moonR*.20,moonR*.14,-.3,0,PI2); ctx.fill();
      ctx.restore();
    }
    // Borg tractor beam — natural red energy aura on moon
    if (this._borgTint > 0) {
      const t = this._borgTint;
      const pulse = 1 + Math.sin(this._borgWobblePh * 1.8) * 0.12 * t;
      ctx.save();
      // Outer disturbed halo
      ctx.globalCompositeOperation = 'screen';
      const outerG = ctx.createRadialGradient(mx, my, moonR * 0.7, mx, my, moonR * 3.2 * pulse);
      outerG.addColorStop(0,    'rgba(200,30,0,0)');
      outerG.addColorStop(0.35, `rgba(220,40,10,${0.20 * t})`);
      outerG.addColorStop(0.65, `rgba(180,25,5,${0.12 * t})`);
      outerG.addColorStop(1,    'rgba(150,15,0,0)');
      ctx.fillStyle = outerG;
      ctx.beginPath(); ctx.arc(mx, my, moonR * 3.2 * pulse, 0, PI2); ctx.fill();
      // Mid corona shift
      const midG = ctx.createRadialGradient(mx, my, 0, mx, my, moonR * 1.8 * pulse);
      midG.addColorStop(0,   'rgba(255,20,0,0)');
      midG.addColorStop(0.4, `rgba(240,15,0,${0.18 * t})`);
      midG.addColorStop(0.75,`rgba(200,10,0,${0.10 * t})`);
      midG.addColorStop(1,   'rgba(180,8,0,0)');
      ctx.fillStyle = midG;
      ctx.beginPath(); ctx.arc(mx, my, moonR * 1.8 * pulse, 0, PI2); ctx.fill();
      // Inner disc tint
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = t * 0.40;
      const innerG = ctx.createRadialGradient(mx - moonR*.2, my - moonR*.2, 0, mx, my, moonR * pulse);
      innerG.addColorStop(0,   'rgba(255,130,90,1)');
      innerG.addColorStop(0.5, 'rgba(255,65,35,1)');
      innerG.addColorStop(1,   'rgba(210,25,10,1)');
      ctx.fillStyle = innerG;
      ctx.beginPath(); ctx.arc(mx, my, moonR * pulse, 0, PI2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  _dSun(ctx, w, h) {
    const c=this._cond;
    if (c==='fog'||c==='lightning'||c==='lightning-rainy'||c==='pouring') return;
    const wobble = this._borgTint > 0 ? Math.sin(this._borgWobblePh) * 3.5 * this._borgTint : 0;
    const sx=w*.74 + wobble, sy=h*.25, dark=this._isDark, PI2=Math.PI*2;
    const pulse=1+Math.sin(this._sunPh*.55)*.032, sunR=Math.min(h*.13,24);
    const cR=sunR*(dark?3.5:5.5)*pulse;
    const cor=ctx.createRadialGradient(sx,sy,0,sx,sy,cR);
    dark?(cor.addColorStop(0,'rgba(255,225,85,.32)'),cor.addColorStop(.20,'rgba(255,195,45,.16)'),cor.addColorStop(.52,'rgba(255,165,22,.06)'),cor.addColorStop(1,'rgba(255,138,0,0)'))
        :(cor.addColorStop(0,'rgba(255,245,170,.80)'),cor.addColorStop(.15,'rgba(255,220,88,.52)'),cor.addColorStop(.32,'rgba(255,195,50,.26)'),cor.addColorStop(.55,'rgba(255,170,25,.10)'),cor.addColorStop(1,'rgba(255,140,0,0)'));
    ctx.fillStyle=cor; ctx.beginPath(); ctx.arc(sx,sy,cR,0,PI2); ctx.fill();
    const dR=(dark?sunR:sunR*2.5)*pulse;
    const disc=ctx.createRadialGradient(sx-sunR*.22,sy-sunR*.24,0,sx,sy,dR);
    dark?(disc.addColorStop(0,'rgba(255,255,218,1)'),disc.addColorStop(.38,'rgba(255,218,65,1)'),disc.addColorStop(1,'rgba(255,132,0,1)'))
        :(disc.addColorStop(0,'rgba(255,255,255,1)'),disc.addColorStop(.25,'rgba(255,255,228,.98)'),disc.addColorStop(.52,'rgba(255,235,150,.88)'),disc.addColorStop(.78,'rgba(255,195,58,.48)'),disc.addColorStop(1,'rgba(255,160,28,0)'));
    ctx.fillStyle=disc; ctx.beginPath(); ctx.arc(sx,sy,dR,0,PI2); ctx.fill();
    // Borg tractor beam — natural red energy aura
    if (this._borgTint > 0) {
      const t = this._borgTint;
      const pulse = 1 + Math.sin(this._borgWobblePh * 1.8) * 0.12 * t; // aura breathes with wobble
      ctx.save();
      // Layer 1: wide outer disturbance halo — red-orange, very soft
      ctx.globalCompositeOperation = 'screen';
      const outerG = ctx.createRadialGradient(sx, sy, dR * 0.6, sx, sy, dR * 2.8 * pulse);
      outerG.addColorStop(0,   `rgba(200,30,0,0)`);
      outerG.addColorStop(0.35,`rgba(220,40,10,${0.18 * t})`);
      outerG.addColorStop(0.65,`rgba(180,25,5,${0.12 * t})`);
      outerG.addColorStop(1,    'rgba(160,20,0,0)');
      ctx.fillStyle = outerG;
      ctx.beginPath(); ctx.arc(sx, sy, dR * 2.8 * pulse, 0, PI2); ctx.fill();
      // Layer 2: mid corona shift — pulls the normal warm corona toward deep red
      const midG = ctx.createRadialGradient(sx, sy, 0, sx, sy, dR * 1.6 * pulse);
      midG.addColorStop(0,   `rgba(255,20,0,0)`);
      midG.addColorStop(0.4, `rgba(240,15,0,${0.22 * t})`);
      midG.addColorStop(0.75,`rgba(200,10,0,${0.14 * t})`);
      midG.addColorStop(1,   'rgba(180,8,0,0)');
      ctx.fillStyle = midG;
      ctx.beginPath(); ctx.arc(sx, sy, dR * 1.6 * pulse, 0, PI2); ctx.fill();
      // Layer 3: inner disc tint — warms/reddens the disc surface naturally
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = t * 0.45;
      const innerG = ctx.createRadialGradient(sx-sunR*.2, sy-sunR*.2, 0, sx, sy, dR);
      innerG.addColorStop(0,   `rgba(255,120,80,1)`);
      innerG.addColorStop(0.5, `rgba(255,60,30,1)`);
      innerG.addColorStop(1,   `rgba(200,20,10,1)`);
      ctx.fillStyle = innerG;
      ctx.beginPath(); ctx.arc(sx, sy, dR, 0, PI2); ctx.fill();
      ctx.restore();
    }
  }

  /* ── Wind vapor ──────────────────────────────────────────────── */
  _dWindVapor(ctx, w, h) {
    const c=this._cond, PI2=Math.PI*2;
    const isWindy=c==='windy'||c==='windy-variant'||c==='cloudy'||c==='partlycloudy'||c==='rainy'||c==='snowy';
    const spdScale=isWindy?1.8:.6, d=this._isDark;
    const wind=.06+Math.sin(this._gustPh)*.04;
    for (const v of this._windVapor) {
      v.ph+=v.phSpd*spdScale; v.x+=(v.speed*spdScale+wind*40)*.5;
      if (v.x>w+v.w) v.x=-v.w;
      const uy=Math.sin(v.ph)*v.drift;
      const baseOp=d?(.04+v.tier*.02):(.08+v.tier*.04);
      const op=Math.min(.28,baseOp*(isWindy?1.6:1.0));
      if (op<.01) continue;
      const col=d?'210,225,245':'255,255,255';
      const gr=ctx.createRadialGradient(v.x,v.y+uy,0,v.x,v.y+uy,v.w/2);
      gr.addColorStop(0,`rgba(${col},${op})`); gr.addColorStop(.45,`rgba(${col},${op*.35})`); gr.addColorStop(1,`rgba(${col},0)`);
      ctx.save(); ctx.scale(1,v.squash*2.5);
      ctx.fillStyle=gr; ctx.beginPath();
      ctx.ellipse(v.x,(v.y+uy)/(v.squash*2.5),v.w/2,v.w*.3,0,0,PI2); ctx.fill();
      ctx.restore();
    }
  }

  /* ── Clouds ──────────────────────────────────────────────────── */
  _dClouds(ctx, w, h, minLayer = 1, maxLayer = 3) {
    const pal  = this._pal();
    const wind = .06 + Math.sin(this._gustPh)*.06;
    const PI2  = Math.PI*2;

    const sorted = [...this._clouds].sort((a,b) => a.layer - b.layer);

    for (const cl of sorted) {
      if (cl.layer < minLayer || cl.layer > maxLayer) continue;
      // Parallax: bg clouds drift slower
      cl.x += cl.speed * wind * (1 + cl.layer * .20);
      if (cl.x > w + 200) cl.x = -200;
      cl.breathPh += cl.breathSpd;
      const bS = 1 + Math.sin(cl.breathPh) * .018;
      const fl = cl.flashInt || 0; if (fl > 0) cl.flashInt *= .70;

      ctx.save(); ctx.translate(cl.x, cl.y);

      for (const pf of cl.puffs) {
        const dx = pf.dx * bS, dy = pf.dy, r = pf.r * bS;
        const sh = pf.shade, is = 1 - sh;

        // Base colour from palette interpolation
        let tR = (pal.lit[0]*sh + pal.shd[0]*is) | 0;
        let tG = (pal.lit[1]*sh + pal.shd[1]*is) | 0;
        let tB = (pal.lit[2]*sh + pal.shd[2]*is) | 0;
        const mR = ((pal.lit[0]+pal.shd[0])/2)|0;
        const mG = ((pal.lit[1]+pal.shd[1])/2)|0;
        const mB = ((pal.lit[2]+pal.shd[2])/2)|0;

        // Lightning flash tint
        if (fl > .01) {
          tR = (tR + (255-tR)*fl*.65) | 0;
          tG = (tG + (255-tG)*fl*.65) | 0;
          tB = (tB + (255-tB)*fl*.85) | 0;
        }

        // Layer opacity: bg clouds slightly more transparent
        const layerAlpha = 0.82 + cl.layer * 0.06;
        const op = Math.min(1, cl.op * pal.amb * sh * layerAlpha);
        if (op < .03) continue;

        if (pf.isRim) {
          // Rim highlight: thin bright crescent on top using screen blend
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = op * .55;
          const rg = ctx.createRadialGradient(dx-r*.12, dy-r*.42, 0, dx, dy, r);
          rg.addColorStop(0, `rgba(255,255,255,.85)`);
          rg.addColorStop(.45, `rgba(255,255,255,.20)`);
          rg.addColorStop(1,  `rgba(255,255,255,0)`);
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.ellipse(dx, dy, r, r*.55, 0, 0, PI2); ctx.fill();
          ctx.restore();
        } else {
          // Main puff — 4-stop radial gradient for volume
          const g = ctx.createRadialGradient(dx-r*.16, dy-r*.42, 0, dx, dy, r*1.05);
          g.addColorStop(0,   `rgba(${tR},${tG},${tB},${Math.min(1,op*1.1)})`);
          g.addColorStop(.28, `rgba(${tR},${tG},${tB},${op})`);
          g.addColorStop(.58, `rgba(${mR},${mG},${mB},${op*.55})`);
          g.addColorStop(.82, `rgba(${pal.shd[0]},${pal.shd[1]},${pal.shd[2]},${op*.10})`);
          g.addColorStop(1,   `rgba(${pal.shd[0]},${pal.shd[1]},${pal.shd[2]},0)`);
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(dx, dy, r, r * .72, 0, 0, PI2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* ── Fog ─────────────────────────────────────────────────────── */
  _dFog(ctx, w, h) {
    const col=this._isDark?'82,88,105':'188,198,215', PI2=Math.PI*2;
    for (const f of this._fog) {
      f.x+=f.spd; f.ph+=.006;
      if(f.x>w+f.bw/2)f.x=-f.bw/2; if(f.x<-f.bw/2)f.x=w+f.bw/2;
      const ys=.14+f.layer*.19, uy=Math.sin(f.ph)*3.5;
      ctx.save(); ctx.scale(1,ys);
      const g=ctx.createRadialGradient(f.x,(f.y+uy)/ys,0,f.x,(f.y+uy)/ys,f.bw/2);
      g.addColorStop(0,`rgba(${col},${f.op})`); g.addColorStop(.52,`rgba(${col},${f.op*.52})`); g.addColorStop(1,`rgba(${col},0)`);
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(f.x,(f.y+uy)/ys,f.bw/2,f.bh,0,0,PI2); ctx.fill(); ctx.restore();
    }
  }

  /* ── Birds ───────────────────────────────────────────────────── */
  _dBirds(ctx, w, h) {
    const c=this._cond;
    if (c==='lightning'||c==='lightning-rainy'||c==='pouring'||c==='hail') return;
    this._birdTimer=(this._birdTimer||0)+1;
    if (this._birds.length===0 && this._birdTimer>180 && Math.random()<.007){this._birdTimer=0;this._spawnBirds(w,h);}
    const col=!this._isDark?'rgba(40,45,52,0.80)':'rgba(200,210,220,0.65)';
    ctx.strokeStyle=col; ctx.lineJoin='round'; ctx.lineCap='round';
    for (let i=this._birds.length-1;i>=0;i--) {
      const b=this._birds[i]; b.x+=b.vx; b.y+=b.vy; b.flapPh+=b.flapSpd;
      const env=Math.max(0,Math.sin(b.flapPh*.38)), wing=Math.sin(b.flapPh)*b.size*env;
      const dir=b.vx>0?1:-1;
      ctx.lineWidth=Math.max(.8,b.size*.45);
      ctx.beginPath();
      ctx.moveTo(b.x-b.size*dir,b.y+wing-b.size/2.2);
      ctx.lineTo(b.x,b.y); ctx.lineTo(b.x-b.size*dir,b.y+wing+b.size/2.2); ctx.stroke();
      if ((b.vx>0&&b.x>w+80)||(b.vx<0&&b.x<-80)) this._birds.splice(i,1);
    }
    ctx.lineCap='butt'; ctx.lineJoin='miter';
  }

  /* ── Planes with contrails ───────────────────────────────────── */
  _dPlanes(ctx, w, h) {
    this._planeTimer=(this._planeTimer||0)+1;
    if (this._planes.length===0 && this._planeTimer>300 && Math.random()<.004){this._planeTimer=0;this._spawnPlane(w,h);}
    const dark=this._isDark;
    for (let i=this._planes.length-1;i>=0;i--) {
      const pl=this._planes[i];
      pl.x+=pl.vx; pl.y+=pl.vy;
      pl.gapTimer>0?pl.gapTimer--:(Math.random()<.004&&(pl.gapTimer=8+Math.random()*14));
      // Store trail point
      const ti=pl.trailHead;
      pl.trailBuf[ti*3]=pl.x; pl.trailBuf[ti*3+1]=pl.y+(Math.random()-.5)*1.2; pl.trailBuf[ti*3+2]=pl.gapTimer>0?1:0;
      pl.trailHead=(pl.trailHead+1)%120; if(pl.trailLen<120)pl.trailLen++;
      // Draw contrail (two offset stripes)
      if (pl.trailLen>2) {
        const sinA=Math.sin(pl.climbAng), cosA=Math.cos(pl.climbAng);
        ctx.lineCap='round'; ctx.lineWidth=2.2*pl.scale;
        ctx.strokeStyle=dark?'rgba(215,225,245,.08)':'rgba(255,255,255,.18)';
        for (const oY of [-3,3]) {
          ctx.beginPath(); let drawing=false;
          for (let j=0;j<Math.min(pl.trailLen,110);j++) {
            const ri=((pl.trailHead-1-j+120)%120);
            if (pl.trailBuf[ri*3+2]>.5){drawing=false;continue;}
            const px=pl.trailBuf[ri*3]+sinA*oY*pl.scale*pl.dir;
            const py=pl.trailBuf[ri*3+1]+cosA*oY*pl.scale;
            const a=1-j/pl.trailLen;
            ctx.globalAlpha=a*(dark?.12:.22);
            drawing?ctx.lineTo(px,py):(ctx.moveTo(px,py),drawing=true);
          }
          ctx.stroke();
        }
        ctx.globalAlpha=1;
      }
      // Draw silhouette
      ctx.save(); ctx.translate(pl.x,pl.y); ctx.scale(pl.scale,pl.scale);
      if (pl.climbAng>0) ctx.rotate(-pl.climbAng*pl.dir);
      ctx.strokeStyle=dark?'rgba(130,140,150,.90)':'rgba(100,108,118,.85)';
      ctx.lineWidth=1.5; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(7*pl.dir,0); ctx.lineTo(-7*pl.dir,0);   // fuselage
      ctx.moveTo(-6*pl.dir,0); ctx.lineTo(-9*pl.dir,-4); // tail fin
      ctx.moveTo(2*pl.dir,0); ctx.lineTo(-1*pl.dir,2.5); // wing stub
      ctx.stroke();
      // Nav light blink
      pl.blinkPh+=.11;
      if (Math.sin(pl.blinkPh)>.75) {
        ctx.globalAlpha=1; ctx.fillStyle=pl.vx>0?'rgba(90,255,130,1)':'rgba(255,100,100,1)';
        ctx.beginPath(); ctx.arc(0,1,1.5,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      if (pl.x<-450||pl.x>w+450) this._planes.splice(i,1);
    }
    ctx.globalAlpha=1; ctx.lineCap='butt'; ctx.lineJoin='miter';
  }

  /* ── Alien UFO ───────────────────────────────────────────────── */
  _spawnUFO(w, h) {
    const goRight = Math.random() > .5;
    const dir = goRight ? 1 : -1;
    const startX = goRight ? -90 : w + 90;
    const hoverX = w * (.30 + Math.random() * .40);
    const hoverY = h * (.10 + Math.random() * .28);
    this._ufos.push({
      x: startX,
      y: hoverY,
      startX,
      hoverX,
      hoverY,
      dir,
      phase: 'enter',
      enterProgress: 0,   // 0→1 smooth lerp for entry
      hoverFrames: 100 + Math.floor(Math.random() * 80),
      hoverTimer: 0,
      vx: 0, vy: 0,       // only used during exit
      bobPh: Math.random() * Math.PI * 2,
      lightPh: 0,
      armPh: 0,
      armOut: 0,
      scale: 0.55 + Math.random() * .30,
      beamOp: 0,
    });
  }

  _dUFO(ctx, w, h) {
    if (!this._scifiUFO) return;
    this._ufoTimer++;
    if (this._ufos.length === 0 && this._ufoTimer > 480 && Math.random() < .0015) {
      this._ufoTimer = 0;
      this._spawnUFO(w, h);
    }

    const dark = this._isDark;
    const PI2 = Math.PI * 2;

    for (let i = this._ufos.length - 1; i >= 0; i--) {
      const u = this._ufos[i];
      u.lightPh += .08;
      if (u.phase !== 'enter') u.bobPh += .025;

      if (u.phase === 'enter') {
        // Smooth ease-out: cubic easing so entry starts fast and settles gently
        u.enterProgress += 0.018;
        if (u.enterProgress >= 1) {
          u.enterProgress = 1;
          u.phase = 'hover';
          u.bobPh = 0; // reset so hover bob starts from exact hoverX/hoverY — no jump
        }
        const t = u.enterProgress;
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        u.x = u.startX + (u.hoverX - u.startX) * eased;
        u.y = u.hoverY;

      } else if (u.phase === 'hover') {
        // Gentle bob in place
        u.x = u.hoverX + Math.sin(u.bobPh * .4) * 3.5;
        u.y = u.hoverY + Math.sin(u.bobPh) * 2.2;
        u.hoverTimer++;
        u.beamOp = Math.min(.42, u.beamOp + .015);
        u.armPh += .06;
        u.armOut = Math.max(0, Math.sin(u.armPh * .35));
        if (u.hoverTimer > u.hoverFrames) {
          u.phase = 'exit';
          u.vx = u.dir * 1.8;
          u.vy = -0.8;
          u.beamOp = 0;
        }

      } else {
        // Exit: smooth acceleration away using ease-in (starts slow, ends fast)
        u.vx += u.dir * 0.22;
        u.vy -= 0.06;
        u.x += u.vx;
        u.y += u.vy;
      }

      const sc = u.scale;
      ctx.save(); ctx.translate(u.x, u.y + Math.sin(u.bobPh) * 2);

      // Tractor beam (hover phase only)
      if (u.beamOp > .01) {
        const bg = ctx.createLinearGradient(0, 0, 0, 38 * sc);
        bg.addColorStop(0, `rgba(120,255,180,${u.beamOp})`);
        bg.addColorStop(1, `rgba(120,255,180,0)`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-14*sc, 4*sc);
        ctx.lineTo(14*sc, 4*sc);
        ctx.lineTo(24*sc, 38*sc);
        ctx.lineTo(-24*sc, 38*sc);
        ctx.closePath(); ctx.fill();
      }

      // Saucer body — dark underside
      ctx.globalAlpha = 1;
      const bodyGrad = ctx.createRadialGradient(0, -4*sc, 0, 0, 0, 22*sc);
      bodyGrad.addColorStop(0, dark?'rgba(160,175,195,1)':'rgba(190,205,220,1)');
      bodyGrad.addColorStop(.5, dark?'rgba(90,105,125,1)':'rgba(140,158,178,1)');
      bodyGrad.addColorStop(1,  dark?'rgba(40,48,62,1)':'rgba(80,95,115,1)');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath(); ctx.ellipse(0, 2*sc, 22*sc, 7*sc, 0, 0, PI2); ctx.fill();

      // Dome
      const domeGrad = ctx.createRadialGradient(-4*sc, -8*sc, 0, 0, -4*sc, 12*sc);
      domeGrad.addColorStop(0,  'rgba(160,240,255,.92)');
      domeGrad.addColorStop(.42,'rgba(80,200,240,.70)');
      domeGrad.addColorStop(.82,'rgba(30,120,180,.45)');
      domeGrad.addColorStop(1,  'rgba(10,60,120,.20)');
      ctx.fillStyle = domeGrad;
      ctx.beginPath(); ctx.ellipse(0, 0, 12*sc, 9*sc, 0, Math.PI, PI2); ctx.fill();

      // Dome rim
      ctx.strokeStyle = dark?'rgba(140,220,255,.55)':'rgba(80,180,240,.50)';
      ctx.lineWidth = .8*sc; ctx.beginPath();
      ctx.ellipse(0, 0, 12*sc, 1.5*sc, 0, 0, PI2); ctx.stroke();

      // Rotating colour lights around rim
      const numLights = 5;
      for (let l = 0; l < numLights; l++) {
        const ang = (l/numLights)*PI2 + u.lightPh;
        const lx = Math.cos(ang)*18*sc, ly = Math.sin(ang)*5*sc + 2*sc;
        const hue = (l/numLights)*360 + u.lightPh*30;
        const blink = 0.5 + Math.sin(u.lightPh*3 + l*1.2)*0.5;
        ctx.globalAlpha = .7 + blink*.3;
        // Glow
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createRadialGradient(lx,ly,0,lx,ly,4*sc);
        lg.addColorStop(0,`hsla(${hue},100%,75%,.7)`); lg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(lx,ly,4*sc,0,PI2); ctx.fill();
        ctx.restore();
        // Dot
        ctx.globalAlpha = 1;
        ctx.fillStyle = `hsla(${hue},100%,72%,1)`;
        ctx.beginPath(); ctx.arc(lx, ly, 2.2*sc, 0, PI2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Alien arm wave (hover phase)
      if (u.phase === 'hover' && u.armOut > .05) {
        // Tiny alien visible in dome
        ctx.save(); ctx.globalAlpha = .80;
        ctx.strokeStyle = dark?'rgba(80,230,180,1)':'rgba(40,180,140,1)';
        ctx.lineWidth = 1.5*sc; ctx.lineCap = 'round';
        const aDir = u.dir;
        const armAngle = -0.6 + u.armOut * Math.sin(u.armPh) * 1.2;
        // Head
        ctx.fillStyle = dark?'rgba(100,230,180,1)':'rgba(50,200,150,1)';
        ctx.beginPath(); ctx.arc(2*sc*aDir, -6*sc, 2.2*sc, 0, PI2); ctx.fill();
        // Body
        ctx.beginPath(); ctx.moveTo(2*sc*aDir,-4*sc); ctx.lineTo(2*sc*aDir,-1*sc); ctx.stroke();
        // Waving arm
        const ax = 2*sc*aDir + Math.cos(armAngle)*(aDir>0?4:-4)*sc;
        const ay = -3*sc + Math.sin(armAngle)*4*sc;
        ctx.beginPath(); ctx.moveTo(2*sc*aDir,-3*sc); ctx.lineTo(ax,ay); ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      // Remove when off screen
      if (u.x < -200 || u.x > w + 200 || u.y < -120) this._ufos.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }
  /* ── USS Enterprise (NCC-1701) ───────────────────────────────── */
  _spawnEnterprise(w, h) {
    const goRight = Math.random() > .5;
    const dir = goRight ? 1 : -1;
    this._enterprise.push({
      x: goRight ? -120 : w + 120,
      y: h * (.25 + Math.random() * .35),
      vx: dir * (0.7 + Math.random() * 0.3),   // slow steady cruise
      vy: -(0.02 + Math.random() * 0.02),        // almost flat - barely tilted
      trail: [],
      sc: 0.55 + Math.random() * 0.3,
      dir,
      lightPh: Math.random() * Math.PI * 2,
      crossTimer: 0,   // track how long it's been on screen
    });
  }

  _dEnterprise(ctx, w, h) {
    if (!this._scifiEnterprise) return;
    this._enterpriseTimer++;
    if (this._enterprise.length === 0 && this._enterpriseTimer > 520 && Math.random() < .0014) {
      this._enterpriseTimer = 0;
      this._spawnEnterprise(w, h);
    }
    const PI2 = Math.PI * 2, dark = this._isDark;
    for (let i = this._enterprise.length - 1; i >= 0; i--) {
      const e = this._enterprise[i];
      e.crossTimer++;
      e.x += e.vx; e.y += e.vy; e.lightPh += .09;

      // Cruise flat across most of the screen, then engage warp and climb away
      // Only start climbing once it has crossed roughly 60% of the screen width
      const crossProgress = Math.abs(e.x - e.startX || (e.dir > 0 ? -120 : w + 120)) / w;
      const hasReachedMid = e.dir > 0 ? e.x > w * 0.55 : e.x < w * 0.45;
      if (hasReachedMid) {
        // Warp out: accelerate and climb steeply
        e.vx += e.dir * 0.055;
        e.vy -= 0.018;
      } else {
        // Cruise: very slight climb, constant speed
        e.vx += e.dir * 0.004;
        e.vy -= 0.001;
      }
      // Store nacelle trail positions (two nacelles offset from hull)
      const angle = Math.atan2(e.vy, e.vx);
      const perpX = -Math.sin(angle) * 9 * e.sc;
      const perpY =  Math.cos(angle) * 9 * e.sc;
      e.trail.push({ x1: e.x + perpX, y1: e.y + perpY, x2: e.x - perpX, y2: e.y - perpY });
      if (e.trail.length > 38) e.trail.shift();

      // Draw nacelle warp trails FIRST (in world space, before ship rotation is applied)
      for (let t = 1; t < e.trail.length; t++) {
        const alpha = (t / e.trail.length) * 0.55;
        const thinning = t / e.trail.length;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `hsl(${200 + t * 2},100%,${75 - t}%)`;
        ctx.lineWidth = thinning * 2.2 * e.sc;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e.trail[t-1].x1, e.trail[t-1].y1);
        ctx.lineTo(e.trail[t].x1,   e.trail[t].y1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.trail[t-1].x2, e.trail[t-1].y2);
        ctx.lineTo(e.trail[t].x2,   e.trail[t].y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Now draw ship on top, rotated to flight angle
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(angle);
      const sc = e.sc;

      // Primary hull (saucer section)
      const saucerGrad = ctx.createRadialGradient(-2*sc, -1*sc, 0, 0, 0, 18*sc);
      saucerGrad.addColorStop(0,  dark?'rgba(210,220,235,1)':'rgba(200,212,228,1)');
      saucerGrad.addColorStop(.5, dark?'rgba(140,155,175,1)':'rgba(160,175,195,1)');
      saucerGrad.addColorStop(1,  dark?'rgba(60,70,90,1)' :'rgba(100,115,138,1)');
      ctx.fillStyle = saucerGrad;
      ctx.beginPath(); ctx.ellipse(0, 0, 18*sc, 10*sc, 0, 0, PI2); ctx.fill();

      // Secondary hull (engineering section — tapers behind saucer)
      ctx.fillStyle = dark?'rgba(120,132,155,1)':'rgba(145,160,180,1)';
      ctx.beginPath();
      ctx.moveTo(-4*sc, 2*sc);
      ctx.lineTo(-22*sc, 6*sc);
      ctx.lineTo(-28*sc, 4*sc);
      ctx.lineTo(-22*sc, 3*sc);
      ctx.lineTo(-4*sc, -1*sc);
      ctx.closePath(); ctx.fill();

      // Two nacelles
      for (const side of [-1, 1]) {
        const ny = side * 9 * sc;
        // Nacelle strut
        ctx.strokeStyle = dark?'rgba(100,112,135,1)':'rgba(130,145,165,1)';
        ctx.lineWidth = 1.8*sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8*sc, 0); ctx.lineTo(-14*sc, ny); ctx.stroke();
        // Nacelle body
        const nacGrad = ctx.createLinearGradient(-20*sc, ny-2*sc, -8*sc, ny+2*sc);
        nacGrad.addColorStop(0, dark?'rgba(80,160,255,1)':'rgba(60,140,230,1)');
        nacGrad.addColorStop(.4, dark?'rgba(180,200,230,1)':'rgba(160,185,215,1)');
        nacGrad.addColorStop(1, dark?'rgba(60,70,90,1)':'rgba(90,105,130,1)');
        ctx.fillStyle = nacGrad;
        ctx.beginPath(); ctx.ellipse(-14*sc, ny, 8*sc, 2.2*sc, 0, 0, PI2); ctx.fill();
        // Bussard collector (glowing red front)
        ctx.save(); ctx.globalCompositeOperation='lighter';
        const bcg = ctx.createRadialGradient(-22*sc, ny, 0, -22*sc, ny, 4*sc);
        const blink = .5 + Math.sin(e.lightPh + side) * .5;
        bcg.addColorStop(0, `rgba(255,80,60,${.8*blink})`);
        bcg.addColorStop(1, 'rgba(255,80,60,0)');
        ctx.fillStyle = bcg; ctx.beginPath(); ctx.arc(-22*sc, ny, 4*sc, 0, PI2); ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      ctx.restore();
      if (e.x < -300 || e.x > w + 300 || e.y < -180) this._enterprise.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Sperm Whale (Hitchhiker's Guide) ────────────────────────── */
  /* ── Borg Cube ──────────────────────────────────────────────── */
  _spawnBorg(w, h) {
    const goRight = Math.random() > .5;
    const dir = goRight ? 1 : -1;
    // Target is sun (daytime) or moon (night) — fixed world position
    const tx = w * .74, ty = h * .25; // matches sun/moon coords in _dSun/_dMoon
    this._borg.push({
      x:  goRight ? -90 : w + 90,
      y:  h * (.05 + Math.random() * .20),
      vx: dir * (0.6 + Math.random() * 0.3),
      vy: 0,
      dir,
      sc: 0.5 + Math.random() * 0.25,
      phase: 'enter',   // enter → lock → hold → release → exit
      tx, ty,           // target (sun or moon)
      beamOp: 0,
      tintOp: 0,        // red tint on sun/moon 0→1
      holdTimer: 0,
      holdDuration: 80 + Math.floor(Math.random() * 50),
      rotPh: Math.random() * Math.PI * 2,
    });
  }

  _dBorg(ctx, w, h) {
    if (!this._scifiBorg) return;
    this._borgTimer++;
    if (this._borg.length === 0 && this._borgTimer > 600 && Math.random() < .0012) {
      this._borgTimer = 0;
      this._spawnBorg(w, h);
    }
    const PI2 = Math.PI * 2, dark = this._isDark;

    // Decay tint when no borg is locking
    const anyLocking = this._borg.some(b => b.phase === 'lock' || b.phase === 'hold');
    if (!anyLocking && this._borgTint > 0) this._borgTint = Math.max(0, this._borgTint - 0.04);

    for (let i = this._borg.length - 1; i >= 0; i--) {
      const b = this._borg[i];
      b.rotPh += 0.012;

      // ── Phase logic ──
      if (b.phase === 'enter') {
        b.x += b.vx;
        // Steer gently toward tx horizontally
        const dx = b.tx - b.x;
        if (Math.abs(dx) < 80) {
          b.phase = 'lock';
          b.vx *= 0.5;
        }
      } else if (b.phase === 'lock') {
        // Slow to hover above target
        b.x += b.vx; b.vx *= 0.90;
        b.y += (b.ty - h * 0.12 - b.y) * 0.04; // settle above sun/moon
        b.beamOp = Math.min(1, b.beamOp + 0.04);
        this._borgTint = Math.min(1, this._borgTint + 0.025);
        if (b.beamOp >= 1 && Math.abs(b.vx) < 0.15) {
          b.phase = 'hold';
          b.vx = 0;
        }
      } else if (b.phase === 'hold') {
        b.holdTimer++;
        // Gentle hover
        b.y += Math.sin(b.rotPh * 0.5) * 0.18;
        this._borgTint = Math.min(1, this._borgTint + 0.01);
        this._borgWobblePh += 0.14;  // wobble the sun/moon while locked
        if (b.holdTimer >= b.holdDuration) {
          b.phase = 'release';
        }
      } else if (b.phase === 'release') {
        b.beamOp = Math.max(0, b.beamOp - 0.05);
        this._borgTint = Math.max(0, this._borgTint - 0.03);
        this._borgWobblePh += 0.08;  // continue wobbling briefly as beam fades
        if (b.beamOp <= 0) {
          b.phase = 'exit';
          b.vx = b.dir * 1.2;
          b.vy = -0.4;
        }
      } else { // exit — accelerate away
        b.vx += b.dir * 0.04;
        b.vy -= 0.008;
        b.x += b.vx; b.y += b.vy;
      }

      const sc = b.sc;
      const half = 18 * sc;   // half-width of cube face
      const dep  = half * 0.5; // isometric depth offset — makes all faces equal

      // ── Draw tractor beam first (behind cube) ──
      if (b.beamOp > 0.01) {
        ctx.save();
        // Sun/moon disc radius: sunR = min(h*0.13, 24), dR = sunR*2.5 (light disc)
        // We want the beam bottom to exactly match the visible disc width
        const targetR = Math.min(h * 0.13, 24) * 2.5; // matches dR in _dSun/_dMoon
        const beamTopHalf = 2.5;          // tight ~5px slit at cube underside — clearly a point
        const beamBotHalf = targetR;      // fans out to full sun/moon disc width

        const beamTop_y = b.y + half;     // bottom of the Borg cube
        const beamBot_y = b.ty;           // sun/moon centre

        // Beam fill — green gradient fading to transparent at target
        const beamGrad = ctx.createLinearGradient(0, beamTop_y, 0, beamBot_y);
        beamGrad.addColorStop(0,   'rgba(0,255,80,0.85)');
        beamGrad.addColorStop(0.5, 'rgba(0,210,65,0.50)');
        beamGrad.addColorStop(1,   'rgba(0,180,50,0.12)');
        ctx.fillStyle = beamGrad;
        ctx.globalAlpha = b.beamOp * 0.70;
        ctx.beginPath();
        ctx.moveTo(b.x  - beamTopHalf, beamTop_y);   // narrow top-left
        ctx.lineTo(b.x  + beamTopHalf, beamTop_y);   // narrow top-right
        ctx.lineTo(b.tx + beamBotHalf, beamBot_y);   // wide bottom-right
        ctx.lineTo(b.tx - beamBotHalf, beamBot_y);   // wide bottom-left
        ctx.closePath();
        ctx.fill();

        // Bright green glow ring at target enveloping the full disc
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = b.beamOp * 0.50;
        const tg = ctx.createRadialGradient(b.tx, b.ty, targetR * 0.3, b.tx, b.ty, targetR * 1.2);
        tg.addColorStop(0,   'rgba(0,255,80,0.6)');
        tg.addColorStop(0.5, 'rgba(0,220,60,0.3)');
        tg.addColorStop(1,   'rgba(0,200,50,0)');
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.arc(b.tx, b.ty, targetR * 1.2, 0, PI2); ctx.fill();
        ctx.restore();
      }

      // ── Draw Borg cube (isometric — all three visible faces equal size) ──
      ctx.save(); ctx.translate(b.x, b.y);

      // Top face — parallelogram sitting above the front face
      ctx.fillStyle = dark ? 'rgba(62,78,64,1)' : 'rgba(72,90,74,1)';
      ctx.beginPath();
      ctx.moveTo(-half,       -half);           // front-left
      ctx.lineTo( half,       -half);           // front-right
      ctx.lineTo( half + dep, -half - dep);     // back-right
      ctx.lineTo(-half + dep, -half - dep);     // back-left
      ctx.closePath(); ctx.fill();

      // Front face — perfect square
      const frontGrad = ctx.createLinearGradient(0, -half, 0, half);
      frontGrad.addColorStop(0, dark ? 'rgba(48,62,50,1)' : 'rgba(58,74,60,1)');
      frontGrad.addColorStop(1, dark ? 'rgba(28,38,30,1)' : 'rgba(38,50,40,1)');
      ctx.fillStyle = frontGrad;
      ctx.beginPath();
      ctx.moveTo(-half, -half);
      ctx.lineTo( half, -half);
      ctx.lineTo( half,  half);
      ctx.lineTo(-half,  half);
      ctx.closePath(); ctx.fill();

      // Right face — square depth panel in shadow
      ctx.fillStyle = dark ? 'rgba(22,30,24,1)' : 'rgba(30,42,32,1)';
      ctx.beginPath();
      ctx.moveTo(half,       -half);
      ctx.lineTo(half + dep, -half - dep);
      ctx.lineTo(half + dep,  half - dep);
      ctx.lineTo(half,        half);
      ctx.closePath(); ctx.fill();

      // Cube edges
      ctx.strokeStyle = dark ? 'rgba(0,180,50,0.35)' : 'rgba(0,160,45,0.30)';
      ctx.lineWidth = 0.8;
      // Front face outline
      ctx.beginPath();
      ctx.rect(-half, -half, half * 2, half * 2);
      ctx.stroke();
      // Top face edges
      ctx.beginPath();
      ctx.moveTo(-half, -half); ctx.lineTo(-half + dep, -half - dep);
      ctx.moveTo( half, -half); ctx.lineTo( half + dep, -half - dep);
      ctx.moveTo(-half + dep, -half - dep); ctx.lineTo(half + dep, -half - dep);
      ctx.stroke();
      // Right face bottom edge
      ctx.beginPath();
      ctx.moveTo(half + dep, half - dep); ctx.lineTo(half, half);
      ctx.stroke();

      // Green circuit lines on front face — grid across the square face
      ctx.strokeStyle = `rgba(0,${180 + Math.floor(Math.sin(b.rotPh)*40)},60,0.55)`;
      ctx.lineWidth = 0.7;
      const lines = 4;
      for (let l = 1; l < lines; l++) {
        const px = -half + (half * 2 / lines) * l;
        const py = -half + (half * 2 / lines) * l;
        ctx.globalAlpha = 0.45;
        // Vertical line across full square height
        ctx.beginPath(); ctx.moveTo(px, -half); ctx.lineTo(px, half); ctx.stroke();
        // Horizontal line across full square width
        ctx.beginPath(); ctx.moveTo(-half, py); ctx.lineTo(half, py); ctx.stroke();
      }

      // Green pulsing eye / sensor
      ctx.globalAlpha = 0.5 + Math.sin(b.rotPh * 3) * 0.4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eyeG = ctx.createRadialGradient(0, 0, 0, 0, 0, 5*sc);
      eyeG.addColorStop(0, 'rgba(0,255,80,1)');
      eyeG.addColorStop(1, 'rgba(0,255,80,0)');
      ctx.fillStyle = eyeG;
      ctx.beginPath(); ctx.arc(0, 0, 5*sc, 0, PI2); ctx.fill();
      ctx.restore();

      ctx.globalAlpha = 1;
      ctx.restore();

      if (b.x < -250 || b.x > w + 250 || b.y < -150) this._borg.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }

  _makeWormhole(w, h) {
    return {
      x: w * (.22 + Math.random() * .56),
      y: h * (.15 + Math.random() * .40),
      phase: 'kawoosh',
      progress: 0,
      kawooshR: 0,
      kawooshOp: 1,
      holdTimer: 0,
      holdDuration: 150 + Math.floor(Math.random() * 80),
      maxR: 22 + Math.random() * 10,
      spin: 0,
      ripples: [],
      rippleTimer: 0,
    };
  }

  _dWormhole(ctx, w, h) {
    if (!this._wormhole) return;
    const sg = this._wormhole;
    sg.spin += 0.04;
    sg.rippleTimer++;
    const PI2 = Math.PI * 2;

    if (sg.phase === 'hold' && sg.rippleTimer % 18 === 0) {
      sg.ripples.push({ r: 0, op: 0.8 });
    }
    for (let i = sg.ripples.length - 1; i >= 0; i--) {
      sg.ripples[i].r  += 0.55;
      sg.ripples[i].op *= 0.94;
      if (sg.ripples[i].op < 0.04) sg.ripples.splice(i, 1);
    }

    if (sg.phase === 'kawoosh') {
      sg.progress += 0.022;
      sg.kawooshR = sg.maxR * 3.5 * sg.progress;
      sg.kawooshOp = Math.max(0, 1 - sg.progress * 1.2);
      if (sg.progress >= 1) { sg.phase = 'hold'; sg.progress = 1; }
    } else if (sg.phase === 'hold') {
      sg.holdTimer++;
      if (sg.holdTimer >= sg.holdDuration) { sg.phase = 'close'; sg.progress = 1; }
    } else {
      sg.progress -= 0.018;
      if (sg.progress <= 0) { this._wormhole = null; return; }
    }

    const eased = sg.phase === 'kawoosh'
      ? Math.min(1, sg.progress * 1.8)
      : sg.phase === 'hold' ? 1
      : sg.progress * sg.progress;

    const r = sg.maxR * eased;
    if (r < 0.5) return;

    ctx.save();
    ctx.translate(sg.x, sg.y);

    // Kawoosh burst ring
    if (sg.phase === 'kawoosh' && sg.kawooshOp > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const kr = sg.kawooshR;
      const kg = ctx.createRadialGradient(0, 0, kr * 0.5, 0, 0, kr);
      kg.addColorStop(0,    'rgba(60,180,255,0)');
      kg.addColorStop(0.6,  `rgba(80,220,255,${sg.kawooshOp * 0.7})`);
      kg.addColorStop(0.85, `rgba(160,240,255,${sg.kawooshOp * 0.9})`);
      kg.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.fillStyle = kg;
      ctx.beginPath(); ctx.arc(0, 0, kr, 0, PI2); ctx.fill();
      ctx.restore();
    }

    // Stone ring edge
    ctx.globalAlpha = Math.min(1, eased * 1.4);
    ctx.strokeStyle = 'rgba(140,155,170,0.85)';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, PI2); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,215,230,0.55)';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.80, 0, PI2); ctx.stroke();

    // Chevron glyphs
    ctx.globalAlpha = eased * 0.75;
    for (let g = 0; g < 9; g++) {
      const ga = (g / 9) * PI2 + sg.spin * 0.15;
      const gx = Math.cos(ga) * r * 0.92;
      const gy = Math.sin(ga) * r * 0.92;
      const active = g % 3 === 0;
      ctx.fillStyle = active ? 'rgba(255,200,60,0.9)' : 'rgba(180,195,210,0.55)';
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ga + Math.PI/2);
      ctx.beginPath();
      ctx.moveTo(0, -r*0.07); ctx.lineTo(r*0.05, r*0.07); ctx.lineTo(-r*0.05, r*0.07);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Blue liquid surface
    ctx.globalAlpha = eased * 0.92;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    const baseG = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.78);
    baseG.addColorStop(0, 'rgba(0,0,0,1)');
    baseG.addColorStop(0.85, 'rgba(0,0,0,0.95)');
    baseG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baseG;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.78, r * 0.78, 0, 0, PI2); ctx.fill();
    ctx.restore();

    ctx.globalAlpha = eased * 0.88;
    const surfG = ctx.createRadialGradient(0, r * 0.1, 0, 0, 0, r * 0.76);
    surfG.addColorStop(0,    'rgba(30,180,255,0.95)');
    surfG.addColorStop(0.45, 'rgba(10,130,220,0.85)');
    surfG.addColorStop(0.80, 'rgba(5,80,170,0.65)');
    surfG.addColorStop(1,    'rgba(0,40,120,0)');
    ctx.fillStyle = surfG;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.76, r * 0.76, 0, 0, PI2); ctx.fill();

    // Moving highlight
    ctx.globalAlpha = eased * 0.35;
    const sweepX = Math.cos(sg.spin * 0.8) * r * 0.3;
    const sweepY = Math.sin(sg.spin * 0.8) * r * 0.2;
    const hg = ctx.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, r * 0.45);
    hg.addColorStop(0, 'rgba(200,240,255,0.8)');
    hg.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.76, r * 0.76, 0, 0, PI2); ctx.fill();

    // Ripple rings
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.76, r * 0.76, 0, 0, PI2); ctx.clip();
    for (const rp of sg.ripples) {
      ctx.globalAlpha = rp.op * eased * 0.55;
      ctx.strokeStyle = 'rgba(160,230,255,1)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(0, 0, rp.r, rp.r * 0.5, 0, 0, PI2); ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* ── Angry Birds ─────────────────────────────────────────────── */
  _dAngryBirds(ctx, w, h) {
    if (!this._angryBirds) return;

    this._angryBirdTimer++;

    // Trigger a new sequence at random intervals, similar to the UFO — rare and unpredictable
    if (!this._abQueue && this._angryBirdFlock.length === 0 && this._angryBirdTimer > 480 && Math.random() < .0018) {
      this._angryBirdTimer = 0;
      const goRight = Math.random() > .5;
      const dir = goRight ? 1 : -1;
      const count = 1 + Math.floor(Math.random() * 4);
      const types = ['red','yellow','blue','black','bomb'];
      const startY = h * (.15 + Math.random() * .45);
      const arcHeight = h * (0.12 + Math.random() * 0.18);
      const speed = 1.8 + Math.random() * 1.0;
      const startX = goRight ? -50 : w + 50;
      const endX   = goRight ? w + 50 : -50;
      const totalDist = Math.abs(endX - startX);

      this._abQueue = Array.from({length: count}, () => ({
        type: types[Math.floor(Math.random() * types.length)],
        sc: 0.48 + Math.random() * 0.30,
        startX, startY, endX, totalDist, speed, arcHeight, dir,
      }));
      this._abLaunchDelay = 0;
    }

    // Launch next bird from queue — random interval between each bird
    if (this._abQueue && this._abQueue.length > 0) {
      this._abLaunchDelay--;
      if (this._abLaunchDelay <= 0) {
        const def = this._abQueue.shift();
        this._angryBirdFlock.push({
          x: def.startX, y: def.startY,
          startX: def.startX, startY: def.startY, endX: def.endX,
          totalDist: def.totalDist, speed: def.speed,
          arcHeight: def.arcHeight, dir: def.dir,
          sc: def.sc, type: def.type,
          progress: 0, rot: 0, trail: [],
        });
        // Random delay before next bird: 45-120 frames (~1.5–4s), like the slingshot reload time
        this._abLaunchDelay = 45 + Math.floor(Math.random() * 75);
        if (this._abQueue.length === 0) this._abQueue = null;
      }
    }

    const PI2 = Math.PI * 2;

    for (let i = this._angryBirdFlock.length - 1; i >= 0; i--) {
      const b = this._angryBirdFlock[i];

      // Advance horizontal position
      b.x += b.speed * b.dir;

      // Compute progress (0 → 1) as fraction of full crossing
      b.progress = Math.abs(b.x - b.startX) / b.totalDist;

      // Parabolic arc: y dips DOWN then comes back up (like a slingshot shot)
      // At t=0 and t=1: y = startY. Peak dip upward at t=0.5
      const t = Math.max(0, Math.min(1, b.progress));
      b.y = b.startY - b.arcHeight * 4 * t * (1 - t);

      // Rotation follows the arc tangent for natural tumble
      const dy = -b.arcHeight * 4 * (1 - 2 * t); // derivative of parabola
      b.rot = Math.atan2(dy, b.speed * b.dir) * 0.6; // soften rotation slightly

      // Store trail puff
      b.trail.push({x: b.x, y: b.y, op: 0.30});
      if (b.trail.length > 10) b.trail.shift();

      // Draw trail
      for (const p of b.trail) {
        p.op *= 0.82;
        ctx.globalAlpha = p.op;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * b.sc, 0, PI2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw bird
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      const sc = b.sc;
      const r = 11 * sc; // body radius

      // ── Body ──
      const bodyColours = {
        red:   ['rgba(220,40,30,1)',  'rgba(185,25,18,1)',  'rgba(255,80,60,1)'],
        yellow:['rgba(255,210,20,1)', 'rgba(220,170,10,1)', 'rgba(255,240,80,1)'],
        blue:  ['rgba(60,120,220,1)', 'rgba(30,80,180,1)',  'rgba(120,180,255,1)'],
        black: ['rgba(40,40,45,1)',   'rgba(20,20,22,1)',   'rgba(80,80,90,1)'],
        bomb:  ['rgba(35,35,40,1)',   'rgba(15,15,18,1)',   'rgba(70,70,80,1)'],
      };
      const [bodyCol, shadowCol, hiliteCol] = bodyColours[b.type] || bodyColours.red;

      const bodyG = ctx.createRadialGradient(-r*0.25, -r*0.3, 0, 0, 0, r);
      bodyG.addColorStop(0, hiliteCol);
      bodyG.addColorStop(0.45, bodyCol);
      bodyG.addColorStop(1, shadowCol);
      ctx.fillStyle = bodyG;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, PI2); ctx.fill();

      // ── Angry eyebrow ──
      ctx.strokeStyle = 'rgba(30,15,5,1)';
      ctx.lineWidth = 1.8 * sc; ctx.lineCap = 'round';
      // Left brow — angled inward (angry)
      ctx.beginPath();
      ctx.moveTo(-r*0.55, -r*0.28);
      ctx.lineTo(-r*0.12, -r*0.48);
      ctx.stroke();
      // Right brow
      ctx.beginPath();
      ctx.moveTo( r*0.55, -r*0.28);
      ctx.lineTo( r*0.12, -r*0.48);
      ctx.stroke();

      // ── Eyes ──
      // White sclera
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.ellipse(-r*0.28, -r*0.16, r*0.22, r*0.26, -0.15, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( r*0.28, -r*0.16, r*0.22, r*0.26,  0.15, 0, PI2); ctx.fill();
      // Pupils
      ctx.fillStyle = 'rgba(20,10,5,1)';
      ctx.beginPath(); ctx.ellipse(-r*0.24, -r*0.12, r*0.12, r*0.15, 0, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( r*0.24, -r*0.12, r*0.12, r*0.15, 0, 0, PI2); ctx.fill();
      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-r*0.20, -r*0.18, r*0.05, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.28,  -r*0.18, r*0.05, 0, PI2); ctx.fill();

      // ── Beak ──
      ctx.fillStyle = 'rgba(255,165,20,1)';
      ctx.beginPath();
      ctx.moveTo(-r*0.20, r*0.08);
      ctx.lineTo( r*0.20, r*0.08);
      ctx.lineTo( r*0.14, r*0.30);
      ctx.lineTo(-r*0.14, r*0.30);
      ctx.closePath(); ctx.fill();
      // Beak highlight
      ctx.fillStyle = 'rgba(255,210,80,0.7)';
      ctx.beginPath();
      ctx.moveTo(-r*0.16, r*0.10);
      ctx.lineTo( r*0.16, r*0.10);
      ctx.lineTo( r*0.10, r*0.20);
      ctx.lineTo(-r*0.10, r*0.20);
      ctx.closePath(); ctx.fill();

      // ── Type-specific features ──
      if (b.type === 'red') {
        // Crest feathers on top
        ctx.fillStyle = 'rgba(200,30,20,1)';
        for (let f = 0; f < 3; f++) {
          const fx = (f - 1) * r * 0.28;
          ctx.beginPath();
          ctx.moveTo(fx - r*0.08, -r*0.75);
          ctx.lineTo(fx,          -r*1.10);
          ctx.lineTo(fx + r*0.08, -r*0.75);
          ctx.closePath(); ctx.fill();
        }
      } else if (b.type === 'yellow') {
        // Triangular body extension (pointy bird)
        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.moveTo(-r*0.3, -r*0.5);
        ctx.lineTo( r*0.3, -r*0.5);
        ctx.lineTo( 0,     -r*1.15);
        ctx.closePath(); ctx.fill();
        // Yellow crest highlight
        const yg = ctx.createLinearGradient(0,-r*1.15,0,-r*0.5);
        yg.addColorStop(0,'rgba(255,240,80,0.9)'); yg.addColorStop(1,'rgba(255,210,20,0)');
        ctx.fillStyle=yg;
        ctx.beginPath();
        ctx.moveTo(-r*0.2,-r*0.55); ctx.lineTo(r*0.2,-r*0.55); ctx.lineTo(0,-r*1.1);
        ctx.closePath(); ctx.fill();
      } else if (b.type === 'blue') {
        // Tiny tuft
        ctx.fillStyle = 'rgba(80,150,240,1)';
        ctx.beginPath();
        ctx.moveTo(-r*0.12, -r*0.85);
        ctx.lineTo( 0,      -r*1.08);
        ctx.lineTo( r*0.12, -r*0.85);
        ctx.closePath(); ctx.fill();
      } else if (b.type === 'bomb' || b.type === 'black') {
        // Fuse on top
        ctx.strokeStyle = 'rgba(80,70,50,1)';
        ctx.lineWidth = 1.5 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(r*0.05,-r*0.95); ctx.lineTo(r*0.25,-r*1.25); ctx.stroke();
        // Spark at fuse tip
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=0.6+Math.sin(Date.now()*0.02)*0.4;
        const spark=ctx.createRadialGradient(r*0.25,-r*1.25,0,r*0.25,-r*1.25,4*sc);
        spark.addColorStop(0,'rgba(255,200,50,1)'); spark.addColorStop(1,'rgba(255,100,0,0)');
        ctx.fillStyle=spark; ctx.beginPath(); ctx.arc(r*0.25,-r*1.25,4*sc,0,PI2); ctx.fill();
        ctx.restore();
        // White chest patch
        ctx.fillStyle='rgba(240,240,240,0.25)';
        ctx.beginPath(); ctx.ellipse(0,r*0.1,r*0.32,r*0.28,0,0,PI2); ctx.fill();
      }

      // ── Tail feathers ──
      const tailDir = b.dir > 0 ? 1 : -1;
      ctx.fillStyle = bodyColours[b.type]?.[0] || 'rgba(200,40,30,1)';
      ctx.beginPath();
      ctx.moveTo(tailDir*r*0.7, r*0.2);
      ctx.lineTo(tailDir*r*1.25, -r*0.05);
      ctx.lineTo(tailDir*r*0.85, r*0.55);
      ctx.closePath(); ctx.fill();

      ctx.restore();

      // Remove once bird has crossed to the other side
      if (b.dir > 0 ? b.x > b.endX + 20 : b.x < b.endX - 20) this._angryBirdFlock.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }

  _dDustMotes(ctx, w, h) {
    ctx.save(); ctx.globalCompositeOperation=this._isDark?'lighter':'source-over';
    const light=!this._isDark, m=light?2.2:2.8;
    for (const d of this._dustMotes) {
      d.ph+=.014; d.x+=d.vx+Math.sin(d.ph)*.14; d.y+=d.vy+Math.cos(d.ph*.7)*.09;
      if(d.x>w+5)d.x=-5; if(d.x<-5)d.x=w+5;
      if(d.y>h+5)d.y=-5; if(d.y<-5)d.y=h+5;
      const tw=.7+Math.sin(d.ph*2)*.3;
      ctx.globalAlpha=d.op*tw*m;
      ctx.fillStyle=light?'rgba(255,245,210,1)':'rgba(255,250,220,1)';
      ctx.beginPath(); ctx.arc(d.x,d.y,d.size*tw,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  /* ── Heat shimmer ────────────────────────────────────────────── */
  _dHeatShimmer(ctx, w, h) {
    ctx.save(); ctx.globalAlpha=.028;
    ctx.strokeStyle=this._isDark?'rgba(255,200,100,.15)':'rgba(255,180,80,.10)';
    ctx.lineWidth=2;
    for (let i=0;i<3;i++) {
      ctx.beginPath();
      const by=h-28+i*9;
      for (let x=0;x<=w;x+=4) {
        const y=by+Math.sin(x*.03+this._shimmerPh+i*.5)*3;
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── Rain ────────────────────────────────────────────────────── */
  _dRain(ctx, w, h) {
    ctx.lineCap = 'round';
    // Light theme: make rain noticeably darker so it reads against blue sky
    const col = this._isDark ? 'rgba(178,208,245,1)' : 'rgba(55,88,140,1)';
    const opBoost = this._isDark ? 1.0 : 1.6; // brighter on light bg
    for (const p of this._rain) {
      p.y += p.vy; p.x += p.vx;
      if (p.y > h+14) { p.y = -14; p.x = Math.random()*w; }
      if (p.x < -8) p.x = w+8;
      ctx.globalAlpha = Math.min(1, p.op * opBoost);
      ctx.strokeStyle = col;
      ctx.lineWidth = p.z * .85;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx*1.8, p.y - p.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ── Snow ────────────────────────────────────────────────────── */
  _dSnow(ctx, w, h) {
    const PI2=Math.PI*2;
    for (const p of this._snow) {
      p.wobPh+=p.wobSpd; p.y+=p.vy; p.x+=p.vx+Math.sin(p.wobPh)*.40;
      if(p.y>h+6){p.y=-6;p.x=Math.random()*w;}
      if(p.x<-6)p.x=w+6; if(p.x>w+6)p.x=-6;
      const sh=.88+Math.sin(p.wobPh*2.5)*.12;
      ctx.globalAlpha=p.op*sh;
      if (p.size>1.6) {
        const gr=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*sh);
        gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.48,'rgba(255,255,255,.52)'); gr.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=gr;
      } else ctx.fillStyle='rgba(255,255,255,1)';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*sh,0,PI2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  /* ── Lightning ───────────────────────────────────────────────── */
  _dLightning(ctx, w, h) {
    if (Math.random()<.007&&this._bolts.length<3) {
      this._flashOp=.72; this._flashHold=5;
      this._bolts.push(this._makeBolt(w,h));
      for (const cl of this._clouds) cl.flashInt=.68;
    }
    if (this._flashOp>0) {
      if(this._flashHold>0)this._flashHold--;else this._flashOp*=.65;
      ctx.globalAlpha=this._flashOp*.38; ctx.fillStyle='rgba(170,198,255,1)';
      ctx.fillRect(0,0,w,h); ctx.globalAlpha=1;
      if(this._flashOp<.004)this._flashOp=0;
    }
    for (let i=this._bolts.length-1;i>=0;i--) {
      const b=this._bolts[i];
      ctx.save(); ctx.lineCap='round';
      ctx.globalAlpha=b.alpha*.18; ctx.strokeStyle='rgba(158,188,255,1)'; ctx.lineWidth=11;
      for(const s of b.segs){if(!s.br){ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.nx,s.ny);ctx.stroke();}}
      ctx.globalAlpha=b.alpha; ctx.strokeStyle='rgba(255,255,255,1)'; ctx.lineWidth=1.8;
      for(const s of b.segs){if(!s.br){ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.nx,s.ny);ctx.stroke();}}
      ctx.restore();
      b.alpha-=.058; if(b.alpha<=0)this._bolts.splice(i,1);
    }
  }
  _makeBolt(w,h) {
    const x=w*.18+Math.random()*w*.64, segs=[];
    let cx=x, cy=0, bias=(Math.random()-.5)*12;
    while(cy<h*.88){const ny=cy+9+Math.random()*17,nx=cx+bias+(Math.random()*20-10);segs.push({x:cx,y:cy,nx,ny,br:false});if(Math.random()<.18){const d=Math.random()>.5?1:-1;segs.push({x:cx,y:cy,nx:cx+d*(10+Math.random()*20),ny:cy+10+Math.random()*16,br:true});}cx=nx;cy=ny;}
    return {segs,alpha:.95};
  }
}


/* ═══════════════════════════ CARD CSS ═══════════════════════════ */
const CARD_CSS = `
:host {
  --worm-ac: #5AC8FA;
  --worm-glow: rgba(90,200,250,0.35);
  font-family: -apple-system,'SF Pro Display','Helvetica Neue',sans-serif;
  -webkit-font-smoothing: antialiased;
  display: block;
}
ha-card {
  background: linear-gradient(158deg,rgba(16,16,24,0.98) 0%,rgba(10,16,32,0.98) 100%) !important;
  backdrop-filter: blur(40px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(180%) !important;
  border-radius: 20px !important;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.07) !important;
  box-shadow: 0 24px 64px rgba(0,0,0,0.65),0 4px 20px rgba(0,0,0,0.4) !important;
  position: relative;
}
.view{display:none}.view.active{display:block}

/* Collapse handle — sits at the top of the expanded view */
.collapse-handle{
  display:flex;align-items:center;justify-content:center;
  height:22px;cursor:pointer;-webkit-tap-highlight-color:transparent;
  user-select:none;flex-shrink:0;
}
.collapse-handle::after{
  content:'';display:block;width:36px;height:4px;border-radius:2px;
  background:rgba(255,255,255,0.18);transition:background .2s;
}
.collapse-handle:active::after{background:rgba(255,255,255,0.42);}

/* Compact wrap — show pointer so it feels tappable */
.compact-wrap{cursor:pointer;-webkit-tap-highlight-color:transparent;}

/* Compact */
.compact-wrap{position:relative;overflow:hidden;}
#atm-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.compact-overlay{
  position:absolute;inset:0;padding:14px 18px 16px;
  display:flex;align-items:flex-end;justify-content:space-between;
  pointer-events:none;z-index:2;
  background:linear-gradient(to top,rgba(0,0,0,0.32) 0%,rgba(0,0,0,0.08) 55%,transparent 100%);
}
/* Left: big temperature */
.compact-left{display:flex;flex-direction:column;justify-content:flex-end;}
.compact-temp{font-size:52px;font-weight:200;color:#fff;line-height:1;letter-spacing:-1px;text-shadow:0 2px 14px rgba(0,0,0,0.45);}
.compact-temp sup{font-size:18px;font-weight:300;letter-spacing:0;vertical-align:super;}
/* Right: info stack */
.compact-right{
  display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;
  gap:3px;text-align:right;
}
.compact-cond{font-size:13px;font-weight:500;color:rgba(255,255,255,0.92);letter-spacing:.2px;text-shadow:0 1px 4px rgba(0,0,0,0.5);}
.compact-hilo{font-size:11px;color:rgba(255,255,255,0.65);text-shadow:0 1px 3px rgba(0,0,0,0.4);}
.compact-pills{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-top:1px;}
.compact-pill{
  display:flex;align-items:center;gap:3px;
  background:rgba(0,0,0,0.30);backdrop-filter:blur(8px);
  border-radius:20px;padding:2px 8px;
  font-size:11px;color:rgba(255,255,255,0.82);
  text-shadow:none;border:0.5px solid rgba(255,255,255,0.12);
}
.compact-pill ha-icon{--mdc-icon-size:11px;opacity:0.70;}

/* Map */
.map-wrap{position:relative;height:340px;}
#lf-map{height:100%;width:100%;}
.leaflet-container{background:#16161e !important;}
.map-time-tag{
  position:absolute;top:10px;right:10px;z-index:1000;
  background:rgba(12,12,18,0.92);backdrop-filter:blur(14px);
  border-radius:8px;padding:4px 10px;font-size:11px;font-weight:600;
  color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.08);pointer-events:none;
}
.map-loc-tag{
  position:absolute;top:10px;left:10px;z-index:1000;
  background:rgba(12,12,18,0.92);backdrop-filter:blur(14px);
  border-radius:8px;padding:4px 10px;font-size:10px;
  color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.08);
  max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  pointer-events:none;transition:opacity .4s;
}
.map-legend{
  position:absolute;bottom:28px;right:12px;z-index:1000;
  background:rgba(12,12,18,0.92);backdrop-filter:blur(14px);
  border-radius:9px;padding:7px 9px;border:1px solid rgba(255,255,255,0.08);
}
.leg-t{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:4px;}
.leg-bar{width:80px;height:5px;border-radius:3px;background:linear-gradient(to right,#3288bd,#66c2a5,#abdda4,#e6f598,#fee090,#fdae61,#f46d43,#d53e4f);}
.leg-lbls{display:flex;justify-content:space-between;margin-top:3px;}
.leg-l{font-size:8px;color:rgba(255,255,255,0.3);}
.fpbar-wrap{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.05);}
.fpbar{height:100%;background:var(--worm-ac);transition:width .3s;box-shadow:0 0 6px var(--worm-glow);}

/* Tabs */
.tabs{
  display:flex;background:rgba(8,8,14,0.98);
  border-top:1px solid rgba(255,255,255,0.05);
  padding:6px 0 10px;
}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 0;-webkit-tap-highlight-color:transparent;user-select:none;}
.tab:active{opacity:.45;}
.tab-i{--mdc-icon-size:20px;color:rgba(255,255,255,0.3);transition:all .2s;}
.tab.on .tab-i{color:var(--worm-ac);filter:drop-shadow(0 0 6px var(--worm-glow));}
.tab-l{font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:rgba(255,255,255,0.3);transition:color .2s;}
.tab.on .tab-l{color:var(--worm-ac);}

/* Weather content — compact sizing matching Forecast tab */
.wx-wrap{padding:0 0 16px;}
.wx-current{
  display:flex;align-items:center;gap:12px;
  padding:12px 16px 10px;
  border-bottom:1px solid rgba(255,255,255,0.05);
  margin-bottom:0;
}
.wx-ico-sm{--mdc-icon-size:36px;color:rgba(255,255,255,0.88);flex-shrink:0;}
.wx-temp{font-size:36px;font-weight:300;color:#fff;line-height:1;letter-spacing:-1px;flex-shrink:0;}
.wx-temp sup{font-size:14px;font-weight:400;letter-spacing:0;vertical-align:super;}
.wx-meta{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.wx-cond{font-size:13px;color:rgba(255,255,255,0.65);}
.wx-hl{font-size:11px;color:rgba(255,255,255,0.38);}
.wx-pad{padding:10px 16px 0;}
.feels-chip{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);
  border-radius:20px;padding:4px 12px;margin-bottom:12px;
}
.feels-chip .fl{font-size:12px;color:rgba(255,255,255,0.42);}
.feels-chip .fv{font-size:12px;font-weight:600;color:#fff;}
.sec-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,0.3);margin-bottom:8px;}
.hrow{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;scrollbar-width:none;}
.hrow::-webkit-scrollbar{display:none;}
.hitem{
  flex:0 0 58px;background:rgba(255,255,255,0.04);border-radius:14px;padding:10px 4px;
  display:flex;flex-direction:column;align-items:center;gap:5px;
  border:1px solid rgba(255,255,255,0.06);
}
.hitem.now{background:rgba(90,200,250,0.07);border-color:rgba(90,200,250,0.28);}
.ht{font-size:9px;font-weight:600;color:rgba(255,255,255,0.35);}
.hitem.now .ht{color:var(--worm-ac);}
.hi{--mdc-icon-size:18px;color:rgba(255,255,255,0.75);}
.htmp{font-size:12px;font-weight:600;color:#fff;}
.hrn{font-size:9px;color:#5AC8FA;}
.dlist{background:rgba(255,255,255,0.03);border-radius:14px;margin-bottom:18px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;}
.drow{display:flex;align-items:center;padding:11px 14px;gap:12px;}
.drow+.drow{border-top:1px solid rgba(255,255,255,0.05);}
.dday{font-size:13px;font-weight:500;color:rgba(255,255,255,0.85);width:38px;flex-shrink:0;}
.dico{--mdc-icon-size:20px;color:rgba(255,255,255,0.72);flex-shrink:0;}
.drn{font-size:11px;color:#5AC8FA;flex:1;}
.dtemps{display:flex;gap:8px;}
.dhi{font-size:13px;font-weight:600;color:#fff;}
.dlo{font-size:13px;color:rgba(255,255,255,0.35);}
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}
.tile{background:rgba(255,255,255,0.03);border-radius:12px;padding:10px 12px;border:1px solid rgba(255,255,255,0.06);}
.tile-hdr{display:flex;align-items:center;gap:5px;margin-bottom:5px;}
.tile-ico{--mdc-icon-size:13px;color:rgba(255,255,255,0.38);}
.tile-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,0.32);}
.tile-val{font-size:22px;font-weight:300;color:#fff;line-height:1;}
.tile-unit{font-size:11px;color:rgba(255,255,255,0.5);}
.tile-sub{font-size:10px;color:rgba(255,255,255,0.32);margin-top:3px;}

/* Forecast tab */
.fc-wrap{padding:0 0 20px;}
/* Day tab strip */
.fc-day-tabs{display:flex;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid rgba(255,255,255,0.06);padding:0 16px;}
.fc-day-tabs::-webkit-scrollbar{display:none;}
.fc-day-tab{
  flex:0 0 auto;padding:12px 14px 10px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:4px;
  border-bottom:2px solid transparent;transition:border-color .2s,color .2s;
  -webkit-tap-highlight-color:transparent;user-select:none;
}
.fc-day-tab:active{opacity:.6;}
.fc-day-tab .fdt-name{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,0.38);}
.fc-day-tab .fdt-ico{--mdc-icon-size:20px;color:rgba(255,255,255,0.55);}
.fc-day-tab .fdt-hi{font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);}
.fc-day-tab.active .fdt-name{color:var(--worm-ac);}
.fc-day-tab.active .fdt-ico{color:rgba(255,255,255,0.92);}
.fc-day-tab.active .fdt-hi{color:#fff;}
.fc-day-tab.active{border-bottom-color:var(--worm-ac);}
/* Hourly panel */
.fc-panel{padding:12px 16px 4px;animation:fcSlideIn .18s ease;}
@keyframes fcSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fc-hlist{background:rgba(255,255,255,0.03);border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);}
.fc-hrow{display:flex;align-items:center;padding:10px 14px;gap:12px;border-bottom:1px solid rgba(255,255,255,0.04);}
.fc-hrow:last-child{border-bottom:none;}
.fc-h-time{font-size:12px;color:rgba(255,255,255,0.48);width:42px;flex-shrink:0;}
.fc-h-ico{--mdc-icon-size:18px;color:rgba(255,255,255,0.72);flex-shrink:0;}
.fc-h-desc{font-size:12px;color:rgba(255,255,255,0.58);flex:1;}
.fc-h-temp{font-size:14px;font-weight:600;color:#fff;flex-shrink:0;}
.fc-h-rn{font-size:11px;color:#5AC8FA;flex-shrink:0;width:34px;text-align:right;}
/* Daily summary row (used when no hourly data) */
.fc-cards{display:flex;gap:8px;overflow-x:auto;padding:14px 16px 6px;scrollbar-width:none;}
.fc-cards::-webkit-scrollbar{display:none;}
.fc-card{flex:0 0 72px;background:rgba(255,255,255,0.04);border-radius:14px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid rgba(255,255,255,0.06);text-align:center;}
.fc-card.today{background:rgba(90,200,250,0.07);border-color:rgba(90,200,250,0.25);}
.fc-day-name{font-size:10px;font-weight:700;color:rgba(255,255,255,0.42);text-transform:uppercase;letter-spacing:.4px;}
.fc-card.today .fc-day-name{color:var(--worm-ac);}
.fc-day-ico{--mdc-icon-size:24px;color:rgba(255,255,255,0.82);}
.fc-day-hi{font-size:14px;font-weight:600;color:#fff;}
.fc-day-lo{font-size:11px;color:rgba(255,255,255,0.38);}
.fc-day-rn{font-size:9px;color:#5AC8FA;}

/* Empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:14px;padding:20px;}
.empty-ico{--mdc-icon-size:52px;color:rgba(255,255,255,0.14);}
.empty-txt{font-size:13px;color:rgba(255,255,255,0.28);text-align:center;line-height:1.6;}
`;

/* ══════════════════════════ EDITOR CSS ══════════════════════════ */
const ED_CSS = `
:host {
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased; display:block;
  color:var(--primary-text-color);
}
.container{display:flex;flex-direction:column;gap:20px;padding:12px;}
.sec-title{
  font-size:11px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:var(--secondary-text-color,#888);
  margin-bottom:2px;padding-left:2px;
}
.card-block{
  background:var(--card-background-color);
  border:1px solid var(--divider-color,rgba(0,0,0,0.1));
  border-radius:13px;overflow:hidden;
}
.row{
  display:flex;align-items:center;padding:13px 16px;gap:12px;
  border-bottom:1px solid var(--divider-color,rgba(0,0,0,0.06));
  min-height:52px;
}
.row:last-child{border-bottom:none;}
.row-icon{
  width:30px;height:30px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  --mdc-icon-size:16px;
}
.row-info{flex:1;min-width:0;}
.row-label{font-size:14px;font-weight:500;color:var(--primary-text-color);}
.row-sub{font-size:11px;color:var(--secondary-text-color,#888);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.row-ctrl{flex-shrink:0;display:flex;align-items:center;gap:6px;}
/* iOS toggle */
.tog{position:relative;width:51px;height:31px;flex-shrink:0;}
.tog input{opacity:0;width:0;height:0;position:absolute;}
.tog-tr{position:absolute;inset:0;border-radius:31px;background:rgba(120,120,128,.32);cursor:pointer;transition:background .25s;}
.tog-tr::after{content:'';position:absolute;width:27px;height:27px;border-radius:50%;background:#fff;top:2px;left:2px;box-shadow:0 2px 6px rgba(0,0,0,.3);transition:transform .25s;}
.tog input:checked+.tog-tr{background:#34C759;}
.tog input:checked+.tog-tr::after{transform:translateX(20px);}
/* Select */
select.sel{
  background:var(--secondary-background-color,rgba(0,0,0,0.04));
  color:var(--primary-text-color);
  border:1px solid var(--divider-color,rgba(0,0,0,0.1));
  border-radius:8px;padding:7px 26px 7px 10px;font-size:13px;
  cursor:pointer;outline:none;font-family:inherit;
  -webkit-appearance:none;appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 8px center;
  max-width:160px;
}
/* Text input */
input.txt{
  background:var(--secondary-background-color,rgba(0,0,0,0.04));
  border:1px solid var(--divider-color,rgba(0,0,0,0.1));
  border-radius:8px;padding:7px 10px;font-size:13px;
  outline:none;color:var(--primary-text-color);font-family:inherit;
}
input.txt:focus{border-color:var(--primary-color,#3b82f6);}
input.txt.sm{width:60px;}input.txt.md{width:115px;}
/* Slider */
input.sl{
  -webkit-appearance:none;appearance:none;
  width:120px;height:3px;border-radius:2px;
  background:var(--divider-color,rgba(0,0,0,0.12));outline:none;cursor:pointer;
}
input.sl::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;}
input.sl::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;border:none;}
.sl-val{font-size:11px;color:var(--secondary-text-color,#888);min-width:40px;text-align:right;}
/* Segmented */
.seg{display:flex;background:rgba(118,118,128,0.18);border-radius:9px;padding:2px;gap:1px;}
.seg-o{flex:1;text-align:center;font-size:11px;font-weight:500;color:var(--secondary-text-color,#888);padding:6px 4px;border-radius:7px;cursor:pointer;transition:all .2s;user-select:none;}
.seg-o.on{background:var(--card-background-color);color:var(--primary-text-color);box-shadow:0 1px 3px rgba(0,0,0,.2);}
/* Editor header */
.ed-hdr{display:flex;align-items:center;gap:12px;padding:4px 0 16px;border-bottom:1px solid var(--divider-color,rgba(0,0,0,0.08));margin-bottom:4px;}
.ed-logo{--mdc-icon-size:32px;}
.ed-title{font-size:16px;font-weight:700;color:var(--primary-text-color);}
.ed-ver{font-size:10px;color:var(--secondary-text-color,#888);margin-top:1px;}
`;

/* ═══════════════════════ MAIN CARD CLASS ═══════════════════════ */
class WormWeatherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._cfg = {}; this._hass = null;
    this._expanded = false; this._curTab = 'radar';
    this._map = null; this._radar = null;
    this._frames = []; this._fi = 0;
    this._playing = false; this._timer = null; this._rafAnim = null;
    this._lat = 51.5; this._lon = -0.12; this._zoom = 7;
    this._ready = false;
    this._atm = null;
    this._forecast = [];       // legacy / daily fallback
    this._forecastHourly = []; // hourly data for Forecast tab
    this._forecastDaily  = []; // daily summaries for tab headers
  }

  setConfig(c) {
    if (!c) throw new Error('worm-weather-card: missing config');
    this._cfg = Object.assign({
      accent_color:'#5AC8FA', default_view:'compact', map_style:'standard',
      zoom_level:7, radar_opacity:0.7, animation_speed:600,
      auto_animate:true, temp_unit:'°C', wind_unit:'km/h',
      show_hourly:true, show_daily:true, show_details:true, compact_height:160,
      show_wind_on_compact:false,
      scifiUFO:true, scifiEnterprise:true, scifiBorg:true, scifiWormhole:true, angryBirds:true,
    }, c);
    this._zoom = parseInt(this._cfg.zoom_level) || 7;
    this._expanded = (this._cfg.default_view || 'compact') !== 'compact';
    this._curTab = this._expanded ? 'radar' : 'compact';
    if (this._ready) {
      this._stopAtm();
      this._stopAnim();
      if (this._map) { this._map.remove(); this._map = null; }
      this._frames = []; this._fi = 0; this._radar = null;
      this._render();
      this._postRender();
    }
  }

  set hass(h) {
    this._hass = h;
    if (!this._ready) { this._render(); this._ready = true; this._postRender(); }
    else { this._updateCompact(); if (this._expanded) { const wxc = this.shadowRoot.getElementById('wx-content'); if (wxc) wxc.innerHTML = this._wxHTML(); } }
  }

  connectedCallback() { if (this._hass && !this._ready) { this._render(); this._ready = true; this._postRender(); } }

  disconnectedCallback() {
    this._stopAtm();
    if (this._rafAnim) { cancelAnimationFrame(this._rafAnim); this._rafAnim = null; }
    if (this._timer) clearInterval(this._timer);
    if (this._map) { this._map.remove(); this._map = null; }
  }

  getCardSize() { return this._expanded ? 12 : 5; }
  static getConfigElement() { return document.createElement('worm-weather-card-editor'); }
  static getStubConfig() { return { weather_entity:'', postcode:'', country_code:'GB', accent_color:'#5AC8FA', zoom_level:7 }; }

  _render() {
    const ac  = this._cfg.accent_color || '#5AC8FA';
    const ch  = parseInt(this._cfg.compact_height) || 160;
    const exp = this._expanded;
    // Determine which expanded tab should start active
    const dv  = this._cfg.default_view || 'compact';
    const initTab = exp ? (dv === 'weather' ? 'weather' : dv === 'forecast' ? 'forecast' : 'radar') : 'radar';
    const radarActive    = initTab === 'radar';
    const weatherActive  = initTab === 'weather';
    const forecastActive = initTab === 'forecast';
    this.shadowRoot.innerHTML =
      `<style>${CARD_CSS}:host{--worm-ac:${ac};--worm-glow:${ac}55}</style>` +
      '<ha-card>' +
      `<div class="view${exp?'':' active'}" id="v-compact">` +
        `<div class="compact-wrap" id="cmp-wrap" style="height:${ch}px">` +
          '<canvas id="atm-canvas"></canvas>' +
          '<div class="compact-overlay">' +
            '<div class="compact-left">' +
              '<div class="compact-temp" id="cmp-temp">—</div>' +
            '</div>' +
            '<div class="compact-right">' +
              '<div class="compact-cond" id="cmp-cond">—</div>' +
              '<div class="compact-hilo" id="cmp-hilo"></div>' +
              '<div class="compact-pills" id="cmp-pills"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      `<div class="view${exp?' active':''}" id="v-expanded">` +
        '<div class="collapse-handle" id="collapse-handle"></div>' +
        `<div class="view${radarActive?' active':''}" id="v-radar">` +
          '<div class="map-wrap">' +
            '<div id="lf-map"></div>' +
            '<div class="map-time-tag" id="map-time">Loading…</div>' +
            '<div class="map-loc-tag" id="map-loc" style="opacity:0"></div>' +
            '<div class="map-legend"><div class="leg-t">Rainfall</div><div class="leg-bar"></div><div class="leg-lbls"><span class="leg-l">Light</span><span class="leg-l">Heavy</span></div></div>' +
            '<div class="fpbar-wrap"><div class="fpbar" id="fpbar" style="width:0%"></div></div>' +
          '</div>' +
        '</div>' +
        `<div class="view${weatherActive?' active':''}" id="v-weather"><div class="wx-wrap" id="wx-content"></div></div>` +
        `<div class="view${forecastActive?' active':''}" id="v-forecast"><div class="fc-wrap" id="fc-content"></div></div>` +
        '<div class="tabs">' +
          `<div class="tab${radarActive?' on':''}" id="t-radar"><ha-icon class="tab-i" icon="mdi:radar"></ha-icon><span class="tab-l">Radar</span></div>` +
          `<div class="tab${weatherActive?' on':''}" id="t-weather"><ha-icon class="tab-i" icon="mdi:weather-partly-cloudy"></ha-icon><span class="tab-l">Weather</span></div>` +
          `<div class="tab${forecastActive?' on':''}" id="t-forecast"><ha-icon class="tab-i" icon="mdi:calendar-week"></ha-icon><span class="tab-l">Forecast</span></div>` +
        '</div>' +
      '</div>' +
      '</ha-card>';
    this._bindUI();
  }

  _postRender() {
    this._updateCompact();
    if (!this._expanded) {
      this._initAtm();
    } else {
      const dv = this._cfg.default_view || 'radar';
      if (dv !== 'weather' && dv !== 'forecast') {
        this._initMapAsync();
      }
      this._loadForecast().then(() => this._updateExpandedContent());
      this._updateExpandedContent();
    }
  }

  /* ── Forecast fetcher — always tries both hourly and daily ── */
  async _loadForecast() {
    const eid = this._cfg.weather_entity;
    if (!eid || !this._hass) return;

    const fetchType = async (type) => {
      try {
        const res = await this._hass.connection.sendMessagePromise({
          type: 'call_service', domain: 'weather', service: 'get_forecasts',
          service_data: { entity_id: eid, type },
          return_response: true,
        });
        return res?.response?.[eid]?.forecast || [];
      } catch (_) { return []; }
    };

    // Fetch hourly and daily simultaneously
    const [hourly, daily] = await Promise.all([
      fetchType('hourly'),
      fetchType('daily'),
    ]);

    // Also try twice_daily if neither worked
    if (!hourly.length && !daily.length) {
      const td = await fetchType('twice_daily');
      this._forecastHourly = td;
      this._forecastDaily  = td;
      this._forecast = td;
      return;
    }

    this._forecastHourly = hourly;
    this._forecastDaily  = daily;

    // Legacy _forecast: prefer hourly for the hourly strip in the Weather tab,
    // fall back to daily if no hourly available
    this._forecast = hourly.length ? hourly : daily;

    // Also check legacy attribute as last resort
    if (!this._forecast.length) {
      const st = this._hass.states[eid];
      this._forecast = st?.attributes?.forecast || [];
      this._forecastHourly = this._forecast;
      this._forecastDaily  = this._forecast;
    }
  }

  _bindUI() {
    const $ = id => this.shadowRoot.getElementById(id);

    // ── Tap + long-press helper ──────────────────────────────────────
    // Attaches to `el`. `onTap` fires on a short press, `onLongPress`
    // fires after 500 ms and suppresses the subsequent tap.
    const attachGesture = (el, onTap, onLongPress) => {
      if (!el) return;
      let timer = null;
      let longFired = false;
      let startX = 0, startY = 0;

      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

      el.addEventListener('pointerdown', e => {
        longFired = false;
        startX = e.clientX; startY = e.clientY;
        timer = setTimeout(() => {
          longFired = true;
          timer = null;
          onLongPress();
        }, 500);
      }, { passive: true });

      el.addEventListener('pointermove', e => {
        // Cancel if finger drifts more than 10 px (scroll tolerance)
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.sqrt(dx*dx + dy*dy) > 10) cancel();
      }, { passive: true });

      el.addEventListener('pointerup',     cancel, { passive: true });
      el.addEventListener('pointercancel', cancel, { passive: true });

      el.addEventListener('click', () => {
        if (longFired) { longFired = false; return; }
        onTap();
      });
    };

    // ── More-info helper ────────────────────────────────────────────
    const fireMoreInfo = () => {
      const eid = this._cfg.weather_entity;
      if (!eid) return;
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: eid }, bubbles: true, composed: true,
      }));
    };

    // ── Compact view: tap → expand, long → more-info ────────────────
    attachGesture($('cmp-wrap'),
      () => this._toggleSize(),
      fireMoreInfo
    );

    // ── Expanded collapse handle: tap → collapse, long → more-info ──
    attachGesture($('collapse-handle'),
      () => this._toggleSize(),
      fireMoreInfo
    );

    // ── Tab buttons ──
    ['t-radar','t-weather','t-forecast'].forEach(t => {
      $(t)?.addEventListener('click', e => { e.stopPropagation(); this._switchTab(t.replace('t-','')); });
    });
  }

  _toggleSize() {
    this._expanded = !this._expanded;
    const $ = id => this.shadowRoot.getElementById(id);
    $('v-compact').classList.toggle('active', !this._expanded);
    $('v-expanded').classList.toggle('active', this._expanded);
    if (this._expanded) {
      this._stopAtm();
      if (!this._map) this._initMapAsync();
      else setTimeout(() => this._map.invalidateSize(), 80);
      this._loadForecast().then(() => this._updateExpandedContent());
      this._updateExpandedContent();
    } else {
      this._stopAnim();
      this._initAtm();
    }
  }

  _switchTab(t) {
    this._curTab = t;
    const s = this.shadowRoot;
    ['radar','weather','forecast'].forEach(n => {
      s.getElementById('v-'+n)?.classList.toggle('active', n===t);
      s.getElementById('t-'+n)?.classList.toggle('on', n===t);
    });
    if (t==='radar') {
      if (!this._map) this._initMapAsync();
      else setTimeout(() => this._map.invalidateSize(), 80);
    }
    if (t==='weather') { const wxc = s.getElementById('wx-content'); if (wxc) wxc.innerHTML = this._wxHTML(); }
    if (t==='forecast') {
      const fcc = s.getElementById('fc-content');
      if (fcc) {
        fcc.innerHTML = this._fcHTML();
        this._fcBindDayTabs();
        this._loadForecast().then(() => {
          const el = s.getElementById('fc-content');
          if (el) { el.innerHTML = this._fcHTML(); this._fcBindDayTabs(); }
        });
      }
    }
  }

  _updateExpandedContent() {
    const wxc = this.shadowRoot.getElementById('wx-content');
    const fcc = this.shadowRoot.getElementById('fc-content');
    if (wxc) wxc.innerHTML = this._wxHTML();
    if (fcc) { fcc.innerHTML = this._fcHTML(); this._fcBindDayTabs(); }
  }

  /* ── Compact overlay ── */
  _updateCompact() {
    const s = this.shadowRoot;
    if (!s.getElementById('cmp-temp')) return;
    const eid  = this._cfg.weather_entity;
    const st   = this._hass && eid && this._hass.states[eid];
    const a    = st ? (st.attributes || {}) : {};
    const cond = st ? (st.state || '') : '';
    const u    = this._cfg.temp_unit || '°C';
    const wu   = this._cfg.wind_unit || 'km/h';
    const srcT = a.temperature_unit || '°C';
    const srcW = a.wind_speed_unit  || 'km/h';

    // Temperature
    s.getElementById('cmp-temp').innerHTML = `${cvtTempD(a.temperature, u, srcT)}<sup>${u}</sup>`;

    // Condition
    s.getElementById('cmp-cond').textContent = W_LABELS[cond] || cond || '—';

    // H/L
    const hi = a.temperature_high != null ? cvtTemp(a.temperature_high, u, srcT) : null;
    const lo = a.temperature_low  != null ? cvtTemp(a.temperature_low,  u, srcT) : null;
    s.getElementById('cmp-hilo').textContent = (hi != null && lo != null) ? `H: ${hi}° · L: ${lo}°` : '';

    // Pills: humidity + optional wind
    const pillsEl = s.getElementById('cmp-pills');
    if (pillsEl) {
      let pills = '';
      if (a.humidity != null) {
        pills += `<span class="compact-pill">${ico('mdi:water-percent',11,'vertical-align:middle;')} ${Math.round(a.humidity)}%</span>`;
      }
      if (this._cfg.show_wind_on_compact && a.wind_speed != null) {
        const ws  = cvtWind(a.wind_speed, wu, srcW);
        const dir = a.wind_bearing != null ? ' ' + wdir(a.wind_bearing) : '';
        pills += `<span class="compact-pill">${ico('mdi:weather-windy',11,'vertical-align:middle;')} ${ws} ${wu}${dir}</span>`;
      }
      pillsEl.innerHTML = pills;
    }

    // Update canvas animation state
    if (this._atm) {
      const isNight = cond === 'clear-night' || (this._hass && this._hass.states['sun.sun']?.state === 'below_horizon');
      this._atm.update(cond || 'cloudy', isNight, this._isDarkMode(), {ufo:this._cfg.scifiUFO!==false, enterprise:this._cfg.scifiEnterprise!==false, borg:this._cfg.scifiBorg!==false, wormhole:this._cfg.scifiWormhole!==false, angryBirds:this._cfg.angryBirds!==false});
    }
  }

  _stopAtm() { if (this._atm) { this._atm.stop(); } }
  _initAtm() {
    const wrap = this.shadowRoot.getElementById('cmp-wrap');
    const cv   = this.shadowRoot.getElementById('atm-canvas');
    if (!wrap || !cv) return;
    requestAnimationFrame(() => {
      const w = wrap.offsetWidth || 300, h = wrap.offsetHeight || 160;
      if (!w || !h) return;
      const eid = this._cfg.weather_entity;
      const st  = this._hass && eid && this._hass.states[eid];
      const cond = st ? (st.state || 'cloudy') : 'cloudy';
      const isNight = cond === 'clear-night' || (this._hass && this._hass.states['sun.sun']?.state === 'below_horizon');
      const sf = {ufo:this._cfg.scifiUFO!==false, enterprise:this._cfg.scifiEnterprise!==false, borg:this._cfg.scifiBorg!==false, wormhole:this._cfg.scifiWormhole!==false, angryBirds:this._cfg.angryBirds!==false};
      if (!this._atm) this._atm = new AtmCanvas(cv);
      this._atm.init(cond, isNight, this._isDarkMode(), w, h, sf);
      this._atm.start();
    });
  }

  /* ── Resolve whether HA is in dark mode ── */
  _isDarkMode() {
    // Follow the sun: dark theme after sunset, light theme after sunrise.
    // Primary source: sun.sun entity (most accurate — set by HA from your location).
    // Fallback: weather entity state 'clear-night' as a secondary signal.
    // Last resort: wall-clock hour (6 pm–6 am = dark).
    const sun = this._hass?.states?.['sun.sun'];
    if (sun) {
      return sun.state === 'below_horizon';
    }
    // No sun entity — check if the weather condition is a night state
    const eid  = this._cfg?.weather_entity;
    const cond = eid ? (this._hass?.states?.[eid]?.state || '') : '';
    if (cond === 'clear-night') return true;
    // Final fallback: local clock (6pm–6am = dark)
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  }

  /* ── Map ── */
  async _initMapAsync() {
    await loadLeaflet(this.shadowRoot);
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    this._initMap();
  }

  _initMap() {
    const el = this.shadowRoot.getElementById('lf-map');
    if (!el || !window.L) return;
    if (this._map) { this._map.remove(); this._map = null; }
    this._frames = []; this._fi = 0; this._radar = null;
    const style = this._cfg.map_style || 'standard';
    const tl    = TILES[style] || TILES.standard;
    this._map = L.map(el, { zoomControl:false, attributionControl:false })
                 .setView([this._lat, this._lon], this._zoom);
    L.control.attribution({ position:'bottomright', prefix:false }).addTo(this._map);
    L.tileLayer(tl.url, {
      attribution: tl.attr, maxZoom:19,
      subdomains: tl.sub || 'abc',
      crossOrigin: true
    }).addTo(this._map);
    setTimeout(() => { if (this._map) this._map.invalidateSize(); }, 150);
    this._fetchRadar();
    if (this._cfg.postcode) this._geocode();
  }

  async _geocode() {
    const tag = this.shadowRoot.getElementById('map-loc');
    if (tag) { tag.textContent = '📍 Locating…'; tag.style.opacity='1'; }
    const r = await geocode(this._cfg.postcode, this._cfg.country_code);
    if (r) {
      this._lat = r.lat; this._lon = r.lon;
      if (this._map) this._map.setView([r.lat, r.lon], this._zoom, { animate:true });
      if (tag) tag.textContent = '📍 ' + r.name.split(',').slice(0,2).join(',');
    } else { if (tag) tag.textContent = '⚠️ Location not found'; }
    setTimeout(() => { if (tag) tag.style.opacity='0'; }, 3500);
  }

  async _fetchRadar() {
    try {
      const d = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
      this._frames = [...(d.radar?.past||[]), ...(d.radar?.nowcast||[])];
      if (!this._frames.length) return;
      this._fi = this._frames.length - 1;
      this._showFrame(this._fi);
      if (this._cfg.auto_animate !== false) this._startAnim();
    } catch (_) {
      const t = this.shadowRoot.getElementById('map-time');
      if (t) t.textContent = 'Radar unavailable';
    }
  }

  _showFrame(i, instant = false) {
    if (!this._map || !window.L) return;
    const f = this._frames[i]; if (!f) return;
    const url = 'https://tilecache.rainviewer.com' + f.path + '/256/{z}/{x}/{y}/7/1_1.png';
    const targetOpacity = parseFloat(this._cfg.radar_opacity) || 0.7;
    const oldLayer = this._radar;
    const hasOld = !!oldLayer;

    // New layer: start visible immediately if no old layer to crossfade from
    const newLayer = L.tileLayer(url, {
      opacity: (instant || !hasOld) ? targetOpacity : 0,
      zIndex: 200,
      crossOrigin: 'anonymous',
    }).addTo(this._map);

    this._radar = newLayer;

    if (hasOld && !instant) {
      // Crossfade: ramp new layer up, old layer down over ~300 ms
      const STEPS = 12, INTERVAL = 25;
      let step = 0;
      const fade = setInterval(() => {
        step++;
        const t = step / STEPS;
        const eased = t * (2 - t); // ease-in-out
        try { newLayer.setOpacity(eased * targetOpacity); } catch (_) {}
        try { oldLayer.setOpacity((1 - eased) * targetOpacity); } catch (_) {}
        if (step >= STEPS) {
          clearInterval(fade);
          try { if (this._map) this._map.removeLayer(oldLayer); } catch (_) {}
        }
      }, INTERVAL);
    } else if (hasOld) {
      this._map.removeLayer(oldLayer);
    }

    // Update time label and progress bar
    const t = this.shadowRoot.getElementById('map-time');
    if (t) t.textContent = new Date(f.time*1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const bar = this.shadowRoot.getElementById('fpbar');
    if (bar) bar.style.width = ((i+1)/this._frames.length*100).toFixed(0)+'%';
  }

  _startAnim() {
    this._stopAnim();
    if (this._frames.length < 2) return;
    this._playing = true;
    const speed = parseInt(this._cfg.animation_speed) || 600;
    this._timer = setInterval(() => {
      this._fi = (this._fi + 1) % this._frames.length;
      this._showFrame(this._fi);
    }, speed);
  }

  _stopAnim() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._rafAnim) { cancelAnimationFrame(this._rafAnim); this._rafAnim = null; }
    this._playing = false;
  }
  _toggleAnim(){ this._playing ? this._stopAnim() : this._startAnim(); }

  /* ── Weather HTML ── */
  _wxHTML() {
    const eid = this._cfg.weather_entity;
    if (!eid) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:weather-sunny"></ha-icon><div class="empty-txt">Select a weather entity<br>in the visual editor</div></div>`;
    const st = this._hass?.states?.[eid];
    if (!st) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:alert-circle"></ha-icon><div class="empty-txt">Entity not found:<br>${eid}</div></div>`;
    const a  = st.attributes || {};
    const u  = this._cfg.temp_unit || '°C';
    const wu = this._cfg.wind_unit || 'km/h';
    const srcT = a.temperature_unit || '°C';
    const srcW = a.wind_speed_unit  || 'km/h';
    const cond  = st.state || '';
    const feels = a.apparent_temperature != null ? cvtTemp(a.apparent_temperature, u, srcT) : null;
    const hi    = a.temperature_high != null ? cvtTemp(a.temperature_high, u, srcT) : null;
    const lo    = a.temperature_low  != null ? cvtTemp(a.temperature_low,  u, srcT) : null;
    // Use hourly for the strip; fall back to whatever we have
    const fc    = this._forecastHourly.length ? this._forecastHourly
                : this._forecast.length       ? this._forecast
                : (a.forecast || []);
    const now   = Date.now();
    const hourly = fc.filter(f => { const d=new Date(f.datetime)-now; return d>-3.6e6 && d<9.36e7; }).slice(0,12);
    const ws = cvtWind(a.wind_speed, wu, srcW) ?? '—';

    let h = `<div class="wx-current">
      <div class="wx-ico-sm">${wico(cond,36)}</div>
      <div class="wx-temp">${cvtTempD(a.temperature,u,srcT)}<sup>${u}</sup></div>
      <div class="wx-meta">
        <div class="wx-cond">${W_LABELS[cond]||cond}</div>
        ${feels!=null?`<div class="wx-hl">Feels like ${feels}${u}${(hi!=null&&lo!=null)?` · H:${hi}° L:${lo}°`:''}</div>`
          :(hi!=null&&lo!=null?`<div class="wx-hl">H: ${hi}° · L: ${lo}°</div>`:'') }
      </div>
    </div><div class="wx-pad">`;

    if (this._cfg.show_hourly !== false && hourly.length) {
      h += '<div class="sec-hdr">Hourly</div><div class="hrow">';
      hourly.forEach((f,i) => {
        h += `<div class="hitem${i===0?' now':''}">
          <div class="ht">${i===0?'Now':fmtT(f.datetime)}</div>
          <div class="hi">${wico(f.condition,18)}</div>
          <div class="htmp">${cvt(f.temperature,u)}°</div>
          ${f.precipitation_probability!=null?`<div class="hrn">${Math.round(f.precipitation_probability)}%</div>`:''}
        </div>`;
      });
      h += '</div>';
    }

    if (this._cfg.show_details !== false) {
      h += '<div class="sec-hdr">Conditions</div><div class="tgrid">';
      const tile=(icon,lbl,val,unit,sub)=>`<div class="tile"><div class="tile-hdr">${ico(icon,14,'')}<span class="tile-lbl">${lbl}</span></div><div><span class="tile-val">${val}</span><span class="tile-unit"> ${unit}</span></div><div class="tile-sub">${sub}</div></div>`;
      if (a.humidity!=null) { const hm=Math.round(a.humidity); h+=tile('mdi:water-percent','Humidity',hm,'%',hm<30?'Dry':hm<60?'Comfortable':hm<80?'Humid':'Very Humid'); }
      if (a.wind_speed!=null) h+=tile('mdi:weather-windy','Wind',ws,wu,wdir(a.wind_bearing));
      if (a.pressure!=null) { const p=Math.round(a.pressure); h+=tile('mdi:gauge','Pressure',p,'hPa',p>1020?'↑ High':p<1000?'↓ Low':'→ Normal'); }
      if (a.uv_index!=null) h+=tile('mdi:sun-wireless','UV Index',a.uv_index,'',uvl(a.uv_index));
      if (a.visibility!=null) h+=tile('mdi:eye','Visibility',Math.round(a.visibility),'km','');
      if (a.dew_point!=null) h+=tile('mdi:thermometer-water','Dew Point',cvtTemp(a.dew_point,u,srcT),u,'');
      if (a.cloud_coverage!=null) h+=tile('mdi:cloud-percent','Cloud Cover',Math.round(a.cloud_coverage),'%','');
      if (a.precipitation!=null) h+=tile('mdi:weather-rainy','Precipitation',a.precipitation,'mm','');
      h += '</div>';
    }
    h += '</div>'; // close wx-pad
    return h;
  }
  _fcHTML() {
    const eid = this._cfg.weather_entity;
    if (!eid) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:calendar-weather"></ha-icon><div class="empty-txt">Select a weather entity</div></div>`;
    const st = this._hass?.states?.[eid];
    if (!st) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:alert-circle"></ha-icon><div class="empty-txt">Entity not found: ${eid}</div></div>`;
    const u = this._cfg.temp_unit || '°C';

    const hourlyFc = this._forecastHourly;
    const dailyFc  = this._forecastDaily.length ? this._forecastDaily
                   : (st.attributes?.forecast || []);

    if (!hourlyFc.length && !dailyFc.length) {
      return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:loading"></ha-icon><div class="empty-txt">Loading forecast\u2026</div></div>`;
    }

    const byDayDaily = {};
    for (const f of dailyFc) {
      const d = new Date(f.datetime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDayDaily[key]) byDayDaily[key] = f;
    }

    const byDayHourly = {};
    for (const f of hourlyFc) {
      const d = new Date(f.datetime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDayHourly[key]) byDayHourly[key] = { label: d, items: [] };
      byDayHourly[key].items.push(f);
    }

    const allKeys = new Set([...Object.keys(byDayHourly), ...Object.keys(byDayDaily)]);
    const sortedKeys = Array.from(allKeys).sort().slice(0, 7);

    if (!sortedKeys.length) {
      return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:calendar-blank"></ha-icon><div class="empty-txt">No forecast data</div></div>`;
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let tabsHTML = '<div class="fc-day-tabs" id="fc-day-tabs">';
    sortedKeys.forEach((key, i) => {
      const dailySummary = byDayDaily[key];
      const hourlyDay    = byDayHourly[key];
      const labelDate    = hourlyDay?.label || (dailySummary ? new Date(dailySummary.datetime) : new Date(key));
      const dt = new Date(labelDate); dt.setHours(0, 0, 0, 0);
      const isToday = dt.getTime() === today.getTime();
      let peakCond = dailySummary?.condition;
      if (!peakCond && hourlyDay) peakCond = hourlyDay.items[Math.floor(hourlyDay.items.length * 0.45)]?.condition;
      peakCond = peakCond || 'cloudy';
      let hi = dailySummary?.temperature;
      if (hi == null && hourlyDay) hi = Math.max(...hourlyDay.items.map(x => x.temperature ?? -99));
      tabsHTML += `<div class="fc-day-tab${i === 0 ? ' active' : ''}" data-day="${key}">
        <span class="fdt-name">${isToday ? 'Today' : fmtD(labelDate)}</span>
        <span class="fdt-ico">${wico(peakCond, 20)}</span>
        ${hi != null ? `<span class="fdt-hi">${cvt(hi, u)}°</span>` : ''}
      </div>`;
    });
    tabsHTML += '</div>';

    const firstKey   = sortedKeys[0];
    const firstPanel = this._fcDayPanel(
      byDayHourly[firstKey]?.items || [],
      byDayDaily[firstKey] || null,
      u, true
    );
    return tabsHTML + `<div class="fc-panel" id="fc-panel">${firstPanel}</div>`;
  }

  _fcDayPanel(hourlyItems, dailySummary, u, isToday) {
    let h = '<div class="fc-hlist">';
    const now = Date.now();
    if (hourlyItems.length > 1) {
      for (const f of hourlyItems) {
        const d = new Date(f.datetime);
        const isNow = isToday && Math.abs(d - now) < 1800000;
        const timeStr = isNow ? 'Now' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const rn = f.precipitation_probability;
        h += `<div class="fc-hrow">
          <div class="fc-h-time">${timeStr}</div>
          <div class="fc-h-ico">${wico(f.condition, 18)}</div>
          <div class="fc-h-desc">${W_LABELS[f.condition] || f.condition || ''}</div>
          <div class="fc-h-temp">${cvt(f.temperature, u)}°</div>
          <div class="fc-h-rn">${rn != null ? Math.round(rn) + '%' : ''}</div>
        </div>`;
      }
    } else if (dailySummary) {
      const rn = dailySummary.precipitation_probability;
      const lo = dailySummary.templow;
      h += `<div class="fc-hrow">
        <div class="fc-h-time" style="width:56px;color:var(--worm-ac)">All day</div>
        <div class="fc-h-ico">${wico(dailySummary.condition, 18)}</div>
        <div class="fc-h-desc">${W_LABELS[dailySummary.condition] || dailySummary.condition || ''}</div>
        <div class="fc-h-temp">${cvt(dailySummary.temperature, u)}°${lo != null ? ' / ' + cvt(lo, u) + '°' : ''}</div>
        <div class="fc-h-rn">${rn != null ? Math.round(rn) + '%' : ''}</div>
      </div>`;
    } else {
      h += '<div class="empty" style="height:80px"><div class="empty-txt">No data for this day</div></div>';
    }
    h += '</div>';
    return h;
  }

  _fcBindDayTabs() {
    const s = this.shadowRoot;
    const tabsEl  = s.getElementById('fc-day-tabs');
    const panelEl = s.getElementById('fc-panel');
    if (!tabsEl || !panelEl) return;
    const u = this._cfg.temp_unit || '°C';
    const hourlyFc = this._forecastHourly;
    const dailyFc  = this._forecastDaily.length ? this._forecastDaily
                   : (this._hass?.states?.[this._cfg.weather_entity]?.attributes?.forecast || []);
    const byDayHourly = {};
    for (const f of hourlyFc) {
      const d = new Date(f.datetime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDayHourly[key]) byDayHourly[key] = { items: [] };
      byDayHourly[key].items.push(f);
    }
    const byDayDaily = {};
    for (const f of dailyFc) {
      const d = new Date(f.datetime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDayDaily[key]) byDayDaily[key] = f;
    }
    const allKeys = new Set([...Object.keys(byDayHourly), ...Object.keys(byDayDaily)]);
    const sortedKeys = Array.from(allKeys).sort().slice(0, 7);
    tabsEl.querySelectorAll('.fc-day-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsEl.querySelectorAll('.fc-day-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const key     = tab.dataset.day;
        const isFirst = key === sortedKeys[0];
        panelEl.innerHTML = this._fcDayPanel(
          byDayHourly[key]?.items || [],
          byDayDaily[key] || null,
          u, isFirst
        );
        panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }
} // end WormWeatherCard

/* ═══════════════════════ EDITOR CLASS ═══════════════════════ */
class WormWeatherCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._cfg = {}; this._hass = null; this._init = false;
  }

  setConfig(c) {
    this._cfg = Object.assign({}, c);
    if (this._init) this._syncUI();
    else if (this._hass) this._render();
  }

  set hass(h) {
    this._hass = h;
    if (!this._init) this._render();
  }

  _updateConfig(k, v) {
    this._cfg = Object.assign({}, this._cfg, { [k]: v });
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._cfg }, bubbles:true, composed:true }));
  }

  _entities(domain) {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(id => id.startsWith(domain + '.'))
      .map(id => ({ id, nm: this._hass.states[id]?.attributes?.friendly_name || id }))
      .sort((a,b) => a.nm.localeCompare(b.nm));
  }

  _seg(key, opts, value) {
    return '<div class="seg">' + opts.map(([v,label]) =>
      `<div class="seg-o${(value||opts[0][0])===v?' on':''}" data-seg="${key}" data-val="${v}">${label}</div>`
    ).join('') + '</div>';
  }

  _tog(id, checked) {
    return `<label class="tog"><input type="checkbox" id="${id}"${checked?' checked':''}><span class="tog-tr"></span></label>`;
  }

  _render() {
    if (!this._hass || !this._cfg) return;
    this._init = true;
    const c = this._cfg;
    const wEnts = this._entities('weather');

    this.shadowRoot.innerHTML = `<style>${ED_CSS}</style>
<div class="container">
  <div class="ed-hdr">
    <ha-icon class="ed-logo" icon="mdi:weather-cloudy" style="color:var(--primary-color,#3b82f6)"></ha-icon>
    <div><div class="ed-title">Worm Weather Card</div></div>
  </div>

  <!-- CARD SETTINGS -->
  <div><div class="sec-title">Card Settings</div><div class="card-block">
    <div class="row">
      <div class="row-icon" style="background:rgba(52,199,89,0.12)">${ico('mdi:arrow-expand-vertical',16,'color:#34C759')}</div>
      <div class="row-info"><div class="row-label">Compact Height</div><div class="row-sub">Pixels in compact mode</div></div>
      <div class="row-ctrl"><input type="range" class="sl" id="sl-ch" min="120" max="260" step="10" value="${c.compact_height||160}"><span class="sl-val" id="slv-ch">${c.compact_height||160}px</span></div>
    </div>
  </div></div>

  <!-- LOCATION -->
  <div><div class="sec-title">Location</div><div class="card-block">
    <div class="row">
      <div class="row-icon" style="background:rgba(52,199,89,0.12)">${ico('mdi:map-marker',16,'color:#34C759')}</div>
      <div class="row-info"><div class="row-label">Postcode / ZIP</div><div class="row-sub">Centres the radar map</div></div>
      <div class="row-ctrl"><input type="text" class="txt md" id="inp-postcode" value="${c.postcode||''}" placeholder="e.g. SW1A 1AA"></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(94,92,230,0.12)">${ico('mdi:earth',16,'color:#5E5CE6')}</div>
      <div class="row-info"><div class="row-label">Country Code</div><div class="row-sub">ISO 2-letter (GB, US, DE…)</div></div>
      <div class="row-ctrl"><input type="text" class="txt sm" id="inp-cc" value="${c.country_code||''}" placeholder="GB" maxlength="3"></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,55,95,0.12)">${ico('mdi:magnify-plus',16,'color:#FF375F')}</div>
      <div class="row-info"><div class="row-label">Default Zoom</div><div class="row-sub">4=country · 8=region · 12=city</div></div>
      <div class="row-ctrl"><input type="range" class="sl" id="sl-zoom" min="4" max="14" step="1" value="${c.zoom_level||7}"><span class="sl-val" id="slv-zoom">${c.zoom_level||7}</span></div>
    </div>
  </div></div>

  <!-- RADAR -->
  <div><div class="sec-title">Radar</div><div class="card-block">
    <div class="row">
      <div class="row-icon" style="background:rgba(90,200,250,0.12)">${ico('mdi:radar',16,'color:#5AC8FA')}</div>
      <div class="row-info"><div class="row-label">Map Style</div></div>
      <div class="row-ctrl">
        <select class="sel" id="sel-mapstyle">
          <option value="standard"${(c.map_style||'standard')==='standard'?' selected':''}>Standard</option>
          <option value="dark"${c.map_style==='dark'?' selected':''}>Dark</option>
          <option value="light"${c.map_style==='light'?' selected':''}>Light</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(94,92,230,0.12)">${ico('mdi:opacity',16,'color:#5E5CE6')}</div>
      <div class="row-info"><div class="row-label">Radar Opacity</div></div>
      <div class="row-ctrl"><input type="range" class="sl" id="sl-op" min="10" max="100" step="5" value="${Math.round((c.radar_opacity||0.7)*100)}"><span class="sl-val" id="slv-op">${Math.round((c.radar_opacity||0.7)*100)}%</span></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,159,10,0.12)">${ico('mdi:timer',16,'color:#FF9F0A')}</div>
      <div class="row-info"><div class="row-label">Animation Speed</div><div class="row-sub">ms per frame</div></div>
      <div class="row-ctrl"><input type="range" class="sl" id="sl-spd" min="200" max="1500" step="100" value="${c.animation_speed||600}"><span class="sl-val" id="slv-spd">${c.animation_speed||600}ms</span></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(52,199,89,0.12)">${ico('mdi:play-circle',16,'color:#34C759')}</div>
      <div class="row-info"><div class="row-label">Auto-play on Load</div></div>
      <div class="row-ctrl">${this._tog('tog-anim', c.auto_animate!==false)}</div>
    </div>
  </div></div>

  <!-- WEATHER -->
  <div><div class="sec-title">Weather</div><div class="card-block">
    <div class="row">
      <div class="row-icon" style="background:rgba(90,200,250,0.12)">${ico('mdi:weather-partly-cloudy',16,'color:#5AC8FA')}</div>
      <div class="row-info"><div class="row-label">Weather Entity</div><div class="row-sub">${c.weather_entity||'None selected'}</div></div>
      <div class="row-ctrl">
        <select class="sel" id="sel-entity">
          <option value="">— Select entity —</option>
          ${wEnts.map(e=>`<option value="${e.id}"${e.id===c.weather_entity?' selected':''}>${e.nm}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,159,10,0.12)">${ico('mdi:thermometer',16,'color:#FF9F0A')}</div>
      <div class="row-info"><div class="row-label">Temperature Unit</div></div>
      <div class="row-ctrl" id="seg-temp_unit"></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(52,199,89,0.12)">${ico('mdi:weather-windy',16,'color:#34C759')}</div>
      <div class="row-info"><div class="row-label">Wind Speed Unit</div></div>
      <div class="row-ctrl">
        <select class="sel" id="sel-wind">
          <option value="km/h"${(c.wind_unit||'km/h')==='km/h'?' selected':''}>km/h</option>
          <option value="mph"${c.wind_unit==='mph'?' selected':''}>mph</option>
          <option value="m/s"${c.wind_unit==='m/s'?' selected':''}>m/s</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,159,10,0.12)">${ico('mdi:chart-bar',16,'color:#FF9F0A')}</div>
      <div class="row-info"><div class="row-label">Condition Tiles</div><div class="row-sub">Humidity, wind, UV…</div></div>
      <div class="row-ctrl">${this._tog('tog-details', c.show_details!==false)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(52,199,89,0.12)">${ico('mdi:weather-windy',16,'color:#34C759')}</div>
      <div class="row-info"><div class="row-label">Wind Speed on Mini Card</div><div class="row-sub">Show wind speed below condition</div></div>
      <div class="row-ctrl">${this._tog('tog-windcmp', c.show_wind_on_compact===true)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(180,80,255,0.12)">${ico('mdi:ufo',16,'color:#B450FF')}</div>
      <div class="row-info"><div class="row-label">UFO</div><div class="row-sub">Alien saucer with waving alien</div></div>
      <div class="row-ctrl">${this._tog('tog-scifi-ufo', c.scifiUFO!==false)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(180,80,255,0.12)">${ico('mdi:rocket-launch',16,'color:#B450FF')}</div>
      <div class="row-info"><div class="row-label">USS Enterprise</div><div class="row-sub">NCC-1701 warping through the sky</div></div>
      <div class="row-ctrl">${this._tog('tog-scifi-enterprise', c.scifiEnterprise!==false)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(180,80,255,0.12)">${ico('mdi:cube-outline',16,'color:#B450FF')}</div>
      <div class="row-info"><div class="row-label">Borg Cube</div><div class="row-sub">Resistance Is Futile — locks on to the Sun or Moon</div></div>
      <div class="row-ctrl">${this._tog('tog-scifi-borg', c.scifiBorg!==false)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(180,80,255,0.12)">${ico('mdi:circle-double',16,'color:#B450FF')}</div>
      <div class="row-info"><div class="row-label">Stargate</div><div class="row-sub">SG-1 Kawoosh Wormhole</div></div>
      <div class="row-ctrl">${this._tog('tog-scifi-wormhole', c.scifiWormhole!==false)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,80,30,0.12)">${ico('mdi:bird',16,'color:#FF5020')}</div>
      <div class="row-info"><div class="row-label">Angry Birds</div><div class="row-sub">Red, Yellow, Blue, Black and Bomb birds fly in an arc</div></div>
      <div class="row-ctrl">${this._tog('tog-angry-birds', c.angryBirds!==false)}</div>
    </div>
  </div></div>

</div>`;

    // Build segmented controls after DOM is set
    const segTU = this.shadowRoot.getElementById('seg-temp_unit');
    if (segTU) segTU.innerHTML = this._seg('temp_unit', [['°C','°C'],['°F','°F']], c.temp_unit||'°C');

    this._setupListeners();
  }

  _syncUI() {
    const s = this.shadowRoot, c = this._cfg;
    // Update selects
    const se = s.getElementById('sel-entity'); if (se) se.value = c.weather_entity||'';
    const sm = s.getElementById('sel-mapstyle'); if (sm) sm.value = c.map_style||'standard';
    const sw = s.getElementById('sel-wind'); if (sw) sw.value = c.wind_unit||'km/h';
    // Update sliders
    const slch=s.getElementById('sl-ch'); if(slch){slch.value=c.compact_height||160;const v=s.getElementById('slv-ch');if(v)v.textContent=(c.compact_height||160)+'px';}
    const slz=s.getElementById('sl-zoom'); if(slz){slz.value=c.zoom_level||7;const v=s.getElementById('slv-zoom');if(v)v.textContent=c.zoom_level||7;}
    const slop=s.getElementById('sl-op'); if(slop){slop.value=Math.round((c.radar_opacity||0.7)*100);const v=s.getElementById('slv-op');if(v)v.textContent=Math.round((c.radar_opacity||0.7)*100)+'%';}
    const slsp=s.getElementById('sl-spd'); if(slsp){slsp.value=c.animation_speed||600;const v=s.getElementById('slv-spd');if(v)v.textContent=(c.animation_speed||600)+'ms';}
    // Update toggles
    const ta=s.getElementById('tog-anim');if(ta)ta.checked=c.auto_animate!==false;
    const tdt=s.getElementById('tog-details');if(tdt)tdt.checked=c.show_details!==false;
    const twc=s.getElementById('tog-windcmp');if(twc)twc.checked=c.show_wind_on_compact===true;
    const ts1=s.getElementById('tog-scifi-ufo');if(ts1)ts1.checked=c.scifiUFO!==false;
    const ts2=s.getElementById('tog-scifi-enterprise');if(ts2)ts2.checked=c.scifiEnterprise!==false;
    const ts3=s.getElementById('tog-scifi-borg');if(ts3)ts3.checked=c.scifiBorg!==false;
    const ts4=s.getElementById('tog-scifi-wormhole');if(ts4)ts4.checked=c.scifiWormhole!==false;
    const ts5=s.getElementById('tog-angry-birds');if(ts5)ts5.checked=c.angryBirds!==false;
    // Update seg opts
    s.querySelectorAll('[data-seg="temp_unit"]').forEach(el=>el.classList.toggle('on',el.dataset.val===(c.temp_unit||'°C')));
    // Update postcode display
    const pc=s.getElementById('inp-postcode');if(pc)pc.value=c.postcode||'';
    const cc=s.getElementById('inp-cc');if(cc)cc.value=c.country_code||'';
  }

  _setupListeners() {
    const s = this.shadowRoot;
    // Entity & selects
    s.getElementById('sel-entity')?.addEventListener('change', e => {
      this._updateConfig('weather_entity', e.target.value);
      const sub = s.querySelector('#sel-entity').closest('.row')?.querySelector('.row-sub');
      if (sub) sub.textContent = e.target.value || 'None selected';
    });
    s.getElementById('sel-mapstyle')?.addEventListener('change', e => this._updateConfig('map_style', e.target.value));
    s.getElementById('sel-wind')?.addEventListener('change', e => this._updateConfig('wind_unit', e.target.value));
    // Text inputs — use onblur to prevent hang
    const pc = s.getElementById('inp-postcode');
    if (pc) { pc.addEventListener('blur', e => this._updateConfig('postcode', e.target.value.trim())); pc.addEventListener('keydown', e => { if(e.key==='Enter')e.target.blur(); }); }
    const cc = s.getElementById('inp-cc');
    if (cc) { cc.addEventListener('blur', e => this._updateConfig('country_code', e.target.value.trim().toUpperCase())); cc.addEventListener('keydown', e => { if(e.key==='Enter')e.target.blur(); }); }
    // Sliders
    const sl=(id,key,mul,sfx)=>{
      const el=s.getElementById('sl-'+id), vl=s.getElementById('slv-'+id);
      if(el){el.addEventListener('input',e=>{const v=parseFloat(e.target.value);if(vl)vl.textContent=mul?+(v*mul).toFixed(2)+sfx:v+sfx;this._updateConfig(key,mul?v/100:v);});}
    };
    sl('ch','compact_height',null,'px'); sl('zoom','zoom_level',null,''); sl('op','radar_opacity',0.01,'%'); sl('spd','animation_speed',null,'ms');
    // Toggles
    s.getElementById('tog-anim')?.addEventListener('change', e => this._updateConfig('auto_animate', e.target.checked));
    s.getElementById('tog-details')?.addEventListener('change', e => this._updateConfig('show_details', e.target.checked));
    s.getElementById('tog-windcmp')?.addEventListener('change', e => this._updateConfig('show_wind_on_compact', e.target.checked));
    s.getElementById('tog-scifi-ufo')?.addEventListener('change', e => this._updateConfig('scifiUFO', e.target.checked));
    s.getElementById('tog-scifi-enterprise')?.addEventListener('change', e => this._updateConfig('scifiEnterprise', e.target.checked));
    s.getElementById('tog-scifi-borg')?.addEventListener('change', e => this._updateConfig('scifiBorg', e.target.checked));
    s.getElementById('tog-scifi-wormhole')?.addEventListener('change', e => this._updateConfig('scifiWormhole', e.target.checked));
    s.getElementById('tog-angry-birds')?.addEventListener('change', e => this._updateConfig('angryBirds', e.target.checked));
    // Segmented controls
    s.querySelectorAll('[data-seg]').forEach(el => el.addEventListener('click', () => {
      const key = el.dataset.seg, val = el.dataset.val;
      s.querySelectorAll(`[data-seg="${key}"]`).forEach(x=>x.classList.toggle('on',x===el));
      this._updateConfig(key, val);
    }));
  }
}

/* ─────────────────────── REGISTRATION ─────────────────────── */
customElements.define('worm-weather-card',        WormWeatherCard);
customElements.define('worm-weather-card-editor', WormWeatherCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'worm-weather-card')) {
  window.customCards.push({
    type:'worm-weather-card', name:'Worm Weather Card', preview:true,
    description:'Atmospheric weather + radar card for Home Assistant',
  });
}

console.info(
  '%c WORM WEATHER CARD ',
  'color:#fff;background:#5AC8FA;font-weight:700;border-radius:4px;padding:2px 8px'
);
})();
