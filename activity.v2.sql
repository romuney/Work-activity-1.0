-- ============================================================================
-- activity.v2.sql — запрос листа «Мониторинг рабочей активности», версия 2.0
-- ============================================================================
-- Пара к activity.v2.chart.js. Версия 1.0 (activity.sql) не тронута.
--
-- ЧТО ИЗМЕНИЛОСЬ ПРОТИВ 1.0: точные гранулярности.
--   В 1.0 недельный снимок и периодовые признаки сводились к месяцу — и на
--   стыке месяцев сотрудник из последней недели попадал в два месяца, а по
--   прогулам приходилось брать максимум по месяцам. Здесь выдача из трёх
--   видов строк, каждый — на своей гранулярности:
--     row_kind = 'month'    → подразделение × месяц: состав по cat_month
--                             и компоненты средних (стек и линии по месяцам)
--     row_kind = 'week'     → подразделение × неделя: состав по cat_week,
--                             численность и компоненты средних (стек и линии
--                             по неделям, спарклайны недельных долей в таблице)
--     row_kind = 'snapshot' → подразделение: снимок последней закрытой
--                             недели и периодовые признаки (KPI и таблица)
--   Набор колонок у всех видов один; чужие для вида колонки равны 0.
--   cnt_cat_* в строках 'month' считаются по cat_month, в строках 'week' —
--   по cat_week: одна и та же мера на двух гранулярностях, JS переключает их
--   кнопкой «Месяцы / Недели». Недельная доля в таблице — из 'snapshot',
--   как в 1.0; её последняя точка совпадает с cnt_cat_low / cnt_emp недели.
--
-- ЦЕНА: три плоских прохода по витрине (UNION ALL) вместо одного, все —
--   GROUP BY без оконных функций и без делений. Если диалект поддерживает
--   GROUPING SETS, сводится к одному проходу:
--     GROUP BY GROUPING SETS ((lvl_down_nm, dateTrunc('month', calendar_dt)),
--                             (lvl_down_nm, dateTrunc('week', calendar_dt)),
--                             (lvl_down_nm))
--   JS различает виды строк по row_kind, а без него — по date_structure
--   (пусто → snapshot), поэтому с таким запросом работает тот же скрипт.
--
-- НЕДЕЛЯ: dateTrunc('week', calendar_dt) — понедельник. Если в витрине есть
--   своя колонка недели (week_dt) с той же разметкой, что у cat_week, —
--   подставьте её. flag_last_week в строках 'week' говорит JS, какая неделя
--   последняя закрытая: всё, что позже, в спарклайн не попадает.
--
-- 29 колонок: row_kind, 2 измерения, flag_last_week, 25 показателей.
-- Все показатели аддитивные; доли, средние, дельты, итоги категорий
-- и «все подразделения» считает JS.
--
-- ПРЕДПОСЫЛКА: сотрудник относится ровно к одному lvl_down_nm.
-- ============================================================================

-- ---------------------------------------------------------------- месяц ----
SELECT
  'month' AS `row_kind`,
  `lvl_down_nm` AS `lvl_down_nm`,
  dateTrunc('month', calendar_dt) AS `date_structure`,

  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_month IN ('low', 'super_low'))   AS `cnt_cat_low`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_month = 'normal')                AS `cnt_cat_normal`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_month IN ('high', 'super_high')) AS `cnt_cat_high`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_month = 'grey')                  AS `cnt_cat_grey`,

  0 AS `cnt_emp`,
  0 AS `low_fresh`,  0 AS `low_long`,  0 AS `prev_low`,
  0 AS `high_fresh`, 0 AS `high_long`, 0 AS `prev_high`,
  0 AS `talk_20_30`, 0 AS `talk_30_50`, 0 AS `talk_50_plus`, 0 AS `prev_talk_20_30`,
  0 AS `leave_fresh`, 0 AS `leave_long`, 0 AS `weekend_fresh`, 0 AS `weekend_long`,
  0 AS `flag_last_week`,

  sumIf(duration_hour_correct, plan_working_day_flg = 1) AS `dur_plan_sum`,
  countIf(plan_working_day_flg = 1)                      AS `dur_plan_cnt`,
  sum(duration_hour_correct)                             AS `dur_all_sum`,
  count(duration_hour_correct)                           AS `dur_all_cnt`,
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

UNION ALL

