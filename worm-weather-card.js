// ================================================================
// WORM WEATHER CARD v1.1.0
// Apple-inspired Weather Radar + Atmospheric Conditions
// for Home Assistant — by James McGinnis
//
// Compact atmospheric canvas adapted from:
//   Atmospheric Weather Card v3.3
//   https://github.com/shpongledsummer/atmospheric-weather-card
//   © shpongledsummer — MIT Licence
// ================================================================
(function () {
‘use strict’;
const VERSION = ‘1.1.0’;

// ── Leaflet loader ──────────────────────────────────────────
let _lfPromise = null;
function loadLeaflet(sr) {
if (!_lfPromise) {
_lfPromise = new Promise(res => {
if (window.L) { res(); return; }
const s = document.createElement(‘script’);
s.src = ‘https://unpkg.com/leaflet@1.9.4/dist/leaflet.js’;
s.onload = res;
document.head.appendChild(s);
});
}
if (sr && !sr.querySelector(’#lf-css’)) {
const l = document.createElement(‘link’);
l.id = ‘lf-css’; l.rel = ‘stylesheet’;
l.href = ‘https://unpkg.com/leaflet@1.9.4/dist/leaflet.css’;
sr.prepend(l);
}
return _lfPromise;
}

// ── Helpers ─────────────────────────────────────────────────
async function geocode(postcode, cc) {
try {
let q = encodeURIComponent(postcode);
if (cc) q += ‘&countrycodes=’ + cc.toLowerCase();
const r = await fetch(
‘https://nominatim.openstreetmap.org/search?q=’ + q + ‘&format=json&limit=1’,
{ headers: { ‘Accept-Language’: ‘en’ } }
);
const d = await r.json();
if (d && d[0]) return { lat: +d[0].lat, lon: +d[0].lon, name: d[0].display_name };
} catch (e) {}
return null;
}

const WI = {
‘clear-night’:     { e: ‘\uD83C\uDF19’, l: ‘Clear Night’ },
cloudy:            { e: ‘\u2601\uFE0F’,  l: ‘Cloudy’ },
exceptional:       { e: ‘\uD83C\uDF2A\uFE0F’, l: ‘Exceptional’ },
fog:               { e: ‘\uD83C\uDF2B\uFE0F’, l: ‘Foggy’ },
hail:              { e: ‘\uD83C\uDF28\uFE0F’, l: ‘Hail’ },
lightning:         { e: ‘\u26A1’, l: ‘Lightning’ },
‘lightning-rainy’: { e: ‘\u26C8\uFE0F’, l: ‘Thunderstorm’ },
partlycloudy:      { e: ‘\u26C5’, l: ‘Partly Cloudy’ },
pouring:           { e: ‘\uD83C\uDF27\uFE0F’, l: ‘Heavy Rain’ },
rainy:             { e: ‘\uD83C\uDF26\uFE0F’, l: ‘Rainy’ },
snowy:             { e: ‘\u2744\uFE0F’, l: ‘Snowy’ },
‘snowy-rainy’:     { e: ‘\uD83C\uDF28\uFE0F’, l: ‘Sleet’ },
sunny:             { e: ‘\u2600\uFE0F’, l: ‘Sunny’ },
windy:             { e: ‘\uD83D\uDCA8’, l: ‘Windy’ },
‘windy-variant’:   { e: ‘\uD83D\uDCA8’, l: ‘Windy’ },
};

// Atmospheric compact-view state config (adapted from atmospheric-weather-card)
const ATM_CFG = {
‘clear-night’:     { sky: [5, 8, 25],    rain: false, snow: false, clouds: 0,  count: 0   },
cloudy:            { sky: [40, 55, 85],   rain: false, snow: false, clouds: 5,  count: 0   },
exceptional:       { sky: [30, 100, 220], rain: false, snow: false, clouds: 0,  count: 0   },
fog:               { sky: [60, 70, 90],   rain: false, snow: false, clouds: 6,  count: 0   },
hail:              { sky: [20, 28, 50],   rain: true,  snow: false, clouds: 5,  count: 120 },
lightning:         { sky: [15, 20, 40],   rain: true,  snow: false, clouds: 6,  count: 160 },
‘lightning-rainy’: { sky: [15, 20, 40],   rain: true,  snow: false, clouds: 6,  count: 130 },
partlycloudy:      { sky: [30, 85, 180],  rain: false, snow: false, clouds: 3,  count: 0   },
pouring:           { sky: [15, 35, 75],   rain: true,  snow: false, clouds: 6,  count: 200 },
rainy:             { sky: [20, 55, 110],  rain: true,  snow: false, clouds: 5,  count: 120 },
snowy:             { sky: [50, 65, 100],  rain: false, snow: true,  clouds: 5,  count: 65  },
‘snowy-rainy’:     { sky: [35, 50, 85],   rain: true,  snow: true,  clouds: 5,  count: 80  },
sunny:             { sky: [30, 100, 220], rain: false, snow: false, clouds: 0,  count: 0   },
windy:             { sky: [35, 70, 140],  rain: false, snow: false, clouds: 4,  count: 0   },
‘windy-variant’:   { sky: [35, 70, 140],  rain: false, snow: false, clouds: 4,  count: 0   },
default:           { sky: [30, 60, 120],  rain: false, snow: false, clouds: 3,  count: 0   },
};

const TILES = {
dark:     { url: ‘https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png’,  attr: ‘\u00A9 OSM \u00A9 CARTO’, sub: ‘abcd’ },
light:    { url: ‘https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png’, attr: ‘\u00A9 OSM \u00A9 CARTO’, sub: ‘abcd’ },
standard: { url: ‘https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png’,             attr: ‘\u00A9 OpenStreetMap’,    sub: ‘abc’  },
};

const DIRS = [‘N’,‘NNE’,‘NE’,‘ENE’,‘E’,‘ESE’,‘SE’,‘SSE’,‘S’,‘SSW’,‘SW’,‘WSW’,‘W’,‘WNW’,‘NW’,‘NNW’];
const wdir  = b  => b == null ? ‘\u2014’ : DIRS[Math.round(b / 22.5) % 16];
const fmtT  = iso => { const d = new Date(iso), h = d.getHours(); return (h % 12 || 12) + (h >= 12 ? ‘pm’ : ‘am’); };
const fmtD  = iso => [‘Sun’,‘Mon’,‘Tue’,‘Wed’,‘Thu’,‘Fri’,‘Sat’][new Date(iso).getDay()];
const cvt   = (v, u) => v == null ? ‘\u2014’ : u === ‘\u00B0F’ ? Math.round(v * 9 / 5 + 32) : Math.round(v);
const uvl   = u => !u ? ‘’ : u <= 2 ? ‘Low’ : u <= 5 ? ‘Moderate’ : u <= 7 ? ‘High’ : u <= 10 ? ‘Very High’ : ‘Extreme’;
const TWO_PI = Math.PI * 2;

// ── Card CSS ────────────────────────────────────────────────
const CARD_CSS = `
:host{
–bg:#1C1C1E;–bg2:#2C2C2E;–bg3:#3A3A3C;
–lbl:#fff;–lbl2:rgba(235,235,245,.6);–lbl3:rgba(235,235,245,.3);
–sep:rgba(84,84,88,.65);–fill:rgba(118,118,128,.24);
–ac:var(–worm-ac,#5AC8FA);–glow:var(–worm-glow,rgba(90,200,250,.4));
font-family:-apple-system,‘SF Pro Display’,‘Helvetica Neue’,sans-serif;
-webkit-font-smoothing:antialiased;display:block;
}
ha-card{
background:var(–bg)!important;border-radius:20px;overflow:hidden;
border:.5px solid var(–sep);box-shadow:0 8px 32px rgba(0,0,0,.5)!important;
position:relative;
}

/* ── Resize button (crow-style) ── */
.resize-btn{
position:absolute;top:10px;right:10px;z-index:50;
width:28px;height:28px;border-radius:50%;
background:rgba(255,255,255,.13);border:none;
color:#fff;cursor:pointer;
display:flex;align-items:center;justify-content:center;
transition:background .2s,transform .15s;
-webkit-tap-highlight-color:transparent;padding:0;
}
.resize-btn:active{transform:scale(.88);background:rgba(255,255,255,.24);}
.resize-btn svg{width:13px;height:13px;stroke:#fff;fill:none;
stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}

/* ── Views ── */
.view{display:none}.view.active{display:block}

/* ══════════════════════════════
COMPACT (ATMOSPHERIC) VIEW
══════════════════════════════ */
.compact-wrap{
position:relative;height:160px;overflow:hidden;
background:linear-gradient(160deg,#0e1a30 0%,#1a2d4a 50%,#0d1520 100%);
cursor:pointer;
}
#atm-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.atm-overlay{
position:absolute;inset:0;
padding:14px 16px;
display:flex;align-items:flex-end;justify-content:space-between;
pointer-events:none;
}
.atm-left{display:flex;flex-direction:column;gap:1px;}
.atm-temp{font-size:52px;font-weight:200;color:#fff;line-height:1;letter-spacing:-3px;}
.atm-temp sup{font-size:18px;font-weight:300;letter-spacing:0;vertical-align:super;}
.atm-cond{font-size:12px;color:rgba(255,255,255,.7);margin-top:3px;}
.atm-hilo{font-size:10px;color:rgba(255,255,255,.4);margin-top:2px;}
.atm-ico{font-size:48px;line-height:1;filter:drop-shadow(0 3px 10px rgba(0,0,0,.4));}
.atm-badge{
position:absolute;top:10px;right:44px;
background:rgba(0,0,0,.35);backdrop-filter:blur(10px);
border-radius:7px;padding:3px 8px;
font-size:9px;font-weight:700;
letter-spacing:.5px;text-transform:uppercase;
color:rgba(255,255,255,.55);border:.5px solid rgba(255,255,255,.12);
pointer-events:none;
}

/* ══════════════════════════════
EXPANDED VIEW
══════════════════════════════ */
/* Map */
.map-wrap{position:relative;height:340px}
#lf-map{height:100%;width:100%}
.leaflet-container{background:#0d0d0d!important}
.rtag{position:absolute;top:10px;right:10px;z-index:1000;
background:rgba(28,28,30,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
border-radius:8px;padding:4px 9px;font-size:10px;font-weight:700;letter-spacing:.3px;
color:var(–lbl2);border:.5px solid var(–sep);pointer-events:none;}
.gtag{position:absolute;top:10px;left:10px;z-index:1000;
background:rgba(28,28,30,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
border-radius:8px;padding:4px 9px;font-size:10px;color:var(–lbl2);
border:.5px solid var(–sep);max-width:200px;white-space:nowrap;overflow:hidden;
text-overflow:ellipsis;pointer-events:none;transition:opacity .4s;}
.mctrl{position:absolute;bottom:12px;left:12px;z-index:1000;display:flex;gap:7px;}
.mbtn{
width:34px;height:34px;border-radius:10px;
background:rgba(28,28,30,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
border:.5px solid var(–sep);color:var(–lbl);font-size:14px;
display:flex;align-items:center;justify-content:center;
cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;user-select:none;
}
.mbtn:active{transform:scale(.88);background:rgba(58,58,60,.98);}
.mbtn.on{color:var(–ac);border-color:var(–ac);box-shadow:0 0 8px var(–glow);}
.rleg{position:absolute;bottom:12px;right:12px;z-index:1000;
background:rgba(28,28,30,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
border-radius:9px;padding:7px 9px;border:.5px solid var(–sep);}
.rleg-t{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
color:var(–lbl3);text-align:center;margin-bottom:4px;}
.rleg-bar{width:80px;height:5px;border-radius:3px;
background:linear-gradient(to right,#3288bd,#66c2a5,#abdda4,#e6f598,#fee090,#fdae61,#f46d43,#d53e4f);}
.rleg-lbls{display:flex;justify-content:space-between;margin-top:3px;}
.rleg-l{font-size:8px;color:var(–lbl3);}
.fpbar-wrap{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,.07);}
.fpbar{height:100%;background:var(–ac);transition:width .3s;box-shadow:0 0 5px var(–glow);}

/* Tab bar — smaller, more subtle */
.tabs{
display:flex;background:rgba(28,28,30,.97);backdrop-filter:blur(20px);
-webkit-backdrop-filter:blur(20px);border-top:.5px solid var(–sep);
padding:7px 0 11px;
}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;
cursor:pointer;padding:3px 0;-webkit-tap-highlight-color:transparent;user-select:none;}
.tab:active{opacity:.45}
.tab-i{font-size:19px;transition:transform .2s}
.tab.on .tab-i{transform:scale(1.06);filter:drop-shadow(0 0 5px var(–glow));}
.tab-l{font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
color:var(–lbl3);transition:color .2s;}
.tab.on .tab-l{color:var(–ac);}

/* Weather content */
.wxwrap{padding:4px 14px 16px;}
.wxcur{display:flex;align-items:center;justify-content:space-between;padding:14px 0 8px;}
.wxtemp{font-size:68px;font-weight:200;color:var(–lbl);line-height:1;letter-spacing:-4px;}
.wxtemp sup{font-size:23px;font-weight:300;letter-spacing:0;vertical-align:super;}
.wxcond{font-size:15px;color:var(–lbl2);margin-top:5px;}
.wxhl{font-size:12px;color:var(–lbl3);margin-top:2px;}
.wxico{font-size:62px;line-height:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4));}
.feels{display:inline-flex;align-items:center;gap:5px;background:var(–fill);
border-radius:9px;padding:5px 11px;margin-bottom:16px;}
.fl{font-size:12px;color:var(–lbl2);}.fv{font-size:12px;font-weight:600;color:var(–lbl);}
.secht{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;
color:var(–lbl3);margin-bottom:8px;}

/* Hourly */
.hrow{display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;scrollbar-width:none;}
.hrow::-webkit-scrollbar{display:none}
.hitem{flex:0 0 50px;background:var(–bg2);border-radius:12px;padding:9px 4px;
display:flex;flex-direction:column;align-items:center;gap:4px;border:.5px solid var(–sep);}
.hitem.now{background:var(–bg3);border-color:var(–ac);box-shadow:0 0 0 .5px var(–ac);}
.ht{font-size:9px;font-weight:600;color:var(–lbl3);}
.hitem.now .ht{color:var(–ac);}
.hi{font-size:17px;}.htmp{font-size:12px;font-weight:600;color:var(–lbl);}
.hrn{font-size:9px;color:#5AC8FA;}

/* Daily */
.dlist{background:var(–bg2);border-radius:13px;overflow:hidden;margin-bottom:16px;border:.5px solid var(–sep);}
.drow{display:flex;align-items:center;padding:10px 13px;gap:10px;}
.drow+.drow{border-top:.5px solid var(–sep);}
.dday{font-size:13px;font-weight:500;color:var(–lbl);width:38px;flex-shrink:0;}
.dico{font-size:19px;flex-shrink:0;}.drn{font-size:11px;color:#5AC8FA;flex:1;}
.dtemps{display:flex;gap:7px;}
.dhi{font-size:13px;font-weight:600;color:var(–lbl);}
.dlo{font-size:13px;color:var(–lbl3);}

/* Tiles */
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:8px;}
.tile{background:var(–bg2);border-radius:13px;padding:13px;border:.5px solid var(–sep);}
.thdr{display:flex;align-items:center;gap:4px;margin-bottom:7px;}
.tico{font-size:13px;opacity:.65;}.tlbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(–lbl3);}
.tval{font-size:27px;font-weight:200;color:var(–lbl);line-height:1;}
.tunit{font-size:12px;color:var(–lbl2);}.tsub{font-size:11px;color:var(–lbl3);margin-top:3px;}

/* Empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;padding:20px;}
.emico{font-size:40px;opacity:.3}.emtxt{font-size:13px;color:var(–lbl3);text-align:center;line-height:1.5}
`;

// ── Editor CSS ──────────────────────────────────────────────
const ED_CSS = `:host{ --bg:#1C1C1E;--bg2:#2C2C2E;--bg3:#3A3A3C; --lbl:#fff;--lbl2:rgba(235,235,245,.6);--lbl3:rgba(235,235,245,.3); --sep:rgba(84,84,88,.65);--ac:var(--worm-ac-ed,#5AC8FA); font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif; -webkit-font-smoothing:antialiased;display:block; } .root{padding:14px;display:flex;flex-direction:column;gap:18px;} .ehdr{display:flex;align-items:center;gap:10px;padding-bottom:14px;border-bottom:.5px solid var(--sep);} .elogo{font-size:26px;}.etitle{font-size:16px;font-weight:700;color:var(--lbl);} .ever{font-size:10px;color:var(--lbl3);margin-top:1px;} .sechdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--lbl3);margin-bottom:7px;padding-left:4px;} .seccard{background:var(--bg2);border-radius:13px;overflow:visible;border:.5px solid var(--sep);} .row{display:flex;align-items:center;padding:11px 13px;gap:11px;} .row+.row{border-top:.5px solid var(--sep);} .rico{font-size:15px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:7px;flex-shrink:0;} .rinfo{flex:1;min-width:0}.rlbl{font-size:13px;font-weight:500;color:var(--lbl);} .rsub{font-size:11px;color:var(--lbl3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .rctrl{flex-shrink:0;display:flex;align-items:center;} input.inp{background:var(--bg3);border:.5px solid var(--sep);border-radius:8px; color:var(--lbl);font-size:13px;padding:6px 9px;outline:none;font-family:inherit;transition:border-color .2s;} input.inp:focus{border-color:var(--ac);} input.inp.sm{width:56px}input.inp.md{width:105px}input.inp.full{width:100%;box-sizing:border-box;} select.sel{background:var(--bg3);border:.5px solid var(--sep);border-radius:8px; color:var(--lbl);font-size:12px;padding:6px 24px 6px 9px;outline:none;font-family:inherit; appearance:none;-webkit-appearance:none;cursor:pointer; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(235,235,245,.35)'/%3E%3C/svg%3E"); background-repeat:no-repeat;background-position:right 8px center;} .tog{position:relative;width:47px;height:28px;flex-shrink:0;} .tog input{opacity:0;width:0;height:0;position:absolute;} .togtr{position:absolute;inset:0;background:rgba(118,118,128,.32);border-radius:14px;cursor:pointer;transition:background .25s;} .togtr::after{content:'';position:absolute;left:2px;top:2px;width:24px;height:24px; background:#fff;border-radius:50%;transition:transform .25s;box-shadow:0 2px 4px rgba(0,0,0,.3);} .tog input:checked+.togtr{background:#34C759;} .tog input:checked+.togtr::after{transform:translateX(19px);} .cprow{display:flex;align-items:center;gap:7px;} .cpsw{width:30px;height:30px;border-radius:7px;cursor:pointer;border:1.5px solid rgba(255,255,255,.18); position:relative;overflow:hidden;flex-shrink:0;transition:transform .15s;} .cpsw:active{transform:scale(.88);} .cpsw input[type=color]{position:absolute;top:-4px;left:-4px;width:38px;height:38px;opacity:0;cursor:pointer;border:none;} input.hex{background:var(--bg3);border:.5px solid var(--sep);border-radius:7px; color:var(--lbl);font-size:11px;padding:5px 7px;outline:none; font-family:'SF Mono',monospace;width:72px;transition:border-color .2s;} input.hex:focus{border-color:var(--ac);} .slrow{display:flex;align-items:center;gap:7px;} input.sl{-webkit-appearance:none;appearance:none;width:120px;height:3px;border-radius:2px;background:var(--bg3);outline:none;cursor:pointer;} input.sl::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;} input.sl::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;border:none;} .slv{font-size:11px;color:var(--lbl2);min-width:34px;text-align:right;} .seg{display:flex;background:var(--bg3);border-radius:8px;padding:2px;gap:1px;} .sop{flex:1;text-align:center;font-size:11px;font-weight:500;color:var(--lbl2); padding:5px 7px;border-radius:6px;cursor:pointer;transition:all .2s;user-select:none;} .sop.on{background:var(--bg2);color:var(--lbl);box-shadow:0 1px 3px rgba(0,0,0,.3);} .ewrap{position:relative;width:100%;} .esel{background:rgba(90,200,250,.1);border:.5px solid rgba(90,200,250,.35); border-radius:8px;padding:6px 9px;font-size:12px;color:var(--lbl); display:flex;align-items:center;gap:5px;cursor:pointer;} .eselid{color:var(--lbl2);font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} .eclr{color:var(--lbl3);font-size:15px;flex-shrink:0;} .edrop{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg3); border:.5px solid var(--sep);border-radius:9px;max-height:200px;overflow-y:auto; z-index:9999;box-shadow:0 10px 36px rgba(0,0,0,.5);} .eitem{padding:10px 11px;font-size:12px;color:var(--lbl);cursor:pointer;} .eitem:hover{background:rgba(90,200,250,.12);color:var(--ac);} .eitem+.eitem{border-top:.5px solid var(--sep);} .einm{font-weight:500;}.eiid{font-size:10px;color:var(--lbl3);margin-top:2px;} .enone{padding:12px;text-align:center;font-size:12px;color:var(--lbl3);}`;

// ── SVG icons for resize button ─────────────────────────────
const ICO_EXPAND   = ‘<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>’;
const ICO_COLLAPSE = ‘<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>’;

// ══════════════════════════════════════════════════════════════
// MAIN CARD
// ══════════════════════════════════════════════════════════════
class WormWeatherCard extends HTMLElement {
constructor() {
super();
this.attachShadow({ mode: ‘open’ });
this._cfg      = {};
this._hass     = null;
this._view     = ‘compact’;   // compact | radar | weather
this._expanded = false;
this._map      = null;
this._radar    = null;
this._frames   = [];
this._fi       = 0;
this._playing  = false;
this._timer    = null;
this._lat      = 51.5;
this._lon      = -0.12;
this._zoom     = 7;
this._ready    = false;
// Atmospheric canvas state
this._atmFrame    = 0;
this._atmParticles = [];
this._atmAnimId   = null;
}

```
setConfig(c) {
  if (!c) throw new Error('worm-weather-card: missing config');
  this._cfg = Object.assign({
    accent_color: '#5AC8FA', default_view: 'compact', map_style: 'dark',
    zoom_level: 7, radar_opacity: 0.7, animation_speed: 600,
    auto_animate: true, temp_unit: '\u00B0C', wind_unit: 'km/h',
    show_hourly: true, show_daily: true, show_details: true,
    compact_height: 160,
  }, c);
  this._zoom     = parseInt(this._cfg.zoom_level) || 7;
  const dv       = this._cfg.default_view || 'compact';
  this._expanded = (dv !== 'compact');
  this._view     = this._expanded ? 'radar' : 'compact';

  if (this._ready) {
    this._stopAnim();
    this._stopAtm();
    if (this._map) { this._map.remove(); this._map = null; }
    this._render();
    this._postRender();
  }
}

set hass(h) {
  this._hass = h;
  if (!this._ready) {
    this._render();
    this._ready = true;
    this._postRender();
  } else {
    // Update compact overlay values
    this._updateCompactOverlay();
    // Update weather panel if expanded
    if (this._expanded) {
      const wc = this.shadowRoot.getElementById('wxc');
      if (wc) wc.innerHTML = this._wxHTML();
    }
  }
}

connectedCallback() {
  if (this._hass && !this._ready) {
    this._render();
    this._ready = true;
    this._postRender();
  }
}

disconnectedCallback() {
  this._stopAnim();
  this._stopAtm();
  if (this._map) { this._map.remove(); this._map = null; }
}

getCardSize()            { return this._expanded ? 12 : 5; }
static getConfigElement(){ return document.createElement('worm-weather-card-editor'); }
static getStubConfig()   {
  return { weather_entity: '', postcode: '', country_code: 'GB', accent_color: '#5AC8FA', zoom_level: 7 };
}

// ── Render ───────────────────────────────────────────────
_render() {
  const ac  = this._cfg.accent_color || '#5AC8FA';
  const ch  = parseInt(this._cfg.compact_height) || 160;
  const exp = this._expanded;

  this.shadowRoot.innerHTML =
    '<style>' + CARD_CSS +
    ':host{--worm-ac:' + ac + ';--worm-glow:' + ac + '55}</style>' +
    '<ha-card>' +

    /* Resize button — always visible, top-right */
    '<button class="resize-btn" id="rbtn">' +
      '<svg viewBox="0 0 24 24">' + (exp ? ICO_COLLAPSE : ICO_EXPAND) + '</svg>' +
    '</button>' +

    /* ── COMPACT VIEW ── */
    '<div class="view' + (exp ? '' : ' active') + '" id="v-compact">' +
      '<div class="compact-wrap" id="compact-wrap" style="height:' + ch + 'px">' +
        '<canvas id="atm-canvas"></canvas>' +
        '<div class="atm-badge" id="atm-badge">Now</div>' +
        '<div class="atm-overlay">' +
          '<div class="atm-left">' +
            '<div class="atm-temp" id="atm-temp">\u2014</div>' +
            '<div class="atm-cond" id="atm-cond">\u2014</div>' +
            '<div class="atm-hilo" id="atm-hilo"></div>' +
          '</div>' +
          '<div class="atm-ico" id="atm-ico"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ── EXPANDED VIEW ── */
    '<div class="view' + (exp ? ' active' : '') + '" id="v-expanded">' +

      /* Radar sub-view */
      '<div class="view active" id="v-radar">' +
        '<div class="map-wrap">' +
          '<div id="lf-map"></div>' +
          '<div class="rtag" id="rtag">Loading\u2026</div>' +
          '<div class="gtag" id="gtag" style="opacity:0"></div>' +
          '<div class="mctrl">' +
            '<div class="mbtn" id="bplay">\u25B6</div>' +
            '<div class="mbtn" id="bprev">\u25C4</div>' +
            '<div class="mbtn" id="bnext">\u25BA\u25BA</div>' +
            '<div class="mbtn" id="brc" title="Re-centre">\u2295</div>' +
          '</div>' +
          '<div class="rleg">' +
            '<div class="rleg-t">Rainfall</div>' +
            '<div class="rleg-bar"></div>' +
            '<div class="rleg-lbls"><span class="rleg-l">Light</span><span class="rleg-l">Heavy</span></div>' +
          '</div>' +
          '<div class="fpbar-wrap"><div class="fpbar" id="fpbar" style="width:0%"></div></div>' +
        '</div>' +
      '</div>' +

      /* Weather sub-view */
      '<div class="view" id="v-weather">' +
        '<div class="wxwrap" id="wxc">' + this._wxHTML() + '</div>' +
      '</div>' +

      /* Tab bar */
      '<div class="tabs">' +
        '<div class="tab on" id="t-radar" onclick="void(0)">' +
          '<span class="tab-i">\uD83D\uDDFA\uFE0F</span><span class="tab-l">Radar</span>' +
        '</div>' +
        '<div class="tab" id="t-weather" onclick="void(0)">' +
          '<span class="tab-i">\uD83C\uDF24\uFE0F</span><span class="tab-l">Weather</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '</ha-card>';

  this._bindUI();
}

_postRender() {
  this._updateCompactOverlay();
  if (!this._expanded) {
    this._resizeAtmCanvas();
    this._startAtm();
  } else {
    this._initMapAsync();
  }
}

// ── UI bindings ──────────────────────────────────────────
_bindUI() {
  const s  = this.shadowRoot;
  const $  = id => s.getElementById(id);

  // Resize button (crow-style toggle)
  $('rbtn').addEventListener('click', () => this._toggleSize());

  // Tab buttons
  $('t-radar').addEventListener('click',   () => this._switchTab('radar'));
  $('t-weather').addEventListener('click', () => this._switchTab('weather'));

  // Compact tap → expand
  const cw = $('compact-wrap');
  if (cw) cw.addEventListener('click', () => this._toggleSize());

  // Map controls
  $('bplay').addEventListener('click', () => this._toggleAnim());
  $('bprev').addEventListener('click', () => { this._stopAnim(); this._step(-1); });
  $('bnext').addEventListener('click', () => { this._stopAnim(); this._step(1); });
  $('brc').addEventListener('click',   () => {
    if (this._map) this._map.setView([this._lat, this._lon], this._zoom, { animate: true });
  });
}

// ── Toggle compact ↔ expanded (crow-style) ───────────────
_toggleSize() {
  this._expanded = !this._expanded;
  const s  = this.shadowRoot;
  const $  = id => s.getElementById(id);

  $('v-compact').classList.toggle('active', !this._expanded);
  $('v-expanded').classList.toggle('active', this._expanded);

  // Swap resize icon
  const btnSvg = $('rbtn').querySelector('svg');
  btnSvg.innerHTML = this._expanded ? ICO_COLLAPSE : ICO_EXPAND;

  if (this._expanded) {
    this._stopAtm();
    if (!this._map) this._initMapAsync();
    else setTimeout(() => this._map.invalidateSize(), 60);
    // Refresh weather panel
    const wc = $('wxc');
    if (wc) wc.innerHTML = this._wxHTML();
  } else {
    this._stopAnim();
    this._resizeAtmCanvas();
    this._startAtm();
  }
}

// ── Tab switching (inside expanded) ─────────────────────
_switchTab(t) {
  const s = this.shadowRoot;
  s.getElementById('v-radar').classList.toggle('active', t === 'radar');
  s.getElementById('v-weather').classList.toggle('active', t === 'weather');
  s.getElementById('t-radar').classList.toggle('on', t === 'radar');
  s.getElementById('t-weather').classList.toggle('on', t === 'weather');
  if (t === 'radar') {
    if (!this._map) this._initMapAsync();
    else setTimeout(() => this._map.invalidateSize(), 60);
  }
}

// ════════════════════════════════════════════════════════════
// COMPACT ATMOSPHERIC VIEW
// Particle system adapted from Atmospheric Weather Card v3.3
// https://github.com/shpongledsummer/atmospheric-weather-card
// ════════════════════════════════════════════════════════════
_atmState() {
  const entity  = this._cfg.weather_entity;
  const s       = this._hass && entity && this._hass.states[entity];
  const cond    = s ? (s.state || 'cloudy') : 'cloudy';
  return ATM_CFG[cond] || ATM_CFG.default;
}

_updateCompactOverlay() {
  const s  = this.shadowRoot;
  if (!s.getElementById('atm-temp')) return;
  const entity = this._cfg.weather_entity;
  const st     = this._hass && entity && this._hass.states[entity];
  const a      = st ? (st.attributes || {}) : {};
  const cond   = st ? (st.state || '') : '';
  const wi     = WI[cond] || { e: '\uD83C\uDF21\uFE0F', l: cond || '\u2014' };
  const u      = this._cfg.temp_unit || '\u00B0C';
  s.getElementById('atm-temp').innerHTML = cvt(a.temperature, u) + '<sup>' + u + '</sup>';
  s.getElementById('atm-cond').textContent = wi.l;
  s.getElementById('atm-ico').textContent  = wi.e;
  const hi = a.temperature_high != null ? cvt(a.temperature_high, u) : null;
  const lo = a.temperature_low  != null ? cvt(a.temperature_low,  u) : null;
  s.getElementById('atm-hilo').textContent = (hi != null && lo != null) ? 'H: ' + hi + '\u00B0 \u00B7 L: ' + lo + '\u00B0' : '';
}

_resizeAtmCanvas() {
  const wrap = this.shadowRoot.getElementById('compact-wrap');
  const cv   = this.shadowRoot.getElementById('atm-canvas');
  if (!wrap || !cv) return;
  const w = wrap.offsetWidth, h = wrap.offsetHeight;
  if (!w || !h) return;
  cv.width  = w;
  cv.height = h;
  this._initAtmParticles(w, h);
}

_initAtmParticles(w, h) {
  const cfg = this._atmState();
  this._atmParticles = [];
  const count = cfg.count || 0;
  for (let i = 0; i < count; i++) {
    const isSnow = cfg.snow && (!cfg.rain || Math.random() < 0.4);
    if (isSnow) {
      this._atmParticles.push({
        type: 'snow',
        x: Math.random() * w, y: Math.random() * h,
        vy: 0.4 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.5,
        size: 0.8 + Math.random() * 2.5,
        op:  0.45 + Math.random() * 0.45,
        phase: Math.random() * TWO_PI,
      });
    } else {
      this._atmParticles.push({
        type: 'rain',
        x: Math.random() * w, y: Math.random() * h,
        vy:  5 + Math.random() * 6,
        vx: -0.8 - Math.random() * 0.8,
        len: 10 + Math.random() * 12,
        op:  0.18 + Math.random() * 0.28,
        z:   0.5 + Math.random() * 0.7,
      });
    }
  }
}

_drawAtm() {
  const cv = this.shadowRoot.getElementById('atm-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const w   = cv.width, h = cv.height;
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);

  const entity = this._cfg.weather_entity;
  const st     = this._hass && entity && this._hass.states[entity];
  const cond   = st ? (st.state || 'cloudy') : 'cloudy';
  const cfg    = ATM_CFG[cond] || ATM_CFG.default;
  const [sr, sg, sb] = cfg.sky;
  const isNight = cond === 'clear-night';
  const f = this._atmFrame;

  // ── Background gradient ──
  if (isNight) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#000814'); bg.addColorStop(1, '#0a0e1a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // Stars (adapted from atmospheric-weather-card star rendering concept)
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.508) % w;
      const sy = (i * 97.308)  % (h * 0.85);
      const r  = i % 7 === 0 ? 1.1 : 0.55;
      ctx.globalAlpha = 0.25 + Math.sin(f * 0.06 + i) * 0.18;
      ctx.fillStyle   = 'rgba(255,255,255,1)';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TWO_PI); ctx.fill();
    }
    // Moon
    const mx = w * 0.75, my = h * 0.28;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 22);
    mg.addColorStop(0,   'rgba(240,245,255,.92)');
    mg.addColorStop(0.6, 'rgba(200,215,245,.55)');
    mg.addColorStop(1,   'rgba(160,180,220,0)');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle   = mg;
    ctx.beginPath(); ctx.arc(mx, my, 22, 0, TWO_PI); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(' + Math.max(0, sr - 12) + ',' + Math.max(0, sg - 12) + ',' + Math.max(0, sb - 12) + ',1)');
    bg.addColorStop(1, 'rgba(' + sr + ',' + sg + ',' + sb + ',1)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // Sun glow (sunny/partlycloudy/exceptional)
    if (cond === 'sunny' || cond === 'partlycloudy' || cond === 'exceptional') {
      const sx = w * 0.74, sy = h * 0.28;
      const pulse = 1 + Math.sin(f * 0.04) * 0.04;
      const sg2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 44 * pulse);
      sg2.addColorStop(0,   'rgba(255,255,210,.92)');
      sg2.addColorStop(0.3, 'rgba(255,210,80,.55)');
      sg2.addColorStop(0.6, 'rgba(255,160,30,.2)');
      sg2.addColorStop(1,   'rgba(255,160,30,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle   = sg2;
      ctx.beginPath(); ctx.arc(sx, sy, 44 * pulse, 0, TWO_PI); ctx.fill();
    }
  }

  // ── Clouds (adapted from atmospheric-weather-card cloud rendering) ──
  const cloudCount = cfg.clouds || 0;
  for (let i = 0; i < cloudCount; i++) {
    const cx = ((i * 195 + f * 0.35) % (w + 200)) - 80;
    const cy = h * (0.08 + i * 0.055) + Math.sin(f * 0.009 + i) * 1.5;
    const cw2 = 55 + i * 18;
    const isDarkCloud = isNight || cond === 'pouring' || cond === 'lightning' || cond === 'lightning-rainy';
    const cloudAlpha = isDarkCloud ? 0.16 : 0.24;
    const cg = ctx.createRadialGradient(cx + cw2 / 2, cy, 0, cx + cw2 / 2, cy, cw2 * 0.62);
    if (isDarkCloud) {
      cg.addColorStop(0, 'rgba(28,33,50,' + cloudAlpha + ')');
      cg.addColorStop(1, 'rgba(28,33,50,0)');
    } else {
      cg.addColorStop(0, 'rgba(255,255,255,' + cloudAlpha + ')');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle   = cg;
    ctx.beginPath();
    ctx.ellipse(cx + cw2 / 2, cy, cw2 / 2, (12 + i * 3), 0, 0, TWO_PI);
    ctx.fill();
  }

  // ── Lightning flash ──
  if ((cond === 'lightning' || cond === 'lightning-rainy') && Math.random() < 0.008) {
    ctx.globalAlpha = 0.55 + Math.random() * 0.3;
    ctx.fillStyle   = 'rgba(180,210,255,1)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // ── Particles ──
  for (let i = 0; i < this._atmParticles.length; i++) {
    const p = this._atmParticles[i];
    p.y += p.vy; p.x += p.vx;
    if (p.y > h + 10) { p.y = -12; p.x = Math.random() * w; }
    if (p.x < -6) p.x = w + 6;
    if (p.x > w + 6) p.x = -6;

    if (p.type === 'rain') {
      ctx.globalAlpha = p.op;
      ctx.strokeStyle = 'rgba(180,205,240,1)';
      ctx.lineWidth   = p.z * 0.75;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 1.8, p.y - p.len);
      ctx.stroke();
    } else {
      p.phase += 0.025;
      const shimmer = 0.88 + Math.sin(p.phase * 2.5) * 0.12;
      ctx.globalAlpha = p.op * shimmer;
      ctx.fillStyle   = 'rgba(255,255,255,1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * shimmer, 0, TWO_PI); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  this._atmFrame++;
}

_startAtm() {
  if (this._atmAnimId) return;
  const loop = () => {
    if (!this._expanded && this.shadowRoot.getElementById('atm-canvas')) {
      this._drawAtm();
      this._atmAnimId = requestAnimationFrame(loop);
    } else {
      this._atmAnimId = null;
    }
  };
  this._atmAnimId = requestAnimationFrame(loop);
}

_stopAtm() {
  if (this._atmAnimId) { cancelAnimationFrame(this._atmAnimId); this._atmAnimId = null; }
}

// ════════════════════════════════════════════════════════════
// RADAR (Leaflet + RainViewer)
// ════════════════════════════════════════════════════════════
async _initMapAsync() { await loadLeaflet(this.shadowRoot); this._initMap(); }

_initMap() {
  const el = this.shadowRoot.getElementById('lf-map');
  if (!el || !window.L) return;
  if (this._map) { this._map.remove(); this._map = null; }
  this._map = L.map(el, { zoomControl: false, attributionControl: false })
               .setView([this._lat, this._lon], this._zoom);
  L.control.zoom({ position: 'topright' }).addTo(this._map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(this._map);
  const t = TILES[this._cfg.map_style] || TILES.dark;
  L.tileLayer(t.url, { attribution: t.attr, maxZoom: 18, subdomains: t.sub || 'abc' }).addTo(this._map);
  this._fetchRadar();
  if (this._cfg.postcode) this._geocode();
}

async _geocode() {
  const tag = this.shadowRoot.getElementById('gtag');
  if (tag) { tag.textContent = '\uD83D\uDCCD Locating\u2026'; tag.style.opacity = '1'; }
  const r = await geocode(this._cfg.postcode, this._cfg.country_code);
  if (r) {
    this._lat = r.lat; this._lon = r.lon;
    if (this._map) this._map.setView([r.lat, r.lon], this._zoom, { animate: true });
    if (tag) tag.textContent = '\uD83D\uDCCD ' + r.name.split(',').slice(0, 2).join(',');
  } else {
    if (tag) tag.textContent = '\u26A0\uFE0F Location not found';
  }
  setTimeout(() => { if (tag) tag.style.opacity = '0'; }, 3500);
}

async _fetchRadar() {
  try {
    const d = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
    this._frames = [...(d.radar?.past || []), ...(d.radar?.nowcast || [])];
    if (!this._frames.length) return;
    this._fi = this._frames.length - 1;
    this._showFrame(this._fi);
    if (this._cfg.auto_animate !== false) this._startAnim();
  } catch (e) {
    const t = this.shadowRoot.getElementById('rtag');
    if (t) t.textContent = 'Radar unavailable';
  }
}

_showFrame(i) {
  if (!this._map || !window.L) return;
  const f = this._frames[i]; if (!f) return;
  if (this._radar) { this._map.removeLayer(this._radar); this._radar = null; }
  this._radar = L.tileLayer(
    'https://tilecache.rainviewer.com' + f.path + '/512/{z}/{x}/{y}/2/1_1.png',
    { opacity: parseFloat(this._cfg.radar_opacity) || 0.7, zIndex: 10, tileSize: 512 }
  ).addTo(this._map);
  const t = this.shadowRoot.getElementById('rtag');
  if (t) t.textContent = new Date(f.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bar = this.shadowRoot.getElementById('fpbar');
  if (bar) bar.style.width = ((i + 1) / this._frames.length * 100).toFixed(0) + '%';
}

_startAnim() {
  this._stopAnim();
  if (this._frames.length < 2) return;
  this._playing = true; this._updatePlayBtn();
  this._timer = setInterval(() => {
    this._fi = (this._fi + 1) % this._frames.length;
    this._showFrame(this._fi);
  }, parseInt(this._cfg.animation_speed) || 600);
}
_stopAnim() {
  if (this._timer) { clearInterval(this._timer); this._timer = null; }
  this._playing = false; this._updatePlayBtn();
}
_toggleAnim() { this._playing ? this._stopAnim() : this._startAnim(); }
_step(d) {
  if (!this._frames.length) return;
  this._fi = (this._fi + d + this._frames.length) % this._frames.length;
  this._showFrame(this._fi);
}
_updatePlayBtn() {
  const b = this.shadowRoot.getElementById('bplay'); if (!b) return;
  b.textContent = this._playing ? '\u23F8' : '\u25B6';
  b.classList.toggle('on', this._playing);
}

// ════════════════════════════════════════════════════════════
// WEATHER PANEL HTML
// ════════════════════════════════════════════════════════════
_wxHTML() {
  const e = this._cfg.weather_entity;
  if (!e) return '<div class="empty"><div class="emico">\uD83C\uDF24\uFE0F</div><div class="emtxt">Select a weather entity<br>in the visual editor</div></div>';
  const s = this._hass?.states?.[e];
  if (!s) return '<div class="empty"><div class="emico">\u26A0\uFE0F</div><div class="emtxt">Entity not found:<br>' + e + '</div></div>';
  const a  = s.attributes || {};
  const wi = WI[s.state] || { e: '\uD83C\uDF21\uFE0F', l: s.state };
  const u  = this._cfg.temp_unit || '\u00B0C';
  const wu = this._cfg.wind_unit || 'km/h';
  const temp  = cvt(a.temperature, u);
  const feels = a.apparent_temperature != null ? cvt(a.apparent_temperature, u) : null;
  const hi    = a.temperature_high != null ? cvt(a.temperature_high, u) : null;
  const lo    = a.temperature_low  != null ? cvt(a.temperature_low, u)  : null;
  const fc    = a.forecast || [];
  const now   = Date.now();
  const hourly = fc.filter(f => { const d = new Date(f.datetime) - now; return d > -3.6e6 && d < 9.36e7; }).slice(0, 12);
  const daily  = fc.filter((f, i) => new Date(f.datetime) > new Date() && i < 7).slice(0, 7);
  let ws = a.wind_speed;
  if (ws != null) {
    if (wu === 'mph') ws = Math.round(ws * 0.621371) + '';
    else if (wu === 'm/s') ws = (ws / 3.6).toFixed(1);
    else ws = Math.round(ws) + '';
  } else { ws = '\u2014'; }

  let h = '<div class="wxcur"><div>' +
    '<div class="wxtemp">' + temp + '<sup>' + u + '</sup></div>' +
    '<div class="wxcond">' + wi.l + '</div>' +
    (hi != null && lo != null ? '<div class="wxhl">H: ' + hi + '\u00B0 \u00B7 L: ' + lo + '\u00B0</div>' : '') +
    '</div><div class="wxico">' + wi.e + '</div></div>';

  if (feels != null) h += '<div class="feels"><span class="fl">Feels like</span><span class="fv">' + feels + u + '</span></div>';

  if (this._cfg.show_hourly !== false && hourly.length) {
    h += '<div class="secht">Hourly Forecast</div><div class="hrow">';
    hourly.forEach((f, i) => {
      const fi = WI[f.condition] || { e: '\uD83C\uDF21\uFE0F' };
      h += '<div class="hitem' + (i === 0 ? ' now' : '') + '">' +
        '<div class="ht">' + (i === 0 ? 'Now' : fmtT(f.datetime)) + '</div>' +
        '<div class="hi">' + fi.e + '</div>' +
        '<div class="htmp">' + cvt(f.temperature, u) + '\u00B0</div>' +
        (f.precipitation_probability != null ? '<div class="hrn">' + Math.round(f.precipitation_probability) + '%</div>' : '') +
        '</div>';
    });
    h += '</div>';
  }

  if (this._cfg.show_daily !== false && daily.length) {
    h += '<div class="secht">7-Day Forecast</div><div class="dlist">';
    daily.forEach((f, i) => {
      const fi = WI[f.condition] || { e: '\uD83C\uDF21\uFE0F' };
      h += '<div class="drow">' +
        '<div class="dday">' + (i === 0 ? 'Today' : fmtD(f.datetime)) + '</div>' +
        '<div class="dico">' + fi.e + '</div>' +
        '<div class="drn">' + (f.precipitation_probability != null ? '\uD83D\uDCA7 ' + Math.round(f.precipitation_probability) + '%' : '') + '</div>' +
        '<div class="dtemps"><span class="dhi">' + cvt(f.temperature, u) + '\u00B0</span>' +
        '<span class="dlo">' + (f.templow != null ? cvt(f.templow, u) + '\u00B0' : '\u2014') + '</span></div>' +
        '</div>';
    });
    h += '</div>';
  }

  if (this._cfg.show_details !== false) {
    h += '<div class="secht">Conditions</div><div class="tgrid">';
    const tile = (ico, lbl, val, unit, sub) =>
      '<div class="tile"><div class="thdr"><span class="tico">' + ico + '</span>' +
      '<span class="tlbl">' + lbl + '</span></div>' +
      '<div><span class="tval">' + val + '</span><span class="tunit"> ' + unit + '</span></div>' +
      '<div class="tsub">' + sub + '</div></div>';
    if (a.humidity != null) {
      const hm = Math.round(a.humidity);
      h += tile('\uD83D\uDCA7', 'Humidity', hm, '%', hm < 30 ? 'Dry' : hm < 60 ? 'Comfortable' : hm < 80 ? 'Humid' : 'Very Humid');
    }
    if (a.wind_speed != null) h += tile('\uD83D\uDCA8', 'Wind', ws, wu, wdir(a.wind_bearing));
    if (a.pressure != null) {
      const p = Math.round(a.pressure);
      h += tile('\uD83D\uDD35', 'Pressure', p, 'hPa', p > 1020 ? '\u2191 High' : p < 1000 ? '\u2193 Low' : '\u2192 Normal');
    }
    if (a.uv_index != null) h += tile('\u2600\uFE0F', 'UV Index', a.uv_index, '', uvl(a.uv_index));
    if (a.visibility != null) h += tile('\uD83D\uDC41', 'Visibility', Math.round(a.visibility), 'km', '');
    if (a.dew_point != null) h += tile('\uD83C\uDF21\uFE0F', 'Dew Point', cvt(a.dew_point, u), u, '');
    if (a.cloud_coverage != null) h += tile('\u2601\uFE0F', 'Cloud Cover', Math.round(a.cloud_coverage), '%', '');
    if (a.precipitation != null) h += tile('\uD83C\uDF27\uFE0F', 'Precipitation', a.precipitation, 'mm', '');
    h += '</div>';
  }
  return h;
}
```

}

// ══════════════════════════════════════════════════════════════
// VISUAL EDITOR
// ══════════════════════════════════════════════════════════════
class WormWeatherCardEditor extends HTMLElement {
constructor() {
super();
this.attachShadow({ mode: ‘open’ });
this._cfg = {}; this._hass = null; this._drop = false; this._q = ‘’;
}

```
setConfig(c) { this._cfg = Object.assign({}, c); this._render(); }
set hass(h)   { this._hass = h; this._render(); }

_ents() {
  if (!this._hass) return [];
  return Object.keys(this._hass.states)
    .filter(id => id.startsWith('weather.'))
    .map(id => ({ id, nm: this._hass.states[id].attributes.friendly_name || id }))
    .sort((a, b) => a.nm.localeCompare(b.nm));
}

_fire(c) {
  this._cfg = Object.assign({}, c);
  this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._cfg }, bubbles: true, composed: true }));
}
_set(k, v) { this._fire(Object.assign({}, this._cfg, { [k]: v })); this._render(); }

_render() {
  const c = this._cfg, ac = c.accent_color || '#5AC8FA';
  const all = this._ents();
  const q   = this._q.toLowerCase();
  const fil = all.filter(e => !q || e.nm.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));

  const seg = (k, opts) => '<div class="seg">' + opts.map(([v, label]) =>
    '<div class="sop' + ((c[k] || opts[0][0]) === v ? ' on' : '') + '" data-seg="' + k + '" data-val="' + v + '">' + label + '</div>'
  ).join('') + '</div>';

  const tog = (id, key, checked) =>
    '<label class="tog"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
    '<span class="togtr"></span></label>';

  let entCtrl = '';
  if (c.weather_entity) {
    entCtrl = '<div class="esel" id="eclr"><span>\uD83C\uDF21\uFE0F</span>' +
      '<span class="eselid">' + c.weather_entity + '</span><span class="eclr">\u2715</span></div>';
  } else {
    entCtrl = '<input type="text" class="inp full" id="einp" placeholder="Search\u2026" value="' + this._q + '">';
    if (this._drop) {
      entCtrl += '<div class="edrop" id="edrop">' +
        (fil.length ? fil.map(e =>
          '<div class="eitem" data-eid="' + e.id + '">' +
          '<div class="einm">' + e.nm + '</div>' +
          '<div class="eiid">' + e.id + '</div></div>').join('')
        : '<div class="enone">No weather entities found</div>') + '</div>';
    }
  }

  const op  = Math.round((c.radar_opacity || 0.7) * 100);
  const sp  = c.animation_speed || 600;
  const z   = c.zoom_level || 7;
  const ch  = c.compact_height || 160;

  this.shadowRoot.innerHTML = '<style>' + ED_CSS + ':host{--worm-ac-ed:' + ac + '}</style>' +
    '<div class="root">' +
    '<div class="ehdr"><div class="elogo">\uD83C\uDF26\uFE0F</div>' +
      '<div><div class="etitle">Worm Weather Card</div><div class="ever">v' + VERSION + ' \u00B7 James McGinnis</div></div></div>' +

    /* Card settings */
    '<div><div class="sechdr">Card Settings</div><div class="seccard">' +
      '<div class="row"><div class="rico" style="background:#FF9F0A22">\uD83C\uDFA8</div>' +
        '<div class="rinfo"><div class="rlbl">Accent Colour</div><div class="rsub">Tabs, glow &amp; active states</div></div>' +
        '<div class="rctrl"><div class="cprow">' +
          '<div class="cpsw" id="sw" style="background:' + ac + '"><input type="color" id="cpick" value="' + ac + '"></div>' +
          '<input type="text" class="hex" id="hexinp" value="' + ac + '" maxlength="7" spellcheck="false">' +
        '</div></div></div>' +
      '<div class="row"><div class="rico" style="background:#5AC8FA22">\uD83D\uDCF1</div>' +
        '<div class="rinfo"><div class="rlbl">Default View</div></div>' +
        '<div class="rctrl">' + seg('default_view', [['compact', '\uD83C\uDF21\uFE0F Compact'], ['radar', '\uD83D\uDDFA\uFE0F Radar'], ['weather', '\uD83C\uDF24\uFE0F Full']]) + '</div></div>' +
      '<div class="row"><div class="rico" style="background:#30D15822">\u2195\uFE0F</div>' +
        '<div class="rinfo"><div class="rlbl">Compact Height</div><div class="rsub">Pixels when in compact mode</div></div>' +
        '<div class="rctrl"><div class="slrow">' +
          '<input type="range" class="sl" id="sch" min="120" max="250" step="10" value="' + ch + '">' +
          '<span class="slv" id="schv">' + ch + 'px</span>' +
        '</div></div></div>' +
    '</div></div>' +

    /* Location */
    '<div><div class="sechdr">Location</div><div class="seccard">' +
      '<div class="row"><div class="rico" style="background:#30D15822">\uD83D\uDCCD</div>' +
        '<div class="rinfo"><div class="rlbl">Postcode / ZIP</div><div class="rsub">Centres radar map on your area</div></div>' +
        '<div class="rctrl"><input type="text" class="inp md" id="ipc" value="' + (c.postcode || '') + '" placeholder="e.g. SW1A 1AA"></div></div>' +
      '<div class="row"><div class="rico" style="background:#5E5CE622">\uD83C\uDF0D</div>' +
        '<div class="rinfo"><div class="rlbl">Country Code</div><div class="rsub">ISO 2-letter (GB, US, DE\u2026)</div></div>' +
        '<div class="rctrl"><input type="text" class="inp sm" id="icc" value="' + (c.country_code || '') + '" placeholder="GB" maxlength="3"></div></div>' +
      '<div class="row"><div class="rico" style="background:#FF375F22">\uD83D\uDD0D</div>' +
        '<div class="rinfo"><div class="rlbl">Default Zoom</div><div class="rsub">4=country \u00B7 8=region \u00B7 12=city</div></div>' +
        '<div class="rctrl"><div class="slrow">' +
          '<input type="range" class="sl" id="szoom" min="4" max="14" step="1" value="' + z + '">' +
          '<span class="slv" id="szoomv">' + z + '</span>' +
        '</div></div></div>' +
    '</div></div>' +

    /* Radar */
    '<div><div class="sechdr">Radar</div><div class="seccard">' +
      '<div class="row"><div class="rico" style="background:#5AC8FA22">\uD83D\uDDFA\uFE0F</div>' +
        '<div class="rinfo"><div class="rlbl">Map Style</div></div>' +
        '<div class="rctrl"><select class="sel" id="sms">' +
          '<option value="dark"' + ((c.map_style || 'dark') === 'dark' ? ' selected' : '') + '>Dark</option>' +
          '<option value="light"' + (c.map_style === 'light' ? ' selected' : '') + '>Light</option>' +
          '<option value="standard"' + (c.map_style === 'standard' ? ' selected' : '') + '>Standard</option>' +
        '</select></div></div>' +
      '<div class="row"><div class="rico" style="background:#5E5CE622">\uD83C\uDF27\uFE0F</div>' +
        '<div class="rinfo"><div class="rlbl">Radar Opacity</div></div>' +
        '<div class="rctrl"><div class="slrow">' +
          '<input type="range" class="sl" id="sop" min="10" max="100" step="5" value="' + op + '">' +
          '<span class="slv" id="sopv">' + op + '%</span>' +
        '</div></div></div>' +
      '<div class="row"><div class="rico" style="background:#FF9F0A22">\u26A1</div>' +
        '<div class="rinfo"><div class="rlbl">Animation Speed</div><div class="rsub">ms per frame</div></div>' +
        '<div class="rctrl"><div class="slrow">' +
          '<input type="range" class="sl" id="ssp" min="200" max="1500" step="100" value="' + sp + '">' +
          '<span class="slv" id="sspv">' + sp + 'ms</span>' +
        '</div></div></div>' +
      '<div class="row"><div class="rico" style="background:#30D15822">\u25B6\uFE0F</div>' +
        '<div class="rinfo"><div class="rlbl">Auto-play on Load</div></div>' +
        '<div class="rctrl">' + tog('tap', 'auto_animate', c.auto_animate !== false) + '</div></div>' +
    '</div></div>' +

    /* Weather */
    '<div><div class="sechdr">Weather</div><div class="seccard">' +
      '<div class="row" style="position:relative;overflow:visible">' +
        '<div class="rico" style="background:#5AC8FA22">\uD83C\uDF24\uFE0F</div>' +
        '<div class="rinfo"><div class="rlbl">Weather Entity</div><div class="rsub">' + (c.weather_entity || 'None selected') + '</div></div>' +
        '<div class="rctrl" style="flex:1;max-width:180px;position:relative"><div class="ewrap">' + entCtrl + '</div></div>' +
      '</div>' +
      '<div class="row"><div class="rico" style="background:#FF9F0A22">\uD83C\uDF21\uFE0F</div>' +
        '<div class="rinfo"><div class="rlbl">Temperature Unit</div></div>' +
        '<div class="rctrl">' + seg('temp_unit', [['\u00B0C', '\u00B0C'], ['\u00B0F', '\u00B0F']]) + '</div></div>' +
      '<div class="row"><div class="rico" style="background:#30D15822">\uD83D\uDCA8</div>' +
        '<div class="rinfo"><div class="rlbl">Wind Speed Unit</div></div>' +
        '<div class="rctrl"><select class="sel" id="swu">' +
          '<option value="km/h"' + ((c.wind_unit || 'km/h') === 'km/h' ? ' selected' : '') + '>km/h</option>' +
          '<option value="mph"'  + (c.wind_unit === 'mph'  ? ' selected' : '') + '>mph</option>' +
          '<option value="m/s"'  + (c.wind_unit === 'm/s'  ? ' selected' : '') + '>m/s</option>' +
        '</select></div></div>' +
      '<div class="row"><div class="rico" style="background:#5E5CE622">\uD83D\uDD50</div>' +
        '<div class="rinfo"><div class="rlbl">Hourly Forecast</div><div class="rsub">Scrollable hourly strip</div></div>' +
        '<div class="rctrl">' + tog('thr', 'show_hourly', c.show_hourly !== false) + '</div></div>' +
      '<div class="row"><div class="rico" style="background:#FF375F22">\uD83D\uDCC5</div>' +
        '<div class="rinfo"><div class="rlbl">Daily Forecast</div><div class="rsub">7-day list</div></div>' +
        '<div class="rctrl">' + tog('tda', 'show_daily', c.show_daily !== false) + '</div></div>' +
      '<div class="row"><div class="rico" style="background:#FF9F0A22">\uD83D\uDCCA</div>' +
        '<div class="rinfo"><div class="rlbl">Condition Tiles</div><div class="rsub">Humidity, wind, UV, pressure\u2026</div></div>' +
        '<div class="rctrl">' + tog('tdt', 'show_details', c.show_details !== false) + '</div></div>' +
    '</div></div>' +

    '</div>';

  this._bindEd();
}

_bindEd() {
  const s = this.shadowRoot, $ = id => s.getElementById(id);

  // Accent colour
  const pick = $('cpick'), hexinp = $('hexinp'), sw = $('sw');
  if (pick) pick.oninput = e => { const v = e.target.value; if (hexinp) hexinp.value = v; if (sw) sw.style.background = v; this._set('accent_color', v); };
  if (hexinp) hexinp.onchange = e => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (sw) sw.style.background = v; if (pick) pick.value = v; this._set('accent_color', v); };

  // Text inputs
  const ipc = $('ipc'); if (ipc) ipc.onchange = e => this._set('postcode', e.target.value.trim());
  const icc = $('icc'); if (icc) icc.onchange = e => this._set('country_code', e.target.value.trim().toUpperCase());

  // Compact height
  const sch = $('sch'), schv = $('schv');
  if (sch) sch.oninput = e => { const v = +e.target.value; if (schv) schv.textContent = v + 'px'; this._set('compact_height', v); };

  // Zoom slider
  const szoom = $('szoom'), szoomv = $('szoomv');
  if (szoom) szoom.oninput = e => { const v = +e.target.value; if (szoomv) szoomv.textContent = v; this._set('zoom_level', v); };

  // Selects
  const sms = $('sms'); if (sms) sms.onchange = e => this._set('map_style', e.target.value);
  const swu = $('swu'); if (swu) swu.onchange = e => this._set('wind_unit', e.target.value);

  // Opacity
  const sop = $('sop'), sopv = $('sopv');
  if (sop) sop.oninput = e => { const v = parseFloat(e.target.value); if (sopv) sopv.textContent = v + '%'; this._set('radar_opacity', v / 100); };

  // Speed
  const ssp = $('ssp'), sspv = $('sspv');
  if (ssp) ssp.oninput = e => { const v = +e.target.value; if (sspv) sspv.textContent = v + 'ms'; this._set('animation_speed', v); };

  // Autoplay
  const tap = $('tap'); if (tap) tap.onchange = e => this._set('auto_animate', e.target.checked);

  // Toggles
  const thr = $('thr'); if (thr) thr.onchange = e => this._set('show_hourly', e.target.checked);
  const tda = $('tda'); if (tda) tda.onchange = e => this._set('show_daily', e.target.checked);
  const tdt = $('tdt'); if (tdt) tdt.onchange = e => this._set('show_details', e.target.checked);

  // Segmented controls
  s.querySelectorAll('[data-seg]').forEach(el => { el.onclick = () => this._set(el.dataset.seg, el.dataset.val); });

  // Entity search
  const einp = $('einp');
  if (einp) {
    einp.onfocus = () => { this._drop = true; this._q = einp.value; this._render(); setTimeout(() => { const i = s.getElementById('einp'); if (i) i.focus(); }, 20); };
    einp.oninput = e => { this._q = e.target.value; this._drop = true; this._render(); setTimeout(() => { const i = s.getElementById('einp'); if (i) { i.focus(); i.value = this._q; } }, 20); };
  }
  const drop = $('edrop');
  if (drop) drop.querySelectorAll('[data-eid]').forEach(item => {
    item.onmousedown = e => { e.preventDefault(); this._drop = false; this._q = ''; this._set('weather_entity', item.dataset.eid); };
  });
  const eclr = $('eclr'); if (eclr) eclr.onclick = () => this._set('weather_entity', '');
}
```

}

// ── Register ───────────────────────────────────────────────
customElements.define(‘worm-weather-card’,        WormWeatherCard);
customElements.define(‘worm-weather-card-editor’, WormWeatherCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
type:        ‘worm-weather-card’,
name:        ‘Worm Weather Card’,
description: ‘Apple-inspired weather radar + atmospheric conditions card for Home Assistant’,
preview:     true,
});

console.info(
‘%c WORM WEATHER CARD %c v’ + VERSION + ’ ’,
‘color:#fff;background:#5AC8FA;font-weight:700;border-radius:4px 0 0 4px;padding:2px 8px’,
‘color:#5AC8FA;background:#1C1C1E;font-weight:600;border-radius:0 4px 4px 0;padding:2px 8px’
);

})();
