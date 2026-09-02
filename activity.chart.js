// ============================================================================
// activity.chart.js — лист «Мониторинг рабочей активности»
// ============================================================================
// Один Proteus-график на весь лист: KPI-полоса, состав по категориям,
// динамика активности и звонков, таблица по подразделениям.
// Собран из трёх прежних файлов (kpi / barchart / table) — они строились
// на одной витрине, поэтому и запрос теперь один (activity.sql).
//
// КОНТРАКТ PROTEUS:
//   ECharts = только холст. Вся визуализация — HTML/CSS/SVG в overlay.
//   Хост = ПОСЛЕДНИЙ [_echarts_instance_]. Canvas прячем. Overlay — appendChild.
//   В САМОМ КОНЦЕ ФАЙЛА, ГЛОБАЛЬНО: option = {...} с пустым scatter.
//
// ЗАПРЕЩЕНО: backticks/template-literals, стрелочные функции, let/const,
//   document.getElementById (только overlay.querySelector), console.log в итоге.
// ОБЯЗАТЕЛЬНО: все 7 блоков ниже, в таком порядке, без перенумерации.
//
// ЧТО СЧИТАЕТ JS (в SQL этого больше нет):
//   доли, средние, дельты, итоги, «все подразделения», недельные доли для
//   спарклайнов, пересчёт всего листа под выбранное подразделение.
//   SQL отдаёт только аддитивные счётчики и суммы двух гранулярностей:
//   строки 'month' (как в 1.0) и строки 'week' (состав по cat_week, численность
//   недели, компоненты средних). Нет строк 'week' — лист работает по месяцам,
//   переключатель «Месяцы / Недели» и спарклайны не показываются.
//
// ИНТЕРАКТИВ:
//   клик по строке таблицы  → фильтрует KPI-полосу и оба графика;
//   клик по столбцу состава → отмечает период на линиях динамики;
//   клик по легенде         → скрывает категорию из стека;
//   «Месяцы / Недели»       → гранулярность стека и линий; таблица и KPI —
//                             снимок недели, они не меняются;
//   клик по шапке колонки   → сортирует таблицу;
//   Escape                  → снимает фильтр и отметку периода.
// ============================================================================

// ---------- БЛОК 1: CFG ----------
var CFG = {
  ns: 'wa',

  // Имена колонок из activity.sql. Менять только здесь.
  fields: {
    dept: 'lvl_down_nm',
    month: 'date_structure',
    kind: 'row_kind',         // 'month' | 'week'; колонки нет — все строки месячные (выдача 1.0)
    flag: 'flag_last_week'    // в строках 'week': 1 — последняя закрытая неделя
  },

  sparkWeeks: 12,             // сколько закрытых недель показывает спарклайн в таблице

  text: {
    title: 'Мониторинг рабочей активности',
    subtitle: 'Статистика за последнюю закрытую неделю, сравнение с предыдущей',
    noDataHead: 'Нет данных по выбранным разрезам',
    noData: 'Снимите один из срезов в шапке отчёта.',
    allDepts: 'Все подразделения',
    sliceLabel: 'Срез:',
    filterLabel: 'Команда',
    filterReset: 'Снять срез',
    scopeNote: 'срез действует на показатели и графики, таблица показывает все подразделения',
    stackTitle: 'Состав по категориям',
    stackSubMonth: 'по месяцам, категория месяца',
    stackSubWeek: 'по неделям, категория недели',
    stackNote: 'Клик по столбцу отмечает период на графиках справа, клик по легенде убирает категорию',
    stackTotal: 'Всего в месяце',
    stackTotalWeek: 'Всего в неделе',
    grainMonth: 'Месяцы',
    grainWeek: 'Недели',
    grainTip: 'Гранулярность состава и динамики: категория месяца или категория недели. Таблица и показатели наверху — снимок последней недели, они не меняются',
    actTitle: 'Рабочая активность',
    actUnit: 'в среднем, ч/день',
    talkTitle: 'Доля звонков в Talk',
    talkUnit: 'в среднем, % рабочего времени',
    avgHint: 'среднее',
    tableTitle: 'Детализация по подразделениям',
    tableNote: 'Клик по строке пересчитывает показатели наверху под эту команду',
    rowTipHint: 'Нажмите на строку — показатели наверху пересчитаются по этой команде',
    rowTipHintOff: 'Нажмите ещё раз, чтобы вернуться ко всем подразделениям',
    sortHint: 'Сортировать по этой колонке',
    partsTitle: 'Состав категории',
    monthBase: 'к прошлому месяцу',
    weekBase: 'к прошлой неделе',
    sparkNote: 'Линия — доля от численности недели за последние закрытые недели, последняя точка совпадает с числом рядом',
    noBase: 'нет базы',
    notCompared: 'не сравнивается',
    pagerShown: 'Показаны',
    pagerOf: 'из',
    pagerPrev: 'Предыдущая страница',
    pagerNext: 'Следующая страница',
    pagerPage: 'Страница'
  },

  // Токены дизайн-системы TeamPulse (DESIGN_SYSTEM.md §2). Значения не правим.
  colors: {
    bg: '#f4f5f7',
    card: '#ffffff',
    line: '#e7e9ee',
    line2: '#eef0f3',
    ink: '#1f1f1f',
    ink2: '#3a3f4a',
    muted: '#8a909c',
    muted2: '#aab0bb',
    green: '#12b048', greenBg: '#bff2cd', greenTx: '#0a8f3c',
    red: '#f51f1f', redBg: '#ffcccc', redTx: '#d11414',
    blue: '#3b6fe0', blueBg: '#eef3fe', act: '#2b6cff',
    chipTx: '#2b5fd0', chipLine: '#dbe6fd',
    bench: '#9aa0ac',
    neutralBg: '#f3f4f6',
    hover: '#fafbfc',
    sel: '#f5f8ff',
    valInk: '#2b2b2b'    // §6.2: все подписи значений одного цвета
  },

  // §2: семь ролей кегля, десять ступеней отступа, пять радиусов.
  fonts: {
    family: 'Inter,Helvetica,Arial,sans-serif',
    micro: 9.5, cap: 10.5, note: 11.5, body: 12.5, lead: 13.5, head: 16, hero: 24
  },
  space: { s1: 2, s2: 4, s3: 6, s4: 8, s5: 10, s6: 12, s7: 14, s8: 16, s9: 20, s10: 24 },
  radius: { r1: 3, r2: 6, r3: 9, r4: 12, r5: 16, pill: 999 },
  shadow: '0 1px 3px rgba(20,28,45,.06),0 4px 16px rgba(20,28,45,.04)',

  // §6.3: единая геометрия графиков. Зазор между панелями — один на весь лист
  // (S.s7, как у сетки HQ), поэтому отдельной константы для него нет.
  geom: {
    AXIS_H: 30,      // высота оси X (период + месяц/год под ним)
    PAD_X: 6,        // боковые поля области построения
    VAL_SZ: 11,      // единственный кегль подписи значения
    VAL_DY: 9,       // отступ подписи от марки
    LBL_ROOM: 26,    // место под подписи сверху
    STACK_H: 362,    // запасная высота стека, если контейнер ещё не измерен
    LINE_H: 110,     // запасная высота линии
    BAR_MAX_W: 54,
    BAR_MIN_W: 10,
    DOT_R: 3.4
  },

  // Категории периода (cat_month в строках месяца, cat_week в строках недели).
  // Палитра живёт здесь, а не в SQL (§2: цвета только в токенах и рисовальном
  // слое). Крупная доля — бледнее, редкая — насыщеннее.
  cats: [
    { key: 'grey', field: 'cnt_cat_grey', name: 'Grey', color: '#c7c8cc',
      hint: 'Активность не размечена' },
    { key: 'under', field: 'cnt_cat_low', name: 'Недоработка', color: '#d4a5b5',
      hint: 'Категории low и super_low' },
    { key: 'normal', field: 'cnt_cat_normal', name: 'Нормал', color: '#d0e4e2',
      hint: 'Категория normal' },
    { key: 'over', field: 'cnt_cat_high', name: 'Переработка', color: '#5d9acb',
      hint: 'Категории high и super_high' }
  ],

  // KPI-полоса. positive: 'down' — рост плохо; 'none' — не окрашиваем вовсе.
  kpis: [
    {
      key: 'low', title: 'Недоработка',
      valueKey: 'low', prevKey: 'prev_low', positive: 'down', base: 'week',
      parts: [
        { key: 'low_fresh', label: '1–2 недели' },
        { key: 'low_long', label: 'больше 2 недель' }
      ],
      tip: 'Сотрудники с недельной активностью ниже нормы (Категории low или super_low) в последней закрытой неделе. Ниже — сколько недель человек уже в этой категории.'
    },
    {
      key: 'high', title: 'Переработка',
      valueKey: 'high', prevKey: 'prev_high', positive: 'down', base: 'week',
      parts: [
        { key: 'high_fresh', label: '1–2 недели' },
        { key: 'high_long', label: 'больше 2 недель' }
      ],
      tip: 'Сотрудники с недельной активностью выше нормы (Категории high или super_high) в последней закрытой неделе. Ниже — сколько недель человек уже в этой категории.'
    },
    {
      key: 'talk', title: 'Звонки в Talk 20–30%',
      valueKey: 'talk_20_30', prevKey: 'prev_talk_20_30', positive: 'none', base: 'week',
      valueNote: '20–30% рабочего времени',
      parts: [
        { key: 'talk_30_50', label: '30–50% времени' },
        { key: 'talk_50_plus', label: 'больше 50% времени' }
      ],
      tip: 'Сотрудники, у которых разговоры в Talk занимают 20–30% рабочего времени. Изменение не окрашено: больше не значит лучше — норма зависит от роли.'
    },
    {
      key: 'leave', title: 'Прогулы',
      valueKey: 'leave', positive: 'down', base: 'period',
      parts: [
        { key: 'leave_fresh', label: '2–5 дней' },
        { key: 'leave_long', label: 'больше 5 дней' }
      ],
      tip: 'Сотрудники, у которых за весь период больше одного дня отсутствия. Метрика периодовая, а не недельная, поэтому сравнения с прошлой неделей нет.'
    },
    {
      key: 'weekend', title: 'Работа в выходные',
      valueKey: 'weekend', positive: 'down', base: 'period',
      parts: [
        { key: 'weekend_fresh', label: '2–5 дней' },
        { key: 'weekend_long', label: 'больше 5 дней' }
      ],
      tip: 'Сотрудники, выходившие в выходные больше одного дня за весь период. Метрика периодовая, а не недельная, поэтому сравнения с прошлой неделей нет.'
    }
  ],

  // Колонки таблицы. group — блок шапки, sort — ключ сортировки.
  tableGroups: [
    { key: 'under', name: 'Недоработка', color: '#d4a5b5',
      hint: 'Сотрудники с недельной активностью ниже нормы' },
    { key: 'over', name: 'Переработка', color: '#5d9acb',
      hint: 'Сотрудники с недельной активностью выше нормы' },
    { key: 'talk', name: 'Звонки в Talk', color: '#9aa0ac',
      hint: 'Доля разговоров в Talk от рабочего времени' }
  ],

  perPage: 10
};

// ---------- БЛОК 2: ВХОД + СОСТОЯНИЕ + ХЕЛПЕРЫ ----------
var rawData = (typeof data !== 'undefined' && data && data.length) ? data : [];

