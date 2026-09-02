// ============================================================================
// hq-portrait.chart.js — портрет команды HQ для Proteus (v2.1, серая воронка)
// ============================================================================
// ---------- БЛОК 1: CFG ----------
var CFG = {
  ns: 'hqp',
  specFilter: 'Hq', // фильтр emp_specialization_oper_code на входе
  fields: {
    specOper: 'emp_specialization_oper_code',
    gender: 'gender',
    typeAge: 'type_age',
    age: 'age',
    seniority: 'seniority',
    grade: 'grade',
    experience: 'experience_group_nm',
    company: 'type_company',
    employment: 'employment_relation_type_desc',
    workType: 'type_of_work',
    stream: 'employee_stream_desc',
    specialization: 'employee_specialization_desc',
    legalCount: 'ur_count',
    activeCount: 'active_count',
    hqCount: 'hq_count'
  },
  dimLabels: {
    gender: 'Пол', age: 'Возрастная группа', seniority: 'Сеньорность', grade: 'Грейд',
    company: 'Юр. лицо', employment: 'Тип оформления', format: 'Тип договора',
    stream: 'Стрим', specialization: 'Специализация', tenure: 'Стаж'
  },
  order: {
    gender: ['Мужчина', 'Женщина'],
    age: ['до 25', 'от 25 до 30', '30+'],
    seniority: ['Lead', 'Senior+', 'Senior', 'Middle+', 'Middle', 'Junior+', 'Junior', 'Intern', 'n/a'],
    grade: ['21', '20+', '20', '19', '18', '17', '16', '15', '14', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'n/a', '-'],
    company: ['Банк', 'ТЦР РФ', 'ТЦР СНГ'],
    employment: ['Штат', 'ГПД ФЛ', 'ГПД ИП'],
    format: ['Гибридный', 'Дистанционный', 'Офисный', '-'],
    tenure: [
      'Стаж более 5 лет','Стаж от 2 до 5 лет','Стаж от 1 до 2 лет',
      'Стаж от 6 мес до 1 года','Стаж от 3 до 6 мес','Стаж менее 3 мес'
    ]
  },
  ageCenter: { 'до 25': 23, 'от 25 до 30': 27.5, '30+': 34.5 },
  dashLabel: 'Не указано',
  text: { noData: 'Нет данных' },
  colors: {
    bg: 'transparent', card: '#ffffff', line: '#e7e9ee', line2: '#eef0f3',
    ink: '#1f1f1f', ink2: '#3a3f4a', muted: '#8a909c', muted2: '#aab0bb',
    accent: '#2B5EC5', accentRGB: '43,94,197',
    blue: '#3B6FE0', blue2: '#1f4fbf', blue3: '#89aeee',
    female: '#FFB6C1',
    ageColors: { 'до 25': '#D9F0E2', 'от 25 до 30': '#DFDFDF', '30+': '#C6C6C6' }
  },
  fonts: { family: 'Inter, Helvetica, Arial' }
};

// ---------- БЛОК 2: ВХОД + СОСТОЯНИЕ + ХЕЛПЕРЫ ----------
var rawData = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];

