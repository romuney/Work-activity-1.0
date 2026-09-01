// ============================================================================
// monitoring-raboty.chart.js - Таблица с детализацией по подразделениям
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
    lvl_down_nm: 'lvl_down_nm',
    count_employee: 'count_employee',
    low: 'low',
    prev_low: 'prev_low',
    high: 'high',
    prev_high: 'prev_high',
    talk: 'talk',
    fresh_talk: 'fresh_talk',
    long_talk: 'long_talk'
  },
  text: {
    noData: 'Нет данных',
    title: 'Детализация по подразделениям',
    subtitle: 'Группировка столбцов по блокам: недоработка, переработка и % звонков в Talk',
    teamHead: 'Команда',
    underHead: 'Недоработка',
    overHead: 'Переработка',
    talkHead: 'Толк',
    underSub: 'Кол-во сотрудников в категории',
    underSubPct: '% от активной числ.',
    underSubDelta: 'Δ к прошлому периоду',
    overSub: 'Кол-во сотрудников в категории',
    overSubPct: '% от активной числ.',
    overSubDelta: 'Δ к прошлому периоду',
    talkSub1: 'Кол-во сотрудников, 20–30% рабочего времени',
    talkSub2: 'Кол-во сотрудников, 30–50% рабочего времени',
    talkSub3: 'Кол-во сотрудников, более 50% рабочего времени',
    pagerShown: 'Показаны',
    pagerOf: 'из',
    pagerPrev: 'Предыдущая страница',
    pagerNext: 'Следующая страница',
    pagerPage: 'Страница'
  },
  mode: 'snapshot',
  colors: {
    card: '#ffffff',
    line: '#e7e9ee',
    line2: '#eef0f3',
    ink: '#1f1f1f',
    ink2: '#3a3f4a',
    muted: '#8a909c',
    muted2: '#aab0bb',
    act: '#2b6cff',
    actBg: '#eef3fe',
    bench: '#9aa0ac',
    // Светофор
    green: '#12b048',
    greenTx: '#0a8f3c',
    red: '#f51f1f',
    redTx: '#d11414',
    neutral: '#7d8794',
    // Блоки
    underHead: '#f6c4bf',
    underBorder: '#d97b70',
    underCell: '#fff5f4',
    overHead: '#f6e7bf',
    overBorder: '#dfc273',
    overCell: '#fffaf0',
    talkHead: '#dce9f7',
    talkBorder: '#8fb1da',
    talkCell: '#f6f9fd',
    // Маркеры для тултипа
    mkUnder: '#d97b70',
    mkOver: '#dfc273',
    mkTalk: '#8fb1da'
  },
  // Токены шрифтов из TeamPulse DESIGN_SYSTEM.md §2
  fonts: {
    family: 'Inter,Helvetica,Arial,sans-serif',
    micro: 9.5,   // --fs-micro: служебные подписи в плотных таблицах
    cap: 10.5,    // --fs-cap: шапки колонок, подписи осей, надзаголовки
    note: 11.5,   // --fs-note: сноски, пояснения, подписи в карточках
    body: 12.5,   // --fs-body: основной текст таблиц
    lead: 13.5,   // --fs-lead: имена строк и метрик, значения в подсказке
    head: 16      // --fs-head: заголовки блоков
  },
  spacing: {
    s1: 2, s2: 4, s3: 6, s4: 8, s5: 10, s6: 12, s7: 14, s8: 16
  },
  radius: {
    r1: 3, r2: 6, r3: 9, r4: 12, rPill: 999
  },
  perPage: 20
};

// ---------- БЛОК 2: ВХОД + СОСТОЯНИЕ + ХЕЛПЕРЫ ----------
// Proteus передаёт данные в глобальной переменной data (массив строк)
// Формат от Proteus: [{ management_unit_nm, count_employee, low, prev_low, ... }, ...]