if (!window.__pvtState) window.__pvtState = {};
var __S = window.__pvtState;
if (!__S[CFG.ns]) {
  __S[CFG.ns] = {
    dept: null,        // выбранное подразделение или null = все
    month: null,       // отмеченный период (месяц или неделя) на графиках или null
    grain: 'month',    // гранулярность стека и линий: 'month' | 'week'
    hidden: {},        // скрытые категории стека
    page: 1,
    sortKey: 'cnt_emp',
    sortDir: -1
  };
}
var state = __S[CFG.ns];
if (state.grain !== 'week') state.grain = 'month';   // состояние старой версии без поля

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

// '2026-06-01' | 1750000000 | Date-строка -> {y, m}
function toMonthKey(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  var s = String(raw).trim(), d = null;
  var m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) return { y: +m[1], m: +m[2] - 1 };
  if (/^\d{11,}$/.test(s)) { var ms = Number(s); d = new Date(ms > 1e12 ? ms : ms * 1000); }
  else if (/^\d{10}$/.test(s)) d = new Date(Number(s) * 1000);
  else d = new Date(s);
  if (!d || isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

// '2026-06-01' | timestamp | Date-строка -> {y, m, d}: ключ недели по её понедельнику
function toDayKey(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  var s = String(raw).trim(), d = null;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
  if (/^\d{11,}$/.test(s)) { var ms = Number(s); d = new Date(ms > 1e12 ? ms : ms * 1000); }
  else if (/^\d{10}$/.test(s)) d = new Date(Number(s) * 1000);
  else d = new Date(s);
  if (!d || isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }

var MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
var MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль',
  'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// --- Числа (§7): тонкий пробел в разрядах, запятая в дробной, минус типографский
var THIN = ' ';
var MINUS = '−';
var DASH = '—';

function fmtNum(v, d) {
  if (v === null || v === undefined || isNaN(v)) return DASH;
  var neg = v < 0;
  var s = Math.abs(v).toFixed(d || 0);
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  return (neg ? MINUS : '') + parts.join(',');
}
function fmtInt(v) { return fmtNum(v, 0); }
function fmtPct(v, d) { return v === null || v === undefined || isNaN(v) ? DASH : fmtNum(v, d === undefined ? 0 : d) + '%'; }
function fmtHours(v) { return v === null || v === undefined || isNaN(v) ? DASH : fmtNum(v, 1) + THIN + 'ч'; }

// §4.7: направление — знаком, а не стрелкой. Ноль — просто «0».
function fmtDelta(v, d, unit) {
  if (v === null || v === undefined || isNaN(v)) return DASH;
  var body = fmtNum(Math.abs(v), d || 0);
  var sign = v > 0 ? '+' : (v < 0 ? MINUS : '');
  var tail = unit ? THIN + unit : '';
  if (v === 0) return '0' + tail;
  return sign + body + tail;
}

// §4.7 правило 2: знак отвечает за направление, класс — за оценку.
function deltaStatus(v, positive) {
  if (positive === 'none') return 'neu';
  if (v === null || v === undefined || v === 0) return 'flat';
  if (positive === 'down') return v < 0 ? 'up' : 'down';
  return v > 0 ? 'up' : 'down';
}

// --- Подсказки (§5): один конструктор на весь лист, теги руками не клеим.
function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

function tipHtml(o) {
  if (o == null) return '';
  if (typeof o === 'string') return esc(o);
  var s = '';
  if (o.title) s += '<span class="t-h">' + esc(o.title) + '</span>';
  if (o.text) s += '<span class="t-x">' + esc(o.text) + '</span>';
  var rows = o.rows || [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r) continue;
    var mk = '';
    if (r.color) {
      mk = '<i class="t-m' + (r.dash ? ' dash' : '') + '" style="' +
        (r.dash ? 'border-top-color:' : 'background:') + r.color + '"></i>';
    }
    s += '<span class="t-r' + (r.dash || r.bench ? ' bench' : '') + '">' + mk +
      '<span class="t-l">' + esc(r.label) + '</span>' +
      '<b class="t-v">' + esc(r.value) + '</b></span>';
  }
  var ns = o.note == null ? [] : (isArray(o.note) ? o.note : [o.note]);
  for (var j = 0; j < ns.length; j++) {
    if (ns[j]) s += '<span class="t-n">' + esc(ns[j]) + '</span>';
  }
  return s;
}
// Единственный способ поставить подсказку в строке разметки.
function tipAttr(o) { return ' data-tip="' + esc(tipHtml(o)) + '"'; }

// ---------- БЛОК 3: ТРАНСФОРМАЦИЯ ДАННЫХ ----------
// Витрина отдаёт два вида строк (activity.sql) и только аддитивные величины:
//   'month' — подразделение × месяц: состав по cat_month, компоненты средних,
//             недельный снимок и периодовые признаки (как в 1.0);
//   'week'  — подразделение × неделя: состав по cat_week, численность недели
//             и компоненты средних — режим «Недели» и спарклайны таблицы.
// Нет колонки row_kind или строк 'week' — выдача 1.0, лист работает по месяцам.
// Здесь выдача разбирается на индекс подразделений, а функция aggregate()
// собирает из него любой срез: все подразделения или одно.

// Недельный снимок: суммируем по месяцам (последняя неделя лежит в одном).
var WEEK_KEYS = ['cnt_emp', 'prev_low', 'low_fresh', 'low_long',
  'prev_high', 'high_fresh', 'high_long',
  'talk_20_30', 'prev_talk_20_30', 'talk_30_50', 'talk_50_plus'];

// Периодовые признаки: по месяцам НЕ аддитивны (сотрудник попадает в каждый
// свой месяц), поэтому внутри подразделения берём максимум по месяцам.
var PERIOD_KEYS = ['leave_fresh', 'leave_long', 'weekend_fresh', 'weekend_long'];

// Величины периода (месяца или недели): чистые суммы, складываются в любом разрезе.
var MONTH_KEYS = ['cnt_cat_grey', 'cnt_cat_low', 'cnt_cat_normal', 'cnt_cat_high',
  'dur_plan_sum', 'dur_plan_cnt', 'dur_all_sum', 'dur_all_cnt',
  'talk_h_sum', 'work_h_sum'];

// Строки 'week': то же, что у месяца, плюс численность недели — знаменатель
// недельных долей в спарклайнах.
var WEEKROW_KEYS = ['cnt_emp'].concat(MONTH_KEYS);

// Выдача 1.0 называла колонки состава cnt_month_*: читаем оба имени.
function field(row, key) {
  var v = row[key];
  if ((v === null || v === undefined) && key.indexOf('cnt_cat_') === 0) v = row['cnt_month_' + key.slice(8)];
  return num(v);
}

function rowKind(row) {
  var raw = row[CFG.fields.kind];
  if (raw === null || raw === undefined || raw === '') return 'month';
  return String(raw).toLowerCase() === 'week' ? 'week' : 'month';
}

// Итоги, которые SQL не отдаёт: полосы непересекающиеся и покрывают категорию
// целиком, поэтому итог = их сумма. Пары «итог: из чего складывается».
var SUM_KEYS = [
  ['low', 'low_fresh', 'low_long'],
  ['high', 'high_fresh', 'high_long'],
  ['leave', 'leave_fresh', 'leave_long'],
  ['weekend', 'weekend_fresh', 'weekend_long']
];

function zeroBag(keys) {
  var o = {}, i;
  for (i = 0; i < keys.length; i++) o[keys[i]] = 0;
  return o;
}

function buildModel() {
  var byName = {}, order = [], monthSet = {}, weekSet = {}, hasWeeks = false, i, k;

  for (i = 0; i < rawData.length; i++) {
    var row = rawData[i];
    if (!row) continue;
    var name = row[CFG.fields.dept];
    name = (name === null || name === undefined || name === '') ? DASH : String(name);

    var dept = byName[name];
    if (!dept) {
      dept = { name: name, week: zeroBag(WEEK_KEYS), period: zeroBag(PERIOD_KEYS), months: {}, weeks: {} };
      byName[name] = dept;
      order.push(dept);
    }

    // Строка недели: состав по cat_week, численность и компоненты средних.
    if (rowKind(row) === 'week') {
      var dk = toDayKey(row[CFG.fields.month]);
      if (!dk) continue;
      var wKey = dk.y + '-' + pad2(dk.m + 1) + '-' + pad2(dk.d);
      if (!weekSet[wKey]) weekSet[wKey] = { date: dk, flag: 0 };
      weekSet[wKey].flag = Math.max(weekSet[wKey].flag, num(row[CFG.fields.flag]));
      var wrec = dept.weeks[wKey];
      if (!wrec) { wrec = zeroBag(WEEKROW_KEYS); dept.weeks[wKey] = wrec; }
      for (k = 0; k < WEEKROW_KEYS.length; k++) wrec[WEEKROW_KEYS[k]] += field(row, WEEKROW_KEYS[k]);
      if (wrec.cnt_emp > 0 || wrec.dur_all_cnt > 0) hasWeeks = true;
      continue;
    }

    // Строка месяца — как в 1.0.
    var mk = toMonthKey(row[CFG.fields.month]);
    if (!mk) continue;
    var mKey = mk.y + '-' + (mk.m < 9 ? '0' : '') + (mk.m + 1);
    monthSet[mKey] = mk;
    for (k = 0; k < WEEK_KEYS.length; k++) dept.week[WEEK_KEYS[k]] += num(row[WEEK_KEYS[k]]);
    for (k = 0; k < PERIOD_KEYS.length; k++) {
      dept.period[PERIOD_KEYS[k]] = Math.max(dept.period[PERIOD_KEYS[k]], num(row[PERIOD_KEYS[k]]));
    }
    var mrec = dept.months[mKey];
    if (!mrec) { mrec = zeroBag(MONTH_KEYS); dept.months[mKey] = mrec; }
    for (k = 0; k < MONTH_KEYS.length; k++) mrec[MONTH_KEYS[k]] += field(row, MONTH_KEYS[k]);
  }

  var monthOrder = [];
  for (var mk2 in monthSet) if (monthSet.hasOwnProperty(mk2)) monthOrder.push(mk2);
  monthOrder.sort();

  // Недели: только закрытые — до недели с flag_last_week = 1 включительно.
  // Флага нет ни у одной — берём все. Спарклайны берут последние CFG.sparkWeeks.
  var weekOrder = [], lastClosed = null;
  for (var wk in weekSet) if (weekSet.hasOwnProperty(wk)) weekOrder.push(wk);
  weekOrder.sort();
  for (i = 0; i < weekOrder.length; i++) if (weekSet[weekOrder[i]].flag === 1) lastClosed = weekOrder[i];
  if (lastClosed !== null) {
    var cut = [];
    for (i = 0; i < weekOrder.length; i++) if (weekOrder[i] <= lastClosed) cut.push(weekOrder[i]);
    weekOrder = cut;
  }

  return {
    depts: order, byName: byName, monthOrder: monthOrder, monthMeta: monthSet,
    weekOrder: weekOrder, weekMeta: weekSet, hasWeeks: hasWeeks && weekOrder.length > 0, cache: {}
  };
}

// Средняя рабочая активность, ч/день. База дней: плановые дни, а если их
// в срезе нет вовсе — все дни. Это остаток прежней coalesce-цепочки из SQL.
function ratioAct(a) {
  if (a.dur_plan_cnt > 0) return a.dur_plan_sum / a.dur_plan_cnt;
  if (a.dur_all_cnt > 0) return a.dur_all_sum / a.dur_all_cnt;
  return null;
}

// Доля разговоров в Talk от рабочего времени, %.
function ratioTalk(a) {
  if (a.work_h_sum > 0) return a.talk_h_sum / a.work_h_sum * 100;
  return null;
}

// Срез листа: name === null -> все подразделения.
function aggregate(name) {
  var ck = name === null ? '*' : name;
  if (MODEL.cache[ck]) return MODEL.cache[ck];

  var list = name === null ? MODEL.depts : (MODEL.byName[name] ? [MODEL.byName[name]] : []);
  var snap = zeroBag(WEEK_KEYS.concat(PERIOD_KEYS));
  snap.low = 0; snap.high = 0; snap.leave = 0; snap.weekend = 0;
  var acc = {}, total = zeroBag(MONTH_KEYS), i, k, mKey;

  for (i = 0; i < MODEL.monthOrder.length; i++) acc[MODEL.monthOrder[i]] = zeroBag(MONTH_KEYS);

  for (i = 0; i < list.length; i++) {
    var d = list[i];
    for (k = 0; k < WEEK_KEYS.length; k++) snap[WEEK_KEYS[k]] += d.week[WEEK_KEYS[k]];
    for (k = 0; k < PERIOD_KEYS.length; k++) snap[PERIOD_KEYS[k]] += d.period[PERIOD_KEYS[k]];
    for (mKey in d.months) {
      if (!d.months.hasOwnProperty(mKey) || !acc[mKey]) continue;
      for (k = 0; k < MONTH_KEYS.length; k++) {
        acc[mKey][MONTH_KEYS[k]] += d.months[mKey][MONTH_KEYS[k]];
        total[MONTH_KEYS[k]] += d.months[mKey][MONTH_KEYS[k]];
      }
    }
  }

  // Итоги категорий: SQL отдаёт только полосы, складываем их здесь.
  for (i = 0; i < SUM_KEYS.length; i++) {
    snap[SUM_KEYS[i][0]] = snap[SUM_KEYS[i][1]] + snap[SUM_KEYS[i][2]];
  }

  // Дельты недельного снимка — здесь, а не в SQL.
  snap.delta_low = snap.low - snap.prev_low;
  snap.delta_high = snap.high - snap.prev_high;
  snap.delta_talk_20_30 = snap.talk_20_30 - snap.prev_talk_20_30;

  var series = [];
  for (i = 0; i < MODEL.monthOrder.length; i++) {
    mKey = MODEL.monthOrder[i];
    var a = acc[mKey], meta = MODEL.monthMeta[mKey], cats = {}, sum = 0;
    for (k = 0; k < CFG.cats.length; k++) {
      var v = a[CFG.cats[k].field];
      cats[CFG.cats[k].key] = v;
      sum += v;
    }
    series.push({
      key: mKey,
      y: meta.y,
      m: meta.m,
      label: MONTHS_SHORT[meta.m],
      sub: (i === 0 || meta.m === 0) ? String(meta.y) : null,   // ось X: год под первым и под январём
      full: MONTHS_FULL[meta.m] + ' ' + meta.y,
      cats: cats,
      total: sum,
      act: ratioAct(a),
      talk: ratioTalk(a)
    });
  }

  // Недельный ряд: те же точки, что по месяцам (состав, средние), плюс доли
  // недоработки и переработки от численности недели — для спарклайнов.
  var weeks = [], weekTotal = zeroBag(MONTH_KEYS), prevM = -1;
  for (i = 0; i < MODEL.weekOrder.length; i++) {
    var wKey = MODEL.weekOrder[i], wa = zeroBag(WEEKROW_KEYS), dk = MODEL.weekMeta[wKey].date;
    for (k = 0; k < list.length; k++) {
      var wr = list[k].weeks[wKey];
      if (!wr) continue;
      for (var q = 0; q < WEEKROW_KEYS.length; q++) wa[WEEKROW_KEYS[q]] += wr[WEEKROW_KEYS[q]];
    }
    for (k = 0; k < MONTH_KEYS.length; k++) weekTotal[MONTH_KEYS[k]] += wa[MONTH_KEYS[k]];
    var wc = {};
    for (k = 0; k < CFG.cats.length; k++) wc[CFG.cats[k].key] = wa[CFG.cats[k].field];
    weeks.push({
      key: wKey,
      y: dk.y, m: dk.m, d: dk.d,
      label: pad2(dk.d) + '.' + pad2(dk.m + 1),
      // ось X: под первой неделей — месяц и год, под первой неделей месяца — месяц
      sub: i === 0 ? MONTHS_SHORT[dk.m] + ' ' + dk.y : (dk.m !== prevM ? MONTHS_SHORT[dk.m] : null),
      full: 'неделя с ' + pad2(dk.d) + '.' + pad2(dk.m + 1) + '.' + dk.y,
      cats: wc,
      total: wc.grey + wc.under + wc.normal + wc.over,
      act: ratioAct(wa),
      talk: ratioTalk(wa),
      cnt: wa.cnt_emp,
      lowShare: wa.cnt_emp > 0 ? wa.cnt_cat_low / wa.cnt_emp * 100 : null,
      highShare: wa.cnt_emp > 0 ? wa.cnt_cat_high / wa.cnt_emp * 100 : null
    });
    prevM = dk.m;
  }

  var out = {
    name: name,
    snap: snap,
    series: series,
    weeks: weeks,
    avgAct: ratioAct(total),
    avgTalk: ratioTalk(total),
    avgActW: ratioAct(weekTotal),
    avgTalkW: ratioTalk(weekTotal)
  };
  MODEL.cache[ck] = out;
  return out;
}

// Последние закрытые недели для спарклайна.
function sparkWeeks(weeks) {
  return weeks.length > CFG.sparkWeeks ? weeks.slice(weeks.length - CFG.sparkWeeks) : weeks;
}

// Строка таблицы: доли и дельты считаются здесь, SQL их не отдаёт.
// Спарклайн — недельные доли той же категории (строки 'week'); недоработку
// и переработку не складываем: это разные сигналы с разной логикой реагирования.
function tableRow(name, snap, weeksAll) {
  var size = snap.cnt_emp;
  var weeks = sparkWeeks(weeksAll || []);
  var spLow = [], spHigh = [], i;
  for (i = 0; i < weeks.length; i++) { spLow.push(weeks[i].lowShare); spHigh.push(weeks[i].highShare); }
  return {
    spark_low: spLow,
    spark_high: spHigh,
    name: name,
    isTotal: name === null,
    cnt_emp: size,
    low: snap.low,
    low_share: size > 0 ? snap.low / size * 100 : 0,
    low_delta: snap.delta_low,
    high: snap.high,
    high_share: size > 0 ? snap.high / size * 100 : 0,
    high_delta: snap.delta_high,
    talk_20_30: snap.talk_20_30,
    talk_30_50: snap.talk_30_50,
    talk_50_plus: snap.talk_50_plus
  };
}

function buildTableRows() {
  var out = [], i;
  for (i = 0; i < MODEL.depts.length; i++) {
    var agg = aggregate(MODEL.depts[i].name);
    out.push(tableRow(MODEL.depts[i].name, agg.snap, agg.weeks));
  }
  return out;
}

var MODEL = buildModel();
var TOTAL = MODEL.depts.length ? aggregate(null) : null;
var TABLE_ROWS = buildTableRows();

// Состояние могло пережить перезапуск скрипта — проверяем, что выбранное
// подразделение, гранулярность и отмеченный период ещё существуют в новых данных.
if (state.dept !== null && !MODEL.byName[state.dept]) state.dept = null;
if (state.grain === 'week' && !MODEL.hasWeeks) state.grain = 'month';
if (state.month !== null) {
  var found = false, keys = state.grain === 'week' ? MODEL.weekOrder : MODEL.monthOrder;
  for (var mi = 0; mi < keys.length; mi++) {
    if (keys[mi] === state.month) found = true;
  }
  if (!found) state.month = null;
}
if (visibleCats().length === 0) state.hidden = {};

// ---------- БЛОК 4: ФОРМАТИРОВАНИЕ И ЦВЕТ ----------
// §6.1: верх шкалы — «круглое» число не ниже максимума, низ всегда ноль.
function niceTop(maxV) {
  if (!(maxV > 0)) return 1;
  var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  var pow = Math.pow(10, Math.floor(Math.log(maxV) / Math.LN10));
  for (var s = 0; s < steps.length; s++) {
    var t = steps[s] * pow;
    if (t >= maxV - 1e-9) return t;
  }
  return 10 * pow;
}

function visibleCats() {
  var out = [];
  for (var i = 0; i < CFG.cats.length; i++) {
    if (!state.hidden[CFG.cats[i].key]) out.push(CFG.cats[i]);
  }
  return out;
}

function visibleTotal(point) {
  var cats = visibleCats(), t = 0;
  for (var i = 0; i < cats.length; i++) t += point.cats[cats[i].key];
  return t;
}

// Текущий срез листа: выбранное подразделение или все.
function view() { return aggregate(state.dept); }

// Ряд, среднее и база сравнения в текущей гранулярности.
function seriesOf(v) { return state.grain === 'week' ? v.weeks : v.series; }
function avgOf(v, metric) {
  if (state.grain === 'week') return metric === 'act' ? v.avgActW : v.avgTalkW;
  return metric === 'act' ? v.avgAct : v.avgTalk;
}
function baseOf() { return state.grain === 'week' ? CFG.text.weekBase : CFG.text.monthBase; }

function scopeLabel() {
  return state.dept === null ? CFG.text.allDepts : state.dept;
}

var SORT_COLS = {
  name: function(r) { return r.name === null ? '' : r.name; },
  cnt_emp: function(r) { return r.cnt_emp; },
  low: function(r) { return r.low; },
  low_share: function(r) { return r.low_share; },
  low_delta: function(r) { return r.low_delta; },
  high: function(r) { return r.high; },
  high_share: function(r) { return r.high_share; },
  high_delta: function(r) { return r.high_delta; },
  talk_20_30: function(r) { return r.talk_20_30; },
  talk_30_50: function(r) { return r.talk_30_50; },
  talk_50_plus: function(r) { return r.talk_50_plus; }
};

function sortedRows() {
  var get = SORT_COLS[state.sortKey] || SORT_COLS.cnt_emp;
  var dir = state.sortDir;
  var rows = TABLE_ROWS.slice(0);
  rows.sort(function(a, b) {
    var va = get(a), vb = get(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb)) * dir;
    }
    if (va === vb) return String(a.name).localeCompare(String(b.name));
    return (va < vb ? -1 : 1) * dir;
  });
  return rows;
}