if (!window.__pvtState) window.__pvtState = {};
var __S = window.__pvtState;
if (!__S[CFG.ns] || typeof __S[CFG.ns] !== 'object') {
  __S[CFG.ns] = {
    tip: null,
    tab: 'qual',          // qual | contract | stream | custom
    filters: {},          // dim -> string | string[]
    pivotFilters: {},     // { row: key, col: key } — фильтры из конструктора
    streamExpanded: null, // groupId -> bool (инициализируется при первом рендере)
    pivot: { row: 'seniority', col: 'age', mode: 'n', fullscreen: false } // n | row | col
  };
}
// Защита: фильтры и pivot могут быть undefined после сброса
if (!__S[CFG.ns].filters) __S[CFG.ns].filters = {};
if (!__S[CFG.ns].pivot || typeof __S[CFG.ns].pivot !== 'object') {
  __S[CFG.ns].pivot = { row: 'seniority', col: 'age', mode: 'n', fullscreen: false };
}
var state = __S[CFG.ns];
// Явное присваивание для валидатора S18
state.pivot = __S[CFG.ns].pivot;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function labelOf(v) { return v === '-' ? CFG.dashLabel : v; }
function pluralRu(n, one, few, many) {
  var abs = Math.abs(n) % 100, last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
function hasProp(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

// ---------- БЛОК 3: ТРАНСФОРМАЦИЯ ДАННЫХ ----------
var TOTAL_LEGAL_ALL = 0, TOTAL_ACTIVE_ALL = 0;

function buildFacts() {
  var F = CFG.fields, out = [], i, r, g;
  for (i = 0; i < rawData.length; i++) {
    r = rawData[i] || {};
    TOTAL_LEGAL_ALL += num(r[F.legalCount]);
    TOTAL_ACTIVE_ALL += num(r[F.activeCount]);
    g = r[F.grade] || '';
    out.push({
      specOper: r[F.specOper] || '',
      gender: r[F.gender] || '',
      age: r[F.typeAge] || '',
      ageNum: num(r[F.age]),
      seniority: r[F.seniority] || '',
      grade: (g !== '' && num(g) >= 20) ? '20+' : g,
      tenure: r[F.experience] || '',
      company: r[F.company] || '',
      employment: r[F.employment] || '',
      format: r[F.workType] || '',
      stream: r[F.stream] || '',
      specialization: r[F.specialization] || '',
      legal: num(r[F.legalCount]),
      active: num(r[F.activeCount]),
      hq: num(r[F.hqCount])
    });
  }
  return out;
}
var FACTS = buildFacts();

function collectCats(dim, sortByCount, metric, skipPivot) {
  // Для stream используем specialization, для остальных — dim как ключ FACTS
  var field = (dim === 'stream') ? 'specialization' : dim;
  var seen = {}, i, v;
  // Собираем ВСЕ возможные значения из FACTS (без фильтрации)
  for (i = 0; i < FACTS.length; i++) {
    v = FACTS[i][field];
    if (v == null || v === '') continue;
    seen[v] = true;
  }
  var order = CFG.order[dim] || [];
  var ordered = [], rest = [], k;
  for (i = 0; i < order.length; i++) if (seen[order[i]]) ordered.push(order[i]);
  for (k in seen) if (hasProp(seen, k) && order.indexOf(k) === -1) rest.push(k);
  if (sortByCount) {
    var counts = distByDim(dim, metric, skipPivot);
    ordered.sort(function(a, b) { return (counts[b] || 0) - (counts[a] || 0); });
    rest.sort(function(a, b) { return (counts[b] || 0) - (counts[a] || 0); });
  } else {
    rest.sort();
  }
  return ordered.concat(rest);
}

var TOTAL_HQ_ALL = 0;
(function() {
  var i;
  for (i = 0; i < FACTS.length; i++) {
    TOTAL_HQ_ALL += FACTS[i].hq;
  }
})();

function factPasses(row, skipDim, skipPivot) {
  var f = state.filters, d;
  for (d in f) {
    if (!hasProp(f, d)) continue;
    if (d === skipDim) continue;
    var val = f[d];
    var v = row[d];
    if (Object.prototype.toString.call(val) === '[object Array]') {
      if (val.indexOf(v) === -1) return false;
    } else {
      if (v !== val) return false;
    }
  }
  // Фильтры из конструктора (pivotFilters) применяются всегда, кроме конструктора (skipPivot=true)
  if (!skipPivot && state.pivotFilters) {
    var pf = state.pivotFilters;
    if (pf.rowDim && pf.row) {
      var pv = row[pf.rowDim];
      if (pv !== pf.row) return false;
    }
    if (pf.colDim && pf.col) {
      var pv = row[pf.colDim];
      if (pv !== pf.col) return false;
    }
  }
  return true;
}

function distByDim(dim, metric, skipPivot) {
  metric = metric || 'hq';
  // Для stream используем specialization, для остальных — dim как ключ FACTS
  var field = (dim === 'stream') ? 'specialization' : dim;
  var out = {}, i, r, k;
  for (i = 0; i < FACTS.length; i++) {
    r = FACTS[i];
    if (!factPasses(r, null, skipPivot)) continue;
    k = r[field];
    if (k == null || k === '') continue;
    if (out[k] == null) out[k] = 0;
    out[k] += r[metric] || 0;
  }
  return out;
}

function totalWithFilters(metric) {
  metric = metric || 'hq';
  var s = 0, i;
  for (i = 0; i < FACTS.length; i++) {
    if (!factPasses(FACTS[i], null)) continue;
    s += FACTS[i][metric] || 0;
  }
  return s;
}

function avgAge(skipDim) {
  var s = 0, w = 0, i, r, ageVal;
  for (i = 0; i < FACTS.length; i++) {
    r = FACTS[i];
    if (!factPasses(r, skipDim)) continue;
    // Используем точное числовое значение age, если есть; иначе — среднее по группе
    ageVal = r.ageNum > 0 ? r.ageNum : CFG.ageCenter[r.age];
    if (ageVal == null || ageVal <= 0) continue;
    s += ageVal * r.hq; w += r.hq;
  }
  return w > 0 ? s / w : 0;
}

function buildStreamTree() {
  var groups = {}, i, r, gk, ck;
  // Сначала собираем ВСЕ возможные стримы и специализации (без фильтрации)
  for (i = 0; i < FACTS.length; i++) {
    r = FACTS[i];
    gk = r.stream; if (!gk) continue;
    ck = r.specialization || gk;
    if (!groups[gk]) groups[gk] = { id: gk, title: gk, childrenMap: {}, total: 0, totalAll: 0 };
    if (!groups[gk].childrenMap[ck]) groups[gk].childrenMap[ck] = { id: ck, n: ck, cnt: 0, cntAll: 0 };
  }
  // Считаем cntAll (без фильтров) и cnt (с фильтрами)
  for (i = 0; i < FACTS.length; i++) {
    r = FACTS[i];
    gk = r.stream; if (!gk || !groups[gk]) continue;
    ck = r.specialization || gk;
    if (!groups[gk].childrenMap[ck]) groups[gk].childrenMap[ck] = { id: ck, n: ck, cnt: 0, cntAll: 0 };
    // cntAll — всегда считаем (без фильтров)
    groups[gk].childrenMap[ck].cntAll += r.hq;
    groups[gk].totalAll += r.hq;
    // cnt — считаем с фильтрами
    if (!factPasses(r, null)) continue;
    groups[gk].childrenMap[ck].cnt += r.hq;
    groups[gk].total += r.hq;
  }
  var arr = [], k, g, kids, kk;
  for (k in groups) if (hasProp(groups, k)) {
    g = groups[k]; kids = [];
    for (kk in g.childrenMap) if (hasProp(g.childrenMap, kk)) kids.push(g.childrenMap[kk]);
    kids.sort(function(a, b) { return b.cntAll - a.cntAll || a.n.localeCompare(b.n); });
    g.children = kids;
    arr.push(g);
  }
  arr.sort(function(a, b) { return b.totalAll - a.totalAll || (a.title || '').localeCompare(b.title || ''); });
  return arr;
}

if (state.streamExpanded === null || typeof state.streamExpanded !== 'object') {
  var __st = buildStreamTree();
  state.streamExpanded = {};
  if (__st && Array.isArray(__st)) {
    for (var __i = 0; __i < __st.length; __i++) {
      if (__st[__i] && __st[__i].id) {
        state.streamExpanded[__st[__i].id] = (__i === 0);
      }
    }
  }
}

// ---------- БЛОК 4: ФОРМАТИРОВАНИЕ ----------
function nfmt(n) { return Math.round(n || 0).toLocaleString('ru-RU').replace(/,/g, ' '); }
function pctFmt(v) {
  if (v === 0) return '0%';
  if (v >= 10) return Math.round(v) + '%';
  return v.toFixed(1).replace('.', ',') + '%';
}
function pctOf(a, b) { return b > 0 ? pctFmt(a / b * 100) : '0%'; }
function ratioMF(m, f) {
  if (m <= 0 || f <= 0) return '—';
  return (Math.round(m / f * 10) / 10).toString().replace('.', ',') + ' : 1';
}
function ageWord(n) {
  var abs = Math.abs(Math.round(n)) % 100, last = abs % 10;
  if (abs > 10 && abs < 20) return 'лет';
  if (last === 1) return 'г.';
  if (last >= 2 && last <= 4) return 'г.';
  return 'лет';
}
function ageFmt(n) {
  if (!isFinite(n) || n <= 0) return '—';
  var v = Math.round(n);
  return v + ' ' + ageWord(v);
}
function tipAttr(o) { return esc(JSON.stringify(o)); }
function heatFill(t) {
  if (!isFinite(t) || t <= 0) return 'transparent';
  if (t >= 1) return 'rgba(' + CFG.colors.accentRGB + ',1)';
  var a = 0.06 + Math.pow(t, 0.85) * 0.94;
  if (a > 1) a = 1;
  return 'rgba(' + CFG.colors.accentRGB + ',' + a.toFixed(3) + ')';
}

// ---------- БЛОК 5: РАЗМЕТКА ----------
function buildCSS() {
  var P = '.' + CFG.ns, C = CFG.colors;
  return [
    '<style>',
    P + '-root{width:100%;min-height:100%;box-sizing:border-box;font-family:' + CFG.fonts.family + ';background:' + C.bg + ';color:' + C.ink + ';padding:0 8px;}',
    P + '-root *{box-sizing:border-box;font-family:inherit;}',
    P + '-split{display:grid;grid-template-columns:minmax(420px,5fr) minmax(540px,7fr);gap:14px;align-items:stretch;margin-bottom:14px;}',
    P + '-panel{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(20,28,45,.06),0 4px 16px rgba(20,28,45,.04);overflow:hidden;display:flex;flex-direction:column;}',
    P + '-panel-h{padding:14px 16px;border-bottom:1px solid ' + C.line2 + ';display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
    P + '-panel-b{padding:14px 16px;flex:1;display:flex;flex-direction:column;min-height:0;}',
    P + '-h-txt{display:flex;flex-direction:column;gap:2px;min-width:180px;flex:1 1 auto;}',
    P + '-h-title{font-weight:600;font-size:16px;color:' + C.ink2 + ';}',
    P + '-sub{font-size:10.5px;color:' + C.muted + ';font-weight:600;}',
    // Filter bar
    P + '-fbar{margin:0 8px 12px;padding:8px 10px;border:1px solid ' + C.line + ';border-radius:10px;background:#f8f9fb;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
    P + '-fbar-lbl{font-size:10.5px;font-weight:600;color:' + C.muted + ';text-transform:uppercase;letter-spacing:.3px;}',
    P + '-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#fff;border:1px solid ' + C.line + ';border-radius:8px;font-size:11.5px;color:' + C.ink2 + ';}',
    P + '-chip b{color:' + C.ink + ';font-weight:600;}',
    P + '-chip-x{cursor:pointer;color:' + C.muted + ';font-weight:600;padding:0 2px;}',
    P + '-chip-x:hover{color:' + C.ink + ';}',
    P + '-freset{margin-left:auto;background:transparent;border:0;color:' + C.muted + ';font-size:11.5px;font-weight:600;cursor:pointer;text-decoration:underline;}',
    // Portrait
    P + '-portrait-blocks{display:flex;flex-direction:column;gap:30px;flex:1;}',
    P + '-pb-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;gap:8px;}',
    P + '-pb-lbl{font-size:13px;font-weight:600;color:' + C.ink2 + ';}',
    P + '-pb-sum{font-size:11.5px;color:' + C.muted + ';font-weight:600;}',
    P + '-pb-sum b{color:' + C.ink + ';font-weight:600;}',
    // Funnel (grey, centered, proportional)
    P + '-funnel{display:flex;flex-direction:column;}',
    P + '-fn-row{display:grid;grid-template-columns:minmax(140px,1fr) minmax(0,2.2fr) minmax(70px,auto);gap:12px;align-items:center;padding-bottom:10px;}',
    P + '-fn-row:last-child{padding-bottom:0;}',
    P + '-fn-row.hq{outline:1px dashed rgba(' + CFG.colors.accentRGB + ',0.4);outline-offset:4px;border-radius:8px;}',
    P + '-fn-nm{font-size:11.5px;font-weight:600;color:' + C.ink2 + ';}',
    P + '-fn-track{height:26px;position:relative;display:flex;align-items:stretch;justify-content:center;}',
    P + '-fn-bar{height:100%;border-radius:6px;cursor:help;min-width:6px;transition:width .35s ease;}',
    P + '-fn-bar-1{background:#c7ccd4;}',
    P + '-fn-bar-2{background:#a8afba;}',
    P + '-fn-bar-3{background:#7a8290;}',
    P + '-fn-v{font-size:13.5px;font-weight:600;line-height:1;color:' + C.ink + ';text-align:right;white-space:nowrap;}',
    // Stack bars
    P + '-stack-bar{display:flex;height:26px;border-radius:6px;overflow:hidden;background:' + C.line2 + ';}',
    P + '-stack-seg{display:flex;align-items:center;justify-content:center;padding:0 8px;font-size:10.5px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;cursor:help;transition:flex .35s ease;}',
    P + '-stack-seg.dark{color:' + C.ink + ';}',
    P + '-gender-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}',
    P + '-gender-cards.three{grid-template-columns:repeat(3,1fr);}',
    P + '-gcard{padding:8px 12px;background:#fafbfc;border-radius:9px;border:1px solid ' + C.line2 + ';}',
    P + '-gcard-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;}',
    P + '-gcard-name{font-size:11.5px;color:' + C.muted + ';font-weight:600;}',
    P + '-gcard-cnt{font-size:13.5px;font-weight:600;color:' + C.ink + ';}',
    P + '-gcard-facts{font-size:10.5px;color:' + C.muted + ';line-height:1.4;font-weight:600;}',
    // Right side tabs
    P + '-tabs{display:inline-flex;gap:3px;background:#eef0f3;border-radius:12px;padding:3px;}',
    P + '-tab{border:0;background:transparent;padding:6px 12px;border-radius:9px;font-weight:600;font-size:12.5px;color:' + C.muted + ';cursor:pointer;}',
    P + '-tab.on{background:#fff;color:' + C.ink + ';box-shadow:0 1px 3px rgba(20,28,45,.06);}',
    P + '-views{flex:1;display:flex;flex-direction:column;min-height:0;overflow:auto;}',
    P + '-view{display:none;}',
    P + '-view.on{display:flex;flex-direction:column;flex:1;}',
    // Tables (qual/contract)
    P + '-ptable{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed;margin-bottom:20px;}',
    P + '-ptable:last-child{margin-bottom:0;}',
    P + '-ptable th{font-size:10.5px;text-transform:uppercase;letter-spacing:.2px;color:' + C.muted + ';font-weight:600;text-align:right;padding:9px 8px;border-bottom:1px solid ' + C.line2 + ';white-space:nowrap;background:#f8f9fb;}',
    P + '-ptable th:first-child{text-align:left;padding-left:10px;}',
    P + '-ptable td{padding:8px;font-size:12px;font-weight:600;border-bottom:1px solid ' + C.line2 + ';white-space:nowrap;text-align:right;color:' + C.ink2 + ';}',
    P + '-ptable td:first-child{text-align:left;padding-left:10px;font-weight:600;white-space:normal;color:' + C.ink2 + ';}',
    P + '-urow{cursor:pointer;}',
    P + '-urow:hover{background:#f8f9fb;}',
    P + '-urow.sel{background:rgba(' + C.accentRGB + ',.08);}',
    P + '-urow.sel td:first-child{box-shadow:inset 3px 0 0 ' + C.accent + ';}',
    P + '-cellbar{display:inline-block;width:100%;height:8px;background:' + C.line2 + ';border-radius:4px;overflow:hidden;}',
    P + '-cellbar i{display:block;height:100%;background:' + C.accent + ';transition:width .35s ease;}',
    // Section header inside view
    P + '-sect{margin:12px 0 6px;font-size:11.5px;font-weight:600;color:' + C.ink2 + ';}',
    P + '-sect:first-child{margin-top:0;}',
    // Stream tree
    P + '-st-ctl{padding:10px 8px;border-bottom:1px solid ' + C.line2 + ';background:#fafbfc;}',
    P + '-st-toggle-all{border:1px solid ' + C.line + ';background:#fff;color:' + C.ink + ';padding:6px 12px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;}',
    P + '-st-toggle-all:hover{background:#f0f2f5;}',
    P + '-st-row{display:grid;grid-template-columns:1fr 60px 50px 80px;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid ' + C.line2 + ';font-size:12.5px;cursor:pointer;}',
    P + '-st-row:hover{background:#f8f9fb;}',
    P + '-st-row.st-group{font-weight:600;background:#fafbfc;}',
    P + '-st-row.st-child{padding-left:26px;color:' + C.ink2 + ';font-weight:500;}',
    P + '-st-row.st-child.hidden{display:none;}',
    P + '-st-row.st-child.sel{background:rgba(' + C.accentRGB + ',.08);}',
    P + '-st-row.st-child.sel .' + CFG.ns + '-st-name{color:' + C.accent + ';font-weight:600;}',
    P + '-st-body{display:flex;align-items:center;gap:6px;min-width:0;}',
    P + '-st-chev{display:inline-block;width:10px;font-size:9px;color:' + C.muted + ';transition:transform .15s;}',
    P + '-st-chev.expanded{transform:rotate(90deg);}',
    P + '-st-chev.hidden{visibility:hidden;}',
    P + '-st-namewrap{display:flex;flex-direction:column;min-width:0;flex:1;}',
    P + '-st-name-line{display:flex;align-items:center;gap:6px;}',
    P + '-st-row.st-group .' + P + '-st-name{font-weight:600;}',
    P + '-st-row.st-child .' + P + '-st-name{font-weight:500;}',
    P + '-st-sub{font-size:10.5px;color:' + C.muted + ';font-weight:600;}',
    P + '-st-badge{display:inline-block;background:' + C.accent + ';color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;line-height:1.3;}',
    P + '-st-count{text-align:right;font-weight:600;color:' + C.ink + ';font-size:13.5px;}',
    P + '-st-pct{text-align:right;color:' + C.muted + ';font-size:11.5px;}',
    P + '-st-bar-wrap{display:block;}',
    P + '-st-bar{display:block;height:6px;background:' + C.line2 + ';border-radius:3px;overflow:hidden;}',
    P + '-st-bar i{display:block;height:100%;background:' + C.accent + ';transition:width .35s ease;}',
    // Pivot
    P + '-pv-ctl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:11.5px;}',
    P + '-pv-ctl label{color:' + C.muted + ';font-weight:600;}',
    P + '-pv-fs{margin-left:auto;border:1px solid ' + C.line + ';background:#fff;color:' + C.ink + ';padding:4px 8px;border-radius:6px;font-size:14px;cursor:pointer;font-weight:600;line-height:1;}',
    P + '-pv-fs:hover{background:#f0f2f5;}',
    P + '-pv-fs-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:' + C.bg + ';z-index:99999;padding:24px;overflow:auto;}',
    P + '-pv-fs-overlay .' + CFG.ns + '-pv-ctl{max-width:1400px;margin:0 auto 10px;}',
    P + '-pv-fs-overlay .' + CFG.ns + '-pv-tbl{max-width:1400px;margin:0 auto 28px;}',
    P + '-pv-fs-overlay .' + CFG.ns + '-pv-legend{max-width:1400px;margin:0 auto;padding-top:8px;margin-bottom:15px;}',
    P + '-pv-sel{border:1px solid ' + C.line + ';border-radius:6px;padding:4px 8px;font-size:12.5px;font-weight:600;color:' + C.ink + ';background:#fff;}',
    P + '-pv-swap{border:1px solid ' + C.line + ';border-radius:6px;background:#fff;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:600;}',
    P + '-pv-mode{display:inline-flex;gap:2px;background:#eef0f3;border-radius:8px;padding:2px;}',
    P + '-pv-mode button{border:0;background:transparent;padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:600;color:' + C.muted + ';cursor:pointer;}',
    P + '-pv-mode button.on{background:#fff;color:' + C.ink + ';box-shadow:0 1px 3px rgba(20,28,45,.06);}',
    P + '-pv-legend{margin:12px 0 20px;display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.muted + ';}',
    P + '-pv-legend i{display:inline-block;width:18px;height:10px;}',
    P + '-pv-tbl{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed;}',
    P + '-pv-tbl th,' + P + '-pv-tbl td{padding:6px 8px;border:1px solid ' + C.line2 + ';text-align:right;}',
    P + '-pv-tbl th:first-child,' + P + '-pv-tbl td:first-child{width:200px;}',
    P + '-pv-tbl thead th{background:#fafbfc;font-weight:600;color:' + CFG.colors.ink2 + ';font-size:10.5px;text-transform:uppercase;}',
    P + '-pv-tbl tbody th{background:#fafbfc;text-align:left;font-weight:600;color:' + CFG.colors.ink2 + ';}',
    P + '-pv-corner{background:#fff;border:0;padding:0;height:44px;position:relative;}',
    P + '-pv-corner-inner{padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;height:100%;font-size:10.5px;color:' + C.muted + ';text-transform:uppercase;letter-spacing:.3px;}',
    P + '-pv-arrow{display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:' + C.ink + ';margin-left:4px;vertical-align:middle;}',
    P + '-pv-arrow.left{margin-left:0;margin-right:4px;}',
    P + '-pv-arrow.right{margin-left:4px;margin-right:0;transform:translateY(-3px);}',
    P + '-pv-corner-top{text-align:right;}',
    P + '-pv-corner-bot{text-align:left;}',
    P + '-pv-cell{cursor:pointer;font-weight:600;color:' + C.ink + ';font-size:12.5px;transition:background-color .35s ease,color .2s,opacity .2s;}',
    P + '-pv-cell:hover{outline:2px solid ' + C.accent + ';outline-offset:-2px;}',
    P + '-pv-cell.hi{color:#fff;}',
    P + '-pv-cell.zero{color:' + C.muted2 + ';font-weight:500;}',
    P + '-pv-cell.sel{opacity:1;outline:2px solid ' + C.accent + ';outline-offset:-2px;}',
    P + '-pv-tbl.fade tbody ' + P + '-pv-cell{opacity:0.3;}',
    P + '-pv-tbl.fade tbody ' + P + '-pv-cell.sel{opacity:1;}',
    P + '-pv-total-row th,' + P + '-pv-total-row td{background:#fafbfc !important;font-weight:800;font-size:12.5px;}',
    // Empty
    P + '-empty{padding:30px;text-align:center;color:' + C.muted + ';font-weight:600;font-size:11.5px;}',
    P + '-empty b{display:block;color:' + C.ink + ';margin-bottom:4px;font-size:13.5px;}',
    // Tooltip
    P + '-tip{position:fixed;z-index:99999;pointer-events:none;opacity:0;box-sizing:border-box;transition:opacity .08s;background:#fff;border:1px solid ' + C.line + ';border-radius:9px;box-shadow:0 10px 30px rgba(20,33,50,.18),0 2px 6px rgba(20,28,45,.08);padding:9px 12px;font-size:10px;line-height:1.45;color:' + C.ink2 + ';min-width:180px;max-width:360px;font-family:' + CFG.fonts.family + ';}',
    P + '-tip-h{display:block;font-size:10.5px;font-weight:600;letter-spacing:.3px;color:' + C.muted + ';margin-bottom:6px;text-transform:uppercase;}',
    P + '-tip-x{display:block;font-size:11.5px;color:' + C.ink2 + ';margin-bottom:8px;line-height:1.4;font-style:italic;}',
    P + '-tip-r{display:flex;align-items:center;gap:8px;margin-top:4px;}',
    P + '-tip-m{display:inline-block;flex:0 0 auto;width:10px;height:9px;border-radius:3px;}',
    P + '-tip-l{font-size:10.5px;font-weight:600;color:' + C.muted + ';}',
    P + '-tip-v{margin-left:auto;font-size:11.5px;font-weight:600;color:' + C.ink + ';text-align:right;}',
    P + '-nodata{padding:28px;color:' + C.muted + ';font-weight:600;font-size:11.5px;}',
    '@media(max-width:1120px){' + P + '-split{grid-template-columns:1fr;}}',
    '@media(max-width:900px){' + P + '-root{padding:14px;}' + P + '-gender-cards.three{grid-template-columns:1fr;}}',
    '</style>'
  ].join('');
}

// ----- Filter bar -----
function buildFilterBar() {
  var keys = [], k;
  for (k in state.filters) if (hasProp(state.filters, k)) keys.push(k);
  var pf = state.pivotFilters || {};
  var hasPivot = !!(pf.rowDim && pf.row) || !!(pf.colDim && pf.col);
  if (keys.length === 0 && !hasPivot) return '';
  var h = ['<div class="' + CFG.ns + '-fbar"><span class="' + CFG.ns + '-fbar-lbl">Срез:</span>'];
  var i, d, val, label;
  for (i = 0; i < keys.length; i++) {
    d = keys[i]; val = state.filters[d];
    if (Object.prototype.toString.call(val) === '[object Array]') {
      label = val.length <= 2 ? val.join(', ') : (val.slice(0, 2).join(', ') + ' и ещё ' + (val.length - 2));
    } else {
      label = val === '-' ? CFG.dashLabel : val;
    }
    h.push('<span class="' + CFG.ns + '-chip"><span>' + esc(CFG.dimLabels[d]) + ': <b>' + esc(label) + '</b></span><span class="' + CFG.ns + '-chip-x" data-drop="' + esc(d) + '" title="Снять фильтр">×</span></span>');
  }
  // Срезы из конструктора — как отдельные чипы (row и col), каждый снимается отдельно
  if (pf.rowDim && pf.row) {
    h.push('<span class="' + CFG.ns + '-chip"><span>' + esc(CFG.dimLabels[pf.rowDim] || pf.rowDim) + ': <b>' + esc(labelOf(pf.row)) + '</b></span><span class="' + CFG.ns + '-chip-x" data-drop-pivot="row" title="Снять срез">×</span></span>');
  }
  if (pf.colDim && pf.col) {
    h.push('<span class="' + CFG.ns + '-chip"><span>' + esc(CFG.dimLabels[pf.colDim] || pf.colDim) + ': <b>' + esc(labelOf(pf.col)) + '</b></span><span class="' + CFG.ns + '-chip-x" data-drop-pivot="col" title="Снять срез">×</span></span>');
  }
  h.push('<button type="button" class="' + CFG.ns + '-freset" data-reset="1">Сбросить всё</button>');
  h.push('</div>');
  return h.join('');
}

// ----- Funnel (grey, proportional) -----
function buildFunnel() {
  // Пересчитываем все три значения с учётом фильтров из FACTS
  var legal = 0, active = 0, hq = 0, i, r;
  for (i = 0; i < FACTS.length; i++) {
    r = FACTS[i];
    if (!factPasses(r, null)) continue;
    legal += r.legal || 0;
    active += r.active || 0;
    hq += r.hq || 0;
  }

  // Форматируем применённые фильтры для тултипа
  var filterText = '';
  var f = state.filters || {}, d, val, label;
  var filterParts = [];
  for (d in f) {
    if (!hasProp(f, d)) continue;
    val = f[d];
    label = CFG.dimLabels[d] || d;
    if (Object.prototype.toString.call(val) === '[object Array]') {
      filterParts.push(label + ': ' + val.join(', '));
    } else {
      filterParts.push(label + ': ' + val);
    }
  }
  if (filterParts.length > 0) {
    filterText = 'Фильтры: ' + filterParts.join(' · ');
  }

  var base = Math.max(legal, active, hq, 1);
  var steps = [
    {
      cls: '1',
      nm: 'Юр. численность',
      v: legal,
      tip: {
        title: 'Юридическая численность',
        text: 'все сотрудники за исключением сотрудников на этапе оформления' + (filterText ? '\n' + filterText : ''),
        rows: [
          { label: 'Человек', value: nfmt(legal), color: 'rgba(199,200,204,0.20)' }
        ]
      }
    },
    {
      cls: '2',
      nm: 'Активная численность',
      v: active,
      tip: {
        title: 'Активная численность',
        text: 'исключая стажеров, декрет, прогульщиков, учебные юниты, подрядчиков' + (filterText ? '\n' + filterText : ''),
        rows: [
          { label: 'Человек', value: nfmt(active), color: 'rgba(168,175,186,0.35)' }
        ]
      }
    },
    {
      cls: '3',
      nm: 'HQ',
      v: hq,
      tip: {
        title: 'HQ',
        text: 'активные сотрудники в покраске HQ' + (filterText ? '\n' + filterText : ''),
        rows: [
          { label: 'Человек', value: nfmt(hq), color: 'rgba(122,130,144,0.55)' }
        ]
      }
    }
  ];
  var h = [];
  h.push('<div><div class="' + CFG.ns + '-pb-h"><span class="' + CFG.ns + '-pb-lbl">Воронка численности</span></div>');
  h.push('<div class="' + CFG.ns + '-funnel">');
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    var w = base > 0 ? (s.v / base * 100) : 0;
    if (w < 2 && s.v > 0) w = 2;
    var tip = tipAttr(s.tip);
    h.push(
      '<div class="' + CFG.ns + '-fn-row' + (s.cls === '3' ? ' hq' : '') + '" data-tip="' + tip + '">' +
        '<div class="' + CFG.ns + '-fn-nm">' + esc(s.nm) + '</div>' +
        '<div class="' + CFG.ns + '-fn-track">' +
          '<div class="' + CFG.ns + '-fn-bar ' + CFG.ns + '-fn-bar-' + s.cls + '" style="width:' + w.toFixed(2) + '%"></div>' +
        '</div>' +
        '<div class="' + CFG.ns + '-fn-v">' + esc(nfmt(s.v)) + '</div>' +
      '</div>'
    );
  }
  h.push('</div></div>');
  return h.join('');
}

