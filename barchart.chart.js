// ============================================================================
// monitoring-raboty.chart.js - Стековый график состава по категориям
// ============================================================================
// КОНТРАКТ PROTEUS:
//   ECharts = только холст. Вся визуализация - HTML/CSS/SVG в overlay.
//   Хост = ПОСЛЕДНИЙ [_echarts_instance_]. Canvas прячем. Overlay - appendChild.
//   В САМОМ КОНЦЕ ФАЙЛА, ГЛОБАЛЬНО: option = {...} с пустым scatter.
//
// ЗАПРЕЩЕНО: backticks/template-literals, стрелочные функции, let/const,
//   document.getElementById (только overlay.querySelector), console.log в итоге.
// ОБЯЗАТЕЛЬНО: все 7 блоков ниже, в таком порядке, без перенумерации.
// ============================================================================

// ---------- БЛОК 1: CFG ----------
var CFG = {
  ns: 'mr',
  fields: {
    date_structure: 'date_structure',
    category: 'category_little_group',
    count: 'count_employee',
    duration_active: 'duration_active',
    calls: 'calls',
    avg_duration_active: 'avg_duration_active',
    avg_calls: 'avg_calls',
    color_col: 'color_col'
  },
  text: {
    noData: 'Нет данных',
    title: 'Состав по категориям',
    legendNote: 'Для включения/выключения категории нажми на легенду',
    miniActivity: 'Средняя рабочая активность, ч.',
    miniTalk: 'Средняя доля звонков, %'
  },
  mode: 'timeseries',
  colors: {
    card: '#ffffff',
    line: '#e7e9ee',
    line2: '#eef0f3',
    ink: '#1f1f1f',
    ink2: '#3a3f4a',
    muted: '#8a909c',
    act: '#5D9ACB',
    bench: '#9aa0ac',
    miniBar: '#C1CCD6',
    selected: '#f5f8ff',
    // Цвета категорий из SQL (заполняется в buildModel)
    flowTotal: '#b0bec5',
    flowOut: '#d4a5b5',
    flowIn: '#d0e4e2',
    flowMove: '#5D9ACB'
  },
  fonts: {
    family: 'Inter,Helvetica,Arial,sans-serif',
    cap: 9.5,
    note: 11.5,
    body: 12.5,
    lead: 13.5,
    head: 16,
    hero: 24
  },
  spacing: {
    s1: 2, s2: 4, s3: 6, s4: 8, s5: 10, s6: 12, s7: 14, s8: 16, s9: 20, s10: 24
  },
  radius: 12,
  legend: [
    { key: 'grey', name: 'Grey', colorKey: 'flowTotal' },
    { key: 'underwork', name: 'Недоработка', colorKey: 'flowOut' },
    { key: 'normal', name: 'Нормал', colorKey: 'flowIn' },
    { key: 'overwork', name: 'Переработка', colorKey: 'flowMove' }
  ],
  categoryMap: {
    'Grey': 'grey',
    'Недоработка': 'underwork',
    'Нормал': 'normal',
    'Переработка': 'overwork'
  }
};

// ---------- БЛОК 2: ВХОД + СОСТОЯНИЕ + ХЕЛПЕРЫ ----------
var rawData = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];

if (!window.__pvtState) window.__pvtState = {};
var __S = window.__pvtState;
if (!__S[CFG.ns]) __S[CFG.ns] = { tip: null, selected_index: -1, hidden_series: {} };
var state = __S[CFG.ns];