// Подсказка строки таблицы: содержание как было, плюс подсказка про клик.
function rowTip(r, selected) {
  var isTotal = r.isTotal;
  return {
    title: isTotal ? CFG.text.allDepts : r.name,
    rows: [
      { label: 'Активная численность', value: fmtInt(r.cnt_emp), bench: true },
      { label: 'Недоработка', value: fmtInt(r.low) + ' · ' + fmtPct(r.low_share), color: '#d4a5b5' },
      { label: 'Переработка', value: fmtInt(r.high) + ' · ' + fmtPct(r.high_share), color: '#5d9acb' }
    ],
    note: [
      'Звонки в Talk: ' + fmtInt(r.talk_20_30) + ' / ' + fmtInt(r.talk_30_50) + ' / ' +
        fmtInt(r.talk_50_plus) + ' человек в полосах 20–30%, 30–50%, больше 50%',
      selected ? CFG.text.rowTipHintOff : CFG.text.rowTipHint
    ]
  };
}

// ---------- БЛОК 5: РАЗМЕТКА (<style> + HTML) ----------
function buildCSS() {
  var P = '.' + CFG.ns;
  var C = CFG.colors;
  var F = CFG.fonts;
  var S = CFG.space;
  var R = CFG.radius;
  var G = CFG.geom;

  return [
    '<style>',
    // --- Каркас листа -------------------------------------------------------
    P + '-root{width:100%;min-height:100%;box-sizing:border-box;padding:0;',
      'font-family:' + F.family + ';font-size:' + F.body + 'px;color:' + C.ink2 + ';',
      'background:transparent;-webkit-font-smoothing:antialiased;}',
    P + '-root *{box-sizing:border-box;font-family:inherit;outline: none;}',
    // Один зазор сетки на весь лист — тот же, что у сетки панелей HQ (14px).
    P + '-root .sheet{display:flex;flex-direction:column;gap:' + S.s7 + 'px;}',

    // --- Полоса срезов сверху: тот же элемент, что hqp-fbar на листе HQ ------
    P + '-root .head{margin:0 8px;padding:8px 10px;border:1px solid ' + C.line + ';border-radius:10px;background:#f8f9fb;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
    P + '-root .fbar-lbl{font-size:' + F.cap + 'px;font-weight:600;color:' + C.muted + ';text-transform:uppercase;letter-spacing:.3px;}',
    P + '-root .chips{display:flex;align-items:center;gap:' + S.s4 + 'px;flex-wrap:wrap;}',
    P + '-root .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#fff;border:1px solid ' + C.line + ';border-radius:8px;font-size:' + F.note + 'px;color:' + C.ink2 + ';}',
    P + '-root .chip b{color:' + C.ink + ';font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
    P + '-root .chip .x{background:none;border:0;font:inherit;line-height:1;cursor:pointer;color:' + C.muted + ';font-weight:600;padding:0 2px;}',
    P + '-root .chip .x:hover{color:' + C.ink + ';}',

    // --- Панель (§4.4): шапка с чертой, тело — как hqp-panel-h / hqp-panel-b --
    P + '-root .panel{background:' + C.card + ';border-radius:' + R.r4 + 'px;',
      'box-shadow:' + CFG.shadow + ';overflow:hidden;}',
    P + '-root .topline{display:flex;align-items:center;justify-content:space-between;',
      'gap:' + S.s6 + 'px;flex-wrap:wrap;padding:' + S.s7 + 'px ' + S.s8 + 'px;',
      'border-bottom:1px solid ' + C.line2 + ';}',
    P + '-root .p-body{padding:' + S.s7 + 'px ' + S.s8 + 'px;flex:1;display:flex;',
      'flex-direction:column;min-height:0;}',
    P + '-root .t-wrap{min-width:0;display:flex;flex-direction:column;gap:' + S.s1 + 'px;}',
    P + '-root .p-title{margin:0;font-size:' + F.head + 'px;line-height:1.2;font-weight:700;color:' + C.ink + ';}',
    P + '-root .p-sub{font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';line-height:1.35;}',

    // Сегментированный переключатель (§4.9) — тот же, что hqp-tabs / hqp-tab
    P + '-root .sub-tabs{display:inline-flex;gap:3px;background:' + C.line2 + ';',
      'border-radius:' + R.r4 + 'px;padding:3px;flex:0 0 auto;}',
    P + '-root .sub-tab{border:0;background:transparent;padding:6px 12px;border-radius:' + R.r3 + 'px;',
      'font-weight:700;font-size:' + F.body + 'px;color:' + C.muted + ';cursor:pointer;',
      'transition:background .15s,color .15s;}',
    P + '-root .sub-tab:hover{color:' + C.ink2 + ';}',
    P + '-root .sub-tab.on{background:' + C.card + ';color:' + C.ink + ';box-shadow:' + CFG.shadow + ';cursor:default;}',

    // --- KPI-полоса (§4.3): одна высота строк во всей полосе ----------------
    P + '-root .kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:' + S.s7 + 'px;}',
    P + '-root .kpi{background:' + C.card + ';border-radius:' + R.r4 + 'px;box-shadow:' + CFG.shadow + ';',
      'padding:' + S.s7 + 'px ' + S.s8 + 'px;display:flex;flex-direction:column;min-width:0;}',
    '@supports (grid-template-rows:subgrid){' +
      P + '-root .kpi{display:grid;grid-template-rows:subgrid;grid-row:span 5;row-gap:0;}}',
    P + '-root .k-label{display:flex;align-items:center;gap:' + S.s3 + 'px;font-size:' + F.note + 'px;',
      'font-weight:700;color:' + C.muted + ';line-height:1.25;}',
    P + '-root .k-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
    P + '-root .k-val{margin-top:' + S.s4 + 'px;font-size:' + F.hero + 'px;line-height:1.05;',
      'font-weight:800;letter-spacing:-.02em;color:' + C.ink + ';font-variant-numeric:tabular-nums;}',
    P + '-root .k-note{margin-top:' + S.s2 + 'px;font-size:' + F.cap + 'px;font-weight:600;',
      'color:' + C.muted2 + ';line-height:1.3;}',
    P + '-root .k-row{display:flex;align-items:center;gap:' + S.s3 + 'px;margin-top:' + S.s5 + 'px;',
      'flex-wrap:wrap;min-height:22px;}',
    P + '-root .k-parts{margin-top:' + S.s6 + 'px;padding-top:' + S.s5 + 'px;',
      'border-top:1px solid ' + C.line2 + ';}',
    P + '-root .k-parts-h{font-size:' + F.micro + 'px;font-weight:800;letter-spacing:.4px;',
      'text-transform:uppercase;color:' + C.muted2 + ';margin-bottom:' + S.s4 + 'px;}',
    P + '-root .k-part{display:flex;align-items:baseline;gap:' + S.s4 + 'px;margin-top:' + S.s3 + 'px;}',
    P + '-root .k-part:first-child{margin-top:0;}',
    P + '-root .k-part-v{font-size:' + F.body + 'px;font-weight:700;color:' + C.ink + ';',
      'font-variant-numeric:tabular-nums;min-width:22px;}',
    P + '-root .k-part-l{font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';',
      'line-height:1.25;margin-left:auto;text-align:right;}',

    // Пилюля изменения (§4.7): направление знаком, оценка классом
    P + '-root .delta{display:inline-flex;align-items:center;gap:5px;font-size:' + F.note + 'px;',
      'font-weight:700;padding:3px 8px;border-radius:' + R.r2 + 'px;white-space:nowrap;cursor:help;}',
    P + '-root .delta.up{background:' + C.greenBg + ';color:' + C.greenTx + ';}',
    P + '-root .delta.down{background:' + C.redBg + ';color:' + C.redTx + ';}',
    P + '-root .delta.flat{background:' + C.neutralBg + ';color:' + C.muted + ';}',
    P + '-root .delta.neu{background:' + C.neutralBg + ';color:' + C.ink2 + ';}',
    // «Не сравнивается» (§4.8) — вместо прочерка и вместо пустоты
    P + '-root .nocmp{display:inline-block;font-size:' + F.note + 'px;font-weight:700;',
      'color:' + C.muted + ';border:1px dashed ' + C.line + ';border-radius:' + R.r2 + 'px;',
      'padding:2px 8px;white-space:nowrap;cursor:help;}',
    // Значок справки (§4.13) — один на весь отчёт
    P + '-root .info{display:inline-flex;align-items:center;justify-content:center;width:16px;',
      'height:16px;border-radius:50%;border:1px solid ' + C.line + ';background:' + C.card + ';',
      'color:' + C.muted + ';font-size:10px;font-weight:700;line-height:1;cursor:help;flex:0 0 auto;',
      'user-select:none;transition:border-color .12s,color .12s,background .12s;}',
    P + '-root .info:hover{border-color:' + C.act + ';background:' + C.blueBg + ';color:' + C.act + ';}',

    // --- Рабочая зона: стек слева, динамика справа --------------------------
    P + '-root .shell{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);',
      'gap:' + S.s7 + 'px;align-items:stretch;}',
    P + '-root .shell>.panel,' + P + '-root .side>.panel{display:flex;flex-direction:column;min-width:0;}',
    P + '-root .side{display:grid;grid-template-rows:1fr 1fr;gap:' + S.s7 + 'px;min-width:0;}',
    P + '-root .plot{position:relative;flex:1;min-height:0;}',
    P + '-root .plot svg{display:block;width:100%;overflow:visible;}',
    P + '-root .main-panel .plot{min-height:' + G.STACK_H + 'px;}',
    P + '-root .mini-panel .plot{min-height:' + G.LINE_H + 'px;}',
    P + '-root .mini-val{display:flex;align-items:baseline;gap:' + S.s4 + 'px;flex-wrap:wrap;',
      'justify-content:flex-end;text-align:right;}',
    P + '-root .mini-num{font-size:' + F.hero + 'px;line-height:1;font-weight:800;',
      'letter-spacing:-.02em;color:' + C.ink + ';font-variant-numeric:tabular-nums;}',
    P + '-root .mini-cap{width:100%;font-size:' + F.cap + 'px;font-weight:600;color:' + C.muted2 + ';}',

    // Легенда как управление сериями (§6.4): первой строкой тела панели
    P + '-root .legend{display:flex;gap:' + S.s7 + 'px;flex-wrap:wrap;align-items:center;',
      'justify-content:flex-end;font-size:' + F.note + 'px;color:' + C.ink2 + ';',
      'margin-bottom:' + S.s4 + 'px;}',
    P + '-root .sw{display:inline-flex;align-items:center;gap:' + S.s3 + 'px;font-weight:600;',
      'cursor:pointer;user-select:none;border-radius:' + R.r2 + 'px;padding:2px 4px;',
      'transition:opacity .15s ease,background .12s ease;}',
    P + '-root .sw:hover{background:' + C.neutralBg + ';}',
    P + '-root .sw.off{opacity:.36;}',
    P + '-root .sw .dot{width:11px;height:11px;border-radius:' + R.r1 + 'px;display:inline-block;flex:0 0 auto;}',

    // --- Таблица (§4.5) -----------------------------------------------------
    P + '-root .table-wrap{width:100%;overflow-x:auto;}',
    P + '-root table{width:100%;border-collapse:collapse;table-layout:fixed;}',
    P + '-root thead th{padding:' + S.s4 + 'px ' + S.s3 + 'px;vertical-align:bottom;',
      'font-size:' + F.cap + 'px;color:' + C.muted + ';font-weight:600;text-align:right;',
      'text-transform:uppercase;letter-spacing:.2px;line-height:1.25;background:' + C.card + ';}',
    P + '-root .g-row th{font-size:' + F.cap + 'px;font-weight:800;letter-spacing:.3px;',
      'text-transform:uppercase;color:' + C.ink + ';text-align:center;padding-bottom:' + S.s3 + 'px;}',
    P + '-root .g-row th.txt{text-align:left;color:' + C.muted + ';}',
    P + '-root .g-row th.rs{vertical-align:bottom;border-bottom:1px solid ' + C.line2 + ';}',
    P + '-root .g-row th.gcol{border-bottom-style:solid;border-bottom-width:2px;}',
    P + '-root .s-row th{border-bottom:1px solid ' + C.line2 + ';}',
    P + '-root .s-row th.sortable{cursor:pointer;user-select:none;',
      'transition:color .12s ease,background .12s ease;}',
    P + '-root .s-row th.sortable:hover{color:' + C.ink + ';background:' + C.hover + ';}',
    P + '-root .s-row th.on{color:' + C.ink + ';font-weight:800;}',
    P + '-root .caret{display:inline-block;margin-left:3px;font-size:8px;vertical-align:1px;}',
    P + '-root th.txt,' + P + '-root td.txt{text-align:left;}',
    P + '-root .grp{border-left:1px solid ' + C.line + ';}',
    P + '-root tbody td{padding:' + S.s4 + 'px ' + S.s3 + 'px;border-bottom:1px solid ' + C.line2 + ';',
      'text-align:right;font-size:' + F.body + 'px;font-weight:600;color:' + C.ink2 + ';',
      'font-variant-numeric:tabular-nums;background:' + C.card + ';}',
    P + '-root tbody tr:last-child td{border-bottom:none;}',
    P + '-root tbody tr.urow{cursor:pointer;}',
    P + '-root tbody tr.urow:hover td{background:' + C.hover + ';}',
    P + '-root tbody tr.sel td{background:' + C.sel + ';}',
    P + '-root tbody tr.sel td.txt{box-shadow:inset 3px 0 0 ' + C.act + ';}',
    P + '-root tbody tr.total td{background:' + C.hover + ';font-weight:700;',
      'border-bottom:2px solid ' + C.line + ';}',
    P + '-root tbody tr.total.sel td{background:' + C.sel + ';}',
    P + '-root td.txt{position:sticky;left:0;z-index:1;}',
    P + '-root .team{font-size:' + F.body + 'px;font-weight:700;color:' + C.ink + ';line-height:1.3;',
      'overflow-wrap:anywhere;}',
    P + '-root .lead{font-weight:700;color:' + C.ink + ';}',
    P + '-root .zero{color:' + C.muted2 + ';}',
    P + '-root .d-cell{font-size:' + F.cap + 'px;font-weight:700;white-space:nowrap;}',
    // Спарклайн рядом с долей (§6.2 «тренд в строке таблицы»): линия в цвете
    // категории, ось от нуля, последняя точка — то же число, что рядом.
    P + '-root .sp-cell{white-space:nowrap;}',
    P + '-root .sp-wrap{display:flex;align-items:center;justify-content:flex-end;gap:' + S.s3 + 'px;}',
    P + '-root .spark{display:block;width:60px;height:20px;overflow:visible;flex:0 0 auto;}',
    P + '-root .sp-val{display:block;min-width:30px;text-align:right;}',
    P + '-root .d-cell.down{color:' + C.redTx + ';}',
    P + '-root .d-cell.up{color:' + C.greenTx + ';}',
    P + '-root .d-cell.flat{color:' + C.muted2 + ';}',
    P + '-root .tbl-note{margin-top:' + S.s4 + 'px;font-size:' + F.note + 'px;color:' + C.muted + ';',
      'font-weight:600;line-height:1.45;}',

    // --- Пагинация ----------------------------------------------------------
    P + '-root .pager{display:flex;align-items:center;justify-content:space-between;',
      'gap:' + S.s5 + 'px;flex-wrap:wrap;margin-top:' + S.s6 + 'px;}',
    P + '-root .pager-info{font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';',
      'font-variant-numeric:tabular-nums;}',
    P + '-root .pager-info b{color:' + C.ink2 + ';font-weight:700;}',
    P + '-root .pager-nav{display:flex;align-items:center;gap:' + S.s2 + 'px;}',
    P + '-root .pg{min-width:28px;height:28px;padding:0 ' + S.s3 + 'px;display:inline-flex;',
      'align-items:center;justify-content:center;background:' + C.card + ';',
      'border:1px solid ' + C.line + ';border-radius:' + R.r2 + 'px;font-size:' + F.note + 'px;',
      'font-weight:600;color:' + C.ink2 + ';cursor:pointer;user-select:none;',
      'font-variant-numeric:tabular-nums;transition:background .12s,border-color .12s,color .12s;}',
    P + '-root .pg:hover:not(:disabled):not(.on){background:' + C.hover + ';border-color:' + C.muted2 + ';}',
    P + '-root .pg.on{background:' + C.act + ';border-color:' + C.act + ';color:#fff;cursor:default;}',
    P + '-root .pg:disabled{opacity:.4;cursor:not-allowed;}',
    P + '-root .pg-gap{padding:0 ' + S.s2 + 'px;color:' + C.muted2 + ';font-weight:600;user-select:none;}',

    // --- Пустое состояние ---------------------------------------------------
    P + '-root .empty{background:' + C.card + ';border-radius:' + R.r4 + 'px;box-shadow:' + CFG.shadow + ';',
      'padding:38px 22px;text-align:center;color:' + C.muted + ';font-size:' + F.body + 'px;}',
    P + '-root .empty b{display:block;color:' + C.ink + ';font-size:15px;margin-bottom:' + S.s3 + 'px;}',

    // --- Интерактив графика (§6.4) ------------------------------------------
    P + '-root .hit{fill:' + C.act + ';fill-opacity:0;cursor:pointer;transition:fill-opacity .12s;}',
    P + '-root .barg:hover .hit,' + P + '-root .barg.on .hit{fill-opacity:.05;}',
    P + '-root .barg:hover .seg{filter:brightness(1.06) saturate(1.15);}',
    P + '-root .barg.off .seg,' + P + '-root .barg.off .val{opacity:.4;}',
    P + '-root .ptg:hover .dot{r:5.2;}',
    P + '-root .seg,' + P + '-root .val,' + P + '-root .dot{transition:opacity .14s ease-out;}',

    // --- Подсказка (§5): один механизм на весь лист -------------------------
    P + '-tip{font-family:' + F.family + ';position:fixed;z-index:9999;pointer-events:none;',
      'opacity:0;transform:translateY(3px);transition:opacity .11s ease-out,transform .11s ease-out;',
      'background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:' + R.r3 + 'px;',
      'box-shadow:0 10px 30px rgba(24,33,50,.18),0 2px 6px rgba(24,33,50,.08);',
      'padding:9px 12px;font-size:' + F.body + 'px;line-height:1.45;color:' + C.ink2 + ';',
      'font-weight:500;min-width:160px;max-width:320px;white-space:normal;}',
    P + '-tip.on{opacity:1;transform:none;}',
    P + '-tip .t-h{display:block;font-size:' + F.cap + 'px;font-weight:700;letter-spacing:.2px;',
      'color:' + C.muted + ';margin-bottom:' + S.s3 + 'px;}',
    P + '-tip .t-x{display:block;font-size:' + F.body + 'px;font-weight:500;color:' + C.ink2 + ';line-height:1.45;}',
    P + '-tip .t-r{display:flex;align-items:center;gap:' + S.s4 + 'px;margin-top:' + S.s2 + 'px;}',
    P + '-tip .t-r:first-child{margin-top:0;}',
    P + '-tip .t-m{display:inline-block;flex:0 0 auto;width:10px;height:9px;border-radius:' + R.r1 + 'px;}',
    P + '-tip .t-m.dash{height:0;width:14px;border-radius:0;border-top:2px dashed;background:none;}',
    P + '-tip .t-l{font-size:' + F.note + 'px;font-weight:600;color:' + C.muted + ';min-width:0;}',
    P + '-tip .t-v{display:inline;margin:0 0 0 auto;font-size:' + F.lead + 'px;font-weight:700;',
      'color:' + C.ink + ';white-space:nowrap;font-variant-numeric:tabular-nums;}',
    P + '-tip .t-r.bench .t-v{color:' + C.muted + ';font-weight:600;}',
    P + '-tip .t-n{display:block;font-size:' + F.note + 'px;font-weight:500;color:' + C.muted + ';',
      'margin-top:5px;line-height:1.4;}',
    P + '-tip .t-r+.t-n{margin-top:' + S.s4 + 'px;padding-top:7px;border-top:1px solid ' + C.line2 + ';}',
    P + '-tip .t-n+.t-n{margin-top:' + S.s1 + 'px;padding-top:0;border-top:0;}',

    // --- Доступность (§9) ---------------------------------------------------
    P + '-root [tabindex]:focus-visible,' + P + '-root button:focus-visible{',
      'outline:3px solid rgba(43,108,255,.32);outline-offset:2px;}',
    P + '-root tr.urow:focus-visible{outline:3px solid rgba(43,108,255,.25);outline-offset:-3px;}',
    P + '-root .barg:focus-visible .hit{fill-opacity:.12;}',

    // --- Появление (§6.5): бар растёт от нуля, линия рисуется по времени -----
    '@keyframes ' + CFG.ns + '-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
    '@keyframes ' + CFG.ns + '-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes ' + CFG.ns + '-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
    P + '-root .anim .seg{transform-box:fill-box;transform-origin:50% 100%;',
      'animation:' + CFG.ns + '-grow .48s cubic-bezier(.22,.61,.36,1) both;}',
    P + '-root .anim .ln{stroke-dasharray:1;stroke-dashoffset:1;',
      'animation:' + CFG.ns + '-draw .76s cubic-bezier(.4,0,.2,1) both;}',
    P + '-root .anim .dot,' + P + '-root .anim .val,' + P + '-root .anim .lnb,',
    P + '-root .anim .fade{',
      'animation:' + CFG.ns + '-fade .3s ease-out both;}',

    // --- Адаптив ------------------------------------------------------------
    '@media (max-width:1120px){' + P + '-root .shell{grid-template-columns:1fr;}',
      P + '-root .side{grid-template-rows:auto auto;}',
      P + '-root .kpis{grid-template-columns:repeat(3,minmax(0,1fr));}}',
    '@media (max-width:780px){' + P + '-root .kpis{grid-template-columns:repeat(2,minmax(0,1fr));}',
      P + '-root table{min-width:860px;}' + P + '-root .head{flex-direction:column;}}',
    '@media (max-width:480px){' + P + '-root .kpis{grid-template-columns:1fr;}',
      P + '-root .topline,' + P + '-root .p-body,' + P + '-root .kpi{padding:' + S.s6 + 'px;}}',
    '@media (prefers-reduced-motion:reduce){' + P + '-root *,' + P + '-root *:before,',
      P + '-root *:after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}',
    '@media print{' + P + '-tip{display:none!important;}' + P + '-root .pager-nav{display:none;}',
      P + '-root .panel,' + P + '-root .kpi{box-shadow:none;border:1px solid ' + C.line + ';',
      'break-inside:avoid;}}',
    '</style>'
  ].join('');
}

