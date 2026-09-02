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
  dateTrunc('month', calendar_dt)
ORDER BY
  `lvl_down_nm`,
  dateTrunc('month', calendar_dt)