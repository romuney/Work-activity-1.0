-- ============================================================================
-- activity.sql — единый датасет листа «Мониторинг рабочей активности»
-- ============================================================================
-- Один запрос на весь лист: KPI-полоса, состав по категориям, динамика
-- активности и звонков, таблица по подразделениям. Раньше запросов было три,
-- и все три ходили в одну и ту же витрину.
--
-- ГРАНУЛЯРНОСТЬ ВЫДАЧИ:  1 строка = подразделение (lvl_down_nm) × месяц.
--   Объём = <подразделений> × <месяцев в фильтре>, то есть десятки строк.
--
-- ПРИНЦИП: SQL отдаёт ТОЛЬКО аддитивные величины — счётчики и суммы.
--   Доли, средние, дельты, итоги и пересчёт под выбранное подразделение
--   делает JS (activity.chart.js, БЛОК 3). Поэтому здесь нет ни одной
--   оконной функции и ни одного деления: клик по строке таблицы
--   пересчитывает весь лист на клиенте, без повторного похода в БД.
--
-- ЧТО УЕХАЛО ИЗ SQL В JS:
--   * CASE ... AS category_little_group  → пивот в четыре колонки cnt_month_*
--   * CASE ... AS color_col              → палитра живёт в CFG.colors
--   * duration_active / avg_duration_active / calls / avg_calls
--     (≈120 строк оконных функций)       → числитель и знаменатель по
--                                          отдельности, деление и
--                                          coalesce-цепочка в JS
--   * prev_* как готовая дельта          → отдаём сырой счётчик прошлой недели,
--                                          вычитание в JS
--
-- ПРЕДПОСЫЛКА АГРЕГАЦИИ: сотрудник относится ровно к одному lvl_down_nm,
--   поэтому «все подразделения» = сумма по строкам. Если в витрине сотрудник
--   может попасть в два подразделения, итог по всем завысится.
--
-- ГРАНУЛЯРНОСТЬ ПРИЗНАКОВ (важно):
--   cat_week / weeks_in_current_category / share_talk — недельные признаки,
--   cat_month — месячный, flg_absent_total / flg_work_in_rest_total — за весь
--   период. В одной плоской выдаче их приходится сводить к месяцу:
--     • недельные (flag_last_week = 1|2) JS суммирует по месяцам — последняя
--       неделя обычно целиком лежит в одном месяце. Если она попадает на стык,
--       её строки лягут в два месяца и сотрудник посчитается дважды. Точное
--       решение — завести в витрине week_dt и вынести снимок недели в
--       отдельный запрос; текущее поведение совпадает с прежним.
--     • периодовые (прогулы, работа в выходные) по месяцам НЕ аддитивны —
--       один и тот же сотрудник попадает в каждый свой месяц. JS берёт по
--       ним максимум по месяцам внутри подразделения (см. БЛОК 3, PERIOD_KEYS).
-- ============================================================================