function kpiCard(k, snap) {
  var val = snap[k.valueKey];
  var size = snap.cnt_emp;
  var share = size > 0 ? val / size * 100 : null;
  var h = [];

  h.push('<div class="kpi">');
  h.push('<div class="k-label"><span class="k-name">' + esc(k.title) + '</span>' +
    '<span class="info"' + tipAttr({ title: k.title, text: k.tip }) + ' aria-hidden="true">i</span></div>');
  h.push('<div class="k-val">' + esc(fmtInt(val)) + '</div>');
  h.push('<div class="k-note">' +
    (share === null ? esc(CFG.text.notCompared) : esc(fmtPct(share) + ' активной численности')) +
    '</div>');

  // Строка сравнения рисуется всегда — иначе полосе нечего выравнивать (§4.3).
  h.push('<div class="k-row">');
  if (k.prevKey) {
    var prev = snap[k.prevKey];
    var d = val - prev;
    var st = deltaStatus(d, k.positive);
    h.push('<span class="delta ' + st + '"' + tipAttr({
      title: k.title,
      rows: [
        { label: 'Последняя неделя', value: fmtInt(val) },
        { label: 'Предыдущая неделя', value: fmtInt(prev), bench: true }
      ],
      note: k.positive === 'none'
        ? 'Изменение не окрашено: больше не значит лучше.'
        : 'Рост категории — хуже, снижение — лучше.'
    }) + '>' + esc(fmtDelta(d)) + '</span>');
  } else {
    h.push('<span class="nocmp"' + tipAttr({
      title: k.title,
      text: 'Метрика считается за весь загруженный период, а не за неделю, - нет базы для сравнения с прошлой неделей.'
    }) + '>' + esc(CFG.text.notCompared) + '</span>');
  }
  h.push('</div>');

  h.push('<div class="k-parts">');
  h.push('<div class="k-parts-h">' + esc(CFG.text.partsTitle) + '</div>');
  for (var i = 0; i < k.parts.length; i++) {
    var p = k.parts[i];
    h.push('<div class="k-part"><span class="k-part-v">' + esc(fmtInt(snap[p.key])) + '</span>' +
      '<span class="k-part-l">' + esc(p.label) + '</span></div>');
  }
  h.push('</div>');
  h.push('</div>');
  return h.join('');
}

