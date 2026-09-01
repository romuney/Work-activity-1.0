-- ============================================================================
-- activity.sql — единственный запрос листа «Мониторинг рабочей активности»
-- ============================================================================
-- Один запрос на весь лист: KPI-полоса, состав по категориям, динамика
-- активности и звонков, таблица по подразделениям.
--
-- ГРАНУЛЯРНОСТЬ:  1 строка = подразделение (lvl_down_nm) × месяц.
--                 Объём = <подразделений> × <месяцев>, то есть десятки строк.
--
-- ПРАВИЛО ОТБОРА КОЛОНОК: в выдаче остаётся поле, которое НЕЛЬЗЯ получить
--   из соседних. Всё остальное — доли, средние, дельты, суммы категорий,
--   итог «все подразделения» — считает JS (activity.chart.js, БЛОК 3).
--   Поэтому здесь нет ни одной оконной функции и ни одного деления:
--   клик по строке таблицы пересчитывает лист на клиенте, без похода в БД.
--
-- 25 показателей, все аддитивные. Что убрано и почему:
--   * category_little_group строкой + color_col  → пивот в 4 колонки, палитра в CFG
--   * duration_active / avg_duration_active /
--     calls / avg_calls (≈120 строк оконных)     → числитель и знаменатель врозь
--   * prev_* как готовая дельта                  → сырой счётчик прошлой недели
--   * low / high / leave / weekend               → сумма своих же двух полос,
--                                                  складывает JS
--   * средняя за будни без плана (второй уровень
--     прежнего coalesce)                         → срабатывала только там, где
--                                                  в подразделении вообще нет
--                                                  плановых дней; этот случай
--                                                  закрывает «по всем дням».
--                                                  Нужен третий уровень —
--                                                  вернуть пару dur_wd_sum/cnt.
--
-- ПРЕДПОСЫЛКА: сотрудник относится ровно к одному lvl_down_nm, поэтому
--   «все подразделения» = сумма по строкам.
--
-- ГРАНУЛЯРНОСТЬ ПРИЗНАКОВ: cat_week / weeks_in_current_category / share_talk —
--   недельные, cat_month — месячный, flg_absent_total / flg_work_in_rest_total —
--   за весь период. В одной плоской выдаче общий ключ только один — месяц:
--     • недельные (flag_last_week = 1|2) JS суммирует по месяцам: последняя
--       закрытая неделя обычно целиком лежит в одном. Если она попадает на стык,
--       её строки лягут в два месяца и сотрудник посчитается дважды. Точное
--       решение — завести в витрине week_dt и вынести снимок недели отдельно;
--       прежний запрос таблицы вёл себя так же.
--     • периодовые (прогулы, работа в выходные) по месяцам НЕ аддитивны —
--       сотрудник попадает в каждый свой месяц. JS берёт максимум по месяцам
--       внутри подразделения (см. PERIOD_KEYS в БЛОКЕ 3).
-- ============================================================================

SELECT
  `lvl_down_nm` AS `lvl_down_nm`,
  dateTrunc('month', calendar_dt) AS `date_structure`,

  -- ------------------------------------------------------------------------
  -- Состав по категориям месяца: стек, легенда, итог и подсказка.
  -- Категорию строкой не отдаём — четыре колонки дешевле и не плодят строк.
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

  -- Активная численность последней закрытой недели: знаменатель всех долей.
  count(DISTINCT mdm_employee_rk) FILTER (
    WHERE flag_last_week = 1
  ) AS `cnt_emp`,

  -- ------------------------------------------------------------------------
  -- Недоработка и переработка: две полосы «сколько недель в категории».
  -- Полосы непересекающиеся и покрывают категорию целиком (NULL уходит
  -- в первую), поэтому итог по категории JS получает сложением — отдельная
  -- колонка не нужна. Прошлая неделя — сырым счётчиком, дельту считает JS.
  -- ------------------------------------------------------------------------
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

  -- ------------------------------------------------------------------------
  -- Доля разговоров в Talk от рабочего времени: три непересекающиеся полосы,
  -- ни одна не выводится из двух других.
  -- ------------------------------------------------------------------------
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

  -- ------------------------------------------------------------------------
  -- Прогулы и работа в выходные: тоже две полосы, итог складывает JS.
  -- ------------------------------------------------------------------------
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

  -- ------------------------------------------------------------------------
  -- Средняя рабочая активность, ч/день. Готовое среднее не отдаём: две пары
  -- «сумма/количество» вместо трёх вложенных оконных функций. Делит JS, он же
  -- выбирает базу дней (плановые дни, иначе все дни). Пары аддитивны, поэтому
  -- среднее корректно пересчитывается на любом срезе подразделений.
  -- ------------------------------------------------------------------------
  sumIf(duration_hour_correct, plan_working_day_flg = 1) AS `dur_plan_sum`,
  countIf(plan_working_day_flg = 1) AS `dur_plan_cnt`,
  sum(duration_hour_correct) AS `dur_all_sum`,
  count(duration_hour_correct) AS `dur_all_cnt`,

  -- ------------------------------------------------------------------------
  -- Доля звонков в Talk, %. Числитель и знаменатель по одной базе рабочих
  -- дней; делит JS. Раньше «за месяц» и «в среднем за период» считались
  -- двумя разными формулами — теперь формула одна, отличается только область
  -- суммирования.
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