// ----- Gender block -----
function buildGender() {
  var d = distByDim('gender');
  var m = d['Мужчина'] || 0, f = d['Женщина'] || 0, tot = m + f;
  var savedG = hasProp(state.filters, 'gender') ? state.filters.gender : null;
  state.filters.gender = 'Мужчина'; var mAge = avgAge(null);
  state.filters.gender = 'Женщина'; var fAge = avgAge(null);
  if (savedG === null) delete state.filters.gender; else state.filters.gender = savedG;
  var h = [];
  h.push('<div><div class="' + CFG.ns + '-pb-h"><span class="' + CFG.ns + '-pb-lbl">Гендерная структура</span><span class="' + CFG.ns + '-pb-sum">М : Ж ≈ <b>' + esc(ratioMF(m, f)) + '</b></span></div>');
  h.push('<div class="' + CFG.ns + '-stack-bar">');
  if (m > 0) h.push('<div class="' + CFG.ns + '-stack-seg" style="flex:' + m + ';background:' + CFG.colors.blue3 + '" data-tip="' + tipAttr({title:'Мужчины',rows:[{label:'Человек',value:nfmt(m),color:CFG.colors.blue3},{label:'Доля',value:pctOf(m,tot)}]}) + '">' + esc(pctOf(m, tot)) + '</div>');
  if (f > 0) h.push('<div class="' + CFG.ns + '-stack-seg dark" style="flex:' + f + ';background:' + CFG.colors.female + '" data-tip="' + tipAttr({title:'Женщины',rows:[{label:'Человек',value:nfmt(f),color:CFG.colors.female},{label:'Доля',value:pctOf(f,tot)}]}) + '">' + esc(pctOf(f, tot)) + '</div>');
  h.push('</div>');
  h.push('<div class="' + CFG.ns + '-gender-cards">');
  h.push('<div class="' + CFG.ns + '-gcard"><div class="' + CFG.ns + '-gcard-h"><span class="' + CFG.ns + '-gcard-name">Мужчины</span><span class="' + CFG.ns + '-gcard-cnt">' + esc(nfmt(m)) + '</span></div><div class="' + CFG.ns + '-gcard-facts">Средний возраст <b>' + esc(ageFmt(mAge)) + '</b></div></div>');
  h.push('<div class="' + CFG.ns + '-gcard"><div class="' + CFG.ns + '-gcard-h"><span class="' + CFG.ns + '-gcard-name">Женщины</span><span class="' + CFG.ns + '-gcard-cnt">' + esc(nfmt(f)) + '</span></div><div class="' + CFG.ns + '-gcard-facts">Средний возраст <b>' + esc(ageFmt(fAge)) + '</b></div></div>');
  h.push('</div></div>');
  return h.join('');
}