function miniHead(id, title, unit, metric, unitFmt, deltaUnit) {
  var v = view();
  var series = seriesOf(v);
  var week = state.grain === 'week';
  var idx = -1, i;
  if (state.month !== null) {
    for (i = 0; i < series.length; i++) if (series[i].key === state.month) idx = i;
  }
  if (idx === -1) idx = series.length - 1;

  var cur = idx >= 0 ? series[idx][metric] : null;
  var prev = idx > 0 ? series[idx - 1][metric] : null;
  var avg = avgOf(v, metric);
  var when = idx >= 0 ? series[idx].full : DASH;

  var h = [];
  h.push('<div class="topline">');
  h.push('<div class="t-wrap"><h2 class="p-title">' + esc(title) + '</h2>' +
    '<div class="p-sub">' + esc(unit) + '</div></div>');
  h.push('<div class="mini-val">');
  h.push('<span class="mini-num">' + esc(unitFmt(cur)) + '</span>');
  if (prev === null || cur === null) {
    h.push('<span class="nocmp"' + tipAttr({
      title: title, text: (week ? 'Предыдущей недели' : 'Предыдущего месяца') + ' в выборке нет.'
    }) + '>' + esc(CFG.text.noBase) + '</span>');
  } else {
    var d = cur - prev;
    h.push('<span class="delta neu"' + tipAttr({
      title: title,
      rows: [
        { label: when, value: unitFmt(cur) },
        { label: week ? 'Предыдущая неделя' : 'Предыдущий месяц', value: unitFmt(prev), bench: true }
      ],
      note: 'Направление не окрашено: больше не значит лучше.'
    }) + '>' + esc(fmtDelta(d, 1, deltaUnit)) + '</span>');
  }
  h.push('<span class="mini-cap">' + esc(when + ' · ' + CFG.text.avgHint + ' ' +
    unitFmt(avg)) + '</span>');
  h.push('</div>');
  h.push('</div>');
  h.push('<div class="p-body"><div class="plot" id="' + CFG.ns + '-' + id + '"></div></div>');
  return h.join('');
}