// Инициализация hidden_series при первом запуске
if (!state.hidden_series || Object.keys(state.hidden_series).length === 0) {
  state.hidden_series = { grey: false, underwork: false, normal: false, overwork: false };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function toDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  var s = String(raw).trim(), d = null;
  if (/^\d{11,}$/.test(s)) { var ms = Number(s); d = new Date(ms > 1e12 ? ms : ms * 1000); }
  else if (/^\d{10}$/.test(s)) d = new Date(Number(s) * 1000);
  else {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
    if (m) return { y: +m[1], m: +m[2] - 1, d: m[3] ? +m[3] : 1 };
    d = new Date(s);
  }
  if (!d || isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

function cssColor(c) {
  if (!c) return '#000';
  if (typeof c === 'string') return c;
  var a = (c.length >= 4) ? c[3] : 1;
  return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')';
}

// Форматирование чисел
var THIN = '\u2009', MINUS = '\u2212';
function ru(v, d) { return Number(v).toFixed(d).replace('.', ','); }
function signRu(v, d) { if (v > 0) return '+' + ru(v, d); if (v < 0) return MINUS + ru(Math.abs(v), d); return '0'; }
function fmt(v, unit, d) { return ru(v, d) + (unit || ''); }
function fmtDelta(v, unit, d, pp) {
  if (v === 0) return '0';
  var s = signRu(v, d);
  return pp ? s + THIN + 'п.п.' : s + (unit || '');
}

// ---------- БЛОК 3: ТРАНСФОРМАЦИЯ ДАННЫХ ----------
// Pivot: из 1 строка = категория -> 1 строка = период с 4 категориями
function buildModel() {
  if (!rawData || rawData.length === 0) return { rows: [] };

  // Группировка по period
  var byPeriod = {};
  var categoryColors = {};  // Сохраняем цвета категорий из SQL

  for (var i = 0; i < rawData.length; i++) {
    var row = rawData[i];
    var period = row[CFG.fields.date_structure];
    if (!period) continue;

    var dateObj = toDate(period);
    if (!dateObj) continue;

    // Ключ для группировки — используем dateObj для читаемого формата
    var monthStr = (dateObj.m + 1);
    if (monthStr < 10) monthStr = '0' + monthStr;
    var key = dateObj.y + '-' + monthStr + '-01';

    if (!byPeriod[key]) {
      byPeriod[key] = {
        period: key,  // Сохраняем читаемый ключ "2026-06-01"
        date: dateObj,
        grey: 0,
        underwork: 0,
        normal: 0,
        overwork: 0,
        activity: num(row[CFG.fields.duration_active]),
        talk: num(row[CFG.fields.calls]),
        avgActivity: num(row[CFG.fields.avg_duration_active]),
        avgTalk: num(row[CFG.fields.avg_calls])
      };
    }

    // Раскладываем категории по колонкам
    var catRaw = row[CFG.fields.category];
    var catKey = CFG.categoryMap[catRaw];
    if (catKey) {
      byPeriod[key][catKey] = num(row[CFG.fields.count]) || 0;
      // Сохраняем цвет категории
      if (row[CFG.fields.color_col]) {
        categoryColors[catKey] = row[CFG.fields.color_col];
      }
    }
  }

  // Применяем цвета из SQL к CFG.colors
  if (categoryColors.grey) CFG.colors.flowTotal = categoryColors.grey;
  if (categoryColors.underwork) CFG.colors.flowOut = categoryColors.underwork;
  if (categoryColors.normal) CFG.colors.flowIn = categoryColors.normal;
  if (categoryColors.overwork) CFG.colors.flowMove = categoryColors.overwork;

  // Преобразуем в массив и сортируем
  var rows = [];
  for (var k in byPeriod) {
    if (byPeriod.hasOwnProperty(k)) {
      var r = byPeriod[k];
      // Генерируем label из даты (мар, апр, май...)
      var monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      r.label = monthNames[r.date.m];
      rows.push(r);
    }
  }

  // Сортировка по period ASC
  rows.sort(function(a, b) {
    if (a.period < b.period) return -1;
    if (a.period > b.period) return 1;
    return 0;
  });

  return { rows: rows };
}

var MODEL = buildModel();

// ---------- БЛОК 4: ФОРМАТИРОВАНИЕ И ЦВЕТ ----------
function fmtInt(v) { return fmt(v, '', 0); }
function fmtOne(v) { return fmt(v, '', 1); }

function niceTop(maxV) {
  if (maxV <= 0) return 1;
  var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  var pow = Math.pow(10, Math.floor(Math.log(maxV) / Math.LN10));
  for (var s = 0; s < steps.length; s++) {
    var t = steps[s] * pow;
    if (t >= maxV) return t;
  }
  return 10 * pow;
}

function calcBarLayout(plotWidth, count, maxBarWidth, minBarWidth) {
  var bw = Math.min(maxBarWidth, plotWidth / count * 0.72);
  bw = Math.max(minBarWidth, bw);
  var gap = count > 1 ? (plotWidth - bw * count) / (count - 1) : 0;
  if (gap < 3) {
    bw = Math.max(8, Math.min(maxBarWidth, (plotWidth - 3 * (count - 1)) / count));
    gap = count > 1 ? (plotWidth - bw * count) / (count - 1) : 0;
  }
  return { bw: bw, gap: gap };
}

function getCssVar(name) {
  // Возвращает значение цвета из CFG.colors
  var map = {
    '--flow-total': CFG.colors.flowTotal,
    '--flow-out': CFG.colors.flowOut,
    '--flow-in': CFG.colors.flowIn,
    '--flow-move': CFG.colors.flowMove,
    '--mini-bar': CFG.colors.miniBar,
    '--act': CFG.colors.act
  };
  return map[name] || '#000';
}

function getCategoryColor(catKey) {
  // Возвращает цвет категории из CFG.colors
  var leg = null;
  for (var i = 0; i < CFG.legend.length; i++) {
    if (CFG.legend[i].key === catKey) {
      leg = CFG.legend[i];
      break;
    }
  }
  return leg ? CFG.colors[leg.colorKey] : '#000';
}

// ---------- БЛОК 5: РАЗМЕТКА ----------
function buildCSS() {
  var P = '.' + CFG.ns;
  var C = CFG.colors;
  var F = CFG.fonts;
  var S = CFG.spacing;

  return [
    '<style>',
    P + '-root{position:relative;padding:' + S.s2 + 'px;',
      'font-family:' + F.family + ';font-size:' + F.body + 'px;color:' + C.ink + ';',
      '-webkit-font-smoothing:antialiased;box-sizing:border-box;}',
    P + '-root *{box-sizing:border-box; outline: none;}',

    // Layout
    P + '-root .shell{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(0,1fr);gap:' + S.s5 + 'px;align-items:stretch}',
    P + '-root .panel{background:' + C.card + ';border-radius:' + CFG.radius + 'px;box-shadow:0 1px 3px rgba(20,28,45,.06),0 4px 16px rgba(20,28,45,.04);overflow:hidden}',
    P + '-root .main-panel{padding:' + S.s6 + 'px ' + S.s7 + 'px ' + S.s5 + 'px ' + S.s7 + 'px;min-height:314px}',
    P + '-root .side-col{display:grid;grid-template-rows:1fr 1fr;gap:' + S.s5 + 'px}',
    P + '-root .mini-panel{padding:' + S.s6 + 'px ' + S.s7 + 'px;min-height:152px}',

    // Topline
    P + '-root .topline{display:flex;align-items:flex-start;justify-content:space-between;gap:' + S.s5 + 'px;margin-bottom:' + S.s1 + 'px}',
    P + '-root .title-wrap{display:flex;align-items:center;gap:0;min-width:0}',
    P + '-root .title{font-size:' + F.cap + 'px;line-height:1;font-weight:700;letter-spacing:.2px;color:' + C.muted + ';text-transform:uppercase;white-space:nowrap}',
    P + '-root .mr-card-title{margin:0;font-size:' + F.head + 'px;line-height:1.15;font-weight:700;color:' + C.ink2 + '}',

    // Legend
    P + '-root .legend-col{display:flex;flex-direction:column;align-items:flex-end;gap:' + S.s2 + 'px}',
    P + '-root .legend{display:flex;gap:' + S.s8 + 'px;flex-wrap:wrap;align-items:center;justify-content:flex-end;font-size:' + F.note + 'px;color:' + C.ink2 + '}',
    P + '-root .sw{display:inline-flex;align-items:center;gap:' + S.s3 + 'px;font-weight:600;cursor:pointer;user-select:none;opacity:1;transition:opacity .15s ease}',
    P + '-root .sw.disabled{opacity:.3}',
    P + '-root .dot{width:11px;height:11px;border-radius:' + S.s1 + 'px;display:inline-block;flex:0 0 auto}',
    P + '-root .legend-note{color:' + C.muted + ';font-size:10.5px;line-height:1.18;white-space:nowrap}',

    // Charts
    P + '-root .main-chart-wrap{height:264px;margin-top:' + S.s3 + 'px}',
    P + '-root .chart-container{display:flex;align-items:flex-end;justify-content:space-around;height:100%;gap:40px}',
    P + '-root .bar-group{display:flex;flex-direction:column;align-items:center;height:100%;position:relative;flex:0 0 auto;max-width:100px}',
    P + '-root .segment-stack{position:relative;width:100%;flex:1;display:flex;align-items:flex-end}',
    P + '-root .segment{position:absolute;left:0;right:0;bottom:0}',
    P + '-root .segment.dim{opacity:.42}',
    P + '-root .segment.top{border-top-left-radius:4px;border-top-right-radius:4px}',
    P + '-root .selected-overlay{position:absolute;left:-2px;right:-2px;top:0;bottom:0;border-radius:4px;background:' + C.selected + '}',
    P + '-root .hit{position:absolute;left:0;right:0;top:0;bottom:0;cursor:pointer;transition:background .12s;z-index:2}',
    P + '-root .barg:hover .hit{background:rgba(93,154,203,.05)}',
    P + '-root .barg:hover .segment{filter:brightness(1.06) saturate(1.2)}',
    P + '-root .xlab{margin-top:' + S.s2 + 'px;font-size:' + F.cap + 'px;color:' + C.muted + ';font-weight:400;text-align:center;white-space:nowrap}',

    // Mini bars
    P + '-root .mini-chart-container{display:flex;align-items:flex-end;justify-content:space-around;height:100%;gap:40px}',
    P + '-root .mini-bar-group{display:flex;flex-direction:column;align-items:center;height:100%;flex:0 0 auto;max-width:100px}',
    P + '-root .mini-bar{width:100%;border-radius:2px}',
    P + '-root .mini-bar.dim{opacity:.42}',
    P + '-root .minibarg:hover .mini-bar{filter:brightness(1.06) saturate(1.2)}',
    P + '-root .minibarg:hover .hit{background:rgba(93,154,203,.05)}',
    P + '-root .mini-lab{margin-top:' + S.s2 + 'px;font-size:' + F.cap + 'px;color:' + C.muted + ';font-weight:400;text-align:center;white-space:nowrap}',
    P + '-root .mini-top-val{margin-bottom:5px;font-size:' + F.note + 'px;color:#2b2b2b;font-weight:800;text-align:center}',

    // Mini grid
    P + '-root .mini-grid{display:grid;grid-template-columns:105px minmax(0,1fr);align-items:stretch;gap:0;margin-top:' + S.s2 + 'px;min-height:111px}',
    P + '-root .summary{border-right:1px solid ' + C.line2 + ';padding:' + S.s3 + 'px ' + S.s7 + 'px 0 0;display:flex;flex-direction:column;justify-content:center;gap:' + S.s6 + 'px}',
    P + '-root .summary-value{font-size:' + F.hero + 'px;line-height:1.05;font-weight:800;color:' + C.ink + ';letter-spacing:-.5px;font-variant-numeric:tabular-nums}',
    P + '-root .summary-caption{margin-top:' + S.s2 + 'px;font-size:10.5px;line-height:1.18;color:' + C.muted + '}',
    P + '-root .mini-area{padding-left:' + S.s7 + 'px;display:flex;align-items:center}',
    P + '-root .mini-wrap{width:100%;height:104px}',

    // Tooltip
    P + '-tip{font-family:' + F.family + ';position:fixed;z-index:400;pointer-events:none;opacity:0;transform:translateY(3px);',
      'transition:opacity .11s ease-out,transform .11s ease-out;',
      'background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:' + S.s3 + 'px;',
      'box-shadow:0 10px 30px rgba(24,33,50,.18),0 2px 6px rgba(24,33,50,.08);',
      'padding:9px 12px;font-size:' + F.body + 'px;line-height:1.45;color:' + C.ink2 + ';font-weight:600;',
      'min-width:148px;max-width:300px;white-space:normal}',
    P + '-tip.on{opacity:1;transform:none}',
    P + '-tip .t-h{display:block;font-size:' + F.cap + 'px;font-weight:700;letter-spacing:.2px;color:' + C.muted + ';margin-bottom:6px}',
    P + '-tip .t-r{display:flex;align-items:center;gap:8px;margin-top:4px}',
    P + '-tip .t-r:first-child{margin-top:0}',
    P + '-tip .t-sep{display:block;height:1px;background:#c0c5ce;margin:6px 0}',
    P + '-tip .t-m{display:inline-block;flex:0 0 auto;width:10px;height:9px;border-radius:' + S.s1 + 'px}',
    P + '-tip .t-l{font-size:' + F.note + 'px;font-weight:700;color:' + C.muted + ';min-width:0}',
    P + '-tip .t-v{display:inline;margin:0 0 0 auto;font-size:' + F.lead + 'px;font-weight:800;color:' + C.ink + ';white-space:nowrap;font-variant-numeric:tabular-nums}',
    P + '-tip .t-r.bench .t-v{color:' + C.ink + ';font-weight:800}',
    P + '-tip .t-n{display:block;font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';margin-top:5px}',
    P + '-tip .t-r+.t-n{margin-top:8px;padding-top:7px;border-top:1px solid ' + C.line2 + '}',

    // Focus
    P + '-root .sw:focus-visible,' + P + '-root .hit:focus-visible{outline:3px solid rgba(43,108,255,.32);outline-offset:2px}',

    // Responsive
    '@media (max-width:1100px){' + P + '-root .shell{grid-template-columns:1fr}}',
    '@media (max-width:760px){' + P + '-root .mini-grid{grid-template-columns:1fr}' + P + '-root .summary{border-right:0;border-bottom:1px solid ' + C.line2 + ';padding:2px 0 12px 0;margin-bottom:10px}' + P + '-root .mini-area{padding-left:0}' + P + '-root .legend-note{white-space:normal;text-align:right}}',
    '@media (prefers-reduced-motion:reduce){' + P + '-root *,' + P + '-root *:before,' + P + '-root *:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}',
    '</style>'
  ].join('');
}

function buildHTML() {
  var P = '.' + CFG.ns;
  var T = CFG.text;

  if (!MODEL.rows || MODEL.rows.length === 0) {
    return buildCSS() + '<div class="' + CFG.ns + '-root">' + esc(T.noData) + '</div>';
  }

  var h = [];
  h.push('<div class="' + CFG.ns + '-root">');
  h.push('<div class="shell">');

  // Левая панель
  h.push('<div class="panel main-panel">');
  h.push('<div class="topline">');
  h.push('<div class="title-wrap"><h1 class="mr-card-title">' + esc(T.title) + '</h1></div>');
  h.push('<div class="legend-col">');
  h.push('<div class="legend" id="' + CFG.ns + '-legend">');

  // Легенда
  for (var i = 0; i < CFG.legend.length; i++) {
    var leg = CFG.legend[i];
    var isHidden = state.hidden_series[leg.key];
    h.push('<span class="sw' + (isHidden ? ' disabled' : '') + '" data-series="' + esc(leg.key) + '"><span class="dot" style="background:' + getCategoryColor(leg.key) + '"></span>' + esc(leg.name) + '</span>');
  }

  h.push('</div>');
  h.push('<div class="legend-note">' + esc(T.legendNote) + '</div>');
  h.push('</div>');
  h.push('</div>');
  h.push('<div class="main-chart-wrap"><div class="chart-container" id="' + CFG.ns + '-chart-main"></div></div>');
  h.push('</div>');

  // Правая панель
  h.push('<div class="side-col">');

  // Мини-график 1: активность
  h.push('<div class="panel mini-panel">');
  h.push('<div class="title-wrap"><h2 class="mr-card-title">' + esc(T.miniActivity) + '</h2></div>');
  h.push('<div class="mini-grid">');
  h.push('<div class="summary" id="' + CFG.ns + '-summary-activity"></div>');
  h.push('<div class="mini-area"><div class="mini-wrap"><div class="chart-container" id="' + CFG.ns + '-chart-activity"></div></div></div>');
  h.push('</div>');
  h.push('</div>');

  // Мини-график 2: звонки
  h.push('<div class="panel mini-panel">');
  h.push('<div class="title-wrap"><h2 class="mr-card-title">' + esc(T.miniTalk) + '</h2></div>');
  h.push('<div class="mini-grid">');
  h.push('<div class="summary" id="' + CFG.ns + '-summary-talk"></div>');
  h.push('<div class="mini-area"><div class="mini-wrap"><div class="chart-container" id="' + CFG.ns + '-chart-talk"></div></div></div>');
  h.push('</div>');
  h.push('</div>');

  h.push('</div>');
  h.push('</div>');
  h.push('</div>');

  return buildCSS() + h.join('');
}

// ---------- БЛОК 6: МОНТАЖ + ИНТЕРАКТИВ ----------

function visibleTotal(i) {
  var row = MODEL.rows[i];
  var t = 0;
  for (var j = 0; j < CFG.legend.length; j++) {
    var key = CFG.legend[j].key;
    if (!state.hidden_series[key]) t += row[key];
  }
  return t;
}

function compositionRows(i) {
  var row = MODEL.rows[i];
  var rows = [];
  for (var j = 0; j < CFG.legend.length; j++) {
    var leg = CFG.legend[j];
    if (state.hidden_series[leg.key]) continue;
    rows.push({ label: leg.name, value: fmtInt(row[leg.key]), color: getCategoryColor(leg.key) });
  }
  return rows;
}

function formatDate(periodStr) {
  // periodStr = "2026-06-01" → "июнь 2026"
  var months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var m = /^(\d{4})-(\d{2})/.exec(String(periodStr));
  if (m) {
    var year = m[1];
    var monthIdx = parseInt(m[2], 10) - 1;
    return months[monthIdx] + ' ' + year;
  }
  return String(periodStr);
}

// ---------- БЛОК 6: МОНТАЖ + ИНТЕРАКТИВ (продолжение) ----------
// renderMain и renderMini определены внутри mount() для общей области видимости с render()

(function mount() {
  try {
    // Сброс состояния при каждом запуске (Proteus может запускать скрипт несколько раз)
    state.selected_index = -1;
    state.tip = null;
    state.tipTarget = null;

    var hosts = document.querySelectorAll('[_echarts_instance_]');
    if (!hosts || hosts.length === 0) return;
    var host = hosts[hosts.length - 1];
    var cvs = host.querySelectorAll('canvas');
    for (var i = 0; i < cvs.length; i++) cvs[i].style.display = 'none';
    var prev = host.querySelector('.' + CFG.ns + '-overlay');
    if (prev) prev.parentNode.removeChild(prev);

    var overlay = document.createElement('div');
    overlay.className = CFG.ns + '-overlay';
    overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:10;background:transparent;overflow:auto;box-sizing:border-box;';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(overlay);

    // Тултип
    var tipEl = null;
    function getTip() {
      if (tipEl && tipEl.parentNode) return tipEl;
      var old = document.querySelector('body > .' + CFG.ns + '-tip');
      if (old) old.parentNode.removeChild(old);
      tipEl = document.createElement('div');
      tipEl.className = CFG.ns + '-tip';
      document.body.appendChild(tipEl);
      return tipEl;
    }
    getTip();

    function renderTip() {
      var tip = getTip();
      if (!tip) return;
      if (!state.tip) { tip.style.opacity = '0'; return; }
      tip.innerHTML = state.tip;
      var rect = state.tipTarget ? state.tipTarget.getBoundingClientRect() : null;
      if (rect) {
        var w = tip.offsetWidth || 220, h = tip.offsetHeight || 60;
        var l = rect.left + 16, t = rect.top - h - 14;
        if (l + w > window.innerWidth - 10) l = rect.left - w - 16;
        if (l < 10) l = 10;
        if (t < 10) t = rect.top + 20;
        tip.style.left = Math.round(l) + 'px';
        tip.style.top = Math.round(t) + 'px';
      }
      tip.style.opacity = '1';
    }

    function hideTip() {
      state.tip = null;
      state.tipTarget = null;
      renderTip();
    }

    // ========== renderMain ==========
    function renderMain(overlay, setupHitHandlers) {
      var container = overlay.querySelector('#' + CFG.ns + '-chart-main');
      if (!container) return;

      container.innerHTML = '';
      container.className = 'chart-container';

      var maxT = 1;
      for (var i = 0; i < MODEL.rows.length; i++) maxT = Math.max(maxT, visibleTotal(i));
      var top = niceTop(maxT);
      var chartH = container.getBoundingClientRect().height || 240;
      var barMaxH = chartH - 24;

      for (var i = 0; i < MODEL.rows.length; i++) {
        var row = MODEL.rows[i];
        var g = document.createElement('div');
        g.className = 'bar-group';
        g.style.flex = '1 1 auto';

        // selected-overlay добавляем ПЕРЕД stackContainer, чтобы сегменты были НАД ним
        if (state.selected_index === i) {
          var overlayRect = document.createElement('div');
          overlayRect.className = 'selected-overlay';
          g.appendChild(overlayRect);
        }

        var stackContainer = document.createElement('div');
        stackContainer.className = 'segment-stack';

        var stack = 0;
        var visibleCount = 0;
        // Сначала считаем количество видимых сегментов
        for (var j = 0; j < CFG.legend.length; j++) {
          var leg = CFG.legend[j];
          if (!state.hidden_series[leg.key]) visibleCount++;
        }
        var segIndex = 0;
        for (var j = 0; j < CFG.legend.length; j++) {
          var leg = CFG.legend[j];
          if (state.hidden_series[leg.key]) continue;
          var val = row[leg.key];
          var sh = (val / top) * barMaxH;
          var fill = getCategoryColor(leg.key);
          var isDim = state.selected_index !== -1 && state.selected_index !== i;
          var isTop = segIndex === visibleCount - 1;
          var seg = document.createElement('div');
          seg.className = 'segment' + (isDim ? ' dim' : '') + (isTop ? ' top' : '');
          seg.style.height = sh + 'px';
          seg.style.bottom = stack + 'px';
          seg.style.backgroundColor = fill;
          seg.setAttribute('data-s', leg.key);
          stackContainer.appendChild(seg);
          stack += sh;
          segIndex++;
        }

        g.appendChild(stackContainer);

        var rows = compositionRows(i);
        rows.push({ label: 'Итого за месяц', value: fmtInt(visibleTotal(i)), bench: true, separator: true });
        var hit = document.createElement('div');
        hit.className = 'hit';
        hit.setAttribute('tabindex', '0');
        var tipHtml = '<span class="t-h">' + esc(formatDate(row.period)) + '</span>';
        for (var ri = 0; ri < rows.length; ri++) {
          var r = rows[ri];
          if (r.separator) {
            tipHtml += '<span class="t-sep"></span>';
          }
          var mk = r.color ? '<i class="t-m" style="background:' + r.color + '"></i>' : '';
          tipHtml += '<span class="t-r' + (r.bench ? ' bench' : '') + '">' + mk +
            '<span class="t-l">' + esc(r.label) + '</span>' +
            '<b class="t-v">' + esc(r.value) + '</b></span>';
        }
        (function(barIndex, hitEl, tipData) {
          setupHitHandlers(hitEl, tipData, barIndex);
        })(i, hit, tipHtml);
        g.appendChild(hit);

        var lab = document.createElement('div');
        lab.className = 'xlab';
        lab.textContent = row.label;
        g.appendChild(lab);

        container.appendChild(g);
      }
    }

    // ========== renderMini ==========
    function renderMini(overlay, chartId, summaryId, metricKey, unit, dec, metricLabel, avgOverride, defaultLast, setupHitHandlers) {
      var container = overlay.querySelector('#' + chartId);
      var summary = overlay.querySelector('#' + summaryId);
      if (!container || !summary) return;

      var maxV = 1, sum = 0;
      for (var i = 0; i < MODEL.rows.length; i++) {
        maxV = Math.max(maxV, MODEL.rows[i][metricKey]);
        sum += MODEL.rows[i][metricKey];
      }
      var top = niceTop(maxV);
      var avg = avgOverride !== null ? avgOverride : (sum / MODEL.rows.length);
      var lastIdx = state.selected_index !== -1 ? state.selected_index : MODEL.rows.length - 1;
      var lastVal = state.selected_index !== -1 ? MODEL.rows[lastIdx][metricKey] : defaultLast;

      summary.innerHTML =
        '<div><div class="summary-value">' + fmt(lastVal, unit, dec) + '</div>' +
        '<div class="summary-caption">на последний<br>период</div></div>' +
        '<div><div class="summary-value">' + fmt(avg, unit, dec) + '</div>' +
        '<div class="summary-caption">среднее за период</div></div>';

      container.innerHTML = '';
      container.className = 'mini-chart-container';

      var chartH = container.getBoundingClientRect().height || 86;
      var labelH = 20; // высота подписи значения
      var barMaxH = chartH - 24 - labelH;
      var barVar = CFG.colors.miniBar;
      var selVar = CFG.colors.act;

      for (var i = 0; i < MODEL.rows.length; i++) {
        var row = MODEL.rows[i];
        var value = row[metricKey];
        var bh = (value / top) * barMaxH;
        var isDim = state.selected_index !== -1 && state.selected_index !== i;
        var isSel = state.selected_index === i;

        var g = document.createElement('div');
        g.className = 'mini-bar-group';
        g.style.flex = '1 1 auto';

        var barContainer = document.createElement('div');
        barContainer.className = 'segment-stack';
        barContainer.style.width = '100%';
        barContainer.style.flex = '1';
        barContainer.style.position = 'relative';
        barContainer.style.display = 'flex';
        barContainer.style.flexDirection = 'column';
        barContainer.style.justifyContent = 'flex-end';
        barContainer.style.alignItems = 'center';

        var lbl = document.createElement('div');
        lbl.className = 'mini-top-val' + (isDim ? ' dim' : '');
        lbl.textContent = ru(value, dec);
        barContainer.appendChild(lbl);

        var bar = document.createElement('div');
        bar.className = 'mini-bar' + (isDim ? ' dim' : '');
        bar.style.height = bh + 'px';
        bar.style.backgroundColor = isSel ? selVar : barVar;
        bar.setAttribute('data-s', metricKey);
        barContainer.appendChild(bar);

        var prev = i > 0 ? MODEL.rows[i - 1][metricKey] : null;
        var deltaRow = prev === null
          ? { label: 'Δ к прошлому', value: 'нет базы', bench: true }
          : { label: 'Δ к прошлому', value: fmtDelta(value - prev, unit, dec, metricKey === 'talk'), bench: true };

        var hit = document.createElement('div');
        hit.className = 'hit';
        hit.setAttribute('tabindex', '0');
        var tipHtml = '<span class="t-h">' + esc(formatDate(row.period)) + '</span>';
        tipHtml += '<span class="t-r"><i class="t-m" style="background:' + barVar + '"></i>' +
          '<span class="t-l">' + esc(metricLabel) + '</span>' +
          '<b class="t-v">' + esc(fmt(value, unit, dec)) + '</b></span>';
        tipHtml += '<span class="t-r bench"><span class="t-l">' + esc(deltaRow.label) + '</span>' +
          '<b class="t-v">' + esc(deltaRow.value) + '</b></span>';
        (function(barIndex, hitEl, tipData) {
          setupHitHandlers(hitEl, tipData, barIndex);
        })(i, hit, tipHtml);
        barContainer.appendChild(hit);

        g.appendChild(barContainer);

        var lab = document.createElement('div');
        lab.className = 'mini-lab';
        lab.textContent = row.label;
        g.appendChild(lab);

        container.appendChild(g);
      }
    }

    function selectIndex(i) {
      state.selected_index = state.selected_index === i ? -1 : i;
      render();
    }

    function render() {
      overlay.innerHTML = buildHTML();
      
      // Setup legend handlers
      var legendItems = overlay.querySelectorAll('.legend .sw');
      for (var i = 0; i < legendItems.length; i++) {
        (function(item) {
          var key = item.getAttribute('data-series');
          item.setAttribute('tabindex', '0');
          item.setAttribute('role', 'button');
          function toggle() {
            var visibleCount = 0;
            for (var k in state.hidden_series) if (!state.hidden_series[k]) visibleCount++;
            if (!state.hidden_series[key] && visibleCount <= 1) return;
            state.hidden_series[key] = !state.hidden_series[key];
            render();
          }
          item.addEventListener('click', toggle);
          item.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
          });
        })(legendItems[i]);
      }

      // Вспомогательная функция для обработчиков
      function setupHitHandlers(hit, tipData, idx) {
        if (hit.setAttributeNS) {
          hit.setAttributeNS(null, 'data-tip', tipData);
        } else {
          hit.setAttribute('data-tip', tipData);
        }
        hit.addEventListener('click', function() { selectIndex(idx); });
        hit.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectIndex(idx); }
        });
        hit.addEventListener('mouseenter', function() {
          var tipHtml = hit.getAttributeNS ? hit.getAttributeNS(null, 'data-tip') : hit.getAttribute('data-tip');
          if (tipHtml) { state.tip = tipHtml; state.tipTarget = hit; renderTip(); }
        });
        hit.addEventListener('mouseleave', function() {
          state.tip = null; state.tipTarget = null; renderTip();
        });
      }
      
      renderMain(overlay, setupHitHandlers);
      // Берём avgActivity и avgTalk из первой строки (среднее за всё время одинаково)
      var avgAct = MODEL.rows && MODEL.rows.length > 0 ? MODEL.rows[0].avgActivity : 8.0;
      var avgTalk = MODEL.rows && MODEL.rows.length > 0 ? MODEL.rows[0].avgTalk : 18.8;
      var lastAct = MODEL.rows && MODEL.rows.length > 0 ? MODEL.rows[MODEL.rows.length - 1].activity : 7.9;
      var lastTalk = MODEL.rows && MODEL.rows.length > 0 ? MODEL.rows[MODEL.rows.length - 1].talk : 20.0;
      renderMini(overlay, CFG.ns + '-chart-activity', CFG.ns + '-summary-activity', 'activity', THIN + 'ч.', 1, 'Средняя рабочая активность', avgAct, lastAct, setupHitHandlers);
      renderMini(overlay, CFG.ns + '-chart-talk', CFG.ns + '-summary-talk', 'talk', '%', 1, 'Средняя доля звонков', avgTalk, lastTalk, setupHitHandlers);
    }

    render();

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function() {
        overlay.style.width = '100%';
        overlay.style.height = '100%';
      });
      ro.observe(host);
    }
  } catch (e) {
    if (typeof option !== 'undefined' && option) {
      option.graphic = [{ type: 'text', style: { text: 'Ошибка графика: ' + (e.message || e), x: 20, y: 20, fontSize: 14 } }];
    }
  }
})();

// ---------- БЛОК 7: ПУСТОЙ OPTION ----------
option = {
  animation: false,
  xAxis: { show: false, type: 'value' },
  yAxis: { show: false, type: 'value' },
  series: [{ type: 'scatter', data: [] }]
};