SELECT
  `lvl_down_nm` AS `lvl_down_nm`,
  dateTrunc('month', calendar_dt) AS `date_structure`,

  -- ------------------------------------------------------------------------
  -- Состав по категориям месяца. Пивот в колонки: категорию как строку
  -- (CASE ... AS category_little_group) больше не отдаём — из четырёх колонок
  -- JS собирает и стек, и легенду, и итог, и подсказку.
  -- ------------------------------------------------------------------------
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_month IN ('low', 'super_low')
  ) AS `cnt_month_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_month = 'normal'
  ) AS `cnt_month_normal`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_month IN ('high', 'super_high')
  ) AS `cnt_month_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_month = 'grey'
  ) AS `cnt_month_grey`,

  -- ------------------------------------------------------------------------
  -- Снимок последней закрытой недели (flag_last_week = 1) и предыдущей (= 2).
  -- Дельту не считаем — отдаём оба счётчика, вычитает JS.
  -- ------------------------------------------------------------------------
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flag_last_week = 1
  ) AS `cnt_emp`,

  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low') AND flag_last_week = 1
  ) AS `low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low') AND flag_last_week = 2
  ) AS `prev_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low')
      AND weeks_in_current_category <= 2
      AND flag_last_week = 1
  ) AS `low_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low')
      AND weeks_in_current_category > 2
      AND flag_last_week = 1
  ) AS `low_long`,

  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high') AND flag_last_week = 1
  ) AS `high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high') AND flag_last_week = 2
  ) AS `prev_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high')
      AND weeks_in_current_category <= 2
      AND flag_last_week = 1
  ) AS `high_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high')
      AND weeks_in_current_category > 2
      AND flag_last_week = 1
  ) AS `high_long`,

  -- Доля разговоров в Talk от рабочего времени: три полосы
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk >= 20 AND share_talk <= 30 AND flag_last_week = 1
  ) AS `talk_20_30`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk >= 20 AND share_talk <= 30 AND flag_last_week = 2
  ) AS `prev_talk_20_30`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk > 30 AND share_talk <= 50 AND flag_last_week = 1
  ) AS `talk_30_50`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk > 50 AND flag_last_week = 1
  ) AS `talk_50_plus`,

  -- ------------------------------------------------------------------------
  -- Периодовые признаки: прогулы и работа в выходные.
  -- По месяцам НЕ аддитивны — JS берёт максимум по месяцам подразделения.
  -- ------------------------------------------------------------------------
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_absent_total > 1
  ) AS `leave`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_absent_total > 1 AND flg_absent_total <= 5
  ) AS `leave_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_absent_total > 5
  ) AS `leave_long`,

  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_work_in_rest_total > 1
  ) AS `weekend`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_work_in_rest_total > 1 AND flg_work_in_rest_total <= 5
  ) AS `weekend_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_work_in_rest_total > 5
  ) AS `weekend_long`,

  -- ------------------------------------------------------------------------
  -- Средняя рабочая активность, ч/день. Отдаём три пары «сумма/количество»
  -- вместо готового среднего: JS делит и сам разбирается с приоритетом
  -- (плановый день → будни без плана → все дни) — та же coalesce-цепочка,
  -- что была в SQL, но без трёх вложенных оконных функций. Пары аддитивны,
  -- поэтому среднее корректно пересчитывается на любом срезе.
  -- ------------------------------------------------------------------------
  sumIf(duration_hour_correct, plan_working_day_flg = 1) AS `dur_plan_sum`,
  countIf(plan_working_day_flg = 1) AS `dur_plan_cnt`,
  sumIf(
    duration_hour_correct,
    weekday IN (1, 2, 3, 4, 5) AND plan_working_day_flg = 0
  ) AS `dur_wd_sum`,
  countIf(
    weekday IN (1, 2, 3, 4, 5) AND plan_working_day_flg = 0
  ) AS `dur_wd_cnt`,
  sum(duration_hour_correct) AS `dur_all_sum`,
  count(duration_hour_correct) AS `dur_all_cnt`,

  -- ------------------------------------------------------------------------
  -- Доля звонков в Talk, %. Числитель и знаменатель по одной и той же базе
  -- рабочих дней; делит JS. Раньше «за месяц» и «в среднем за период»
  -- считались двумя разными формулами — теперь формула одна, отличается
  -- только область суммирования.
  -- ------------------------------------------------------------------------
  sumIf(
    talk_call_duration_h,
    (weekday IN (1, 2, 3, 4, 5) AND plan_working_day_flg IS NULL AND duration_hour > 0)
    OR plan_working_day_flg = 1
  ) AS `talk_h_sum`,
  sumIf(
    CASE WHEN reduced_duration_hour > 7 THEN reduced_duration_hour ELSE duration_hour END,
    (weekday IN (1, 2, 3, 4, 5) AND plan_working_day_flg IS NULL AND duration_hour > 0)
    OR plan_working_day_flg = 1
  ) AS `work_h_sum`

FROM
  prod_proteus.monitoring_work_activity_kavtorin
GROUP BY
  `lvl_down_nm`,
  dateTrunc('month', calendar_dt)
ORDER BY
  `lvl_down_nm`,
  dateTrunc('month', calendar_dt)