// ----- Age block -----
function buildAge() {
  var d = distByDim('age');
  // Используем порядок из CFG.order (точно совпадает с данными)
  var ageOrder = CFG.order.age || ['до 25', 'от 25 до 30', '30+'];
  var cats = [];
  for (var i = 0; i < ageOrder.length; i++) {
    if (d[ageOrder[i]] != null && d[ageOrder[i]] > 0) cats.push(ageOrder[i]);
  }
  var tot = 0, i;
  for (i = 0; i < cats.length; i++) tot += d[cats[i]] || 0;
  var avg = avgAge(null);
  // Распределение по полу внутри возрастных групп
  var genderByAge = {};
  for (i = 0; i < cats.length; i++) {
    var cat = cats[i];
    var savedG = hasProp(state.filters, 'gender') ? state.filters.gender : null;
    state.filters.gender = 'Мужчина';
    var mInCat = distByDim('age')[cat] || 0;
    state.filters.gender = 'Женщина';
    var fInCat = distByDim('age')[cat] || 0;
    if (savedG === null) delete state.filters.gender; else state.filters.gender = savedG;
    genderByAge[cat] = { m: mInCat, f: fInCat, tot: mInCat + fInCat };
  }
  var h = [];
  h.push('<div><div class="' + CFG.ns + '-pb-h"><span class="' + CFG.ns + '-pb-lbl">Возрастная структура</span><span class="' + CFG.ns + '-pb-sum">Средний возраст <b>' + esc(ageFmt(avg)) + '</b></span></div>');
  h.push('<div class="' + CFG.ns + '-stack-bar">');
  for (i = 0; i < cats.length; i++) {
    var k = cats[i], v = d[k] || 0;
    if (v <= 0) continue;
    var col = CFG.colors.ageColors[k] || '#DDD';
    h.push('<div class="' + CFG.ns + '-stack-seg dark" style="flex:' + v + ';background:' + col + '" data-tip="' + tipAttr({title:k,rows:[{label:'Человек',value:nfmt(v),color:col},{label:'Доля',value:pctOf(v,tot)}]}) + '"><span>' + esc(k) + '</span>&nbsp;·&nbsp;<span>' + esc(pctOf(v, tot)) + '</span></div>');
  }
  h.push('</div>');
  h.push('<div class="' + CFG.ns + '-gender-cards three">');
  for (i = 0; i < cats.length; i++) {
    var kk = cats[i];
    var vv = d[kk] || 0;
    if (vv <= 0) continue;
    var g = genderByAge[kk] || { m: 0, f: 0, tot: 0 };
    var mPct = g.tot > 0 ? pctOf(g.m, g.tot) : '0%';
    var fPct = g.tot > 0 ? pctOf(g.f, g.tot) : '0%';
    h.push('<div class="' + CFG.ns + '-gcard"><div class="' + CFG.ns + '-gcard-h"><span class="' + CFG.ns + '-gcard-name">' + esc(kk) + '</span><span class="' + CFG.ns + '-gcard-cnt">' + esc(nfmt(vv)) + '</span></div><div class="' + CFG.ns + '-gcard-facts">М ' + esc(mPct) + ' · Ж ' + esc(fPct) + '</div></div>');
  }
  h.push('</div></div>');
  return h.join('');
}

