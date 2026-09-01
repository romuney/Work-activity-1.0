// ============================================================================
// monitoring-raboty.chart.js - KPI-карточки (timeseries по неделям)
// ============================================================================
// КОНТРАКТ PROTEUS:
//   ECharts = только холст. Вся визуализация - HTML/CSS/SVG в overlay.
//   Хост = ПОСЛЕДНИЙ [_echarts_instance_]. Canvas прячем. Overlay - appendChild.
//   В САМОМ КОНЦЕ ФАЙЛА, ГЛОБАЛЬНО: option = {...} с пустым scatter.
//
// ЗАПРЕЩЕНО: backticks/template-literals, стрелочные функции, let/const,
//   document.getElementById (только overlay.querySelector), console.log в итоге.
// ОБЯЗАТЕЛЬНО: все 6 блоков ниже, в таком порядке, без перенумерации.
// ============================================================================

// ---------- БЛОК 1: CFG ----------
var CFG = {
  ns: 'mr',
  fields: {
    week_dt: 'week_dt',
    cnt_emp_low: 'cnt_emp_low',
    prev_cnt_emp_low: 'prev_cnt_emp_low',
    cnt_emp_fresh_low: 'cnt_emp_fresh_low',
    cnt_emp_long_low: 'cnt_emp_long_low',
    cnt_emp_high: 'cnt_emp_high',
    prev_cnt_emp_high: 'prev_cnt_emp_high',
    cnt_emp_fresh_high: 'cnt_emp_fresh_high',
    cnt_emp_long_high: 'cnt_emp_long_high',
    cnt_emp_talk: 'cnt_emp_talk',
    prev_cnt_emp_talk: 'prev_cnt_emp_talk',
    cnt_emp_fresh_talk: 'cnt_emp_fresh_talk',
    cnt_emp_long_talk: 'cnt_emp_long_talk',
    cnt_emp_leave: 'cnt_emp_leave',
    cnt_emp_fresh_leave: 'cnt_emp_fresh_leave',
    cnt_emp_long_leave: 'cnt_emp_long_leave',
    cnt_emp_weekend: 'cnt_emp_weekend',
    cnt_emp_fresh_weekend: 'cnt_emp_fresh_weekend',
    cnt_emp_long_weekend: 'cnt_emp_long_weekend'
  },
  mode: 'timeseries',
  text: {
    noData: 'Нет данных',
    caption: 'Присутствие в этой категории'
  },
  colors: {
    bg: 'transparent',
    card: '#ffffff',
    line: '#e7e9ee',
    line2: '#eef0f3',
    ink: '#1f1f1f',
    ink2: '#3a3f4a',
    muted: '#8a909c',
    muted2: '#aab0bb',
    green: '#12b048',
    greenBg: '#bff2cd',
    greenTx: '#0a8f3c',
    red: '#f51f1f',
    redBg: '#ffcccc',
    redTx: '#d11414',
    warn: '#f59300',
    warnBg: '#ffe6a0',
    warnTx: '#9a6500',
    blue: '#3b6fe0',
    blueBg: '#eef3fe',
    act: '#2b6cff',
    ai: '#6f4ed8',
    aiBg: '#f2eefc',
    aiTx: '#5334c4',
    bench: '#9aa0ac'
  },
  fonts: {
    family: 'Inter, Helvetica, Arial, sans-serif',
    fsMicro: '9.5px',
    fsCap: '10.5px',
    fsNote: '11.5px',
    fsBody: '12.5px',
    fsLead: '13.5px',
    fsHead: '16px',
    fsHero: '24px'
  },
  spacing: {
    s1: '2px',
    s2: '4px',
    s3: '6px',
    s4: '8px',
    s5: '10px',
    s6: '12px',
    s7: '14px',
    s8: '16px',
    s9: '20px',
    s10: '24px',
    r1: '3px',
    r2: '6px',
    r3: '9px',
    r4: '12px',
    r5: '16px',
    rPill: '999px',
    headH: '51px',
    chartGap: '26px'
  },
  metrics: [
    {
      key: 'cnt_emp_low',
      shortKey: 'cnt_emp_fresh_low',
      longKey: 'cnt_emp_long_low',
      deltaKey: 'delta_low',
      title: 'Недоработка',
      positiveWhen: 'down',
      detailMode: 'weeks',
      showDelta: true
    },
    {
      key: 'cnt_emp_high',
      shortKey: 'cnt_emp_fresh_high',
      longKey: 'cnt_emp_long_high',
      deltaKey: 'delta_high',
      title: 'Переработка',
      positiveWhen: 'down',
      detailMode: 'weeks',
      showDelta: true
    },
    {
      key: 'cnt_emp_talk',
      midKey: 'cnt_emp_fresh_talk',
      highKey: 'cnt_emp_long_talk',
      deltaKey: 'delta_talk',
      title: '% звонков в talk',
      positiveWhen: 'down',
      detailMode: 'talk',
      showDelta: true
    },
    {
      key: 'cnt_emp_leave',
      shortKey: 'cnt_emp_fresh_leave',
      longKey: 'cnt_emp_long_leave',
      title: 'Прогул',
      positiveWhen: 'down',
      detailMode: 'days',
      showDelta: false
    },
    {
      key: 'cnt_emp_weekend',
      shortKey: 'cnt_emp_fresh_weekend',
      longKey: 'cnt_emp_long_weekend',
      title: 'Работа в вых',
      positiveWhen: 'down',
      detailMode: 'days',
      showDelta: false
    }
  ]
};