function tableHead() {
  var h = [], i;
  var groups = [
    { g: CFG.tableGroups[0], cols: [
      { key: 'low', label: 'Чел.', tip: 'Сотрудников в категории «недоработка» на последней неделе' },
      { key: 'low_share', label: 'Доля', tip: 'Доля от активной численности подразделения' },
      { key: 'low_delta', label: 'Δ нед.', tip: 'Изменение к предыдущей неделе. Рост — хуже, снижение — лучше' }
    ] },
    { g: CFG.tableGroups[1], cols: [
      { key: 'high', label: 'Чел.', tip: 'Сотрудников в категории «переработка» на последней неделе' },
      { key: 'high_share', label: 'Доля', tip: 'Доля от активной численности подразделения' },
      { key: 'high_delta', label: 'Δ нед.', tip: 'Изменение к предыдущей неделе. Рост — хуже, снижение — лучше' }
    ] },
    { g: CFG.tableGroups[2], cols: [
      { key: 'talk_20_30', label: '20–30%', tip: 'Разговоры занимают 20–30% рабочего времени' },
      { key: 'talk_30_50', label: '30–50%', tip: 'Разговоры занимают 30–50% рабочего времени' },
      { key: 'talk_50_plus', label: '>50%', tip: 'Разговоры занимают больше 50% рабочего времени' }
    ] }
  ];

  // Со спарклайнами колонка «Доля» шире, остальное ужимается; без них — как в 1.0.
  if (MODEL.hasWeeks) {
    h.push('<colgroup><col style="width:24%" /><col style="width:8%" />');
    for (i = 0; i < 2; i++) h.push('<col style="width:6%" /><col style="width:13%" /><col style="width:6%" />');
    for (i = 0; i < 3; i++) h.push('<col style="width:6%" />');
  } else {
    h.push('<colgroup><col style="width:25%" /><col style="width:10%" />');
    for (i = 0; i < 6; i++) h.push('<col style="width:8%" />');
    for (i = 0; i < 3; i++) h.push('<col style="width:5.66%" />');
  }
  h.push('</colgroup>');

  h.push('<thead>');
  h.push('<tr class="g-row">');
  h.push(th('rs txt', 'name', 'Команда', 'Подразделение в вашем подчинении', 2));
  h.push(th('rs', 'cnt_emp', 'Активная численность', 'Сотрудников с активностью на последней неделе', 2));
  for (i = 0; i < groups.length; i++) {
    var g = groups[i].g;
    h.push('<th class="grp gcol" colspan="3" style="border-bottom-color:' + g.color + '"' +
      tipAttr({ title: g.name, text: g.hint }) + '>' + esc(g.name) + '</th>');
  }
  h.push('</tr>');

  h.push('<tr class="s-row">');
  for (i = 0; i < groups.length; i++) {
    for (var j = 0; j < groups[i].cols.length; j++) {
      var c = groups[i].cols[j];
      h.push(th(j === 0 ? 'grp' : '', c.key, c.label, c.tip, 0));
    }
  }
  h.push('</tr>');
  h.push('</thead>');
  return h.join('');
}

function grainTab(grain, label) {
  var on = state.grain === grain;
  return '<button type="button" class="sub-tab' + (on ? ' on' : '') + '"' +
    (on ? '' : ' data-act="grain" data-arg="' + grain + '"') + ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
    tipAttr({ title: label, text: CFG.text.grainTip }) + '>' + esc(label) + '</button>';
}

function th(cls, sortKey, label, tip, rowspan) {
  var on = state.sortKey === sortKey;
  var caret = on ? '<span class="caret" aria-hidden="true">' + (state.sortDir < 0 ? '▾' : '▴') + '</span>' : '';
  return '<th class="' + cls + ' sortable' + (on ? ' on' : '') + '"' +
    (rowspan ? ' rowspan="' + rowspan + '"' : '') +
    ' data-act="sort" data-arg="' + esc(sortKey) + '" tabindex="0" role="button"' +
    ' aria-label="' + esc(label + '. ' + CFG.text.sortHint) + '"' +
    tipAttr({ title: label, text: tip, note: CFG.text.sortHint }) + '>' +
    esc(label) + caret + '</th>';
}

function tableBody() {
  var rows = sortedRows();
  var totalPages = Math.max(1, Math.ceil(rows.length / CFG.perPage));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  var from = (state.page - 1) * CFG.perPage;
  var to = Math.min(from + CFG.perPage, rows.length);

  var h = [];
  h.push('<tbody>');
  // Итог первой строкой: он же — способ вернуться ко всем подразделениям.
  h.push(tableTr(tableRow(null, TOTAL.snap, TOTAL.weeks), true));
  for (var i = from; i < to; i++) h.push(tableTr(rows[i], false));
  h.push('</tbody>');
  return { html: h.join(''), from: from, to: to, total: rows.length, pages: totalPages };
}

// Спарклайн строки: ось от нуля (§6.1), без осей и подписей — значения в подсказке.
function sparkSVG(values, color) {
  var w = 60, h = 20, pad = 3, n = values.length, i;
  if (!n) return '';
  var max = 0;
  for (i = 0; i < n; i++) if (values[i] !== null) max = Math.max(max, values[i]);
  var top = niceTop(max);
  var step = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  var d = '', lx = null, ly = null;
  for (i = 0; i < n; i++) {
    if (values[i] === null) continue;
    var x = (pad + step * i).toFixed(1), y = (h - pad - values[i] / top * (h - pad * 2)).toFixed(1);
    d += (d ? 'L' : 'M') + x + ',' + y;
    lx = x; ly = y;
  }
  if (!d) return '';
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8"' +
    ' stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + lx + '" cy="' + ly + '" r="2.4" fill="#fff" stroke="' + color + '" stroke-width="1.8"/>' +
    '</svg>';
}

function sparkTip(r, values, group) {
  var parts = [], order = sparkWeeks(MODEL.weekOrder);
  for (var i = 0; i < order.length; i++) {
    var dk = MODEL.weekMeta[order[i]].date;
    parts.push(pad2(dk.d) + '.' + pad2(dk.m + 1) + ' ' + (values[i] === null ? DASH : fmtPct(values[i])));
  }
  return {
    title: (r.isTotal ? CFG.text.allDepts : r.name) + ' · ' + group.name.toLowerCase() + ' по неделям',
    text: parts.join(' · '),
    note: CFG.text.sparkNote
  };
}

// Число — недельная доля из снимка, как в 1.0. Линия — те же доли по закрытым
// неделям; нет строк 'week' в выдаче — остаётся одно число.
function cellSpark(r, values, share, group) {
  var hasLine = false;
  for (var i = 0; i < values.length; i++) if (values[i] !== null) hasLine = true;
  if (!hasLine) return cellPct(share);
  return '<td class="sp-cell' + (share === 0 ? ' zero' : '') + '"' + tipAttr(sparkTip(r, values, group)) + '>' +
    '<div class="sp-wrap">' + sparkSVG(values, group.color) +
    '<span class="sp-val">' + esc(fmtPct(share)) + '</span></div></td>';
}

function tableTr(r, isTotal) {
  var selected = isTotal ? state.dept === null : state.dept === r.name;
  var name = isTotal ? CFG.text.allDepts : r.name;
  var h = [];
  h.push('<tr class="urow' + (isTotal ? ' total' : '') + (selected ? ' sel' : '') + '"' +
    ' data-act="dept" data-arg="' + esc(isTotal ? '' : r.name) + '"' +
    ' tabindex="0" role="button" aria-pressed="' + (selected ? 'true' : 'false') + '"' +
    tipAttr(rowTip(r, selected)) + '>');
  h.push('<td class="txt"><div class="team">' + esc(name) + '</div></td>');
  h.push('<td class="lead">' + esc(fmtInt(r.cnt_emp)) + '</td>');
  h.push(cellNum(r.low, 'grp lead'));
  h.push(cellSpark(r, r.spark_low, r.low_share, CFG.tableGroups[0]));
  h.push(cellDelta(r.low_delta));
  h.push(cellNum(r.high, 'grp lead'));
  h.push(cellSpark(r, r.spark_high, r.high_share, CFG.tableGroups[1]));
  h.push(cellDelta(r.high_delta));
  h.push(cellNum(r.talk_20_30, 'grp'));
  h.push(cellNum(r.talk_30_50, ''));
  h.push(cellNum(r.talk_50_plus, ''));
  h.push('</tr>');
  return h.join('');
}

function cellNum(v, cls) {
  return '<td class="' + cls + (v === 0 ? ' zero' : '') + '">' + esc(fmtInt(v)) + '</td>';
}
function cellPct(v) {
  return '<td class="' + (v === 0 ? 'zero' : '') + '">' + esc(fmtPct(v)) + '</td>';
}
function cellDelta(v) {
  return '<td class="d-cell ' + deltaStatus(v, 'down') + '">' + esc(fmtDelta(v)) + '</td>';
}

function pagerHTML(t) {
  var h = [];
  h.push('<div class="pager">');
  h.push('<div class="pager-info">' + esc(CFG.text.pagerShown) + ' <b>' +
    esc(t.total ? fmtInt(t.from + 1) + '–' + fmtInt(t.to) : '0') + '</b> ' +
    esc(CFG.text.pagerOf) + ' <b>' + esc(fmtInt(t.total)) + '</b></div>');
  if (t.pages > 1) {
    h.push('<div class="pager-nav">');
    h.push(pgBtn('‹', state.page - 1, state.page <= 1, false, CFG.text.pagerPrev));
    var list = pageList(state.page, t.pages);
    for (var i = 0; i < list.length; i++) {
      if (list[i] === 0) h.push('<span class="pg-gap">…</span>');
      else h.push(pgBtn(String(list[i]), list[i], false, list[i] === state.page,
        CFG.text.pagerPage + ' ' + list[i]));
    }
    h.push(pgBtn('›', state.page + 1, state.page >= t.pages, false, CFG.text.pagerNext));
    h.push('</div>');
  }
  h.push('</div>');
  return h.join('');
}

