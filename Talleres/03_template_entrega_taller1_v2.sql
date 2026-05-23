-- =====================================================================
-- 03_template_entrega_taller1_v2.sql
-- Taller aplicado 1 - SQL avanzado + Transacciones (ACID) aplicado
-- Plantilla de entrega para estudiantes
--
-- IMPORTANTE:
-- 1. Trabajar únicamente sobre las tablas T1_% y AUDIT_SALARY_ADJUSTMENTS_T1
-- 2. NO modificar la estructura del entorno entregado por el docente
-- 3. NO eliminar secciones de esta plantilla
-- 4. Reemplazar únicamente los bloques indicados como "ESCRIBA AQUÍ"
-- 5. Usar la variante asignada por el docente (1, 2, 3 o 4)
-- 6. Usar un tag único de ejecución final, por ejemplo: P03_FINAL
-- =====================================================================

SET SERVEROUTPUT ON
SET FEEDBACK ON

-- ============================================================
-- Integrante 1: Maria Valentina Osorio Romero 
-- Integrante 2: Juan Pablo Moreno Castro 
-- Curso: Bases de datos 2
-- Fecha: 08 - 04 - 2026
-- Variante asignada por el docente (1, 2, 3 o 4): 2
-- Tag de ejecución final (ejemplo: P03_FINAL): ____________

DEFINE p_variant_id    = 2
DEFINE p_execution_tag = 'P02_FINAL'

PROMPT ===== 0. VERIFICACIÓN DE LA VARIANTE ASIGNADA =====
SELECT
    variant_id,
    variant_name,
    excluded_department_id,
    min_years_service,
    recent_job_history_months,
    gap_high_threshold_pct,
    gap_mid_threshold_pct,
    raise_high_pct,
    raise_mid_pct,
    raise_low_pct,
    max_salary_vs_avg_pct,
    notes
FROM t1_variants
WHERE variant_id = &p_variant_id;

-- ============================================================
-- GUÍA RÁPIDA DE OBJETOS DISPONIBLES
-- ============================================================
-- Tabla principal de empleados: T1_EMPLOYEES
-- Columnas: employee_id, first_name, last_name, email, phone_number,
--           hire_date, job_id, salary, commission_pct, manager_id, department_id
--
-- Tabla de departamentos: T1_DEPARTMENTS
-- Columnas: department_id, department_name, manager_id, location_id
--
-- Tabla de historial laboral: T1_JOB_HISTORY
-- Columnas: employee_id, start_date, end_date, job_id, department_id
--
-- Tabla de auditoría: AUDIT_SALARY_ADJUSTMENTS_T1
-- Columnas: audit_id, execution_tag, variant_id, employee_id, department_id,
--           salary_before, salary_after, pct_gap_to_avg_before, rule_applied,
--           executed_by, executed_at, notes
--
-- Tabla de variantes: T1_VARIANTS
-- Columnas: variant_id, variant_name, excluded_department_id, min_years_service,
--           recent_job_history_months, gap_high_threshold_pct, gap_mid_threshold_pct,
--           raise_high_pct, raise_mid_pct, raise_low_pct, max_salary_vs_avg_pct, notes


-- ============================================================
-- 1. CONSULTA DIAGNÓSTICA
-- ============================================================

PROMPT ===== 1. CONSULTA DIAGNÓSTICA =====

WITH dept_stats AS (
    SELECT
        e.department_id,
        AVG(e.salary)  AS dept_avg_salary,
        MAX(e.salary)  AS dept_max_salary,
        COUNT(*)       AS dept_employee_count
    FROM t1_employees e
    WHERE e.department_id IS NOT NULL
    GROUP BY e.department_id
),

job_history_recent AS (
    SELECT DISTINCT employee_id
    FROM t1_job_history
    WHERE MONTHS_BETWEEN(SYSDATE, end_date) <= (
        SELECT recent_job_history_months
        FROM t1_variants
        WHERE variant_id = &p_variant_id
    )
)

SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    e.job_id,
    e.manager_id,
    e.department_id,
    d.department_name,
    e.salary,
    e.hire_date,
    TRUNC(MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12) AS years_service,
    ROUND(ds.dept_avg_salary, 2)                      AS dept_avg_salary,
    ds.dept_max_salary,
    ds.dept_employee_count,
    CASE
        WHEN ds.dept_avg_salary IS NOT NULL
            THEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
        ELSE NULL
    END AS pct_gap_to_avg,
    CASE
        WHEN jh.employee_id IS NOT NULL THEN 'SI'
        ELSE 'NO'
    END AS recent_job_history_flag,
    DENSE_RANK() OVER (
        PARTITION BY e.department_id
        ORDER BY e.salary DESC
    ) AS salary_rank_in_department

FROM t1_employees e

LEFT JOIN t1_departments d
    ON e.department_id = d.department_id

LEFT JOIN dept_stats ds
    ON e.department_id = ds.department_id

LEFT JOIN job_history_recent jh
    ON e.employee_id = jh.employee_id

ORDER BY
    NVL(e.department_id, 9999),
    e.employee_id;

-- COMENTARIO:
-- Esta consulta lo que hace es mostrar el panorama completo de cada empleado antes de
-- ejecutar cualquier cambio. Permite identificar quiénes tienen un salario
-- por debajo del promedio de su departamento (pct_gap_to_avg positivo),
-- quiénes tuvieron movimiento reciente en historial laboral y su posición
-- salarial dentro del departamento. Asi, ya con esta con esta información se puede decidir
-- con criterio quiénes califican para el ajuste y quiénes deben excluirse.


-- ============================================================
-- 2. DECISIÓN DE POBLACIÓN ELEGIBLE
-- ============================================================

PROMPT ===== 2. DECISIÓN DE ELEGIBLES =====

WITH variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),

dept_stats AS (
    SELECT
        department_id,
        COUNT(*) AS dept_employee_count,
        AVG(salary) AS dept_avg_salary,
        MAX(salary) AS dept_max_salary
    FROM t1_employees
    WHERE department_id IS NOT NULL
    GROUP BY department_id
),

base AS (
    SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.department_id,
        d.department_name,
        e.salary,
        e.hire_date,
        e.job_id,
        e.manager_id,

        ROUND(
            MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12,
            2
        ) AS years_service,

        ds.dept_employee_count,
        ds.dept_avg_salary,
        ds.dept_max_salary,

        CASE
            WHEN ds.dept_avg_salary IS NOT NULL THEN
                ROUND(
                    ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100,
                    2
                )
            ELSE NULL
        END AS pct_gap_to_avg,

        CASE
            WHEN EXISTS (
                SELECT 1
                FROM t1_job_history jh
                WHERE jh.employee_id = e.employee_id
                  AND MONTHS_BETWEEN(SYSDATE, jh.end_date) <= (
                        SELECT recent_job_history_months FROM variant
                  )
            )
            THEN 'SI'
            ELSE 'NO'
        END AS recent_job_history_flag,

        CASE
            WHEN e.manager_id IS NULL
                 OR e.job_id LIKE '%MAN%'
                 OR e.job_id LIKE '%PRES%'
                 OR e.job_id LIKE '%VP%'
            THEN 'SI'
            ELSE 'NO'
        END AS manager_or_exec_flag,

        var.excluded_department_id,
        var.min_years_service,
        var.recent_job_history_months,
        var.gap_high_threshold_pct,
        var.gap_mid_threshold_pct,
        var.raise_high_pct,
        var.raise_mid_pct,
        var.raise_low_pct

    FROM t1_employees e

    LEFT JOIN t1_departments d
        ON e.department_id = d.department_id

    LEFT JOIN dept_stats ds
        ON e.department_id = ds.department_id

    CROSS JOIN variant var
)

