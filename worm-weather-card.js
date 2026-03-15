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
    this._aurora       = null;
    this._birdTimer = 0; this._planeTimer = 0;
    // State
    this._cond = 'sunny'; this._isNight = false; this._isDark = true;
    this._w = 0; this._h = 0;
    // Phase counters
    this._frame = 0; this._gustPh = 0; this._sunPh = 0; this._moonPh = 0;
    this._flashOp = 0; this._flashHold = 0;
    this._shimmerPh = 0;
  }

  /* ── Public API ──────────────────────────────────────────────── */
  init(cond, isNight, isDark, w, h) {
    this._cond = cond || 'cloudy';
    this._isNight = !!isNight; this._isDark = !!isDark;
    this._w = w; this._h = h;
    this._cv.width = w; this._cv.height = h;
    this._ctx = this._cv.getContext('2d');
    this._build();
  }

  update(cond, isNight, isDark) {
    const ch = this._cond !== cond || this._isNight !== !!isNight || this._isDark !== !!isDark;
    this._cond = cond; this._isNight = !!isNight; this._isDark = !!isDark;
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
    this._dustMotes=[]; this._aurora=null;
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
    const nc = ({'clear-night':0,'sunny':0,'exceptional':0,'partlycloudy':3,'cloudy':8,
      'fog':6,'hail':7,'lightning':9,'lightning-rainy':8,'pouring':9,'rainy':7,
      'snowy':7,'snowy-rainy':6,'windy':5,'windy-variant':5})[c] ?? 4;
    const storm = c==='lightning'||c==='lightning-rainy'||c==='pouring'||c==='hail';
    for (let i=0; i<nc; i++) {
      const rand = this._sRand(Math.random()*9999);
      const x = Math.random()*(w*1.5)-w*.25;
      const y = h*(0.03+Math.random()*(storm?.44:.50));
      const baseR = h*(0.14+rand()*.20);
      const vSq = storm?.42:.36;
      const pc = 7+Math.floor(rand()*5);
      const puffs = [];
      for (let p=0;p<pc;p++) {
        const ang=(p/pc)*Math.PI*2+rand()*.55, dist=rand()*.52+.18;
        const dx=Math.cos(ang)*baseR*.52*dist, dy=Math.sin(ang)*baseR*.52*dist*vSq;
        const r=baseR*(.20+rand()*.22), normY=(dy+baseR*vSq)/(baseR*vSq*2);
        puffs.push({dx,dy,r,shade:Math.min(1,.42+(1-normY)*.44)});
      }
      puffs.push({dx:0,dy:-baseR*vSq*.18,r:baseR*.36,shade:.92});
      puffs.sort((a,b)=>a.shade-b.shade);
      this._clouds.push({x,y,puffs,speed:.07+rand()*.13,op:.68+rand()*.28,
        breathPh:rand()*Math.PI*2,breathSpd:.0025+rand()*.0025,layer:1+(i%3),flashInt:0});
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
        vx:(-.55-Math.random()*.75)*z,len:(9+Math.random()*14)*z,op:.14+Math.random()*.26,z});
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
    if (this._clouds.length)  this._dClouds(ctx,w,h);
    if (this._fog.length)     this._dFog(ctx,w,h);
    if (!this._isNight)       this._dBirds(ctx,w,h);
    this._dPlanes(ctx,w,h);
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
      g.addColorStop(0,  `rgb(${Math.max(0,sr-18)},${Math.max(0,sg-18)},${Math.max(0,sb-14)})`);
      g.addColorStop(.5, `rgb(${sr},${sg},${sb})`);
      g.addColorStop(.85,`rgb(${Math.min(255,sr+42)},${Math.min(255,sg+44)},${Math.min(255,sb+26)})`);
      g.addColorStop(1,  `rgb(${Math.min(255,sr+72)},${Math.min(255,sg+70)},${Math.min(255,sb+38)})`);
    } else if (n) {
      g.addColorStop(0, `rgb(${Math.max(0,sr-3)},${Math.max(0,sg-3)},${Math.max(0,sb-3)})`);
      g.addColorStop(.65,`rgb(${sr},${sg},${sb})`);
      g.addColorStop(1,  `rgb(${Math.min(255,sr+6)},${Math.min(255,sg+6)},${Math.min(255,sb+6)})`);
    } else {
      g.addColorStop(0, `rgb(${Math.max(0,sr-22)},${Math.max(0,sg-22)},${Math.max(0,sb-20)})`);
      g.addColorStop(.55,`rgb(${sr},${sg},${sb})`);
      g.addColorStop(1,  `rgb(${Math.min(255,sr+10)},${Math.min(255,sg+12)},${Math.min(255,sb+16)})`);
    }
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    if (useLight&&(c==='sunny'||c==='partlycloudy'||c==='exceptional'||c==='windy'||c==='windy-variant')) {
      const hz=ctx.createLinearGradient(0,h*.60,0,h);
      hz.addColorStop(0,'rgba(255,230,180,0)'); hz.addColorStop(1,'rgba(255,215,148,0.13)');
      ctx.fillStyle=hz; ctx.fillRect(0,0,w,h);
    }
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
    const mx=w*.73, my=h*.26, dark=this._isDark, PI2=Math.PI*2;
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
    ctx.globalAlpha=1;
  }

  /* ── Sun ─────────────────────────────────────────────────────── */
  _dSun(ctx, w, h) {
    const c=this._cond;
    if (c==='fog'||c==='lightning'||c==='lightning-rainy'||c==='pouring') return;
    const sx=w*.74, sy=h*.25, dark=this._isDark, PI2=Math.PI*2;
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
  _dClouds(ctx, w, h) {
    const pal=this._pal(), wind=.10+Math.sin(this._gustPh)*.08, PI2=Math.PI*2;
    for (const cl of this._clouds) {
      cl.x+=cl.speed*wind*(1+cl.layer*.14); if(cl.x>w+180)cl.x=-180;
      cl.breathPh+=cl.breathSpd; const bS=1+Math.sin(cl.breathPh)*.012;
      const fl=cl.flashInt||0; if(fl>0)cl.flashInt*=.72;
      ctx.save(); ctx.translate(cl.x,cl.y);
      for (const pf of cl.puffs) {
        const dx=pf.dx*bS, dy=pf.dy, r=pf.r*bS, sh=pf.shade, is=1-sh;
        let tR=(pal.lit[0]*sh+pal.shd[0]*is)|0, tG=(pal.lit[1]*sh+pal.shd[1]*is)|0, tB=(pal.lit[2]*sh+pal.shd[2]*is)|0;
        const mR=((pal.lit[0]+pal.shd[0])/2)|0, mG=((pal.lit[1]+pal.shd[1])/2)|0, mB=((pal.lit[2]+pal.shd[2])/2)|0;
        if(fl>.01){tR=(tR+(255-tR)*fl*.7)|0;tG=(tG+(255-tG)*fl*.7)|0;tB=(tB+(255-tB)*fl*.7)|0;}
        const op=Math.min(1,cl.op*pal.amb*sh); if(op<.04)continue;
        const g=ctx.createRadialGradient(dx-r*.14,dy-r*.38,0,dx,dy,r);
        g.addColorStop(0,`rgba(${tR},${tG},${tB},${op})`);
        g.addColorStop(.40,`rgba(${mR},${mG},${mB},${op*.70})`);
        g.addColorStop(.72,`rgba(${pal.shd[0]},${pal.shd[1]},${pal.shd[2]},${op*.12})`);
        g.addColorStop(1,`rgba(${pal.shd[0]},${pal.shd[1]},${pal.shd[2]},0)`);
        ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(dx,dy,r,r*.70,0,0,PI2); ctx.fill();
      }
      ctx.restore();
    }
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

  /* ── Dust motes (sun beams) ──────────────────────────────────── */
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
    ctx.lineCap='round';
    for (const p of this._rain) {
      p.y+=p.vy; p.x+=p.vx;
      if(p.y>h+14){p.y=-14;p.x=Math.random()*w;}
      if(p.x<-8)p.x=w+8;
      ctx.globalAlpha=p.op;
      ctx.strokeStyle=this._isDark?'rgba(178,204,238,1)':'rgba(95,125,170,1)';
      ctx.lineWidth=p.z*.70;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+p.vx*1.65,p.y-p.len); ctx.stroke();
    }
    ctx.globalAlpha=1;
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
  position:absolute;inset:0;padding:16px 18px;
  display:flex;align-items:flex-end;justify-content:space-between;
  pointer-events:none;z-index:2;
  background:linear-gradient(to top,rgba(0,0,0,0.25) 0%,transparent 55%);
}
.compact-left{display:flex;flex-direction:column;gap:2px;}
.compact-temp{font-size:54px;font-weight:200;color:#fff;line-height:1;letter-spacing:-3px;text-shadow:0 2px 12px rgba(0,0,0,0.4);}
.compact-temp sup{font-size:20px;font-weight:300;letter-spacing:0;vertical-align:super;}
.compact-cond{font-size:13px;color:rgba(255,255,255,0.88);margin-top:3px;letter-spacing:.2px;text-shadow:0 1px 4px rgba(0,0,0,0.5);}
.compact-hilo{font-size:11px;color:rgba(255,255,255,0.62);margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,0.4);}
.compact-wind{font-size:11px;color:rgba(255,255,255,0.62);margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,0.4);display:flex;align-items:center;gap:3px;}
.compact-wind ha-icon{--mdc-icon-size:12px;opacity:0.75;}

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
.map-controls{position:absolute;bottom:12px;left:12px;z-index:1000;display:flex;gap:7px;}
.map-btn{
  width:36px;height:36px;border-radius:10px;
  background:rgba(12,12,18,0.92);backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.75);font-size:14px;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;user-select:none;
}
.map-btn:active{transform:scale(.88);background:rgba(38,38,50,.98);}
.map-btn.on{color:var(--worm-ac);border-color:var(--worm-ac);box-shadow:0 0 10px var(--worm-glow);}
.map-legend{
  position:absolute;bottom:12px;right:12px;z-index:1000;
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

/* Weather content */
.wx-wrap{padding:4px 16px 20px;}
.wx-current{display:flex;align-items:center;justify-content:space-between;padding:16px 0 10px;}
.wx-temp{font-size:72px;font-weight:200;color:#fff;line-height:1;letter-spacing:-4px;}
.wx-temp sup{font-size:24px;font-weight:300;letter-spacing:0;vertical-align:super;}
.wx-cond{font-size:15px;color:rgba(255,255,255,0.6);margin-top:6px;}
.wx-hl{font-size:12px;color:rgba(255,255,255,0.35);margin-top:3px;}
.wx-ico{--mdc-icon-size:66px;color:rgba(255,255,255,0.92);filter:drop-shadow(0 4px 16px rgba(0,0,0,.5));}
.feels-chip{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);
  border-radius:20px;padding:5px 13px;margin-bottom:18px;
}
.feels-chip .fl{font-size:12px;color:rgba(255,255,255,0.42);}
.feels-chip .fv{font-size:12px;font-weight:600;color:#fff;}
.sec-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,0.3);margin-bottom:10px;}
.hrow{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:18px;scrollbar-width:none;}
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
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
.tile{background:rgba(255,255,255,0.03);border-radius:14px;padding:14px;border:1px solid rgba(255,255,255,0.06);}
.tile-hdr{display:flex;align-items:center;gap:6px;margin-bottom:8px;}
.tile-ico{--mdc-icon-size:14px;color:rgba(255,255,255,0.38);}
.tile-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,0.32);}
.tile-val{font-size:28px;font-weight:200;color:#fff;line-height:1;}
.tile-unit{font-size:12px;color:rgba(255,255,255,0.5);}
.tile-sub{font-size:11px;color:rgba(255,255,255,0.32);margin-top:4px;}

/* Forecast tab */
.fc-wrap{padding:4px 16px 20px;}
.fc-cards{display:flex;gap:8px;overflow-x:auto;padding:14px 0 6px;margin-bottom:14px;scrollbar-width:none;}
.fc-cards::-webkit-scrollbar{display:none;}
.fc-card{
  flex:0 0 72px;background:rgba(255,255,255,0.04);border-radius:14px;
  padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;
  border:1px solid rgba(255,255,255,0.06);text-align:center;
}
.fc-card.today{background:rgba(90,200,250,0.07);border-color:rgba(90,200,250,0.25);}
.fc-day-name{font-size:10px;font-weight:700;color:rgba(255,255,255,0.42);text-transform:uppercase;letter-spacing:.4px;}
.fc-card.today .fc-day-name{color:var(--worm-ac);}
.fc-day-ico{--mdc-icon-size:24px;color:rgba(255,255,255,0.82);}
.fc-day-hi{font-size:14px;font-weight:600;color:#fff;}
.fc-day-lo{font-size:11px;color:rgba(255,255,255,0.38);}
.fc-day-rn{font-size:9px;color:#5AC8FA;}
.fc-hlist{background:rgba(255,255,255,0.03);border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);}
.fc-hrow{display:flex;align-items:center;padding:10px 14px;gap:12px;border-bottom:1px solid rgba(255,255,255,0.04);}
.fc-hrow:last-child{border-bottom:none;}
.fc-h-time{font-size:12px;color:rgba(255,255,255,0.48);width:42px;flex-shrink:0;}
.fc-h-ico{--mdc-icon-size:18px;color:rgba(255,255,255,0.72);flex-shrink:0;}
.fc-h-desc{font-size:12px;color:rgba(255,255,255,0.58);flex:1;}
.fc-h-temp{font-size:14px;font-weight:600;color:#fff;flex-shrink:0;}
.fc-h-rn{font-size:11px;color:#5AC8FA;flex-shrink:0;width:34px;text-align:right;}

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
    this._playing = false; this._timer = null;
    this._lat = 51.5; this._lon = -0.12; this._zoom = 7;
    this._ready = false;
    this._atm = null;
    this._forecast = [];  // cached from get_forecasts service
  }

  setConfig(c) {
    if (!c) throw new Error('worm-weather-card: missing config');
    this._cfg = Object.assign({
      accent_color:'#5AC8FA', default_view:'compact', map_style:'standard',
      zoom_level:7, radar_opacity:0.7, animation_speed:600,
      auto_animate:true, temp_unit:'°C', wind_unit:'km/h',
      show_hourly:true, show_daily:true, show_details:true, compact_height:160,
      show_wind_on_compact:false,
    }, c);
    this._zoom = parseInt(this._cfg.zoom_level) || 7;
    this._expanded = (this._cfg.default_view || 'compact') !== 'compact';
    this._curTab = this._expanded ? 'radar' : 'compact';
    if (this._ready) { this._stopAtm(); if (this._map) { this._map.remove(); this._map = null; } this._render(); this._postRender(); }
  }

  set hass(h) {
    this._hass = h;
    if (!this._ready) { this._render(); this._ready = true; this._postRender(); }
    else { this._updateCompact(); if (this._expanded) { const wxc = this.shadowRoot.getElementById('wx-content'); if (wxc) wxc.innerHTML = this._wxHTML(); } }
  }

  connectedCallback() { if (this._hass && !this._ready) { this._render(); this._ready = true; this._postRender(); } }

  disconnectedCallback() {
    this._stopAtm(); if (this._timer) clearInterval(this._timer);
    if (this._map) { this._map.remove(); this._map = null; }
  }

  getCardSize() { return this._expanded ? 12 : 5; }
  static getConfigElement() { return document.createElement('worm-weather-card-editor'); }
  static getStubConfig() { return { weather_entity:'', postcode:'', country_code:'GB', accent_color:'#5AC8FA', zoom_level:7 }; }

  _render() {
    const ac  = this._cfg.accent_color || '#5AC8FA';
    const ch  = parseInt(this._cfg.compact_height) || 160;
    const exp = this._expanded;
    this.shadowRoot.innerHTML =
      `<style>${CARD_CSS}:host{--worm-ac:${ac};--worm-glow:${ac}55}</style>` +
      '<ha-card>' +
      `<div class="view${exp?'':' active'}" id="v-compact">` +
        `<div class="compact-wrap" id="cmp-wrap" style="height:${ch}px">` +
          '<canvas id="atm-canvas"></canvas>' +
          '<div class="compact-overlay">' +
            '<div class="compact-left">' +
              '<div class="compact-temp" id="cmp-temp">—</div>' +
              '<div class="compact-cond" id="cmp-cond">—</div>' +
              '<div class="compact-hilo" id="cmp-hilo"></div>' +
              '<div class="compact-wind" id="cmp-wind" style="display:none"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      `<div class="view${exp?' active':''}" id="v-expanded">` +
        '<div class="collapse-handle" id="collapse-handle"></div>' +
        '<div class="view active" id="v-radar">' +
          '<div class="map-wrap">' +
            '<div id="lf-map"></div>' +
            '<div class="map-time-tag" id="map-time">Loading…</div>' +
            '<div class="map-loc-tag" id="map-loc" style="opacity:0"></div>' +
            '<div class="map-controls">' +
              `<div class="map-btn" id="b-play">${ico('mdi:play')}</div>` +
              `<div class="map-btn" id="b-prev">${ico('mdi:skip-previous')}</div>` +
              `<div class="map-btn" id="b-next">${ico('mdi:skip-next')}</div>` +
              `<div class="map-btn" id="b-rc" title="Re-centre">${ico('mdi:crosshairs-gps')}</div>` +
            '</div>' +
            '<div class="map-legend"><div class="leg-t">Rainfall</div><div class="leg-bar"></div><div class="leg-lbls"><span class="leg-l">Light</span><span class="leg-l">Heavy</span></div></div>' +
            '<div class="fpbar-wrap"><div class="fpbar" id="fpbar" style="width:0%"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="view" id="v-weather"><div class="wx-wrap" id="wx-content"></div></div>' +
        '<div class="view" id="v-forecast"><div class="fc-wrap" id="fc-content"></div></div>' +
        '<div class="tabs">' +
          `<div class="tab on" id="t-radar"><ha-icon class="tab-i" icon="mdi:radar"></ha-icon><span class="tab-l">Radar</span></div>` +
          `<div class="tab" id="t-weather"><ha-icon class="tab-i" icon="mdi:weather-partly-cloudy"></ha-icon><span class="tab-l">Weather</span></div>` +
          `<div class="tab" id="t-forecast"><ha-icon class="tab-i" icon="mdi:calendar-week"></ha-icon><span class="tab-l">Forecast</span></div>` +
        '</div>' +
      '</div>' +
      '</ha-card>';
    this._bindUI();
  }

  _postRender() {
    this._updateCompact();
    if (!this._expanded) { this._initAtm(); }
    else {
      this._initMapAsync();
      // Load forecast via modern HA API, then refresh content
      this._loadForecast().then(() => this._updateExpandedContent());
      this._updateExpandedContent(); // show immediately with whatever is cached
    }
  }

  /* ── Modern HA forecast fetcher (HA 2023.9+ weather.get_forecasts) ── */
  async _loadForecast() {
    const eid = this._cfg.weather_entity;
    if (!eid || !this._hass) return;
    // 1. Try legacy attribute first (still present on some integrations)
    const st = this._hass.states[eid];
    if (st?.attributes?.forecast?.length) {
      this._forecast = st.attributes.forecast;
      return;
    }
    // 2. Use weather.get_forecasts service (HA 2023.9+)
    for (const type of ['daily', 'hourly', 'twice_daily']) {
      try {
        const res = await this._hass.connection.sendMessagePromise({
          type: 'call_service',
          domain: 'weather',
          service: 'get_forecasts',
          service_data: { entity_id: eid, type },
          return_response: true,
        });
        const fc = res?.response?.[eid]?.forecast;
        if (fc?.length) { this._forecast = fc; return; }
      } catch (_) {}
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

    // ── Map / tab buttons (stop propagation so they don't collapse) ──
    ['b-play','b-prev','b-next','b-rc'].forEach(id => {
      $( id)?.addEventListener('click', e => e.stopPropagation());
    });
    ['t-radar','t-weather','t-forecast'].forEach(t => {
      $(t)?.addEventListener('click', e => { e.stopPropagation(); this._switchTab(t.replace('t-','')); });
    });

    $('b-play').addEventListener('click', () => this._toggleAnim());
    $('b-prev').addEventListener('click', () => { this._stopAnim(); this._step(-1); });
    $('b-next').addEventListener('click', () => { this._stopAnim(); this._step(1); });
    $('b-rc').addEventListener('click', () => { if (this._map) this._map.setView([this._lat, this._lon], this._zoom, { animate:true }); });
  }

  _toggleSize() {
    this._expanded = !this._expanded;
    const $ = id => this.shadowRoot.getElementById(id);
    $('v-compact').classList.toggle('active', !this._expanded);
    $('v-expanded').classList.toggle('active', this._expanded);
    if (this._expanded) {
      this._stopAtm();
      if (!this._map) this._initMapAsync(); else setTimeout(() => this._map.invalidateSize(), 80);
      this._loadForecast().then(() => this._updateExpandedContent());
      this._updateExpandedContent();
    } else {
      if (this._timer) { clearInterval(this._timer); this._timer = null; this._playing = false; }
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
    if (t==='radar') { if (!this._map) this._initMapAsync(); else setTimeout(() => this._map.invalidateSize(), 80); }
    if (t==='weather') { const wxc = s.getElementById('wx-content'); if (wxc) wxc.innerHTML = this._wxHTML(); }
    if (t==='forecast') {
      const fcc = s.getElementById('fc-content');
      if (fcc) {
        fcc.innerHTML = this._fcHTML(); // render immediately
        this._loadForecast().then(() => { const el = s.getElementById('fc-content'); if (el) el.innerHTML = this._fcHTML(); });
      }
    }
  }

  _updateExpandedContent() {
    const wxc = this.shadowRoot.getElementById('wx-content');
    const fcc = this.shadowRoot.getElementById('fc-content');
    if (wxc) wxc.innerHTML = this._wxHTML();
    if (fcc) fcc.innerHTML = this._fcHTML();
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
    s.getElementById('cmp-temp').innerHTML = `${cvt(a.temperature, u)}<sup>${u}</sup>`;
    s.getElementById('cmp-cond').textContent = W_LABELS[cond] || cond || '—';
    const hi = a.temperature_high != null ? cvt(a.temperature_high, u) : null;
    const lo = a.temperature_low  != null ? cvt(a.temperature_low,  u) : null;
    s.getElementById('cmp-hilo').textContent = (hi!=null&&lo!=null) ? `H: ${hi}° · L: ${lo}°` : '';
    // Wind speed on compact
    const windEl = s.getElementById('cmp-wind');
    if (windEl) {
      if (this._cfg.show_wind_on_compact && a.wind_speed != null) {
        let ws = a.wind_speed;
        if (wu==='mph') ws = Math.round(ws*0.621371);
        else if (wu==='m/s') ws = (ws/3.6).toFixed(1);
        else ws = Math.round(ws);
        const dir = a.wind_bearing != null ? ' · ' + wdir(a.wind_bearing) : '';
        windEl.innerHTML = `${ico('mdi:weather-windy',12,'vertical-align:middle;')} ${ws} ${wu}${dir}`;
        windEl.style.display = 'flex';
      } else {
        windEl.style.display = 'none';
      }
    }
    // Update canvas animation state
    if (this._atm) {
      const isNight = cond === 'clear-night' || (this._hass && this._hass.states['sun.sun']?.state === 'below_horizon');
      const isDark  = !!(this._hass?.themes?.darkMode ?? false);
      this._atm.update(cond || 'cloudy', isNight, isDark);
    }
  }

  /* ── Atmospheric canvas ── */
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
      const isDark  = !!(this._hass?.themes?.darkMode ?? false);
      if (!this._atm) this._atm = new AtmCanvas(cv);
      this._atm.init(cond, isNight, isDark, w, h);
      this._atm.start();
    });
  }

  _stopAtm() { if (this._atm) { this._atm.stop(); } }

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
    const style = this._cfg.map_style || 'standard';
    const tl    = TILES[style] || TILES.standard;
    this._map = L.map(el, { zoomControl:false, attributionControl:false })
                 .setView([this._lat, this._lon], this._zoom);
    L.control.zoom({ position:'topright' }).addTo(this._map);
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

  _showFrame(i) {
    if (!this._map || !window.L) return;
    const f = this._frames[i]; if (!f) return;
    if (this._radar) { this._map.removeLayer(this._radar); this._radar = null; }
    // Use 256px tiles (default Leaflet), colorScheme=7 (TITAN 2020 - vivid colours)
    const url = 'https://tilecache.rainviewer.com' + f.path + '/256/{z}/{x}/{y}/7/1_1.png';
    this._radar = L.tileLayer(url, {
      opacity: parseFloat(this._cfg.radar_opacity) || 0.7,
      zIndex: 200,
      crossOrigin: 'anonymous',
    }).addTo(this._map);
    const t = this.shadowRoot.getElementById('map-time');
    if (t) t.textContent = new Date(f.time*1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const bar = this.shadowRoot.getElementById('fpbar');
    if (bar) bar.style.width = ((i+1)/this._frames.length*100).toFixed(0)+'%';
  }

  _startAnim() {
    this._stopAnim();
    if (this._frames.length<2) return;
    this._playing = true; this._updatePlayBtn();
    this._timer = setInterval(() => { this._fi=(this._fi+1)%this._frames.length; this._showFrame(this._fi); }, parseInt(this._cfg.animation_speed)||600);
  }
  _stopAnim()  { if (this._timer) { clearInterval(this._timer); this._timer=null; } this._playing=false; this._updatePlayBtn(); }
  _toggleAnim(){ this._playing ? this._stopAnim() : this._startAnim(); }
  _step(d)     { if (!this._frames.length) return; this._fi=(this._fi+d+this._frames.length)%this._frames.length; this._showFrame(this._fi); }
  _updatePlayBtn() {
    const b = this.shadowRoot.getElementById('b-play'); if (!b) return;
    b.innerHTML = this._playing ? ico('mdi:pause') : ico('mdi:play');
    b.classList.toggle('on', this._playing);
  }

  /* ── Weather HTML ── */
  _wxHTML() {
    const eid = this._cfg.weather_entity;
    if (!eid) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:weather-sunny"></ha-icon><div class="empty-txt">Select a weather entity<br>in the visual editor</div></div>`;
    const st = this._hass?.states?.[eid];
    if (!st) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:alert-circle"></ha-icon><div class="empty-txt">Entity not found:<br>${eid}</div></div>`;
    const a  = st.attributes || {};
    const u  = this._cfg.temp_unit || '°C';
    const wu = this._cfg.wind_unit || 'km/h';
    const cond  = st.state || '';
    const temp  = cvt(a.temperature, u);
    const feels = a.apparent_temperature != null ? cvt(a.apparent_temperature, u) : null;
    const hi    = a.temperature_high != null ? cvt(a.temperature_high, u) : null;
    const lo    = a.temperature_low  != null ? cvt(a.temperature_low,  u) : null;
    const fc    = this._forecast.length ? this._forecast : (a.forecast || []);
    const now   = Date.now();
    const hourly = fc.filter(f => { const d=new Date(f.datetime)-now; return d>-3.6e6 && d<9.36e7; }).slice(0,12);
    const daily  = fc.filter(f => new Date(f.datetime) > new Date()).slice(0,7);
    let ws = a.wind_speed;
    if (ws != null) { if (wu==='mph') ws=Math.round(ws*0.621371)+''; else if (wu==='m/s') ws=(ws/3.6).toFixed(1); else ws=Math.round(ws)+''; } else ws='—';

    let h = `<div class="wx-current"><div>
      <div class="wx-temp">${temp}<sup>${u}</sup></div>
      <div class="wx-cond">${W_LABELS[cond]||cond}</div>
      ${hi!=null&&lo!=null ? `<div class="wx-hl">H: ${hi}° · L: ${lo}°</div>` : ''}
      </div><div class="wx-ico">${wico(cond,66)}</div></div>`;

    if (feels != null) h += `<div class="feels-chip"><span class="fl">Feels like</span><span class="fv">${feels}${u}</span></div>`;

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

    if (this._cfg.show_daily !== false && daily.length) {
      h += '<div class="sec-hdr">7-Day Forecast</div><div class="dlist">';
      daily.forEach((f,i) => {
        h += `<div class="drow">
          <div class="dday">${i===0?'Today':fmtD(f.datetime)}</div>
          <div class="dico">${wico(f.condition,20)}</div>
          <div class="drn">${f.precipitation_probability!=null?`${ico('mdi:water-outline',12)} ${Math.round(f.precipitation_probability)}%`:''}</div>
          <div class="dtemps"><span class="dhi">${cvt(f.temperature,u)}°</span><span class="dlo">${f.templow!=null?cvt(f.templow,u)+'°':'—'}</span></div>
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
      if (a.dew_point!=null) h+=tile('mdi:thermometer-water','Dew Point',cvt(a.dew_point,u),u,'');
      if (a.cloud_coverage!=null) h+=tile('mdi:cloud-percent','Cloud Cover',Math.round(a.cloud_coverage),'%','');
      if (a.precipitation!=null) h+=tile('mdi:weather-rainy','Precipitation',a.precipitation,'mm','');
      h += '</div>';
    }
    return h;
  }

  /* ── Forecast HTML ── */
  _fcHTML() {
    const eid = this._cfg.weather_entity;
    if (!eid) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:calendar-weather"></ha-icon><div class="empty-txt">Select a weather entity</div></div>`;
    const st = this._hass?.states?.[eid];
    if (!st) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:alert-circle"></ha-icon><div class="empty-txt">Entity not found: ${eid}</div></div>`;
    const a  = st.attributes || {};
    const u  = this._cfg.temp_unit || '°C';
    // Use cached forecast (loaded via weather.get_forecasts) or legacy attribute
    const fc = this._forecast.length ? this._forecast : (a.forecast || []);
    if (!fc.length) return `<div class="empty"><ha-icon class="empty-ico" icon="mdi:loading"></ha-icon><div class="empty-txt">Loading forecast…</div></div>`;

    // Detect forecast type based on interval between entries
    const isHourly = fc.length >= 2 && (new Date(fc[1].datetime) - new Date(fc[0].datetime)) < 7200000;
    const now = Date.now();

    let h = '';

    if (isHourly) {
      // Hourly: show day cards (grouped) + detail rows
      const next24 = fc.filter(f => { const d=new Date(f.datetime)-now; return d>-3600000&&d<86400000; }).slice(0,24);
      const next7days = fc.filter(f => new Date(f.datetime) > new Date()).reduce((acc, f) => {
        const day = new Date(f.datetime).toDateString();
        if (!acc[day]) acc[day] = { items:[], date:f.datetime };
        acc[day].items.push(f);
        return acc;
      }, {});

      h += '<div class="sec-hdr">Next 7 Days</div><div class="fc-cards">';
      const dayKeys = Object.keys(next7days).slice(0,7);
      dayKeys.forEach((day, i) => {
        const items = next7days[day].items;
        const avgCond = items[Math.floor(items.length/2)]?.condition || 'cloudy';
        const hi = Math.max(...items.map(x=>x.temperature||0));
        const lo = Math.min(...items.map(x=>x.temperature||99));
        const rn = items.reduce((s,x)=>s+(x.precipitation_probability||0),0)/items.length;
        const dt = next7days[day].date;
        h += `<div class="fc-card${i===0?' today':''}">
          <div class="fc-day-name">${i===0?'Today':fmtD(dt)}</div>
          <div class="fc-day-ico">${wico(avgCond,24)}</div>
          <div class="fc-day-hi">${cvt(hi,u)}°</div>
          <div class="fc-day-lo">${cvt(lo,u)}°</div>
          ${rn>0?`<div class="fc-day-rn">${Math.round(rn)}%</div>`:''}
        </div>`;
      });
      h += '</div>';

      h += '<div class="sec-hdr">Next 24 Hours</div><div class="fc-hlist">';
      next24.forEach((f, i) => {
        h += `<div class="fc-hrow">
          <div class="fc-h-time">${i===0?'Now':fmtT(f.datetime)}</div>
          <div class="fc-h-ico">${wico(f.condition,18)}</div>
          <div class="fc-h-desc">${W_LABELS[f.condition]||f.condition||''}</div>
          <div class="fc-h-temp">${cvt(f.temperature,u)}°</div>
          <div class="fc-h-rn">${f.precipitation_probability!=null?Math.round(f.precipitation_probability)+'%':''}</div>
        </div>`;
      });
      h += '</div>';
    } else {
      // Daily forecast
      const daily = fc.filter(f => new Date(f.datetime) > new Date()).slice(0,7);
      h += '<div class="sec-hdr">7-Day Forecast</div><div class="fc-cards">';
      daily.forEach((f, i) => {
        const rn = f.precipitation_probability;
        h += `<div class="fc-card${i===0?' today':''}">
          <div class="fc-day-name">${i===0?'Today':fmtD(f.datetime)}</div>
          <div class="fc-day-ico">${wico(f.condition,24)}</div>
          <div class="fc-day-hi">${cvt(f.temperature,u)}°</div>
          <div class="fc-day-lo">${f.templow!=null?cvt(f.templow,u)+'°':'—'}</div>
          ${rn!=null?`<div class="fc-day-rn">${Math.round(rn)}%</div>`:''}
        </div>`;
      });
      h += '</div>';

      h += '<div class="sec-hdr">Details</div><div class="fc-hlist">';
      daily.forEach((f, i) => {
        h += `<div class="fc-hrow">
          <div class="fc-h-time" style="width:52px">${i===0?'Today':fmtD(f.datetime)}</div>
          <div class="fc-h-ico">${wico(f.condition,18)}</div>
          <div class="fc-h-desc">${W_LABELS[f.condition]||f.condition||''}</div>
          <div class="fc-h-temp">${cvt(f.temperature,u)}°${f.templow!=null?' / '+cvt(f.templow,u)+'°':''}</div>
          <div class="fc-h-rn">${f.precipitation_probability!=null?Math.round(f.precipitation_probability)+'%':''}</div>
        </div>`;
      });
      h += '</div>';
    }
    return h;
  }
}

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
    <div><div class="ed-title">Worm Weather Card</div><div class="ed-ver">by James McGinnis</div></div>
  </div>

  <!-- CARD SETTINGS -->
  <div><div class="sec-title">Card Settings</div><div class="card-block">
    <div class="row">
      <div class="row-icon" style="background:rgba(0,122,255,0.12)">${ico('mdi:monitor-dashboard',16,'color:#007AFF')}</div>
      <div class="row-info"><div class="row-label">Default View</div></div>
      <div class="row-ctrl" id="seg-default_view"></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(52,199,89,0.12)">${ico('mdi:arrow-expand-vertical',16,'color:#34C759')}</div>
      <div class="row-info"><div class="row-label">Compact Height</div><div class="row-sub">Pixels in compact mode</div></div>
      <div class="row-ctrl"><input type="range" class="sl" id="sl-ch" min="120" max="260" step="10" value="${c.compact_height||160}"><span class="sl-val" id="slv-ch">${c.compact_height||160}px</span></div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,159,10,0.12)">${ico('mdi:palette',16,'color:#FF9F0A')}</div>
      <div class="row-info"><div class="row-label">Accent Colour</div></div>
      <div class="row-ctrl"><input type="color" id="accent-color" value="${c.accent_color||'#5AC8FA'}" style="width:36px;height:28px;border-radius:7px;border:1px solid rgba(0,0,0,0.1);cursor:pointer;padding:2px"></div>
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
      <div class="row-icon" style="background:rgba(94,92,230,0.12)">${ico('mdi:clock-outline',16,'color:#5E5CE6')}</div>
      <div class="row-info"><div class="row-label">Hourly Forecast</div><div class="row-sub">Scrollable strip</div></div>
      <div class="row-ctrl">${this._tog('tog-hourly', c.show_hourly!==false)}</div>
    </div>
    <div class="row">
      <div class="row-icon" style="background:rgba(255,55,95,0.12)">${ico('mdi:calendar-week',16,'color:#FF375F')}</div>
      <div class="row-info"><div class="row-label">Daily Forecast</div><div class="row-sub">7-day list</div></div>
      <div class="row-ctrl">${this._tog('tog-daily', c.show_daily!==false)}</div>
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
  </div></div>

</div>`;

    // Build segmented controls after DOM is set
    const segDV = this.shadowRoot.getElementById('seg-default_view');
    if (segDV) segDV.innerHTML = this._seg('default_view', [['compact','Compact'],['radar','Radar'],['weather','Full']], c.default_view||'compact');
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
    const th=s.getElementById('tog-hourly');if(th)th.checked=c.show_hourly!==false;
    const td=s.getElementById('tog-daily');if(td)td.checked=c.show_daily!==false;
    const tdt=s.getElementById('tog-details');if(tdt)tdt.checked=c.show_details!==false;
    const twc=s.getElementById('tog-windcmp');if(twc)twc.checked=c.show_wind_on_compact===true;
    // Update seg opts
    s.querySelectorAll('[data-seg="default_view"]').forEach(el=>el.classList.toggle('on',el.dataset.val===(c.default_view||'compact')));
    s.querySelectorAll('[data-seg="temp_unit"]').forEach(el=>el.classList.toggle('on',el.dataset.val===(c.temp_unit||'°C')));
    // Update accent
    const ac=s.getElementById('accent-color');if(ac)ac.value=c.accent_color||'#5AC8FA';
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
    // Accent colour
    s.getElementById('accent-color')?.addEventListener('input', e => this._updateConfig('accent_color', e.target.value));
    // Sliders
    const sl=(id,key,mul,sfx)=>{
      const el=s.getElementById('sl-'+id), vl=s.getElementById('slv-'+id);
      if(el){el.addEventListener('input',e=>{const v=parseFloat(e.target.value);if(vl)vl.textContent=mul?+(v*mul).toFixed(2)+sfx:v+sfx;this._updateConfig(key,mul?v/100:v);});}
    };
    sl('ch','compact_height',null,'px'); sl('zoom','zoom_level',null,''); sl('op','radar_opacity',0.01,'%'); sl('spd','animation_speed',null,'ms');
    // Toggles
    s.getElementById('tog-anim')?.addEventListener('change', e => this._updateConfig('auto_animate', e.target.checked));
    s.getElementById('tog-hourly')?.addEventListener('change', e => this._updateConfig('show_hourly', e.target.checked));
    s.getElementById('tog-daily')?.addEventListener('change', e => this._updateConfig('show_daily', e.target.checked));
    s.getElementById('tog-details')?.addEventListener('change', e => this._updateConfig('show_details', e.target.checked));
    s.getElementById('tog-windcmp')?.addEventListener('change', e => this._updateConfig('show_wind_on_compact', e.target.checked));
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