// === Адаптер форматов: HTML макет (departments) vs Proteus (плоский) ===
// Если data[0].departments существует — это HTML макет, разворачиваем
if (data && data.length > 0 && data[0].departments) {
  // Формат HTML макета: [{ period, label, departments: [...] }]
  var flat = [];
  for (var di = 0; di < data.length; di++) {
    var dept = data[di].departments;
    if (dept && dept.length > 0) {
      for (var i = 0; i < dept.length; i++) {
        var d = dept[i];
        flat.push({
          lvl_down_nm: d.name,
          count_employee: d.team_size,
          low: d.underwork_abs,
          prev_low: d.underwork_delta,
          high: d.overwork_abs,
          prev_high: d.overwork_delta,
          talk: d.talk_20_30_abs,
          fresh_talk: d.talk_30_50_abs,
          long_talk: d.talk_50_plus_abs
        });
      }
    }
  }
  data = flat;
}
// ================================================

var rawData = data || [];

if (!window.__pvtState) window.__pvtState = {};
var __S = window.__pvtState;
if (!__S[CFG.ns]) __S[CFG.ns] = { page: 1, tip: null, tipTarget: null };
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

// Форматирование процентов: 20.0 → "20%"
function fmtShare(v) {
  if (v === null || v === undefined) return '0%';
  return Math.round(v) + '%';
}

// Форматирование дельты: +1, −1, 0
var MINUS = '\u2212';
function fmtDelta(v) {
  if (v === null || v === undefined || v === 0) return '0';
  if (v > 0) return '+' + v;
  return MINUS + Math.abs(v);
}

// Класс для дельты: pos (красный), neg (зелёный), neu (серый)
function deltaClass(v) {
  if (v > 0) return 'pos';
  if (v < 0) return 'neg';
  return 'neu';
}

// Получение цвета из CFG.colors
function getColor(name) {
  return CFG.colors[name] || '#000';
}

// ---------- БЛОК 3: ТРАНСФОРМАЦИЯ ДАННЫХ ----------
// rawData -> структура для таблицы с пагинацией
// SQL возвращает: 1 строка = 1 команда
function buildModel() {
  if (!rawData || rawData.length === 0) return { rows: [], periodLabel: '' };

  var rows = [];

  for (var i = 0; i < rawData.length; i++) {
    var d = rawData[i];
    var teamSize = num(d.count_employee) || 0;

    // Абсолютные значения (NULL -> 0)
    var lowAbs = num(d.low) || 0;
    var highAbs = num(d.high) || 0;
    // prev_* могут быть NULL для первой строки (lagInFrame)
    var prevLow = num(d.prev_low) || 0;
    var prevHigh = num(d.prev_high) || 0;

    // Дельты
    var lowDelta = lowAbs - prevLow;
    var highDelta = highAbs - prevHigh;

    // Проценты от активной численности
    var lowPct = teamSize > 0 ? (lowAbs / teamSize * 100) : 0;
    var highPct = teamSize > 0 ? (highAbs / teamSize * 100) : 0;

    // Talk категории (проценты от team_size)
    var talk20_30 = num(d.talk) || 0;
    var talk30_50 = num(d.fresh_talk) || 0;
    var talk50plus = num(d.long_talk) || 0;

    rows.push({
      name: d.lvl_down_nm || 'Название не указано',
      team_size: teamSize,
      underwork_abs: lowAbs,
      underwork_share: lowPct,
      underwork_delta: lowDelta,
      overwork_abs: highAbs,
      overwork_share: highPct,
      overwork_delta: highDelta,
      talk_20_30_abs: talk20_30,
      talk_30_50_abs: talk30_50,
      talk_50_plus_abs: talk50plus
    });
  }

  return { rows: rows, periodLabel: 'Текущий период' };
}

// MODEL будет создан внутри mount() после проверки mock данных
var MODEL = null;

// ---------- БЛОК 4: ФОРМАТИРОВАНИЕ И ЦВЕТ ----------
// (уже есть fmtShare, fmtDelta, deltaClass, getColor в БЛОКЕ 2)

// Умная пагинация: [1, …, 4, 5, 6, …, 10]
function pageList(cur, total) {
  var out = [];
  if (total <= 7) {
    for (var i = 1; i <= total; i++) out.push(i);
    return out;
  }
  out.push(1);
  var left = Math.max(2, cur - 1);
  var right = Math.min(total - 1, cur + 1);
  if (left > 2) out.push('…');
  for (var j = left; j <= right; j++) out.push(j);
  if (right < total - 1) out.push('…');
  out.push(total);
  return out;
}