// ----- Left panel (portrait) -----
function buildPortrait() {
  var h = [];
  h.push('<div class="' + CFG.ns + '-panel">');
  h.push('<div class="' + CFG.ns + '-panel-h"><div class="' + CFG.ns + '-h-txt"><span class="' + CFG.ns + '-h-title">Портрет сотрудника</span><span class="' + CFG.ns + '-sub">воронка · пол · возраст</span></div></div>');
  h.push('<div class="' + CFG.ns + '-panel-b">');
  h.push('<div class="' + CFG.ns + '-portrait-blocks">');
  h.push(buildFunnel());
  h.push(buildGender());
  h.push(buildAge());
  h.push('</div></div></div>');
  return h.join('');
}

// ----- Universal table (for qual/contract) -----
function buildDimTable(dim, sectionTitle, sortByCount, metric, skipPivot) {
  metric = metric || 'hq';
  var cats = collectCats(dim, sortByCount, metric, skipPivot);
  var counts = distByDim(dim, metric, skipPivot);
  var i, tot = 0, maxCnt = 0;
  for (i = 0; i < cats.length; i++) {
    var v = counts[cats[i]] || 0;
    tot += v; if (v > maxCnt) maxCnt = v;
  }
  var h = [];
  h.push('<table class="' + CFG.ns + '-ptable"><colgroup><col style="width:35%"><col style="width:15%"><col style="width:15%"><col></colgroup>');
  h.push('<thead><tr><th>' + esc(CFG.dimLabels[dim] || dim) + '</th><th>Чел.</th><th>%</th><th></th></tr></thead><tbody>');
  for (i = 0; i < cats.length; i++) {
    var k = cats[i], c = counts[k] || 0;
    var pct = tot > 0 ? c / tot * 100 : 0;
    var wpct = maxCnt > 0 ? c / maxCnt * 100 : 0;
    var fv = state.filters[dim];
    var sel = (Object.prototype.toString.call(fv) === '[object Array]') ? (fv.indexOf(k) !== -1) : (fv === k);
    var rowTip = tipAttr({ title: labelOf(k), text: sel ? 'Срез активен. Клик — снять.' : 'Клик — взять срез. Shift+клик — добавить в выбор.' });
    var barTip = tipAttr({ title: labelOf(k), rows: [{ label: 'Человек', value: nfmt(c), color: CFG.colors.accent }, { label: 'Доля', value: pctFmt(pct) }] });
    h.push('<tr class="' + CFG.ns + '-urow' + (sel ? ' sel' : '') + '" data-dim="' + esc(dim) + '" data-key="' + esc(k) + '" data-tip="' + rowTip + '"><td>' + esc(labelOf(k)) + '</td><td>' + esc(nfmt(c)) + '</td><td>' + esc(pctFmt(pct)) + '</td><td data-tip="' + barTip + '"><span class="' + CFG.ns + '-cellbar"><i style="width:' + wpct.toFixed(1) + '%"></i></span></td></tr>');
  }
  h.push('</tbody></table>');
  return h.join('');
}

function buildQualView() {
  // Квалификация — HQ численность
  return buildDimTable('seniority', null, null, 'hq') +
         buildDimTable('grade', null, null, 'hq') +
         buildDimTable('tenure', null, null, 'hq');
}

function buildContractView() {
  // Оформление — HQ численность
  return buildDimTable('company', null, true, 'hq') +
         buildDimTable('employment', null, true, 'hq') +
         buildDimTable('format', null, true, 'hq');
}