SELECT
    employee_id,
    first_name,
    last_name,
    department_id,
    department_name,
    salary,
    years_service,
    ROUND(dept_avg_salary, 2) AS dept_avg_salary,
    dept_max_salary,
    dept_employee_count,
    pct_gap_to_avg,
    recent_job_history_flag,
    manager_or_exec_flag,

    CASE
        WHEN department_id IS NULL          THEN 'NO_ELEGIBLE'
        WHEN manager_or_exec_flag = 'SI'    THEN 'NO_ELEGIBLE'
        WHEN department_id = excluded_department_id THEN 'NO_ELEGIBLE'
        WHEN years_service < min_years_service      THEN 'NO_ELEGIBLE'
        WHEN recent_job_history_flag = 'SI'         THEN 'NO_ELEGIBLE'
        WHEN dept_employee_count < 3                THEN 'NO_ELEGIBLE'
        WHEN pct_gap_to_avg <= 0                    THEN 'NO_ELEGIBLE'
        ELSE 'ELEGIBLE'
    END AS eligibility_flag,

    CASE
        WHEN department_id IS NULL          THEN 'SIN_DEPARTAMENTO'
        WHEN manager_or_exec_flag = 'SI'    THEN 'MANAGER_O_DIRECTIVO'
        WHEN department_id = excluded_department_id THEN 'DEPTO_EXCLUIDO'
        WHEN years_service < min_years_service      THEN 'ANTIGUEDAD_INSUFICIENTE'
        WHEN recent_job_history_flag = 'SI'         THEN 'HISTORIAL_RECIENTE'
        WHEN dept_employee_count < 3                THEN 'DEPTO_MENOR_A_3'
        WHEN pct_gap_to_avg <= 0                    THEN 'SALARIO_NO_APLICA'
        ELSE 'CUMPLE_REGLAS'
    END AS exclusion_reason,

    CASE
        WHEN department_id IS NULL
             OR manager_or_exec_flag = 'SI'
             OR department_id = excluded_department_id
             OR years_service < min_years_service
             OR recent_job_history_flag = 'SI'
             OR dept_employee_count < 3
             OR pct_gap_to_avg <= 0
            THEN 0
        WHEN pct_gap_to_avg >= gap_high_threshold_pct THEN raise_high_pct
        WHEN pct_gap_to_avg >= gap_mid_threshold_pct  THEN raise_mid_pct
        ELSE raise_low_pct
    END AS adjustment_pct,

    CASE
        WHEN department_id IS NULL
             OR manager_or_exec_flag = 'SI'
             OR department_id = excluded_department_id
             OR years_service < min_years_service
             OR recent_job_history_flag = 'SI'
             OR dept_employee_count < 3
             OR pct_gap_to_avg <= 0
            THEN 'SIN_AJUSTE'
        WHEN pct_gap_to_avg >= gap_high_threshold_pct THEN 'AJUSTE_ALTO'
        WHEN pct_gap_to_avg >= gap_mid_threshold_pct  THEN 'AJUSTE_MEDIO'
        ELSE 'AJUSTE_BAJO'
    END AS rule_applied

FROM base

ORDER BY
    NVL(department_id, 9999),
    employee_id;

-- COMENTARIO:
-- Se aplicaron todos los filtros de la variante 2: exclusión del departamento 60,
-- mínimo 3 años de antigüedad, historial laboral de los últimos 18 meses,
-- exclusión de directivos y managers, y departamentos con menos de 3 empleados.
-- Solo quedan como ELEGIBLES los empleados que superan todas las reglas y tienen
-- un salario por debajo del promedio departamental, lo que garantiza que el ajuste
-- tenga justificación real y no se le aumente a los que ya están bien remunerados.


-- ============================================================
-- 3. PREVALIDACIÓN ANTES DE LA TRANSACCIÓN
-- ============================================================

PROMPT ===== 3. PREVALIDACIÓN =====

-- ------------------------------------------------------------
-- A. RESUMEN GENERAL
-- ------------------------------------------------------------

WITH cte_variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),

cte_dept_stats AS (
    SELECT
        e.department_id,
        COUNT(*) AS dept_employee_count,
        AVG(e.salary) AS dept_avg_salary,
        MAX(e.salary) AS dept_max_salary
    FROM t1_employees e
    WHERE e.department_id IS NOT NULL
    GROUP BY e.department_id
),