// ---------- БЛОК 5: РАЗМЕТКА ----------
function buildCSS() {
  var P = '.' + CFG.ns;
  var C = CFG.colors;
  var F = CFG.fonts;
  var S = CFG.spacing;
  var R = CFG.radius;

  return [
    '<style>',
    P + '-root{width:100%;height:100%;box-sizing:border-box;',
      'font-family:' + F.family + ';font-size:' + F.body + 'px;color:' + C.ink2 + ';',
      '-webkit-font-smoothing:antialiased;}',
    P + '-root *{box-sizing:border-box}',

    // Карточка
    P + '-root .card{width:100%;background:' + C.card + ';border-radius:' + R.r4 + 'px;',
      'box-shadow:0 1px 3px rgba(20,28,45,.06),0 4px 16px rgba(20,28,45,.04);',
      'padding:' + S.s6 + 'px ' + S.s7 + 'px;overflow:hidden;}',
    P + '-root .header{margin-bottom:' + S.s5 + 'px}',
    P + '-root .title{margin:0;font-size:16px;line-height:1.15;font-weight:700;color:' + C.ink2 + ';}',
    P + '-root .subtitle{font-size:' + F.note + 'px;font-weight:500;color:' + C.muted + ';line-height:1.35;}',

    // Таблица
    P + '-root .table-wrap{width:100%;overflow-x:auto;border:1px solid ' + C.line + ';border-radius:' + R.r2 + 'px;}',
    P + '-root table{width:100%;border-collapse:collapse;background:' + C.card + ';table-layout:fixed;}',
    P + '-root col.col-team{width:28%}',
    P + '-root col.col-metric{width:8%}',

    // Заголовки
    P + '-root thead th{border-bottom:1px solid ' + C.line + ';padding:' + S.s4 + ';text-align:center;vertical-align:middle;}',
    P + '-root .group-row th{font-size:' + F.cap + 'px;font-weight:800;letter-spacing:.3px;',
      'text-transform:uppercase;color:' + C.ink + ';padding-top:9px;padding-bottom:9px;}',
    P + '-root .subhead-row th{font-size:' + F.cap + 'px;font-weight:600;color:' + C.muted + ';',
      'line-height:1.25;background:#fbfcfe;white-space:normal;word-break:break-word;}',
    P + '-root .team-head{background:#fbfcfe;font-size:' + F.cap + 'px;font-weight:800;',
      'letter-spacing:.3px;text-transform:uppercase;color:' + C.muted + ';text-align:left;}',

    // Цвета заголовков групп
    P + '-root .group-under{background:' + C.underHead + ';border-bottom:2px solid ' + C.underBorder + '}',
    P + '-root .group-over{background:' + C.overHead + ';border-bottom:2px solid ' + C.overBorder + '}',
    P + '-root .group-talk{background:' + C.talkHead + ';border-bottom:2px solid ' + C.talkBorder + '}',
    P + '-root .talk-separator{border-left:3px solid ' + C.talkBorder + '}',

    // Ячейки
    P + '-root tbody td{padding:' + S.s4 + ';border-bottom:1px solid ' + C.line2 + ';',
      'vertical-align:middle;text-align:center;font-size:' + F.body + 'px;font-weight:400;',
      'color:' + C.ink2 + ';font-variant-numeric:tabular-nums;word-break:break-word;}',
    P + '-root tbody tr:last-child td{border-bottom:none}',
    P + '-root tbody tr:hover td{background:#fbfcfe}',

    // Команда
    P + '-root .team-cell{text-align:left;background:' + C.card + ';position:sticky;left:0;z-index:1;cursor:help;}',
    P + '-root tbody tr:hover .team-cell{background:#fbfcfe}',
    P + '-root .team-name{font-size:' + F.body + 'px;font-weight:600;color:' + C.ink + ';',
      'line-height:1.3;white-space:normal;overflow-wrap:anywhere;}',
    P + '-root .team-sub{font-size:' + F.cap + 'px;font-weight:400;color:' + C.muted2 + ';margin-top:' + S.s1 + 'px;}',

    // Цвета ячеек
    P + '-root .under-cell{background:' + C.underCell + '}',
    P + '-root .over-cell{background:' + C.overCell + '}',
    P + '-root .talk-cell{background:' + C.talkCell + '}',
    P + '-root .talk-first{border-left:1px solid ' + C.talkBorder + '}',

    // Метрики
    P + '-root .metric-entry{font-size:' + F.note + 'px;font-weight:700;color:' + C.ink + ';font-variant-numeric:tabular-nums;}',
    P + '-root .metric-share{font-size:' + F.body + 'px;font-weight:400;color:' + C.ink2 + ';font-variant-numeric:tabular-nums;}',
    P + '-root .metric-share.zero{color:' + C.muted2 + '}',

    // Дельта
    P + '-root .delta{font-size:' + F.cap + 'px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;}',
    P + '-root .delta.pos{color:' + C.redTx + '}',
    P + '-root .delta.neg{color:' + C.greenTx + '}',
    P + '-root .delta.neu{color:' + C.muted2 + '}',

    P + '-root .group-divider-left{border-left:1px solid ' + C.line + '}',

    // Пагинация
    P + '-root .pager{display:flex;align-items:center;justify-content:space-between;gap:' + S.s5 + 'px;flex-wrap:wrap;margin-top:' + S.s6 + 'px;}',
    P + '-root .pager-info{font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';font-variant-numeric:tabular-nums;}',
    P + '-root .pager-info b{color:' + C.ink2 + ';font-weight:700}',
    P + '-root .pager-nav{display:flex;align-items:center;gap:' + S.s2 + 'px}',
    P + '-root .pg-btn{min-width:30px;height:30px;padding:0 ' + S.s4 + ';display:inline-flex;',
      'align-items:center;justify-content:center;background:' + C.card + ';border:1px solid ' + C.line + ';',
      'border-radius:' + R.r2 + 'px;font-family:inherit;font-size:' + F.note + 'px;font-weight:600;',
      'color:' + C.ink2 + ';cursor:pointer;user-select:none;font-variant-numeric:tabular-nums;',
      'transition:background .12s ease,border-color .12s ease,color .12s ease;}',
    P + '-root .pg-btn:hover:not(:disabled):not(.active){background:#f4f6fa;border-color:' + C.muted2 + '}',
    P + '-root .pg-btn.active{background:' + C.act + ';border-color:' + C.act + ';color:#fff;cursor:default}',
    P + '-root .pg-btn:disabled{opacity:.4;cursor:not-allowed}',
    P + '-root .pg-ellipsis{padding:0 ' + S.s2 + ';color:' + C.muted2 + ';font-weight:600;user-select:none}',
    P + '-root .pg-btn:focus-visible{outline:3px solid rgba(43,108,255,.32);outline-offset:2px}',

    // Тултип
    P + '-tip{font-family:' + F.family + ';position:fixed;z-index:400;pointer-events:none;opacity:0;transform:translateY(3px);',
      'transition:opacity .11s ease-out,transform .11s ease-out;',
      'background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:' + R.r3 + 'px;',
      'box-shadow:0 10px 30px rgba(24,33,50,.18),0 2px 6px rgba(24,33,50,.08);',
      'padding:9px 12px;font-size:' + F.body + 'px;line-height:1.45;color:' + C.ink2 + ';font-weight:500;',
      'min-width:190px;max-width:320px;white-space:normal}',
    P + '-tip.on{opacity:1;transform:none}',
    P + '-tip .t-h{display:block;font-size:' + F.cap + 'px;font-weight:700;',
      'letter-spacing:.2px;color:' + C.muted + ';margin-bottom:6px}',
    P + '-tip .t-r{display:flex;align-items:center;gap:8px;margin-top:4px}',
    P + '-tip .t-r:first-child{margin-top:0}',
    P + '-tip .t-m{display:inline-block;flex:0 0 auto;width:10px;height:9px;border-radius:' + R.r1 + '}',
    P + '-tip .t-l{font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';min-width:0}',
    P + '-tip .t-v{display:inline;margin:0 0 0 auto;font-size:' + F.lead + 'px;font-weight:700;',
      'color:' + C.ink + ';white-space:nowrap;font-variant-numeric:tabular-nums}',
    P + '-tip .t-r.bench .t-v{color:' + C.muted + ';font-weight:600}',
    P + '-tip .t-n{display:block;font-size:' + F.note + 'px;font-weight:500;color:' + C.muted + ';margin-top:5px}',
    P + '-tip .t-r+.t-n{margin-top:8px;padding-top:7px;border-top:1px solid ' + C.line2 + '}',

    P + '-root .team-cell:focus-visible{outline:3px solid rgba(43,108,255,.32);outline-offset:-3px}',

    // Responsive
    '@media (max-width:1180px){' + P + '-root col.col-team{width:32%}' + P + '-root col.col-metric{width:7.55%}' + P + '-root thead th,' + P + '-root tbody td{padding:7px 6px}' + P + '-root tbody td,' + P + '-root .metric-share{font-size:' + F.note + 'px}' + P + '-root .subhead-row th,' + P + '-root .metric-entry,' + P + '-root .delta,' + P + '-root .team-sub{font-size:' + F.micro + 'px}}',
    '@media (max-width:900px){' + P + '-root .card{padding:' + S.s5 + 'px}' + P + '-root table{min-width:980px}' + P + '-root col.col-team{width:280px}}',
    '@media (prefers-reduced-motion:reduce){' + P + '-root *,' + P + '-root *:before,' + P + '-root *:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}',
    '</style>'
  ].join('');
}