-- --------------------------------------------------------------- неделя ----
-- Те же меры, что в месяце, но на неделю и по cat_week: состав, численность
-- и компоненты средних. Полосы «сколько недель в категории», Talk-полосы,
-- периодовые признаки и прошлая неделя здесь не нужны — нули.
SELECT
  'week' AS `row_kind`,
  `lvl_down_nm` AS `lvl_down_nm`,
  dateTrunc('week', calendar_dt) AS `date_structure`,

  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_week IN ('low', 'super_low'))   AS `cnt_cat_low`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_week = 'normal')                AS `cnt_cat_normal`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_week IN ('high', 'super_high')) AS `cnt_cat_high`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE cat_week = 'grey')                  AS `cnt_cat_grey`,

  count(DISTINCT mdm_employee_rk) AS `cnt_emp`,
  0 AS `low_fresh`,  0 AS `low_long`,  0 AS `prev_low`,
  0 AS `high_fresh`, 0 AS `high_long`, 0 AS `prev_high`,
  0 AS `talk_20_30`, 0 AS `talk_30_50`, 0 AS `talk_50_plus`, 0 AS `prev_talk_20_30`,
  0 AS `leave_fresh`, 0 AS `leave_long`, 0 AS `weekend_fresh`, 0 AS `weekend_long`,
  max(flag_last_week) AS `flag_last_week`,

  sumIf(duration_hour_correct, plan_working_day_flg = 1) AS `dur_plan_sum`,
  countIf(plan_working_day_flg = 1)                      AS `dur_plan_cnt`,
  sum(duration_hour_correct)                             AS `dur_all_sum`,
  count(duration_hour_correct)                           AS `dur_all_cnt`,
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
  dateTrunc('week', calendar_dt)

UNION ALL

-- --------------------------------------------------------------- снимок ----
-- Без WHERE: периодовые признаки должны видеть все строки сотрудника,
-- недельные сами ограничены flag_last_week внутри FILTER.
SELECT
  'snapshot' AS `row_kind`,
  `lvl_down_nm` AS `lvl_down_nm`,
  NULL AS `date_structure`,

  0 AS `cnt_cat_low`, 0 AS `cnt_cat_normal`, 0 AS `cnt_cat_high`, 0 AS `cnt_cat_grey`,

  -- активная численность последней закрытой недели: знаменатель всех долей
  count(DISTINCT mdm_employee_rk) FILTER (WHERE flag_last_week = 1) AS `cnt_emp`,

  -- недоработка: две полосы покрывают категорию целиком (NULL → первая),
  -- итог складывает JS; прошлая неделя — сырым счётчиком, дельта в JS
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low') AND flag_last_week = 1
      AND coalesce(weeks_in_current_category, 0) <= 2
  ) AS `low_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low') AND flag_last_week = 1
      AND weeks_in_current_category > 2
  ) AS `low_long`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low') AND flag_last_week = 2
  ) AS `prev_low`,

  -- переработка
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high') AND flag_last_week = 1
      AND coalesce(weeks_in_current_category, 0) <= 2
  ) AS `high_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high') AND flag_last_week = 1
      AND weeks_in_current_category > 2
  ) AS `high_long`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high') AND flag_last_week = 2
  ) AS `prev_high`,

  -- доля разговоров в Talk: три непересекающиеся полосы
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk >= 20 AND share_talk <= 30 AND flag_last_week = 1
  ) AS `talk_20_30`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk > 30 AND share_talk <= 50 AND flag_last_week = 1
  ) AS `talk_30_50`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk > 50 AND flag_last_week = 1
  ) AS `talk_50_plus`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE share_talk >= 20 AND share_talk <= 30 AND flag_last_week = 2
  ) AS `prev_talk_20_30`,

  -- прогулы и работа в выходные за весь период: точно, без максимума по месяцам
  count(DISTINCT mdm_employee_rk) FILTER (WHERE flg_absent_total > 1 AND flg_absent_total <= 5) AS `leave_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE flg_absent_total > 5)                           AS `leave_long`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE flg_work_in_rest_total > 1 AND flg_work_in_rest_total <= 5) AS `weekend_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (WHERE flg_work_in_rest_total > 5)                                 AS `weekend_long`,
  0 AS `flag_last_week`,

  0 AS `dur_plan_sum`, 0 AS `dur_plan_cnt`, 0 AS `dur_all_sum`, 0 AS `dur_all_cnt`,
  0 AS `talk_h_sum`, 0 AS `work_h_sum`
FROM
  prod_proteus.monitoring_work_activity_kavtorin
GROUP BY
  `lvl_down_nm`