cte_eligible_base AS (
    SELECT
        e.employee_id,
        e.department_id,
        e.salary AS salary_before,
        ds.dept_avg_salary,
        ds.dept_max_salary,
        ds.dept_employee_count,

        ROUND(
            ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100,
            2
        ) AS pct_gap_to_avg,

        CASE
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_high_threshold_pct THEN v.raise_high_pct
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_mid_threshold_pct  THEN v.raise_mid_pct
            ELSE v.raise_low_pct
        END AS adjustment_pct,

        CASE
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_high_threshold_pct THEN 'AJUSTE_ALTO'
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_mid_threshold_pct  THEN 'AJUSTE_MEDIO'
            ELSE 'AJUSTE_BAJO'
        END AS rule_applied

    FROM t1_employees e
    INNER JOIN cte_dept_stats ds ON e.department_id = ds.department_id
    CROSS JOIN cte_variant v
    WHERE e.department_id IS NOT NULL
      AND e.department_id != v.excluded_department_id
      AND ds.dept_employee_count >= 3
      AND MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12 >= v.min_years_service
      AND NOT EXISTS (
            SELECT 1 FROM t1_job_history jh
            WHERE jh.employee_id = e.employee_id
              AND MONTHS_BETWEEN(SYSDATE, jh.end_date) <= v.recent_job_history_months
      )
      AND e.manager_id IS NOT NULL
      AND e.job_id NOT LIKE '%MAN%'
      AND e.job_id NOT LIKE '%PRES%'
      AND e.job_id NOT LIKE '%VP%'
      AND ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100 > 0
),

cte_eligible_final AS (
    SELECT
        employee_id,
        department_id,
        salary_before,
        ROUND(salary_before + (salary_before * adjustment_pct / 100), 2) AS salary_after,
        adjustment_pct,
        rule_applied
    FROM cte_eligible_base
)

SELECT
    COUNT(*) AS total_eligible_employees,
    ROUND(SUM(salary_before), 2) AS total_salary_before,
    ROUND(SUM(salary_after), 2)  AS total_salary_after,
    ROUND(SUM(salary_after - salary_before), 2) AS total_increment
FROM cte_eligible_final;


-- ------------------------------------------------------------
-- B. DETALLE DE EMPLEADOS ELEGIBLES
-- ------------------------------------------------------------

WITH cte_variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),

cte_dept_stats AS (
    SELECT
        e.department_id,
        COUNT(*) AS dept_employee_count,
        AVG(e.salary) AS dept_avg_salary,
        MAX(e.salary) AS dept_max_salary
    FROM t1_employees e
    WHERE e.department_id IS NOT NULL
    GROUP BY e.department_id
),

cte_eligible_base AS (
    SELECT
        e.employee_id,
        e.department_id,
        e.salary AS salary_before,

        CASE
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_high_threshold_pct THEN v.raise_high_pct
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_mid_threshold_pct  THEN v.raise_mid_pct
            ELSE v.raise_low_pct
        END AS adjustment_pct,

        CASE
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_high_threshold_pct THEN 'AJUSTE_ALTO'
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_mid_threshold_pct  THEN 'AJUSTE_MEDIO'
            ELSE 'AJUSTE_BAJO'
        END AS rule_applied

    FROM t1_employees e
    INNER JOIN cte_dept_stats ds ON e.department_id = ds.department_id
    CROSS JOIN cte_variant v
    WHERE e.department_id IS NOT NULL
      AND e.department_id != v.excluded_department_id
      AND ds.dept_employee_count >= 3
      AND MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12 >= v.min_years_service
      AND NOT EXISTS (
            SELECT 1 FROM t1_job_history jh
            WHERE jh.employee_id = e.employee_id
              AND MONTHS_BETWEEN(SYSDATE, jh.end_date) <= v.recent_job_history_months
      )
      AND e.manager_id IS NOT NULL
      AND e.job_id NOT LIKE '%MAN%'
      AND e.job_id NOT LIKE '%PRES%'
      AND e.job_id NOT LIKE '%VP%'
      AND ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100 > 0
)

SELECT
    employee_id,
    department_id,
    salary_before,
    ROUND(salary_before + (salary_before * adjustment_pct / 100), 2) AS salary_after,
    adjustment_pct,
    rule_applied
FROM cte_eligible_base
ORDER BY department_id, employee_id;


-- ------------------------------------------------------------
-- C. CONTROL DE TOPES POR DEPARTAMENTO
-- ------------------------------------------------------------

WITH cte_variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),

cte_dept_stats AS (
    SELECT
        e.department_id,
        COUNT(*) AS dept_employee_count,
        AVG(e.salary) AS dept_avg_salary,
        MAX(e.salary) AS dept_max_salary
    FROM t1_employees e
    WHERE e.department_id IS NOT NULL
    GROUP BY e.department_id
)