function pgBtn(label, page, disabled, active, aria) {
  return '<button type="button" class="pg' + (active ? ' on' : '') + '"' +
    (disabled ? ' disabled' : '') + (active || disabled ? '' : ' data-act="page" data-arg="' + page + '"') +
    ' aria-label="' + esc(aria) + '">' + esc(label) + '</button>';
}

// Умная пагинация: 1 … 4 5 6 … 10 (0 — заглушка многоточия)
function pageList(cur, total) {
  var out = [], i;
  if (total <= 7) {
    for (i = 1; i <= total; i++) out.push(i);
    return out;
  }
  out.push(1);
  var left = Math.max(2, cur - 1), right = Math.min(total - 1, cur + 1);
  if (left > 2) out.push(0);
  for (i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push(0);
  out.push(total);
  return out;
}

function buildHTML() {
  var T = CFG.text;
  if (!MODEL.depts.length) {
    return buildCSS() + '<div class="' + CFG.ns + '-root"><div class="empty">' +
      '<b>' + esc(T.noDataHead) + '</b>' + esc(T.noData) + '</div></div>';
  }

  var v = view();
  var snap = v.snap;
  var h = [];

  h.push('<div class="' + CFG.ns + '-root">');
  h.push('<div class="sheet">');

  // --- Полоса срезов: как на листе HQ, только при выбранном подразделении
  if (state.dept !== null) {
    h.push('<div class="head">');
    h.push('<span class="fbar-lbl">' + esc(T.sliceLabel) + '</span>');
    h.push('<div class="chips">');
    h.push('<span class="chip"><span>' + esc(T.filterLabel) + ': <b>' + esc(state.dept) + '</b></span>' +
      '<button type="button" class="x" data-act="dept" data-arg="" aria-label="' +
      esc(T.filterReset) + '"' + tipAttr({ title: T.filterReset, text: T.scopeNote }) + '>×</button></span>');
    h.push('</div>');
    h.push('</div>');
  }

  // --- KPI-полоса
  h.push('<div class="kpis">');
  for (var i = 0; i < CFG.kpis.length; i++) h.push(kpiCard(CFG.kpis[i], snap));
  h.push('</div>');

  // --- Рабочая зона
  h.push('<div class="shell">');
  h.push('<div class="panel main-panel">');
  h.push('<div class="topline">');
  h.push('<div class="t-wrap"><h2 class="p-title">' + esc(T.stackTitle) + '</h2>' +
    '<div class="p-sub">' + esc(state.grain === 'week' ? T.stackSubWeek : T.stackSubMonth) + '</div></div>');
  // Переключатель гранулярности — в шапке панели справа (§4.4); действует
  // и на две панели динамики. Показывается только при наличии строк недель.
  if (MODEL.hasWeeks) {
    h.push('<div class="sub-tabs" role="group" aria-label="' + esc(T.grainTip) + '">' +
      grainTab('month', T.grainMonth) + grainTab('week', T.grainWeek) + '</div>');
  }
  h.push('</div>');
  h.push('<div class="p-body">');
  h.push('<div class="legend">');
  for (i = 0; i < CFG.cats.length; i++) {
    var c = CFG.cats[i];
    var off = !!state.hidden[c.key];
    h.push('<span class="sw' + (off ? ' off' : '') + '" data-act="legend" data-arg="' + esc(c.key) + '"' +
      ' tabindex="0" role="button" aria-pressed="' + (off ? 'false' : 'true') + '"' +
      tipAttr({ title: c.name, text: c.hint, note: off ? 'Категория скрыта. Нажмите, чтобы вернуть' : 'Нажмите, чтобы скрыть категорию' }) +
      '><span class="dot" style="background:' + c.color + '"></span>' + esc(c.name) + '</span>');
  }
  h.push('</div>');
  h.push('<div class="plot" id="' + CFG.ns + '-plot-stack"></div>');
  h.push('<div class="tbl-note">' + esc(T.stackNote) + '</div>');
  h.push('</div>');
  h.push('</div>');

  h.push('<div class="side">');
  h.push('<div class="panel mini-panel">' +
    miniHead('plot-act', T.actTitle, T.actUnit, 'act', fmtHours, 'ч') + '</div>');
  h.push('<div class="panel mini-panel">' +
    miniHead('plot-talk', T.talkTitle, T.talkUnit, 'talk',
      function(x) { return fmtPct(x, 1); }, 'п.п.') + '</div>');
  h.push('</div>');
  h.push('</div>');

  // --- Таблица
  var body = tableBody();
  h.push('<div class="panel table-panel">');
  h.push('<div class="topline"><div class="t-wrap"><h2 class="p-title">' + esc(T.tableTitle) + '</h2>' +
    '<div class="p-sub">' + esc(T.tableNote) + '</div></div></div>');
  h.push('<div class="p-body">');
  h.push('<div class="table-wrap"><table>' + tableHead() + body.html + '</table></div>');
  h.push(pagerHTML(body));
  h.push('</div>');
  h.push('</div>');

  h.push('</div>');
  h.push('</div>');
  return buildCSS() + h.join('');
}

// ---------- БЛОК 6: МОНТАЖ + ИНТЕРАКТИВ ----------
var SVG_NS = 'http' + '://www.w3.org/2000/svg';

function sv(tag, attrs) {
  var el = document.createElementNS(SVG_NS, tag);
  for (var k in attrs) {
    if (attrs.hasOwnProperty(k) && attrs[k] !== null && attrs[k] !== undefined) {
      el.setAttribute(k, attrs[k]);
    }
  }
  return el;
}

// §6.2: подпись значения рисуется дважды — белый halo, потом заливка.
// paint-order не используем: в части браузеров он даёт двойной текст.
function svVal(parent, x, y, str, anchor, cls) {
  var base = {
    x: x, y: y, 'text-anchor': anchor || 'middle',
    'font-size': CFG.geom.VAL_SZ, 'font-weight': 700,
    'font-family': CFG.fonts.family
  };
  var halo = sv('text', base);
  halo.setAttribute('fill', '#fff');
  halo.setAttribute('stroke', '#fff');
  halo.setAttribute('stroke-width', '3.2');
  halo.setAttribute('stroke-linejoin', 'round');
  halo.textContent = str;
  parent.appendChild(halo);
  var top = sv('text', base);
  top.setAttribute('fill', CFG.colors.valInk);
  if (cls) top.setAttribute('class', cls);
  top.textContent = str;
  parent.appendChild(top);
  return top;
}

function svLabel(parent, x, y, str, size, color, weight) {
  var t = sv('text', {
    x: x, y: y, 'text-anchor': 'middle', 'font-size': size,
    'font-weight': weight || 600, 'font-family': CFG.fonts.family, fill: color
  });
  t.textContent = str;
  parent.appendChild(t);
  return t;
}

// Скругляем только дальний от нуля край (§6.2 правило 11).
function topRoundedPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, h, w / 2));
  return 'M' + x + ',' + (y + h) +
    'L' + x + ',' + (y + r) +
    'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
    'L' + (x + w - r) + ',' + y +
    'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
    'L' + (x + w) + ',' + (y + h) + 'Z';
}

// Подписей столько, сколько влезает без наложения; остальное — в подсказке.
function labelStep(step, needPx) {
  return Math.max(1, Math.ceil(needPx / Math.max(1, step)));
}

// Ось X одинакова во всех видах: подпись периода, под ней — вторая строка
// из точки (p.sub): по месяцам год под первым и под январём, по неделям месяц
// под первой неделей месяца и год под первой точкой.
function drawAxis(svg, pts, x0, step, yBase, selKey) {
  var C = CFG.colors, F = CFG.fonts;
  svg.appendChild(sv('line', {
    x1: x0, y1: yBase, x2: x0 + step * pts.length, y2: yBase,
    stroke: C.line, 'stroke-width': 1
  }));
  var every = labelStep(step, 34);
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i], cx = x0 + step * (i + 0.5);
    var isSel = selKey !== null && p.key === selKey;
    var show = i % every === 0 || i === pts.length - 1 || isSel;
    if (show) svLabel(svg, cx, yBase + 14, p.label, F.cap, isSel ? C.ink : C.muted, isSel ? 800 : 600);
    if (p.sub && (show || every === 1)) svLabel(svg, cx, yBase + 25, p.sub, F.micro, C.muted2, 600);
  }
}

function renderStack(box, v, animate) {
  var G = CFG.geom, C = CFG.colors, T = CFG.text;
  box.innerHTML = '';
  var pts = seriesOf(v);
  if (!pts.length) return;

  var w = Math.max(260, box.clientWidth || 520);
  var h = Math.max(200, box.clientHeight || G.STACK_H);
  var x0 = G.PAD_X, plotW = w - G.PAD_X * 2;
  var yTop = G.LBL_ROOM, yBase = h - G.AXIS_H;
  var cats = visibleCats();

  var maxV = 0, i, j;
  for (i = 0; i < pts.length; i++) maxV = Math.max(maxV, visibleTotal(pts[i]));
  var top = niceTop(maxV);
  var scale = (yBase - yTop) / top;
  var step = plotW / pts.length;
  var bw = Math.max(G.BAR_MIN_W, Math.min(G.BAR_MAX_W, step * 0.62));
  var every = labelStep(step, 34);

  var svg = sv('svg', {
    width: '100%', height: h, viewBox: '0 0 ' + w + ' ' + h,
    preserveAspectRatio: 'none', role: 'img',
    'aria-label': T.stackTitle + ', ' + scopeLabel()
  });
  if (animate) svg.setAttribute('class', 'anim');

  for (i = 0; i < pts.length; i++) {
    var p = pts[i];
    var cx = x0 + step * (i + 0.5);
    var isSel = state.month === p.key;
    var g = sv('g', { class: 'barg' + (isSel ? ' on' : '') });

    var stack = 0;
    for (j = cats.length - 1; j >= 0; j--) {
      var cat = cats[j];
      var val = p.cats[cat.key];
      var sh = val * scale;
      if (sh <= 0) continue;
      var y = yBase - stack - sh;
      var isTop = true;
      for (var k = j - 1; k >= 0; k--) if (p.cats[cats[k].key] > 0) isTop = false;
      var node = isTop
        ? sv('path', { d: topRoundedPath(cx - bw / 2, y, bw, sh, 4), fill: cat.color })
        : sv('rect', { x: cx - bw / 2, y: y, width: bw, height: sh, fill: cat.color });
      node.setAttribute('class', 'seg');
      node.setAttribute('data-s', cat.key);
      g.appendChild(node);
      stack += sh;
    }

    var total = visibleTotal(p);
    if (i % every === 0 || i === pts.length - 1 || isSel) {
      svVal(g, cx, yBase - stack - G.VAL_DY, fmtInt(total), 'middle', 'val');
    }

    // Прозрачная ловушка на всю полосу месяца: в тонкий бар мышью не попасть.
    var tipRows = [];
    for (j = 0; j < cats.length; j++) {
      tipRows.push({ label: cats[j].name, value: fmtInt(p.cats[cats[j].key]), color: cats[j].color });
    }
    var hit = sv('rect', {
      x: cx - step / 2, y: 0, width: step, height: yBase,
      class: 'hit', tabindex: '0', role: 'button'
    });
    hit.setAttribute('data-act', 'month');
    hit.setAttribute('data-arg', p.key);
    hit.setAttribute('aria-label', p.full);
    hit.setAttribute('data-tip', tipHtml({
      title: p.full,
      rows: tipRows,
      note: [
        (state.grain === 'week' ? T.stackTotalWeek : T.stackTotal) + ': ' + fmtInt(total),
        isSel ? 'Нажмите ещё раз, чтобы снять отметку периода'
              : 'Нажмите, чтобы отметить период на графиках справа'
      ]
    }));
    g.appendChild(hit);
    svg.appendChild(g);
  }

  drawAxis(svg, pts, x0, step, yBase, state.month);
  box.appendChild(svg);
}