function buildHTML() {
  var P = '.' + CFG.ns;
  var T = CFG.text;

  if (!MODEL.rows || MODEL.rows.length === 0) {
    return buildCSS() + '<div class="' + CFG.ns + '-root"><div class="card">' + esc(T.noData) + '</div></div>';
  }

  var h = [];
  h.push('<div class="' + CFG.ns + '-root">');
  h.push('<div class="card">');

  // Header
  h.push('<div class="header">');
  h.push('<div class="title">' + esc(T.title) + '</div>');
  h.push('<div class="subtitle">' + esc(T.subtitle) + '</div>');
  h.push('</div>');

  // Таблица
  h.push('<div class="table-wrap">');
  h.push('<table>');

  // Colgroup
  h.push('<colgroup>');
  h.push('<col class="col-team" />');
  for (var ci = 0; ci < 8; ci++) {
    h.push('<col class="col-metric" />');
  }
  h.push('</colgroup>');

  // Thead
  h.push('<thead>');
  h.push('<tr class="group-row">');
  h.push('<th class="team-head" rowspan="2">' + esc(T.teamHead) + '</th>');
  h.push('<th class="group-under group-divider-left" colspan="3">' + esc(T.underHead) + '</th>');
  h.push('<th class="group-over group-divider-left" colspan="3">' + esc(T.overHead) + '</th>');
  h.push('<th class="group-talk group-divider-left talk-separator" colspan="3">' + esc(T.talkHead) + '</th>');
  h.push('</tr>');

  h.push('<tr class="subhead-row">');
  h.push('<th class="group-divider-left">' + esc(T.underSub) + '</th>');
  h.push('<th>' + esc(T.underSubPct) + '</th>');
  h.push('<th>' + esc(T.underSubDelta) + '</th>');
  h.push('<th class="group-divider-left">' + esc(T.overSub) + '</th>');
  h.push('<th>' + esc(T.overSubPct) + '</th>');
  h.push('<th>' + esc(T.overSubDelta) + '</th>');
  h.push('<th class="group-divider-left talk-first">' + esc(T.talkSub1) + '</th>');
  h.push('<th>' + esc(T.talkSub2) + '</th>');
  h.push('<th>' + esc(T.talkSub3) + '</th>');
  h.push('</tr>');
  h.push('</thead>');

  // Tbody
  h.push('<tbody id="' + CFG.ns + '-tbody"></tbody>');

  h.push('</table>');
  h.push('</div>');

  // Pager
  h.push('<div class="pager" id="' + CFG.ns + '-pager"></div>');

  h.push('</div>');
  h.push('</div>');

  return buildCSS() + h.join('');
}

