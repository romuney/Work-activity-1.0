SELECT
  `emp_specialization_oper_code` AS `emp_specialization_oper_code`,
  `gender` AS `gender`,
  `type_age` AS `type_age`,
  `grade` AS `grade`,
  `seniority` AS `seniority`,
  `type_company` AS `type_company`,
  `employment_relation_type_desc` AS `employment_relation_type_desc`,
  `type_of_work` AS `type_of_work`,
  `employee_stream_desc` AS `employee_stream_desc`,
  `employee_specialization_desc` AS `employee_specialization_desc`,
  `experience_group_nm` AS `experience_group_nm`,
  `age` AS `age`,
  count(mdm_employee_rk) AS `ur_count`,
  countIf (mdm_employee_rk, active_type_nm = 'Активная') AS `active_count`,
  countIf (
    mdm_employee_rk,
    active_type_nm = 'Активная'
    AND emp_specialization_oper_code = 'Hq'
  ) AS `hq_count`
FROM
  `prod_proteus`.`team_structure`
GROUP BY
  `emp_specialization_oper_code`,
  `gender`,
  `type_age`,
  `grade`,
  `seniority`,
  `type_company`,
  `employment_relation_type_desc`,
  `type_of_work`,
  `employee_stream_desc`,
  `employee_specialization_desc`,
  `experience_group_nm`,
  `age`
ORDER BY
  `ur_count` DESC