SELECT
    ds.department_id,
    d.department_name,
    ROUND(ds.dept_avg_salary, 2) AS dept_avg_salary,
    ROUND(ds.dept_max_salary, 2) AS dept_max_salary,
    ROUND(ds.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2) AS max_allowed_salary_by_variant

FROM cte_dept_stats ds
INNER JOIN t1_departments d ON ds.department_id = d.department_id
CROSS JOIN cte_variant v

WHERE ds.dept_employee_count >= 3

ORDER BY ds.department_id;


-- ============================================================
-- 4. EJECUCIÓN TRANSACCIONAL
-- ============================================================

PROMPT ===== 4. EJECUCIÓN TRANSACCIONAL =====

SAVEPOINT sv_before_adjustment;

-- ============================================================
-- 4.1  INSERCIÓN EN AUDITORÍA  (VA PRIMERO)
-- Se captura salary_before = e.salary actual (antes de tocar nada).
-- Se proyecta salary_after con la misma fórmula LEAST que usará el UPDATE.
-- El dept_avg_salary se congela aquí con una sola lectura coherente.
-- ============================================================

INSERT INTO audit_salary_adjustments_t1 (
    audit_id,
    execution_tag,
    variant_id,
    employee_id,
    department_id,
    salary_before,
    salary_after,
    pct_gap_to_avg_before,
    rule_applied,
    executed_by,
    executed_at,
    notes
)
WITH cte_variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),
cte_dept_stats AS (
    SELECT
        department_id,
        COUNT(*)    AS dept_employee_count,
        AVG(salary) AS dept_avg_salary
    FROM t1_employees
    WHERE department_id IS NOT NULL
    GROUP BY department_id
),
cte_elegibles AS (
    SELECT
        e.employee_id,
        e.department_id,
        e.salary AS salary_before,
        LEAST(
            ROUND(e.salary * (1 +
                CASE
                    WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                         >= v.gap_high_threshold_pct THEN v.raise_high_pct
                    WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                         >= v.gap_mid_threshold_pct  THEN v.raise_mid_pct
                    ELSE v.raise_low_pct
                END / 100), 2),
            ROUND(ds.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2)
        ) AS salary_after,
        ROUND(
            ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100,
        2) AS pct_gap_to_avg_before,
        CASE
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_high_threshold_pct THEN 'AJUSTE_ALTO'
            WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                 >= v.gap_mid_threshold_pct  THEN 'AJUSTE_MEDIO'
            ELSE 'AJUSTE_BAJO'
        END AS rule_applied
    FROM t1_employees e
    INNER JOIN cte_dept_stats ds ON e.department_id = ds.department_id
    CROSS JOIN cte_variant     v
    WHERE e.department_id   IS NOT NULL
      AND e.department_id   != v.excluded_department_id
      AND ds.dept_employee_count >= 3
      AND MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12 >= v.min_years_service
      AND e.manager_id      IS NOT NULL
      AND e.job_id NOT LIKE '%MAN%'
      AND e.job_id NOT LIKE '%PRES%'
      AND e.job_id NOT LIKE '%VP%'
      AND ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100 > 0
      AND e.salary <= ROUND(ds.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2)
      AND NOT EXISTS (
          SELECT 1
          FROM t1_job_history jh
          WHERE jh.employee_id = e.employee_id
            AND MONTHS_BETWEEN(SYSDATE, jh.end_date) <= v.recent_job_history_months
      )
)
SELECT
    AUDIT_SALARY_ADJ_T1_SEQ.NEXTVAL,
    '&p_execution_tag',
    &p_variant_id,
    el.employee_id,
    el.department_id,
    el.salary_before,
    el.salary_after,
    el.pct_gap_to_avg_before,
    el.rule_applied,
    USER,
    SYSDATE,
    'Ajuste salarial variante &p_variant_id - tag: &p_execution_tag'
FROM cte_elegibles el;

-- ============================================================
-- 4.2  ACTUALIZACIÓN DE SALARIOS  (VA DESPUÉS)
-- Aplica exactamente la misma lógica LEAST(ajuste, tope) que se
-- proyectó en la auditoría. Los empleados afectados son los mismos
-- que ya quedaron registrados en el INSERT anterior.
-- ============================================================

