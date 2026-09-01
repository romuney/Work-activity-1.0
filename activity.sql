SELECT
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND flag_last_week = 1
  ) AS `cnt_emp_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND flag_last_week = 1
  ) - count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND flag_last_week = 2
  ) AS `prev_cnt_emp_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND weeks_in_current_category > 2
      AND flag_last_week = 1
  ) AS `cnt_emp_long_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND weeks_in_current_category <= 2
      AND flag_last_week = 1
  ) AS `cnt_emp_fresh_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND flag_last_week = 1
  ) AS `cnt_emp_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND flag_last_week = 1
  ) - count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND flag_last_week = 2
  ) AS `prev_cnt_emp_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND weeks_in_current_category <= 2
      AND flag_last_week = 1
  ) AS `cnt_emp_fresh_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND weeks_in_current_category > 2
      AND flag_last_week = 1
  ) AS `cnt_emp_long_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk >= 20
      AND share_talk <= 30
      AND flag_last_week = 1
  ) AS `cnt_emp_talk`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk >= 20
      AND share_talk <= 30
      AND flag_last_week = 1
  ) - count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk >= 20
      AND share_talk <= 30
      AND flag_last_week = 2
  ) AS `prev_cnt_emp_talk`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk > 50
      AND flag_last_week = 1
  ) AS `cnt_emp_long_talk`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk > 30
      AND share_talk <= 50
      AND flag_last_week = 1
  ) AS `cnt_emp_fresh_talk`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      flg_absent_total <= 5
      AND flg_absent_total > 1
  ) AS `cnt_emp_fresh_leave`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      flg_absent_total > 1
  ) AS `cnt_emp_leave`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      flg_work_in_rest_total > 1
  ) AS `cnt_emp_weekend`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      flg_absent_total > 5
  ) AS `cnt_emp_long_leave`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      flg_work_in_rest_total <= 5
      AND flg_work_in_rest_total > 1
  ) AS `cnt_emp_fresh_weekend`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      flg_work_in_rest_total > 5
  ) AS `cnt_emp_long_weekend`,
  dateTrunc ('month', calendar_dt) AS `date_structure`,
  CASE
    WHEN cat_month = 'low'
    OR cat_month = 'super_low' THEN 'Недоработка'
    WHEN cat_month = 'high'
    OR cat_month = 'super_high' THEN 'Переработка'
    WHEN cat_month = 'normal' THEN 'Нормал'
    WHEN cat_month = 'grey' THEN 'Grey'
  END AS `category_little_group`,
  count(DISTINCT mdm_employee_rk) AS `count_employee`,
  CASE
    WHEN category_little_group = 'Grey' THEN '#b0bec5'
    WHEN category_little_group = 'Нормал' THEN '#d0e4e2'
    WHEN category_little_group = 'Переработка' THEN '#5D9ACB'
    WHEN category_little_group = 'Недоработка' THEN '#d4a5b5'
  END AS `color_col`,
  round(
    coalesce(
      sum(
        sumIf (duration_hour_correct, plan_working_day_flg = 1)
      ) OVER (
        PARTITION BY
          date_structure
      ) / nullIf(
        sum(countIf (plan_working_day_flg = 1)) OVER (
          PARTITION BY
            date_structure
        ),
        0
      ),
      sum(
        sumIf (
          duration_hour_correct,
          weekday IN (1, 2, 3, 4, 5)
          AND plan_working_day_flg = 0
        )
      ) OVER (
        PARTITION BY
          date_structure
      ) / nullIf(
        sum(
          countIf (
            weekday IN (1, 2, 3, 4, 5)
            AND plan_working_day_flg = 0
          )
        ) OVER (
          PARTITION BY
            date_structure
        ),
        0
      ),
      sum(sum(duration_hour_correct)) OVER (
        PARTITION BY
          date_structure
      ) / nullIf(
        sum(count(duration_hour_correct)) OVER (
          PARTITION BY
            date_structure
        ),
        0
      )
    ),
    1
  ) AS `duration_active`,
  round(
    coalesce(
      sum(
        sumIf (
          CASE
            WHEN reduced_duration_hour > 7 THEN reduced_duration_hour
            ELSE duration_hour
          END,
          (
            weekday IN (1, 2, 3, 4, 5)
            AND plan_working_day_flg IS NULL
            AND duration_hour > 0
          )
          OR plan_working_day_flg = 1
        )
      ) OVER () / nullIf(
        sum(
          countIf (
            (
              weekday IN (1, 2, 3, 4, 5)
              AND plan_working_day_flg IS NULL
              AND duration_hour > 0
            )
            OR plan_working_day_flg = 1
          )
        ) OVER (),
        0
      ),
      0
    ),
    1
  ) AS `avg_duration_active`,
  round(
    coalesce(
      (
        sum(
          sumIf (
            talk_call_duration_h,
            (
              weekday IN (1, 2, 3, 4, 5)
              AND plan_working_day_flg IS NULL
              AND duration_hour > 0
            )
            OR plan_working_day_flg = 1
          )
        ) OVER (
          PARTITION BY
            date_structure
        ) / nullIf(
          sum(
            sumIf (
              CASE
                WHEN reduced_duration_hour > 7 THEN reduced_duration_hour
                ELSE duration_hour
              END,
              (
                weekday IN (1, 2, 3, 4, 5)
                AND plan_working_day_flg IS NULL
                AND duration_hour > 0
              )
              OR plan_working_day_flg = 1
            )
          ) OVER (
            PARTITION BY
              date_structure
          ),
          0
        )
      ) * 100,
      0
    ),
    1
  ) AS `calls`,
  round(
    coalesce(
      (
        coalesce(
          sum(
            sumIf (talk_call_duration_h, plan_working_day_flg = 1)
          ) OVER () / nullIf(
            sum(countIf (plan_working_day_flg = 1)) OVER (),
            0
          ),
          sum(
            sumIf (
              talk_call_duration_h,
              weekday IN (1, 2, 3, 4, 5)
              AND plan_working_day_flg = 0
            )
          ) OVER () / nullIf(
            sum(
              countIf (
                weekday IN (1, 2, 3, 4, 5)
                AND plan_working_day_flg = 0
              )
            ) OVER (),
            0
          ),
          sum(sum(talk_call_duration_h)) OVER () / nullIf(sum(count(talk_call_duration_h)) OVER (), 0)
        ) / nullIf(
          coalesce(
            sum(
              sumIf (duration_hour_correct, plan_working_day_flg = 1)
            ) OVER () / nullIf(
              sum(countIf (plan_working_day_flg = 1)) OVER (),
              0
            ),
            sum(
              sumIf (
                duration_hour_correct,
                weekday IN (1, 2, 3, 4, 5)
                AND plan_working_day_flg = 0
              )
            ) OVER () / nullIf(
              sum(
                countIf (
                  weekday IN (1, 2, 3, 4, 5)
                  AND plan_working_day_flg = 0
                )
              ) OVER (),
              0
            ),
            sum(sum(duration_hour_correct)) OVER () / nullIf(sum(count(duration_hour_correct)) OVER (), 0)
          ),
          0
        )
      ) * 100,
      0
    ),
    1
  ) AS `avg_calls`,
  `lvl_down_nm` AS `lvl_down_nm`,
  count(DISTINCT mdm_employee_rk) AS `count_employee`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND flag_last_week = 1
  ) AS `low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('low', 'super_low')
      AND flag_last_week = 2
  ) AS `prev_low`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND flag_last_week = 1
  ) AS `high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      cat_week IN ('high', 'super_high')
      AND flag_last_week = 2
  ) AS `prev_high`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk >= 20
      AND share_talk <= 30
      AND flag_last_week = 1
  ) AS `talk`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk > 30
      AND share_talk <= 50
      AND flag_last_week = 1
  ) AS `fresh_talk`,
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE
      share_talk > 50
      AND flag_last_week = 1
  ) AS `long_talk`
FROM
  prod_proteus.monitoring_work_activity_kavtorin
ORDER BY
  min(`calendar_dt`) DESC
GROUP BY
  dateTrunc ('month', calendar_dt),
  CASE
    WHEN cat_month = 'low'
    OR cat_month = 'super_low' THEN 'Недоработка'
    WHEN cat_month = 'high'
    OR cat_month = 'super_high' THEN 'Переработка'
    WHEN cat_month = 'normal' THEN 'Нормал'
    WHEN cat_month = 'grey' THEN 'Grey'
END