function renderLine(box, v, metric, fmtFn, title, animate) {
  var G = CFG.geom, C = CFG.colors;
  box.innerHTML = '';
  var pts = seriesOf(v);
  if (!pts.length) return;

  var w = Math.max(220, box.clientWidth || 380);
  var h = Math.max(90, box.clientHeight || G.LINE_H);
  var x0 = G.PAD_X, plotW = w - G.PAD_X * 2;
  var yTop = G.LBL_ROOM, yBase = h - G.AXIS_H;

  var avg = avgOf(v, metric);
  var maxV = 0, i;
  for (i = 0; i < pts.length; i++) {
    if (pts[i][metric] !== null) maxV = Math.max(maxV, pts[i][metric]);
  }
  if (avg !== null) maxV = Math.max(maxV, avg);
  var top = niceTop(maxV);
  var scale = (yBase - yTop) / top;
  var step = plotW / pts.length;
  var every = labelStep(step, 38);

  var svg = sv('svg', {
    width: '100%', height: h, viewBox: '0 0 ' + w + ' ' + h,
    preserveAspectRatio: 'none', role: 'img',
    'aria-label': title + ', ' + scopeLabel()
  });
  if (animate) svg.setAttribute('class', 'anim');

  // Базовая линия нуля: оси Y нет, значения подписаны у точек (§6.1).
  svg.appendChild(sv('line', {
    x1: x0, y1: yBase, x2: x0 + plotW, y2: yBase, stroke: C.line, 'stroke-width': 1
  }));

  // Пунктир среднего за период — та же роль, что база сравнения в подсказке.
  var avgNode = null;
  if (avg !== null) {
    var ya = yBase - avg * scale;
    avgNode = sv('line', {
      x1: x0, y1: ya, x2: x0 + plotW, y2: ya, stroke: C.bench,
      'stroke-width': 1.4, 'stroke-dasharray': '5 4', class: 'lnb'
    });
    svg.appendChild(avgNode);
  }

  var d = '', xs = [], ys = [], xFirst = null, xLast = null;
  for (i = 0; i < pts.length; i++) {
    var val = pts[i][metric];
    var cx = x0 + step * (i + 0.5);
    var cy = val === null ? null : yBase - val * scale;
    xs.push(cx); ys.push(cy);
    if (cy !== null) {
      d += (d ? 'L' : 'M') + cx.toFixed(1) + ',' + cy.toFixed(1);
      if (xFirst === null) xFirst = cx;
      xLast = cx;
    }
  }
  if (d) {
    // Заливка до нуля: связывает линию с базовой линией, иначе низкий график
    // висит в воздухе. Ось при этом всё равно от нуля (§6.1).
    var area = sv('path', {
      d: d + 'L' + xLast.toFixed(1) + ',' + yBase + 'L' + xFirst.toFixed(1) + ',' + yBase + 'Z',
      fill: C.blue, 'fill-opacity': '.07', stroke: 'none', class: 'fade'
    });
    if (avgNode) svg.insertBefore(area, avgNode); else svg.appendChild(area);
    svg.appendChild(sv('path', {
      d: d, fill: 'none', stroke: C.blue, 'stroke-width': 2.2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      pathLength: '1', class: 'ln'
    }));
  }

  for (i = 0; i < pts.length; i++) {
    var p = pts[i];
    if (ys[i] === null) continue;
    var isSel = state.month === p.key;
    var g = sv('g', { class: 'ptg' + (isSel ? ' on' : '') });

    g.appendChild(sv('circle', {
      cx: xs[i], cy: ys[i], r: isSel ? 5 : G.DOT_R, fill: '#fff',
      stroke: C.blue, 'stroke-width': isSel ? 2.8 : 2.2, class: 'dot'
    }));
    if (i % every === 0 || i === pts.length - 1 || isSel) {
      svVal(g, xs[i], ys[i] - G.VAL_DY, fmtFn(p[metric]), 'middle', 'val');
    }

    var prev = i > 0 ? pts[i - 1][metric] : null;
    var rows = [{ label: title, value: fmtFn(p[metric]), color: C.blue }];
    rows.push(prev === null
      ? { label: baseOf(), value: CFG.text.noBase, bench: true }
      : { label: baseOf(), value: fmtDelta(p[metric] - prev, 1), bench: true });
    if (avg !== null) rows.push({ label: CFG.text.avgHint, value: fmtFn(avg), color: C.bench, dash: true });

    var hit = sv('rect', {
      x: xs[i] - step / 2, y: 0, width: step, height: yBase,
      class: 'hit', tabindex: '0', role: 'button'
    });
    hit.setAttribute('data-act', 'month');
    hit.setAttribute('data-arg', p.key);
    hit.setAttribute('aria-label', p.full);
    hit.setAttribute('data-tip', tipHtml({
      title: p.full,
      rows: rows,
      note: isSel ? 'Нажмите ещё раз, чтобы снять отметку периода'
                  : 'Нажмите, чтобы отметить период'
    }));
    g.appendChild(hit);
    svg.appendChild(g);
  }

  drawAxis(svg, pts, x0, step, yBase, state.month);
  box.appendChild(svg);
}

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
    overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:10;' +
      'background:transparent;overflow:auto;box-sizing:border-box;';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(overlay);

    // --- Подсказка: один узел и один обработчик на весь лист (§5) ----------
    var tipEl = null;
    function tipNode() {
      if (tipEl && tipEl.parentNode) return tipEl;
      var old = document.querySelector('body > .' + CFG.ns + '-tip');
      if (old) old.parentNode.removeChild(old);
      tipEl = document.createElement('div');
      tipEl.className = CFG.ns + '-tip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
      return tipEl;
    }
    var tipFor = null;
    function hideTip() {
      if (tipEl) tipEl.className = CFG.ns + '-tip';
      tipFor = null;
    }
    function placeTip(n, x, y) {
      var w = n.offsetWidth || 220, h = n.offsetHeight || 60;
      var l = x + 16, t = y - h - 14;
      if (l + w > window.innerWidth - 10) l = x - w - 16;
      if (l < 10) l = 10;
      if (t < 10) t = y + 20;
      n.style.left = Math.round(l) + 'px';
      n.style.top = Math.round(t) + 'px';
    }

    // Ищем ближайшего предка с атрибутом: closest() есть не у всех SVG-узлов.
    function upWith(node, attr) {
      while (node && node.nodeType === 1 && node !== overlay) {
        if (node.getAttribute && node.getAttribute(attr) !== null) return node;
        node = node.parentNode;
      }
      return null;
    }

    overlay.addEventListener('mousemove', function(e) {
      var t = upWith(e.target, 'data-tip');
      if (!t) { hideTip(); return; }
      var n = tipNode();
      if (tipFor !== t) { tipFor = t; n.innerHTML = t.getAttribute('data-tip') || ''; }
      n.className = CFG.ns + '-tip on';
      placeTip(n, e.clientX, e.clientY);
    }, true);
    overlay.addEventListener('mouseleave', hideTip, true);
    overlay.addEventListener('scroll', hideTip, true);
    window.addEventListener('scroll', hideTip, true);

    // --- Действия ---------------------------------------------------------
    function act(name, arg) {
      if (name === 'dept') {
        var next = arg === '' ? null : arg;
        state.dept = (next !== null && state.dept === next) ? null : next;
      } else if (name === 'legend') {
        var visible = visibleCats();
        if (!state.hidden[arg] && visible.length <= 1) return;   // последнюю не гасим
        state.hidden[arg] = !state.hidden[arg];
      } else if (name === 'month') {
        state.month = state.month === arg ? null : arg;
      } else if (name === 'grain') {
        // Отметка периода живёт в своей гранулярности — при переключении снимается.
        state.grain = arg === 'week' && MODEL.hasWeeks ? 'week' : 'month';
        state.month = null;
      } else if (name === 'sort') {
        if (state.sortKey === arg) state.sortDir = -state.sortDir;
        else { state.sortKey = arg; state.sortDir = arg === 'name' ? 1 : -1; }
        state.page = 1;
      } else if (name === 'page') {
        state.page = Number(arg) || 1;
      } else if (name === 'reset') {
        state.dept = null;
        state.month = null;
      } else {
        return;
      }
      hideTip();
      render(false, name + ':' + arg);
    }

    overlay.addEventListener('click', function(e) {
      var t = upWith(e.target, 'data-act');
      if (!t) return;
      act(t.getAttribute('data-act'), t.getAttribute('data-arg') || '');
    });

    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (state.dept !== null || state.month !== null) { e.preventDefault(); act('reset', ''); }
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ' && e.keyCode !== 13 && e.keyCode !== 32) return;
      var t = upWith(e.target, 'data-act');
      if (!t) return;
      e.preventDefault();
      act(t.getAttribute('data-act'), t.getAttribute('data-arg') || '');
    });

    // --- Рендер -----------------------------------------------------------
    function drawCharts(animate) {
      var v = view();
      var stack = overlay.querySelector('#' + CFG.ns + '-plot-stack');
      if (stack) renderStack(stack, v, animate);
      var pa = overlay.querySelector('#' + CFG.ns + '-plot-act');
      if (pa) renderLine(pa, v, 'act', fmtHours, CFG.text.actTitle, animate);
      var pt = overlay.querySelector('#' + CFG.ns + '-plot-talk');
      if (pt) renderLine(pt, v, 'talk', function(x) { return fmtPct(x, 1); }, CFG.text.talkTitle, animate);
    }

    // §9: у SVG-узла может не быть .focus(), фокус возвращаем вручную.
    function restoreFocus(token) {
      if (!token) return;
      var sep = token.indexOf(':');
      var name = token.slice(0, sep), arg = token.slice(sep + 1);
      var sel = '[data-act="' + name + '"][data-arg="' + arg + '"]';
      var el = overlay.querySelector(sel);
      if (el && typeof el.focus === 'function') {
        try { el.focus(); } catch (err) { /* фокус не критичен */ }
      }
    }

    var lastW = 0;
    function render(animate, focusToken) {
      overlay.innerHTML = buildHTML();
      lastW = overlay.clientWidth;
      drawCharts(animate);
      restoreFocus(focusToken);
    }

    render(true, null);

    if (typeof ResizeObserver !== 'undefined') {
      var pending = false;
      var ro = new ResizeObserver(function() {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function() {
          pending = false;
          var w = overlay.clientWidth;
          if (Math.abs(w - lastW) < 2) return;
          lastW = w;
          hideTip();
          drawCharts(false);   // геометрия пересчитывается, анимация — нет (§6.5)
        });
      });
      ro.observe(host);
    }
  } catch (e) {
    var hs = document.querySelectorAll('[_echarts_instance_]');
    if (hs && hs.length > 0) {
      var hh = hs[hs.length - 1];
      hh.innerHTML = '<div style="padding:20px;font-family:' + CFG.fonts.family +
        ';color:' + CFG.colors.redTx + ';font-size:13px;">Ошибка графика: ' +
        esc(e && e.message ? e.message : e) + '</div>';
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