// ---------- БЛОК 2: ВХОД + СОСТОЯНИЕ + ХЕЛПЕРЫ ----------
var rawData = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];

if (!window.__pvtState) window.__pvtState = {};
var __S = window.__pvtState;
if (!__S[CFG.ns]) __S[CFG.ns] = { selected_index: 0 };
var state = __S[CFG.ns];

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

// ---------- БЛОК 3: ТРАНСФОРМАЦИЯ ДАННЫХ ----------
function buildModel() {
  var rows = [];
  for (var i = 0; i < rawData.length; i++) {
    var row = rawData[i];
    rows.push({
      week_dt: row[CFG.fields.week_dt],
      cnt_emp_low: num(row[CFG.fields.cnt_emp_low]),
      delta_low: num(row[CFG.fields.prev_cnt_emp_low]),
      cnt_emp_fresh_low: num(row[CFG.fields.cnt_emp_fresh_low]),
      cnt_emp_long_low: num(row[CFG.fields.cnt_emp_long_low]),
      cnt_emp_high: num(row[CFG.fields.cnt_emp_high]),
      delta_high: num(row[CFG.fields.prev_cnt_emp_high]),
      cnt_emp_fresh_high: num(row[CFG.fields.cnt_emp_fresh_high]),
      cnt_emp_long_high: num(row[CFG.fields.cnt_emp_long_high]),
      cnt_emp_talk: num(row[CFG.fields.cnt_emp_talk]),
      delta_talk: num(row[CFG.fields.prev_cnt_emp_talk]),
      cnt_emp_fresh_talk: num(row[CFG.fields.cnt_emp_fresh_talk]),
      cnt_emp_long_talk: num(row[CFG.fields.cnt_emp_long_talk]),
      cnt_emp_leave: num(row[CFG.fields.cnt_emp_leave]),
      cnt_emp_fresh_leave: num(row[CFG.fields.cnt_emp_fresh_leave]),
      cnt_emp_long_leave: num(row[CFG.fields.cnt_emp_long_leave]),
      cnt_emp_weekend: num(row[CFG.fields.cnt_emp_weekend]),
      cnt_emp_fresh_weekend: num(row[CFG.fields.cnt_emp_fresh_weekend]),
      cnt_emp_long_weekend: num(row[CFG.fields.cnt_emp_long_weekend])
    });
  }
  rows.sort(function(a, b) {
    return String(b.week_dt).localeCompare(String(a.week_dt));
  });
  if (state.selected_index === undefined || state.selected_index >= rows.length) {
    state.selected_index = 0;
  }
  return { rows: rows };
}

var MODEL = buildModel();

function getSelectedRecord() {
  if (!MODEL.rows || MODEL.rows.length === 0) return null;
  return MODEL.rows[state.selected_index];
}