UPDATE t1_employees e
SET e.salary = (
    SELECT LEAST(
        ROUND(e.salary * (1 +
            CASE
                WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                     >= v.gap_high_threshold_pct THEN v.raise_high_pct
                WHEN ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
                     >= v.gap_mid_threshold_pct  THEN v.raise_mid_pct
                ELSE v.raise_low_pct
            END / 100), 2),
        ROUND(ds.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2)
    )
    FROM (
        SELECT department_id,
               COUNT(*)    AS dept_employee_count,
               AVG(salary) AS dept_avg_salary
        FROM t1_employees
        WHERE department_id IS NOT NULL
        GROUP BY department_id
    ) ds,
    t1_variants v
    WHERE ds.department_id = e.department_id
      AND v.variant_id     = &p_variant_id
)
WHERE EXISTS (
    SELECT 1
    FROM (
        SELECT department_id,
               COUNT(*)    AS dept_employee_count,
               AVG(salary) AS dept_avg_salary
        FROM t1_employees
        WHERE department_id IS NOT NULL
        GROUP BY department_id
    ) ds,
    t1_variants v
    WHERE ds.department_id        = e.department_id
      AND v.variant_id            = &p_variant_id
      AND e.department_id        IS NOT NULL
      AND e.department_id        != v.excluded_department_id
      AND ds.dept_employee_count >= 3
      AND MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12 >= v.min_years_service
      AND e.manager_id           IS NOT NULL
      AND e.job_id NOT LIKE '%MAN%'
      AND e.job_id NOT LIKE '%PRES%'
      AND e.job_id NOT LIKE '%VP%'
      AND ((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100 > 0
      AND e.salary <= ROUND(ds.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2)
      AND NOT EXISTS (
          SELECT 1 FROM t1_job_history jh
          WHERE jh.employee_id = e.employee_id
            AND MONTHS_BETWEEN(SYSDATE, jh.end_date) <= v.recent_job_history_months
      )
);

-- ============================================================
-- 4.3  VALIDACIÓN INTERMEDIA
-- ============================================================

PROMPT ===== 4.3 VALIDACIÓN INTERMEDIA =====

WITH cte_variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),
cte_dept_avg AS (
    SELECT
        department_id,
        AVG(salary) AS dept_avg_salary
    FROM t1_employees
    WHERE department_id IS NOT NULL
    GROUP BY department_id
)
SELECT
    e.employee_id,
    e.department_id,
    e.salary                                                        AS current_salary,
    a.salary_before                                                 AS original_salary,
    ROUND(da.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2) AS allowed_max_salary,
    CASE
        WHEN e.salary <= ROUND(da.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2)
            THEN 'CUMPLE'
        ELSE 'EXCEDE_TOPE'
    END AS validation_status
FROM t1_employees e
INNER JOIN audit_salary_adjustments_t1 a
    ON  e.employee_id   = a.employee_id
    AND a.execution_tag = '&p_execution_tag'
INNER JOIN cte_dept_avg da
    ON  e.department_id = da.department_id
CROSS JOIN cte_variant v
WHERE e.salary != a.salary_before
ORDER BY e.department_id, e.employee_id;

-- ============================================================
-- 4.4  CONTROL TRANSACCIONAL
-- Si la validación intermedia muestra todos en CUMPLE → ejecutar COMMIT
-- Si alguno muestra EXCEDE_TOPE → ejecutar ROLLBACK TO SAVEPOINT
-- ============================================================
 
-- Se ejecuta COMMIT porque la validación intermedia (4.3) confirmó que todos
-- los empleados ajustados muestran validation_status = 'CUMPLE', es decir,
-- ningún salario actualizado supera el tope máximo permitido por la variante.
-- El INSERT en auditoría y el UPDATE de salarios son consistentes entre sí,
-- por lo que es seguro persistir la transacción completa.
 
COMMIT;
-- ROLLBACK TO SAVEPOINT sv_before_adjustment;
 

-- ============================================================
-- 5. VALIDACIÓN POSTERIOR
-- ============================================================

PROMPT ===== 5. VALIDACIÓN POSTERIOR =====

-- ------------------------------------------------------------
-- SALIDA 1. EMPLEADOS IMPACTADOS
-- ------------------------------------------------------------

SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    e.department_id,
    a.salary_before,
    a.salary_after,
    a.execution_tag
FROM t1_employees e
INNER JOIN audit_salary_adjustments_t1 a
    ON e.employee_id = a.employee_id
WHERE a.execution_tag = '&p_execution_tag'
ORDER BY e.department_id, e.employee_id;


-- ------------------------------------------------------------
-- SALIDA 2. RESUMEN ECONÓMICO FINAL
-- ------------------------------------------------------------

SELECT
    COUNT(*) AS total_rows_audited,
    ROUND(SUM(salary_before), 2) AS total_salary_before,
    ROUND(SUM(salary_after), 2)  AS total_salary_after,
    ROUND(SUM(salary_after - salary_before), 2) AS total_increment
FROM audit_salary_adjustments_t1
WHERE execution_tag = '&p_execution_tag';


-- ------------------------------------------------------------
-- SALIDA 3. VALIDACIÓN DE TOPES
-- ------------------------------------------------------------

WITH cte_variant AS (
    SELECT *
    FROM t1_variants
    WHERE variant_id = &p_variant_id
),
cte_dept_avg AS (
    SELECT
        department_id,
        AVG(salary) AS dept_avg_salary
    FROM t1_employees
    WHERE department_id IS NOT NULL
    GROUP BY department_id
)
SELECT
    a.employee_id,
    a.department_id,
    a.salary_after,
    ROUND(da.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2) AS allowed_max_salary,
    CASE
        WHEN a.salary_after <= ROUND(da.dept_avg_salary * (v.max_salary_vs_avg_pct / 100), 2)
            THEN 'OK'
        ELSE 'EXCEDE'
    END AS top_limit_status
FROM audit_salary_adjustments_t1 a
INNER JOIN cte_dept_avg da  ON a.department_id = da.department_id
CROSS JOIN cte_variant v
WHERE a.execution_tag = '&p_execution_tag'
ORDER BY a.department_id, a.employee_id;


-- ------------------------------------------------------------
-- SALIDA 4. AUDITORÍA GENERADA
-- ------------------------------------------------------------

SELECT
    audit_id,
    execution_tag,
    variant_id,
    employee_id,
    department_id,
    salary_before,
    salary_after,
    rule_applied,
    executed_by,
    executed_at
FROM audit_salary_adjustments_t1
WHERE execution_tag = '&p_execution_tag'
ORDER BY audit_id;


-- ============================================================
-- 6. JUSTIFICACIÓN TÉCNICA
-- ============================================================

-- ATOMICIDAD:
-- La transacción está delimitada por un SAVEPOINT y un COMMIT al final.
-- Si cualquier operación falla (INSERT de auditoría o UPDATE de salarios),
-- se puede revertir todo con ROLLBACK TO SAVEPOINT, dejando la base de datos
-- exactamente como estaba. Ningún cambio queda a medias: o se aplican todos
-- los registros o no se aplica ninguno.

-- CONSISTENCIA:
-- Antes de confirmar se ejecuta la validación intermedia (sección 4.3), que
-- verifica que ningún salario actualizado supere el tope permitido por la variante.
-- Además, los filtros de elegibilidad garantizan que solo empleados válidos
-- reciben ajuste, respetando todas las reglas de negocio definidas en T1_VARIANTS.

-- AISLAMIENTO:
-- Oracle aplica lectura consistente por sentencia: cada SELECT ve una instantánea
-- de los datos al momento en que inicia. Otras sesiones no verán los cambios de
-- esta transacción hasta que se ejecute el COMMIT, evitando lecturas sucias.
-- El SAVEPOINT no afecta el nivel de aislamiento de otras sesiones concurrentes.

-- DURABILIDAD:
-- Una vez ejecutado el COMMIT, Oracle escribe los cambios en el redo log antes
-- de confirmar el éxito al cliente. Aunque ocurra una falla del sistema justo
-- después, la base de datos puede recuperar la transacción en el siguiente arranque
-- gracias al mecanismo de recuperación por redo log.

-- USO DE SAVEPOINT / ROLLBACK:
-- El SAVEPOINT sv_before_adjustment se define antes del INSERT y del UPDATE.
-- Esto permite revertir ambas operaciones como una unidad si la validación
-- intermedia detecta algún salario que exceda el tope permitido. Sin este punto
-- de restauración, un error parcial obligaría a revertir toda la sesión con
-- ROLLBACK completo, perdiendo trabajo previo de otras secciones.

PROMPT ===== Fin de plantilla =====
