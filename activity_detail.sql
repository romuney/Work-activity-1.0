-- ============================================================================
-- activity_detail.sql — запрос листа «Мониторинг рабочей активности», подневный
-- ============================================================================
-- Строка выдачи = подразделение (lvl_down_nm) × календарный день (calendar_dt).
-- Месяцев и недель в SQL нет: месяц и неделю (понедельник дня) считает JS и сам
-- группирует дни в периоды — activity.chart.js, БЛОК 3, dailyToPeriods().
-- Один плоский GROUP BY без оконных функций и делений.
--
-- Набор колонок — как в 1.0 (activity.sql до недельной ветки), на день:
--   * cnt_month_* — состав по категории месяца; cnt_emp, полосы, prev_*, Talk —
--     снимок последней закрытой недели (внутри FILTER по flag_last_week, как
--     и раньше: вне этих недель нули); прогулы, выходные, компоненты средних.
-- Добавлено ради недельного режима и спарклайнов:
--   * cnt_week_* — состав по категории недели (cat_week);
--   * cnt_day — численность дня без фильтра (знаменатель недельных долей);
--   * flag_last_week — 1 у дней последней закрытой недели, 2 у предыдущей.
--
-- Как JS сводит дни в период:
--   * суммы (dur_*, talk_h_sum, work_h_sum) складываются — средние точные;
--   * численности (cnt_*, полосы, prev_*, прогулы, выходные) берутся максимумом
--     по дням периода: категория у сотрудника внутри периода постоянна, дневной
--     счётчик — численность категории в этот день, максимум — численность
--     в пиковый день. Он меньше count(DISTINCT) за период на тех, кто пришёл
--     или ушёл внутри периода и ни одного дня не пересёкся с остальными
--     (для недели ноль или единица, для месяца — единицы человек). Нужен точный
--     count(DISTINCT) — запасной activity.sql, скрипт принимает обе выдачи.
--
-- Предпосылки: сотрудник относится ровно к одному lvl_down_nm; витрина
-- календарная (у сотрудника есть строка на каждый день периода); неделя
-- витрины — понедельник–воскресенье, как и неделя, которую считает JS.
-- ============================================================================

SELECT
  `lvl_down_nm` AS `lvl_down_nm`,
  `calendar_dt` AS `date_structure`,
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
  -- состав по категории недели: режим «Недели» и спарклайны
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low')
  ) AS `cnt_week_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week = 'normal'
  ) AS `cnt_week_normal`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high')
  ) AS `cnt_week_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week = 'grey'
  ) AS `cnt_week_grey`,
  -- численность дня без фильтра: знаменатель недельных долей
  count(DISTINCT mdm_employee_rk) AS `cnt_day`,
  -- 1 — день последней закрытой недели, 2 — предыдущей, иначе 0
  max(flag_last_week) AS `flag_last_week`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flag_last_week = 1
  ) AS `cnt_emp`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low')
      AND flag_last_week = 1
      AND coalesce(weeks_in_current_category, 0) <= 2
  ) AS `low_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low')
      AND flag_last_week = 1
      AND weeks_in_current_category > 2
  ) AS `low_long`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('low', 'super_low')
      AND flag_last_week = 2
  ) AS `prev_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high')
      AND flag_last_week = 1
      AND coalesce(weeks_in_current_category, 0) <= 2
  ) AS `high_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high')
      AND flag_last_week = 1
      AND weeks_in_current_category > 2
  ) AS `high_long`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE cat_week IN ('high', 'super_high')
      AND flag_last_week = 2
  ) AS `prev_high`,
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
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_absent_total > 1 AND flg_absent_total <= 5
  ) AS `leave_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_absent_total > 5
  ) AS `leave_long`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_work_in_rest_total > 1 AND flg_work_in_rest_total <= 5
  ) AS `weekend_fresh`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flg_work_in_rest_total > 5
  ) AS `weekend_long`,
  sumIf(duration_hour_correct, plan_working_day_flg = 1) AS `dur_plan_sum`,
  countIf(plan_working_day_flg = 1) AS `dur_plan_cnt`,
  sum(duration_hour_correct) AS `dur_all_sum`,
  count(duration_hour_correct) AS `dur_all_cnt`,
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
  `calendar_dt`
ORDER BY
  `lvl_down_nm`,
  `calendar_dt`