function isStreamSelected(k) {
  // Проверка фильтра по stream
  var fv = state.filters.stream;
  if (fv) {
    if (Object.prototype.toString.call(fv) === '[object Array]') {
      if (fv.indexOf(k) !== -1) return true;
    } else if (fv === k) {
      return true;
    }
  }
  // Проверка фильтра по specialization
  var sv = state.filters.specialization;
  if (sv) {
    if (Object.prototype.toString.call(sv) === '[object Array]') {
      if (sv.indexOf(k) !== -1) return true;
    } else if (sv === k) {
      return true;
    }
  }
  return false;
}
function buildStreamView() {
  var tree = buildStreamTree();
  if (!tree || tree.length === 0) {
    return '<div class="' + CFG.ns + '-empty">Нет данных по стримам</div>';
  }
  // Считаем total ВСЕХ специализаций (без фильтров) для отображения 100%
  var totalAll = 0, i, j, g;
  for (i = 0; i < tree.length; i++) {
    g = tree[i];
    if (!g || !g.children) continue;
    for (j = 0; j < g.children.length; j++) totalAll += g.children[j].cntAll || 0;
  }
  // Считаем total отфильтрованных для процентов
  var total = 0;
  for (i = 0; i < tree.length; i++) {
    g = tree[i];
    if (!g || !g.children) continue;
    for (j = 0; j < g.children.length; j++) total += g.children[j].cnt || 0;
  }
  var h = [], grpTot, selectedInGroup, expanded, childCount, specWord, gPct, badge, groupTip, c, cnt, pct, sel, childTip;
  var maxPct = 0;
  // Сначала считаем maxPct по всем видимым
  for (i = 0; i < tree.length; i++) {
    g = tree[i];
    if (!g || !g.children) continue;
    for (j = 0; j < g.children.length; j++) {
      c = g.children[j];
      if (!c) continue;
      var pctAll = totalAll > 0 ? (c.cntAll || 0) / totalAll * 100 : 0;
      if (pctAll > maxPct) maxPct = pctAll;
    }
  }
  h.push('<div class="' + CFG.ns + '-st-ctl"><button type="button" class="' + CFG.ns + '-st-toggle-all" data-st-toggle="all">⇄ Раскрыть/свернуть всё</button></div>');
  for (i = 0; i < tree.length; i++) {
    g = tree[i];
    if (!g || !g.children) continue;
    grpTot = 0;
    for (j = 0; j < g.children.length; j++) grpTot += g.children[j].cnt || 0;
    gPct = total > 0 ? grpTot / total * 100 : 0;
    for (j = 0; j < g.children.length; j++) {
      c = g.children[j];
      if (!c) continue;
      pct = totalAll > 0 ? (c.cntAll || 0) / totalAll * 100 : 0;
      if (pct > maxPct) maxPct = pct;
    }
  }
  for (i = 0; i < tree.length; i++) {
    g = tree[i];
    if (!g || !g.children) continue;
    grpTot = 0; selectedInGroup = 0;
    for (j = 0; j < g.children.length; j++) {
      grpTot += g.children[j].cnt || 0;
      if (isStreamSelected(g.children[j].id)) selectedInGroup++;
    }
    gPct = total > 0 ? grpTot / total * 100 : 0;
    expanded = !!state.streamExpanded[g.id];
    childCount = g.children.length;
    specWord = pluralRu(childCount, 'специализация', 'специализации', 'специализаций');
    badge = selectedInGroup > 0 ? '<span class="' + CFG.ns + '-st-badge">' + selectedInGroup + '</span>' : '';
    groupTip = tipAttr({
      title: g.title || '',
      text: selectedInGroup > 0 ? 'Shift+клик — снять всю группу. Клик — раскрыть/свернуть.' : 'Клик — раскрыть/свернуть. Shift+клик — выбрать все.',
      rows: [{ label: 'Человек (фильтр)', value: nfmt(grpTot), color: CFG.colors.accent }, { label: 'Доля', value: pctFmt(gPct) }, { label: 'Специализаций', value: String(childCount) }]
    });
    var gBarW = maxPct > 0 ? (gPct / maxPct * 100).toFixed(1) : 0;
    h.push('<div class="' + CFG.ns + '-st-row st-group" data-group="' + esc(g.id) + '" data-stream="' + esc(g.id) + '" data-tip="' + groupTip + '"><span class="' + CFG.ns + '-st-body"><span class="' + CFG.ns + '-st-chev' + (expanded ? ' expanded' : '') + '">▶</span><span class="' + CFG.ns + '-st-namewrap"><span class="' + CFG.ns + '-st-name-line"><span class="' + CFG.ns + '-st-name">' + esc(g.title || '') + '</span>' + badge + '</span><span class="' + CFG.ns + '-st-sub">' + childCount + ' ' + specWord + '</span></span></span><span class="' + CFG.ns + '-st-count">' + esc(nfmt(grpTot)) + '</span><span class="' + CFG.ns + '-st-pct">' + esc(pctFmt(gPct)) + '</span><span class="' + CFG.ns + '-st-bar-wrap"><span class="' + CFG.ns + '-st-bar"><i style="width:' + gBarW + '%"></i></span></span></div>');
    for (j = 0; j < g.children.length; j++) {
      c = g.children[j];
      if (!c) continue;
      cnt = c.cnt || 0;
      cntAll = c.cntAll || 0;
      pct = totalAll > 0 ? cntAll / totalAll * 100 : 0;
      sel = isStreamSelected(c.id);
      childTip = tipAttr({
        title: c.n || c.id || '',
        text: sel ? 'Срез активен. Клик — снять.' : 'Клик — взять срез. Shift+клик — добавить.',
        rows: [{ label: 'Человек (фильтр)', value: nfmt(cnt), color: CFG.colors.accent }, { label: 'Человек (всего)', value: nfmt(cntAll) }, { label: 'Доля', value: pctFmt(pct) }]
      });
      var cBarW = maxPct > 0 ? (pct / maxPct * 100).toFixed(1) : 0;
      h.push('<div class="' + CFG.ns + '-st-row st-child' + (expanded ? '' : ' hidden') + (sel ? ' sel' : '') + '" data-group="' + esc(g.id) + '" data-dim="specialization" data-key="' + esc(c.id) + '" data-tip="' + childTip + '"><span class="' + CFG.ns + '-st-body"><span class="' + CFG.ns + '-st-chev hidden"></span><span class="' + CFG.ns + '-st-namewrap"><span class="' + CFG.ns + '-st-name">' + esc(c.n || c.id || '') + '</span></span></span><span class="' + CFG.ns + '-st-count">' + esc(nfmt(cntAll)) + '</span><span class="' + CFG.ns + '-st-pct">' + esc(pctFmt(pct)) + '</span><span class="' + CFG.ns + '-st-bar-wrap"><span class="' + CFG.ns + '-st-bar"><i style="width:' + cBarW + '%"></i></span></span></div>');
    }
  }
  return h.join('');
}

function buildPivotView() {
  if (!state.pivot) return '<div class="' + CFG.ns + '-empty"><b>Ошибка состояния</b>Конструктор не инициализирован.</div>';
  var rowDim = state.pivot.row, colDim = state.pivot.col, mode = state.pivot.mode;
  var DIMS = ['seniority','grade','tenure','gender','age','stream','company','employment','format'];
  var h = [], i;

  // Если специализация в колонках — показываем заглушку
  if (colDim === 'stream') {
    h.push('<div class="' + CFG.ns + '-pv-ctl">');
    h.push('<label>Строки: <select class="' + CFG.ns + '-pv-sel" data-pv="row">');
    for (i = 0; i < DIMS.length; i++) h.push('<option value="' + esc(DIMS[i]) + '"' + (DIMS[i] === rowDim ? ' selected' : '') + '>' + esc(CFG.dimLabels[DIMS[i]] || DIMS[i]) + '</option>');
    h.push('</select></label>');
    h.push('<button type="button" class="' + CFG.ns + '-pv-swap" data-pv-swap="1">⇄</button>');
    h.push('<label>Колонки: <select class="' + CFG.ns + '-pv-sel" data-pv="col">');
    for (i = 0; i < DIMS.length; i++) h.push('<option value="' + esc(DIMS[i]) + '"' + (DIMS[i] === colDim ? ' selected' : '') + '>' + esc(CFG.dimLabels[DIMS[i]] || DIMS[i]) + '</option>');
    h.push('</select></label>');
    h.push('<span class="' + CFG.ns + '-pv-mode">');
    h.push('<button type="button" data-pv-mode="n"' + (mode === 'n' ? ' class="on"' : '') + '>Чел.</button>');
    h.push('<button type="button" data-pv-mode="row"' + (mode === 'row' ? ' class="on"' : '') + '>% строки</button>');
    h.push('<button type="button" data-pv-mode="col"' + (mode === 'col' ? ' class="on"' : '') + '>% колонки</button>');
    h.push('</span></div>');
    h.push('<div style="padding:40px;text-align:center;color:' + CFG.colors.muted + ';font-size:14px;">Специализации используются только в строках, таблица слишком большая</div>');
    return h.join('');
  }

  h.push('<div class="' + CFG.ns + '-pv-ctl">');
  h.push('<label>Строки: <select class="' + CFG.ns + '-pv-sel" data-pv="row">');
  for (i = 0; i < DIMS.length; i++) h.push('<option value="' + esc(DIMS[i]) + '"' + (DIMS[i] === rowDim ? ' selected' : '') + '>' + esc(CFG.dimLabels[DIMS[i]] || DIMS[i]) + '</option>');
  h.push('</select></label>');
  h.push('<button type="button" class="' + CFG.ns + '-pv-swap" data-pv-swap="1">⇄</button>');
  h.push('<label>Колонки: <select class="' + CFG.ns + '-pv-sel" data-pv="col">');
  for (i = 0; i < DIMS.length; i++) h.push('<option value="' + esc(DIMS[i]) + '"' + (DIMS[i] === colDim ? ' selected' : '') + '>' + esc(CFG.dimLabels[DIMS[i]] || DIMS[i]) + '</option>');
  h.push('</select></label>');
  h.push('<span class="' + CFG.ns + '-pv-mode">');
  h.push('<button type="button" data-pv-mode="n"' + (mode === 'n' ? ' class="on"' : '') + '>Чел.</button>');
  h.push('<button type="button" data-pv-mode="row"' + (mode === 'row' ? ' class="on"' : '') + '>% строки</button>');
  h.push('<button type="button" data-pv-mode="col"' + (mode === 'col' ? ' class="on"' : '') + '>% колонки</button>');
  h.push('</span>');
  var fsIcon = state.pivot && state.pivot.fullscreen ? '↙' : '⛶';
  var fsTitle = state.pivot && state.pivot.fullscreen ? 'Свернуть' : 'На весь экран';
  h.push('<button type="button" class="' + CFG.ns + '-pv-fs" data-pv-fs="1" title="' + fsTitle + '">' + fsIcon + '</button>');
  h.push('</div>');
  if (rowDim === colDim) {
    h.push('<div class="' + CFG.ns + '-empty"><b>Выбери разные измерения</b>Строки и колонки должны отличаться.</div>');
    return h.join('');
  }
  var rowCats = collectCats(rowDim, false, null, true), colCats = collectCats(colDim, false, null, true);
  var rowField = (rowDim === 'stream') ? 'specialization' : rowDim;
  var colField = (colDim === 'stream') ? 'specialization' : colDim;
  var matrix = {}, rowT = {}, colT = {}, grand = 0, r, ck, rk, m;
  for (i = 0; i < rowCats.length; i++) { matrix[rowCats[i]] = {}; rowT[rowCats[i]] = 0; }
  for (i = 0; i < colCats.length; i++) colT[colCats[i]] = 0;
  for (i = 0; i < FACTS.length; i++) {
    r = FACTS[i];
    // В конструкторе игнорируем pivotFilters (третий параметр true)
    if (!factPasses(r, null, true)) continue;
    rk = r[rowField]; ck = r[colField];
    if (matrix[rk] == null || colT[ck] == null) continue;
    m = r.hq || 0;
    matrix[rk][ck] = (matrix[rk][ck] || 0) + m;
    rowT[rk] += m; colT[ck] += m; grand += m;
  }
  var disp = {}, maxDisp = 0, j, n, dv;
  for (i = 0; i < rowCats.length; i++) {
    disp[rowCats[i]] = {};
    for (j = 0; j < colCats.length; j++) {
      n = matrix[rowCats[i]][colCats[j]] || 0;
      dv = n;
      if (mode === 'row') dv = rowT[rowCats[i]] > 0 ? n / rowT[rowCats[i]] * 100 : 0;
      else if (mode === 'col') dv = colT[colCats[j]] > 0 ? n / colT[colCats[j]] * 100 : 0;
      disp[rowCats[i]][colCats[j]] = dv;
      if (dv > maxDisp) maxDisp = dv;
    }
  }
  var steps = 7, legendH = '';
  for (i = 0; i < steps; i++) legendH += '<i style="background:' + heatFill(i / (steps - 1)) + '"></i>';
  h.push('<div class="' + CFG.ns + '-pv-legend"><span>' + (mode === 'n' ? 'меньше' : 'меньше доли') + '</span>' + legendH + '<span>' + (mode === 'n' ? 'больше' : 'больше доли') + '</span></div>');
  // Определяем, есть ли активный фильтр из конструктора
  var hasPivotFilter = !!(state.pivotFilters && state.pivotFilters.row && state.pivotFilters.col);
  h.push('<table class="' + CFG.ns + '-pv-tbl' + (hasPivotFilter ? ' fade' : '') + '">');
  h.push('<thead><tr><th class="' + CFG.ns + '-pv-corner"><div class="' + CFG.ns + '-pv-corner-inner"><div class="' + CFG.ns + '-pv-corner-top">' + esc(CFG.dimLabels[colDim]) + ' <span class="' + CFG.ns + '-pv-arrow right">→</span></div><div class="' + CFG.ns + '-pv-corner-bot"><span class="' + CFG.ns + '-pv-arrow left">↓</span> ' + esc(CFG.dimLabels[rowDim]) + '</div></div></th>');
  for (i = 0; i < colCats.length; i++) h.push('<th>' + esc(labelOf(colCats[i])) + '</th>');
  h.push('</tr></thead><tbody>');
  for (i = 0; i < rowCats.length; i++) {
    h.push('<tr><th>' + esc(labelOf(rowCats[i])) + '</th>');
    for (j = 0; j < colCats.length; j++) {
      n = matrix[rowCats[i]][colCats[j]] || 0;
      dv = disp[rowCats[i]][colCats[j]];
      var t;
      if (mode === 'n') t = maxDisp > 0 ? n / maxDisp : 0;
      else if (mode === 'row') t = rowT[rowCats[i]] > 0 ? n / rowT[rowCats[i]] : 0;
      else t = colT[colCats[j]] > 0 ? n / colT[colCats[j]] : 0;
      var bg = heatFill(t);
      var cls = CFG.ns + '-pv-cell' + (t >= 0.55 ? ' hi' : '') + (dv === 0 ? ' zero' : '');
      // Проверяем, активна ли ячейка
      var isActive = hasPivotFilter && rowCats[i] === state.pivotFilters.row && colCats[j] === state.pivotFilters.col;
      if (isActive) cls += ' sel';
      var text = mode === 'n' ? (n === 0 ? '—' : nfmt(n)) : (dv === 0 ? '—' : pctFmt(dv));
      var tip = tipAttr({
        title: labelOf(rowCats[i]) + ' × ' + labelOf(colCats[j]),
        rows: [
          { label: 'Человек', value: nfmt(n) },
          { label: '% по строке', value: rowT[rowCats[i]] > 0 ? pctFmt(n / rowT[rowCats[i]] * 100) : '0%' },
          { label: '% по колонке', value: colT[colCats[j]] > 0 ? pctFmt(n / colT[colCats[j]] * 100) : '0%' },
          { label: '% от всех', value: grand > 0 ? pctFmt(n / grand * 100) : '0%' }
        ]
      });
      h.push('<td class="' + cls + '" style="background:' + bg + '" data-tip="' + tip + '" data-pv-click="' + esc(rowDim) + ':' + esc(rowCats[i]) + ',' + esc(colDim) + ':' + esc(colCats[j]) + '">' + esc(text) + '</td>');
    }
    h.push('</tr>');
  }
  h.push('<tr class="' + CFG.ns + '-pv-total-row"><th>Итого</th>');
  for (j = 0; j < colCats.length; j++) {
    var vv;
    if (mode === 'n') vv = nfmt(colT[colCats[j]] || 0);
    else if (mode === 'col') vv = '100%';
    else vv = grand > 0 ? pctFmt((colT[colCats[j]] || 0) / grand * 100) : '0%';
    h.push('<td>' + esc(vv) + '</td>');
  }
  h.push('</tr>');
  h.push('</tbody></table>');
  return h.join('');
}