// ---------- БЛОК 4: ФОРМАТИРОВАНИЕ И ЦВЕТ ----------
function formatInt(value) {
  var rounded = Math.round(value);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatValue(value, isPercent) {
  if (isPercent) {
    return Number(value).toFixed(1).replace('.', ',') + '%';
  }
  return formatInt(value);
}

function formatDelta(delta, isPercent) {
  if (isPercent) {
    var sign = delta > 0 ? '+' : delta < 0 ? '−' : '0';
    var abs = Math.abs(delta).toFixed(1).replace('.', ',');
    return (delta === 0 ? '0,0' : sign + abs) + ' п.п.';
  }
  if (delta === 0) {
    return '0';
  }
  return (delta > 0 ? '+' : '−') + formatInt(Math.abs(delta));
}

function getStatus(metric, delta) {
  if (!metric.showDelta || delta === 0) {
    return 'neutral';
  }
  if (metric.positiveWhen === 'down') {
    return delta < 0 ? 'good' : 'bad';
  }
  return delta > 0 ? 'good' : 'bad';
}

function getArrow(metric, delta) {
  if (!metric.showDelta || delta === 0) {
    return '•';
  }
  if (delta > 0) {
    return '▲';
  }
  if (delta < 0) {
    return '▼';
  }
  return '•';
}

function cssColor(c) {
  if (!c) return '#000';
  if (typeof c === 'string') return c;
  var a = (c.length >= 4) ? c[3] : 1;
  return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')';
}

// ---------- БЛОК 5: РАЗМЕТКА (<style> + HTML) ----------
function buildCSS() {
  var P = '.' + CFG.ns;
  var c = CFG.colors;
  var f = CFG.fonts;
  var s = CFG.spacing;
  return [
    '<style>',
    P + '-root{width:100%;height:100%;box-sizing:border-box;',
    'font-family:' + f.family + ';font-size:14px;color:' + c.ink + ';',
    '-webkit-font-smoothing:antialiased;background:' + c.bg + ';}',
    P + '-root *{box-sizing:border-box;font-family:inherit;}',
    P + '-widget-shell{width:100%;}',
    P + '-cards-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:' + s.s6 + ';align-items:stretch;}',
    P + '-kpi-card{background:' + c.card + ';border:1px solid ' + c.line + ';border-radius:' + s.r4 + ';padding:' + s.s6 + ';display:flex;flex-direction:column;cursor:default;min-height:200px;}',
    P + '-card-head{margin-bottom:' + s.s3 + ';}',
    P + '-card-title{margin:0;font-size:' + f.fsHead + ';line-height:1.15;font-weight:700;color:' + c.ink2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    P + '-kpi-value-wrap{margin-top:' + s.s2 + ';margin-bottom:' + s.s3 + ';}',
    P + '-kpi-value{font-size:' + f.fsHero + ';line-height:1;font-weight:800;color:' + c.ink + ';letter-spacing:-0.02em;margin-bottom:' + s.s2 + ';white-space:nowrap;}',
    P + '-kpi-total{font-size:' + f.fsCap + ';color:' + c.muted + ';font-weight:700;white-space:nowrap;}',
    P + '-compose-title{font-size:' + f.fsCap + ';color:' + c.muted + ';font-weight:700;margin:' + s.s5 + ' 0 ' + s.s3 + ' 0;text-transform:uppercase;letter-spacing:0.02em;visibility:hidden;margin-top:auto;}',
    P + '-compose-title.is-visible{visibility:visible;}',
    P + '-details-container{display:grid;grid-template-columns:1fr auto;gap:' + s.s3 + ';align-items:center;}',
    P + '-detail-row{display:contents;}',
    P + '-detail-value{font-size:' + f.fsLead + ';font-weight:700;color:' + c.ink + ';white-space:nowrap;}',
    P + '-detail-label{font-size:' + f.fsNote + ';color:' + c.muted + ';font-weight:600;text-align:right;white-space:nowrap;}',
    P + '-delta-row{display:flex;align-items:center;gap:' + s.s3 + ';margin-top:' + s.s2 + ';}',
    P + '-delta-badge{display:inline-flex;align-items:center;gap:' + s.s2 + ';font-size:' + f.fsNote + ';line-height:1;font-weight:700;padding:4px 8px;border-radius:' + s.r2 + ';white-space:nowrap;}',
    P + '-delta-badge.is-good{color:' + c.greenTx + ';background:' + c.greenBg + ';}',
    P + '-delta-badge.is-bad{color:' + c.redTx + ';background:' + c.redBg + ';}',
    P + '-delta-badge.is-neutral{color:' + c.muted + ';background:#f3f4f6;}',
    P + '-delta-icon{font-size:10px;line-height:1;width:10px;text-align:center;}',
    P + '-tip{position:fixed;z-index:99999;pointer-events:none;opacity:0;font-family:' + f.family + ';box-sizing:border-box;transition:opacity .08s;}',
    '</style>'
  ].join('');
}

function buildHTML() {
  if (!MODEL.rows || MODEL.rows.length === 0) {
    return buildCSS() + '<div class="' + CFG.ns + '-root">' + esc(CFG.text.noData) + '</div>';
  }
  var current = getSelectedRecord();
  var h = [];
  h.push('<div class="' + CFG.ns + '-root">');
  h.push('<div class="' + CFG.ns + '-widget-shell">');
  h.push('<div class="' + CFG.ns + '-cards-grid">');
  for (var i = 0; i < CFG.metrics.length; i++) {
    var metric = CFG.metrics[i];
    var currVal = current[metric.key];
    var delta = 0;
    var hasDelta = false;
    if (metric.showDelta && metric.deltaKey && current[metric.deltaKey] !== null) {
      delta = current[metric.deltaKey];
      hasDelta = true;
    }
    var status = (hasDelta && delta !== 0) ? getStatus(metric, delta) : 'neutral';
    h.push('<div class="' + CFG.ns + '-kpi-card">');
    h.push('<div class="' + CFG.ns + '-card-head">');
    h.push('<h3 class="' + CFG.ns + '-card-title">' + esc(metric.title) + '</h3>');
    h.push('</div>');
    h.push('<div class="' + CFG.ns + '-kpi-value-wrap">');
    h.push('<div class="' + CFG.ns + '-kpi-value">' + esc(formatValue(currVal, false)) + '</div>');
    h.push('<div class="' + CFG.ns + '-kpi-total">' + esc(metric.key === 'cnt_emp_talk' ? '20-30% от рабочего времени' : 'всего') + '</div>');
    h.push('</div>');
    if (hasDelta) {
      h.push('<div class="' + CFG.ns + '-delta-row">');
      h.push('<div class="' + CFG.ns + '-delta-badge is-' + status + '">');
      h.push('<span class="' + CFG.ns + '-delta-icon">' + esc(getArrow(metric, delta)) + '</span>');
      h.push('<span>' + esc(formatDelta(delta, false)) + '</span>');
      h.push('</div>');
      h.push('</div>');
    }
    h.push('<div class="' + CFG.ns + '-compose-title' + (metric.key !== 'cnt_emp_talk' ? ' is-visible' : '') + '">Состав категории</div>');
    h.push('<div class="' + CFG.ns + '-details-container">');
    if (metric.detailMode === 'talk') {
      h.push('<div class="' + CFG.ns + '-detail-value">' + esc(formatInt(current[metric.midKey])) + '</div>');
      h.push('<div class="' + CFG.ns + '-detail-label">30-50% от рабочего времени</div>');
      h.push('<div class="' + CFG.ns + '-detail-value">' + esc(formatInt(current[metric.highKey])) + '</div>');
      h.push('<div class="' + CFG.ns + '-detail-label">более 50% от рабочего времени</div>');
    } else {
      var labelShort = metric.detailMode === 'days' ? '2–5 дней' : '1–2 нед';
      var labelLong = metric.detailMode === 'days' ? 'более 5 дней' : '>2 нед';
      h.push('<div class="' + CFG.ns + '-detail-value">' + esc(formatInt(current[metric.shortKey])) + '</div>');
      h.push('<div class="' + CFG.ns + '-detail-label">' + esc(labelShort) + '</div>');
      h.push('<div class="' + CFG.ns + '-detail-value">' + esc(formatInt(current[metric.longKey])) + '</div>');
      h.push('<div class="' + CFG.ns + '-detail-label">' + esc(labelLong) + '</div>');
    }
    h.push('</div>');
    h.push('</div>');
  }
  h.push('</div>');
  h.push('</div>');
  h.push('</div>');
  return buildCSS() + h.join('');
}

// ---------- БЛОК 6: МОНТАЖ + ИНТЕРАКТИВ ----------
(function mount() {
  try {
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
      if (!state.tip) { tip.style.opacity = '0'; return; }
      tip.style.opacity = '1';
    }

    function render() {
      overlay.innerHTML = buildHTML();
      renderTip();
    }

    render();

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function() {
        overlay.style.width = '100%'; overlay.style.height = '100%';
      });
      ro.observe(host);
    }
  } catch (e) {
    var hosts = document.querySelectorAll('[_echarts_instance_]');
    if (hosts && hosts.length > 0) {
      var host = hosts[hosts.length - 1];
      host.innerHTML = '<div style="padding:20px;font-family:' + CFG.fonts.family + ';color:' + CFG.colors.red + ';font-size:13px;">Ошибка графика: ' + esc(e.message || e) + '</div>';
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