// ---------- БЛОК 6: МОНТАЖ + ИНТЕРАКТИВ ----------
var SVG_NS = 'http' + '://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  var el = document.createElementNS(SVG_NS, tag);
  for (var k in attrs) {
    if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
  }
  return el;
}

function tipHtml(o) {
  if (!o) return '';
  var s = '';
  if (o.title) s += '<span class="t-h">' + esc(o.title) + '</span>';
  if (o.rows && o.rows.length) {
    for (var i = 0; i < o.rows.length; i++) {
      var r = o.rows[i];
      if (!r) continue;
      var mk = r.color ? '<i class="t-m" style="background:' + r.color + '"></i>' : '';
      s += '<span class="t-r' + (r.bench ? ' bench' : '') + '">' + mk +
        '<span class="t-l">' + esc(r.label) + '</span>' +
        '<b class="t-v">' + esc(r.value) + '</b></span>';
    }
  }
  if (o.note) {
    var ns = Array.isArray(o.note) ? o.note : [o.note];
    for (var ni = 0; ni < ns.length; ni++) {
      if (ns[ni]) s += '<span class="t-n">' + esc(ns[ni]) + '</span>';
    }
  }
  return s;
}

(function mount() {
  try {
    MODEL = buildModel();

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

    // Рендер таблицы и пагинации
    function render() {
      var tbody = overlay.querySelector('#' + CFG.ns + '-tbody');
      if (!tbody) return;

      var all = MODEL.rows;
      var totalRows = all.length;
      var perPage = CFG.perPage;
      var totalPages = Math.max(1, Math.ceil(totalRows / perPage));

      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      var startIdx = (state.page - 1) * perPage;
      var endIdx = Math.min(startIdx + perPage, totalRows);
      var pageRows = all.slice(startIdx, endIdx);

      tbody.innerHTML = '';

      for (var i = 0; i < pageRows.length; i++) {
        var r = pageRows[i];
        var tr = document.createElement('tr');

        var zU = r.underwork_share === 0 ? ' zero' : '';
        var zO = r.overwork_share === 0 ? ' zero' : '';
        var z1 = r.talk_20_30_abs === 0 ? ' zero' : '';
        var z2 = r.talk_30_50_abs === 0 ? ' zero' : '';
        var z3 = r.talk_50_plus_abs === 0 ? ' zero' : '';

        var tdTeam = document.createElement('td');
        tdTeam.className = 'team-cell';
        tdTeam.tabIndex = 0;
        tdTeam.innerHTML = '<div class="team-name">' + esc(r.name) + '</div>' +
          '<div class="team-sub">Активная численность: ' + r.team_size + '</div>';

        // Тултип для команды
        var tipData = {
          title: r.name,
          rows: [
            { label: 'Активная численность', value: String(r.team_size), bench: true },
            { label: 'Недоработка', value: r.underwork_abs + ' • ' + fmtShare(r.underwork_share), color: getColor('mkUnder') },
            { label: 'Δ недоработка', value: fmtDelta(r.underwork_delta), bench: true },
            { label: 'Переработка', value: r.overwork_abs + ' • ' + fmtShare(r.overwork_share), color: getColor('mkOver') },
            { label: 'Δ переработка', value: fmtDelta(r.overwork_delta), bench: true },
            { label: 'Толк', value: r.talk_20_30_abs + ' + ' + r.talk_30_50_abs + ' + ' + r.talk_50_plus_abs, color: getColor('mkTalk'), bench: true }
          ],
          note: 'Период: ' + MODEL.periodLabel
        };

        tdTeam.addEventListener('mouseenter', function(rowData) {
          return function() {
            state.tip = tipHtml({
              title: rowData.name,
              rows: [
                { label: 'Активная численность', value: String(rowData.team_size), bench: true },
                { label: 'Недоработка', value: rowData.underwork_abs + ' • ' + fmtShare(rowData.underwork_share), color: getColor('mkUnder') },
                { label: 'Δ недоработка', value: fmtDelta(rowData.underwork_delta), bench: true },
                { label: 'Переработка', value: rowData.overwork_abs + ' • ' + fmtShare(rowData.overwork_share), color: getColor('mkOver') },
                { label: 'Δ переработка', value: fmtDelta(rowData.overwork_delta), bench: true },
                { label: 'Толк', value: rowData.talk_20_30_abs + ' + ' + rowData.talk_30_50_abs + ' + ' + rowData.talk_50_plus_abs, color: getColor('mkTalk'), bench: true }
              ],
              note: 'Период: ' + MODEL.periodLabel
            });
            state.tipTarget = this;
            renderTip();
          };
        }(r));
        tdTeam.addEventListener('mouseleave', hideTip);

        tr.appendChild(tdTeam);

        // Недоработка
        var tdUA = document.createElement('td');
        tdUA.className = 'under-cell group-divider-left metric-entry';
        tdUA.textContent = r.underwork_abs;
        tr.appendChild(tdUA);

        var tdUP = document.createElement('td');
        tdUP.className = 'under-cell metric-share' + zU;
        tdUP.textContent = fmtShare(r.underwork_share);
        tr.appendChild(tdUP);

        var tdUD = document.createElement('td');
        tdUD.className = 'under-cell delta ' + deltaClass(r.underwork_delta);
        tdUD.textContent = fmtDelta(r.underwork_delta);
        tr.appendChild(tdUD);

        // Переработка
        var tdOA = document.createElement('td');
        tdOA.className = 'over-cell group-divider-left metric-entry';
        tdOA.textContent = r.overwork_abs;
        tr.appendChild(tdOA);

        var tdOP = document.createElement('td');
        tdOP.className = 'over-cell metric-share' + zO;
        tdOP.textContent = fmtShare(r.overwork_share);
        tr.appendChild(tdOP);

        var tdOD = document.createElement('td');
        tdOD.className = 'over-cell delta ' + deltaClass(r.overwork_delta);
        tdOD.textContent = fmtDelta(r.overwork_delta);
        tr.appendChild(tdOD);

        // Talk
        var tdT1 = document.createElement('td');
        tdT1.className = 'talk-cell group-divider-left talk-separator metric-entry' + z1;
        tdT1.textContent = r.talk_20_30_abs;
        tr.appendChild(tdT1);

        var tdT2 = document.createElement('td');
        tdT2.className = 'talk-cell metric-entry' + z2;
        tdT2.textContent = r.talk_30_50_abs;
        tr.appendChild(tdT2);

        var tdT3 = document.createElement('td');
        tdT3.className = 'talk-cell metric-entry' + z3;
        tdT3.textContent = r.talk_50_plus_abs;
        tr.appendChild(tdT3);

        tbody.appendChild(tr);
      }

      // Рендер пагинации
      renderPager(totalRows, totalRows ? startIdx + 1 : 0, endIdx, totalPages);
    }

    function renderPager(totalRows, from, to, totalPages) {
      var pager = overlay.querySelector('#' + CFG.ns + '-pager');
      if (!pager) return;
      pager.innerHTML = '';

      if (totalRows === 0) return;

      var info = document.createElement('div');
      info.className = 'pager-info';
      info.innerHTML = esc(CFG.text.pagerShown) + ' <b>' + from + '–' + to + '</b> ' + esc(CFG.text.pagerOf) + ' <b>' + totalRows + '</b>';
      pager.appendChild(info);

      if (totalPages <= 1) return;

      var nav = document.createElement('div');
      nav.className = 'pager-nav';

      function btn(label, page, opts) {
        opts = opts || {};
        var b = document.createElement('button');
        b.className = 'pg-btn' + (opts.active ? ' active' : '');
        b.type = 'button';
        b.textContent = label;
        if (opts.disabled) b.disabled = true;
        if (opts.aria) b.setAttribute('aria-label', opts.aria);
        if (!opts.disabled && !opts.active) {
          b.addEventListener('click', function() {
            state.page = page;
            render();
          });
        }
        return b;
      }

      nav.appendChild(btn('‹', state.page - 1, { disabled: state.page <= 1, aria: CFG.text.pagerPrev }));

      var pages = pageList(state.page, totalPages);
      for (var pi = 0; pi < pages.length; pi++) {
        var p = pages[pi];
        if (p === '…') {
          var e = document.createElement('span');
          e.className = 'pg-ellipsis';
          e.textContent = '…';
          nav.appendChild(e);
        } else {
          nav.appendChild(btn(String(p), p, { active: p === state.page, aria: CFG.text.pagerPage + ' ' + p }));
        }
      }

      nav.appendChild(btn('›', state.page + 1, { disabled: state.page >= totalPages, aria: CFG.text.pagerNext }));

      pager.appendChild(nav);
    }

    // === Сначала создаём HTML, потом рендерим ===
    overlay.innerHTML = buildHTML();
    // =============================

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