function buildRight() {
  var TABS = [
    { k: 'qual', l: 'Уровень позиции' },
    { k: 'contract', l: 'Оформление' },
    { k: 'stream', l: 'Стримы' },
    { k: 'custom', l: 'Конструктор' }
  ];
  var META = {
    qual: { title: 'Уровень позиции', sub: 'клик по строке — срез · срезы складываются' },
    contract: { title: 'Оформление', sub: 'клик по строке — срез' },
    stream: { title: 'Стримы', sub: 'клик по строке — срез · Shift+клик — вся группа' },
    custom: { title: 'Конструктор', sub: 'выбери измерения по строкам и колонкам' }
  };
  var meta = META[state.tab] || META.qual;
  if (!META[state.tab]) state.tab = 'qual';
  var h = [], i;
  h.push('<div class="' + CFG.ns + '-panel">');
  h.push('<div class="' + CFG.ns + '-panel-h"><div class="' + CFG.ns + '-h-txt"><span class="' + CFG.ns + '-h-title">' + esc(meta.title) + '</span><span class="' + CFG.ns + '-sub">' + esc(meta.sub) + '</span></div><div class="' + CFG.ns + '-tabs">');
  for (i = 0; i < TABS.length; i++) h.push('<button type="button" class="' + CFG.ns + '-tab' + (state.tab === TABS[i].k ? ' on' : '') + '" data-tab="' + esc(TABS[i].k) + '">' + esc(TABS[i].l) + '</button>');
  h.push('</div></div>');
  h.push('<div class="' + CFG.ns + '-panel-b"><div class="' + CFG.ns + '-views">');
  h.push('<div class="' + CFG.ns + '-view' + (state.tab === 'qual' ? ' on' : '') + '" data-v="qual">' + (state.tab === 'qual' ? buildQualView() : '') + '</div>');
  h.push('<div class="' + CFG.ns + '-view' + (state.tab === 'contract' ? ' on' : '') + '" data-v="contract">' + (state.tab === 'contract' ? buildContractView() : '') + '</div>');
  h.push('<div class="' + CFG.ns + '-view' + (state.tab === 'stream' ? ' on' : '') + '" data-v="stream">' + (state.tab === 'stream' ? buildStreamView() : '') + '</div>');
  h.push('<div class="' + CFG.ns + '-view' + (state.tab === 'custom' ? ' on' : '') + '" data-v="custom">' + (state.tab === 'custom' ? buildPivotView() : '') + '</div>');
  h.push('</div></div></div>');
  return h.join('');
}

function buildHTML() {
  if (!FACTS.length) return buildCSS() + '<div class="' + CFG.ns + '-root"><div class="' + CFG.ns + '-nodata">' + esc(CFG.text.noData) + '</div></div>';
  var h = [];
  h.push('<div class="' + CFG.ns + '-root">');
  h.push(buildFilterBar());
  h.push('<div class="' + CFG.ns + '-split"' + (state.pivot && state.pivot.fullscreen ? ' style="display:none"' : '') + '>');
  h.push(buildPortrait());
  h.push(buildRight());
  h.push('</div>');
  if (state.pivot && state.pivot.fullscreen) {
    h.push('<div class="' + CFG.ns + '-pv-fs-overlay">');
    h.push(buildPivotView());
    h.push('</div>');
  }
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
      var o = state.tip.data || {}, rows = o.rows || [], h = [], j;
      if (o.title) h.push('<span class="' + CFG.ns + '-tip-h">' + esc(o.title) + '</span>');
      if (o.text) h.push('<span class="' + CFG.ns + '-tip-x">' + esc(o.text) + '</span>');
      for (j = 0; j < rows.length; j++) {
        var rr = rows[j] || {};
        h.push('<span class="' + CFG.ns + '-tip-r">' + (rr.color ? '<i class="' + CFG.ns + '-tip-m" style="background:' + esc(rr.color) + '"></i>' : '') + '<span class="' + CFG.ns + '-tip-l">' + esc(rr.label) + '</span><b class="' + CFG.ns + '-tip-v">' + esc(rr.value) + '</b></span>');
      }
      tip.innerHTML = h.join('');
      tip.style.opacity = '1';
      var x = state.tip.x || 0, y = state.tip.y || 0, w = tip.offsetWidth || 220, th = tip.offsetHeight || 60;
      var l = x + 16, t = y - th - 14;
      if (l + w > window.innerWidth - 10) l = x - w - 16;
      if (l < 10) l = 10;
      if (t < 10) t = y + 20;
      tip.style.left = Math.round(l) + 'px'; tip.style.top = Math.round(t) + 'px';
    }

    function toggleFilter(dim, key, shift) {
      if (!state.filters) state.filters = {};
      if (!dim) return;
      var cur = state.filters[dim];
      var isArr = Object.prototype.toString.call(cur) === '[object Array]';
      if (shift) {
        if (isArr) {
          var idx = cur.indexOf(key);
          if (idx >= 0) { cur.splice(idx, 1); if (cur.length === 0) delete state.filters[dim]; else if (cur.length === 1) state.filters[dim] = cur[0]; }
          else cur.push(key);
        } else if (cur === key) {
          delete state.filters[dim];
        } else if (cur) {
          state.filters[dim] = [cur, key];
        } else {
          state.filters[dim] = key;
        }
      } else {
        if (isArr) {
          if (cur.indexOf(key) !== -1 && cur.length === 1) delete state.filters[dim];
          else state.filters[dim] = key;
        } else if (cur === key) delete state.filters[dim];
        else state.filters[dim] = key;
      }
    }

    function setFilter(dim, key, shift) {
      if (!state.filters) state.filters = {};
      if (!dim) return;
      var cur = state.filters[dim];
      var isArr = Object.prototype.toString.call(cur) === '[object Array]';
      if (shift) {
        if (isArr) {
          var idx = cur.indexOf(key);
          if (idx >= 0) { cur.splice(idx, 1); if (cur.length === 0) delete state.filters[dim]; else if (cur.length === 1) state.filters[dim] = cur[0]; }
          else cur.push(key);
        } else if (cur === key) {
          delete state.filters[dim];
        } else if (cur) {
          state.filters[dim] = [cur, key];
        } else {
          state.filters[dim] = key;
        }
      } else {
        state.filters[dim] = key;
      }
    }

    function attachHandlers() {
      // Глобальный обработчик Escape — вешается ОДИН раз вне render()
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.pivot && state.pivot.fullscreen) {
          state.pivot.fullscreen = false;
          render();
        }
      });
    }

    function render() {
      overlay.innerHTML = buildHTML();

      overlay.onclick = function(e) {
        var t;
        t = e.target.closest ? e.target.closest('[data-reset]') : null;
        if (t) { state.filters = {}; state.pivotFilters = {}; state.tip = null; render(); return; }
        t = e.target.closest ? e.target.closest('[data-drop]') : null;
        if (t) {
          var dropDim = t.getAttribute('data-drop');
          delete state.filters[dropDim];
          state.tip = null; render(); return;
        }
        t = e.target.closest ? e.target.closest('[data-drop-pivot]') : null;
        if (t) {
          var dropSide = t.getAttribute('data-drop-pivot');
          if (!state.pivotFilters) state.pivotFilters = {};
          if (dropSide === 'row') { delete state.pivotFilters.rowDim; delete state.pivotFilters.row; }
          else if (dropSide === 'col') { delete state.pivotFilters.colDim; delete state.pivotFilters.col; }
          state.tip = null; render(); return;
        }
        t = e.target.closest ? e.target.closest('[data-tab]') : null;
        if (t) {
          var tabVal = t.getAttribute('data-tab');
          if (tabVal === 'qual' || tabVal === 'contract' || tabVal === 'stream' || tabVal === 'custom') {
            state.tab = tabVal;
            state.tip = null;
            render();
          }
          return;
        }
        t = e.target.closest ? e.target.closest('[data-pv-swap]') : null;
        if (t && state.pivot) {
          var tmp = state.pivot.row;
          state.pivot.row = state.pivot.col;
          state.pivot.col = tmp;
          state.tip = null;
          render();
          return;
        }
        t = e.target.closest ? e.target.closest('[data-pv-mode]') : null;
        if (t && state.pivot) {
          var modeVal = t.getAttribute('data-pv-mode');
          if (modeVal) {
            state.pivot.mode = modeVal;
            state.tip = null;
            render();
          }
          return;
        }
        t = e.target.closest ? e.target.closest('[data-pv-fs]') : null;
        if (t && state.pivot) {
          state.pivot.fullscreen = !state.pivot.fullscreen;
          state.tip = null;
          render();
          return;
        }
        t = e.target.closest ? e.target.closest('[data-pv-click]') : null;
        if (t && state.pivot) {
          var clickVal = t.getAttribute('data-pv-click');
          if (clickVal) {
            var parts = clickVal.split(',');
            var rowPart = parts[0].split(':'), colPart = parts[1].split(':');
            var rowDim = rowPart[0], rowKey = rowPart[1];
            var colDim = colPart[0], colKey = colPart[1];
            if (!state.pivotFilters) state.pivotFilters = {};
            var pf = state.pivotFilters;
            // Клик по уже активной ячейке (row и col совпадают) — сбросить весь срез
            var isSame = pf.rowDim === rowDim && pf.row === rowKey && pf.colDim === colDim && pf.col === colKey;
            if (isSame) {
              state.pivotFilters = {};
            } else {
              // Иначе применяем оба среза (строки и колонки)
              state.pivotFilters = { rowDim: rowDim, row: rowKey, colDim: colDim, col: colKey };
            }
            state.tip = null;
            render();
          }
          return;
        }
        t = e.target.closest ? e.target.closest('.' + CFG.ns + '-st-row.st-child') : null;
        if (t) {
          var dim = t.getAttribute('data-dim') || 'stream';
          var key = t.getAttribute('data-key');
          if (key) {
            setFilter(dim, key, !!e.shiftKey);
            state.tip = null;
            render();
          }
          return;
        }
        t = e.target.closest ? e.target.closest('.' + CFG.ns + '-st-row.st-group') : null;
        if (t) {
          var gid = t.getAttribute('data-group');
          // Клик — раскрыть/свернуть. Shift+клик — выбрать все специализации в группе.
          var isChevron = e.target.closest ? !!e.target.closest('.' + CFG.ns + '-st-chev') : false;
          if (isChevron || !e.shiftKey) {
            // Клик по стрелке или обычный клик — раскрыть/свернуть
            if (!state.streamExpanded) state.streamExpanded = {};
            state.streamExpanded[gid] = !state.streamExpanded[gid];
          } else {
            // Shift+клик — выбрать все специализации в группе
            var tree = buildStreamTree();
            var group = null;
            for (var i = 0; i < tree.length; i++) {
              if (tree[i].id === gid) { group = tree[i]; break; }
            }
            if (group && group.children) {
              var specs = [];
              for (var j = 0; j < group.children.length; j++) {
                specs.push(group.children[j].id);
              }
              state.filters.specialization = specs.length === 1 ? specs[0] : specs;
            }
          }
          state.tip = null; render(); return;
        }
        t = e.target.closest ? e.target.closest('[data-st-toggle]') : null;
        if (t) {
          if (!state.streamExpanded) state.streamExpanded = {};
          var allExpanded = true;
          var tree = buildStreamTree();
          for (i = 0; i < tree.length; i++) {
            if (tree[i] && !state.streamExpanded[tree[i].id]) { allExpanded = false; break; }
          }
          for (i = 0; i < tree.length; i++) {
            if (tree[i]) state.streamExpanded[tree[i].id] = !allExpanded;
          }
          state.tip = null; render(); return;
        }
        t = e.target.closest ? e.target.closest('.' + CFG.ns + '-urow') : null;
        if (t) {
          var dim = t.getAttribute('data-dim');
          var key = t.getAttribute('data-key');
          if (dim && key) {
            toggleFilter(dim, key, !!e.shiftKey);
            state.tip = null;
            render();
          }
          return;
        }
      };

      overlay.onchange = function(e) {
        var t = e.target.closest ? e.target.closest('[data-pv]') : null;
        if (!t) return;
        var which = t.getAttribute('data-pv');
        if (which && state.pivot) {
          state.pivot[which] = t.value;
          state.tip = null;
          render();
        }
      };

      overlay.onmousemove = function(e) {
        var t = e.target.closest ? e.target.closest('[data-tip]') : null;
        if (!t) { if (state.tip) { state.tip = null; renderTip(); } return; }
        var raw = t.getAttribute('data-tip'), parsed = null;
        parsed = (raw && raw.charAt(0) === '{') ? JSON.parse(raw) : { title: raw, rows: [] };
        state.tip = { data: parsed, x: e.clientX, y: e.clientY };
        renderTip();
      };
      overlay.onmouseleave = function() { state.tip = null; renderTip(); };
      renderTip();
    }
    render();
    attachHandlers();

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function() { overlay.style.width = '100%'; overlay.style.height = '100%'; });
      ro.observe(host);
    }
  } catch (e) {
    var errMsg = document.createElement('div');
    errMsg.style.cssText = 'position:absolute;left:20px;top:20px;font-size:14px;color:#d00;z-index:99999;';
    errMsg.textContent = 'Ошибка графика: ' + (e.message || e);
    if (overlay) overlay.appendChild(errMsg);
    else host.appendChild(errMsg);
  }
})();

// ---------- БЛОК 7: ПУСТОЙ OPTION ----------
option = {
  animation: false,
  xAxis: { show: false, type: 'value' },
  yAxis: { show: false, type: 'value' },
  series: [{ type: 'scatter', data: [] }]
};