import { useCallback, useEffect, useRef, useState } from 'react';
import './EvidenciasViewer.css';

interface Exercise {
  id: string;
  title: string;
  concept: string;
  explanation: string;
  code: string;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  exercises: Exercise[];
}

type TabId = 'taller1' | 'taller2' | 'taller3';

// ============================================================
// TALLER 1 — SQL AVANZADO + TRANSACCIONES ACID (Variante 2)
// ============================================================
const t1Sections: Section[] = [
  {
    id: 't1-diagnostico',
    title: '1. Consulta Diagnóstica',
    icon: '🔍',
    exercises: [
      {
        id: 'T1-1',
        title: 'Panorama completo de empleados',
        concept: 'CTE + DENSE_RANK OVER PARTITION + LEFT JOIN múltiple',
        explanation:
          'Muestra el estado completo de cada empleado: salario actual, promedio departamental, brecha porcentual (pct_gap_to_avg), flag de historial laboral reciente y su ranking salarial dentro del departamento. Es la base de diagnóstico para decidir quiénes califican al ajuste.',
        code: `DEFINE p_variant_id    = 2
DEFINE p_execution_tag = 'P02_FINAL'

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
LEFT JOIN t1_departments d    ON e.department_id = d.department_id
LEFT JOIN dept_stats ds       ON e.department_id = ds.department_id
LEFT JOIN job_history_recent jh ON e.employee_id = jh.employee_id
ORDER BY NVL(e.department_id, 9999), e.employee_id;`,
      },
    ],
  },
  {
    id: 't1-elegibles',
    title: '2. Decisión de Elegibles',
    icon: '✅',
    exercises: [
      {
        id: 'T1-2',
        title: 'Filtros de elegibilidad y regla de ajuste',
        concept: 'CROSS JOIN variante + EXISTS + CASE anidado + exclusiones múltiples',
        explanation:
          'Aplica todos los filtros de la Variante 2: excluye departamento 60, exige mínimo 3 años de antigüedad, descarta historial laboral reciente (últimos 18 meses), elimina directivos/managers y departamentos con menos de 3 empleados. El resultado final etiqueta a cada empleado como ELEGIBLE o NO_ELEGIBLE con su razón de exclusión y el porcentaje de ajuste que le correspondería.',
        code: `WITH variant AS (
    SELECT * FROM t1_variants WHERE variant_id = &p_variant_id
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
        e.employee_id, e.first_name, e.last_name,
        e.department_id, d.department_name,
        e.salary, e.hire_date, e.job_id, e.manager_id,
        ROUND(MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12, 2) AS years_service,
        ds.dept_employee_count, ds.dept_avg_salary, ds.dept_max_salary,
        CASE
            WHEN ds.dept_avg_salary IS NOT NULL THEN
                ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2)
            ELSE NULL
        END AS pct_gap_to_avg,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM t1_job_history jh
                WHERE jh.employee_id = e.employee_id
                  AND MONTHS_BETWEEN(SYSDATE, jh.end_date) <= (
                      SELECT recent_job_history_months FROM variant)
            ) THEN 'SI' ELSE 'NO'
        END AS recent_job_history_flag,
        CASE
            WHEN e.manager_id IS NULL
                 OR e.job_id LIKE '%MAN%'
                 OR e.job_id LIKE '%PRES%'
                 OR e.job_id LIKE '%VP%'
            THEN 'SI' ELSE 'NO'
        END AS manager_or_exec_flag,
        var.excluded_department_id, var.min_years_service,
        var.gap_high_threshold_pct, var.gap_mid_threshold_pct,
        var.raise_high_pct, var.raise_mid_pct, var.raise_low_pct
    FROM t1_employees e
    LEFT JOIN t1_departments d ON e.department_id = d.department_id
    LEFT JOIN dept_stats ds    ON e.department_id = ds.department_id
    CROSS JOIN variant var
)
SELECT
    employee_id, first_name, last_name, department_id, department_name,
    salary, years_service, ROUND(dept_avg_salary, 2) AS dept_avg_salary,
    pct_gap_to_avg, recent_job_history_flag, manager_or_exec_flag,
    CASE
        WHEN department_id IS NULL               THEN 'NO_ELEGIBLE'
        WHEN manager_or_exec_flag = 'SI'         THEN 'NO_ELEGIBLE'
        WHEN department_id = excluded_department_id THEN 'NO_ELEGIBLE'
        WHEN years_service < min_years_service   THEN 'NO_ELEGIBLE'
        WHEN recent_job_history_flag = 'SI'      THEN 'NO_ELEGIBLE'
        WHEN dept_employee_count < 3             THEN 'NO_ELEGIBLE'
        WHEN pct_gap_to_avg <= 0                 THEN 'NO_ELEGIBLE'
        ELSE 'ELEGIBLE'
    END AS eligibility_flag,
    CASE
        WHEN department_id IS NULL               THEN 'SIN_DEPARTAMENTO'
        WHEN manager_or_exec_flag = 'SI'         THEN 'MANAGER_O_DIRECTIVO'
        WHEN department_id = excluded_department_id THEN 'DEPTO_EXCLUIDO'
        WHEN years_service < min_years_service   THEN 'ANTIGUEDAD_INSUFICIENTE'
        WHEN recent_job_history_flag = 'SI'      THEN 'HISTORIAL_RECIENTE'
        WHEN dept_employee_count < 3             THEN 'DEPTO_MENOR_A_3'
        WHEN pct_gap_to_avg <= 0                 THEN 'SALARIO_NO_APLICA'
        ELSE 'CUMPLE_REGLAS'
    END AS exclusion_reason,
    CASE
        WHEN department_id IS NULL OR manager_or_exec_flag = 'SI'
             OR department_id = excluded_department_id
             OR years_service < min_years_service
             OR recent_job_history_flag = 'SI'
             OR dept_employee_count < 3 OR pct_gap_to_avg <= 0
            THEN 0
        WHEN pct_gap_to_avg >= gap_high_threshold_pct THEN raise_high_pct
        WHEN pct_gap_to_avg >= gap_mid_threshold_pct  THEN raise_mid_pct
        ELSE raise_low_pct
    END AS adjustment_pct,
    CASE
        WHEN department_id IS NULL OR manager_or_exec_flag = 'SI'
             OR department_id = excluded_department_id
             OR years_service < min_years_service
             OR recent_job_history_flag = 'SI'
             OR dept_employee_count < 3 OR pct_gap_to_avg <= 0
            THEN 'SIN_AJUSTE'
        WHEN pct_gap_to_avg >= gap_high_threshold_pct THEN 'AJUSTE_ALTO'
        WHEN pct_gap_to_avg >= gap_mid_threshold_pct  THEN 'AJUSTE_MEDIO'
        ELSE 'AJUSTE_BAJO'
    END AS rule_applied
FROM base
ORDER BY NVL(department_id, 9999), employee_id;`,
      },
    ],
  },
  {
    id: 't1-prevalidacion',
    title: '3. Prevalidación',
    icon: '📋',
    exercises: [
      {
        id: 'T1-3A',
        title: 'A. Resumen general de la transacción',
        concept: 'CTE encadenada + LEAST (tope salarial) + SUM agregado',
        explanation:
          'Calcula cuántos empleados recibirán ajuste, cuánto es la nómina antes y después, y cuál es el incremento total. Usa LEAST para garantizar que ningún salario proyectado supere el tope de la variante antes de ejecutar la transacción.',
        code: `WITH cte_variant AS (
    SELECT * FROM t1_variants WHERE variant_id = &p_variant_id
),
cte_dept_stats AS (
    SELECT
        e.department_id,
        COUNT(*) AS dept_employee_count,
        AVG(e.salary) AS dept_avg_salary,
        MAX(e.salary) AS dept_max_salary
    FROM t1_employees e WHERE e.department_id IS NOT NULL
    GROUP BY e.department_id
),
cte_eligible_base AS (
    SELECT
        e.employee_id, e.department_id,
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
        ) AS salary_after
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
    COUNT(*) AS total_eligible_employees,
    ROUND(SUM(salary_before), 2) AS total_salary_before,
    ROUND(SUM(salary_after), 2)  AS total_salary_after,
    ROUND(SUM(salary_after - salary_before), 2) AS total_increment
FROM cte_eligible_base;`,
      },
      {
        id: 'T1-3C',
        title: 'C. Control de topes por departamento',
        concept: 'max_salary_vs_avg_pct — tope = promedio × factor variante',
        explanation:
          'Calcula el salario máximo permitido por departamento según la variante (max_salary_vs_avg_pct). Sirve para verificar que ningún salario ajustado supere el límite antes de ejecutar la transacción real.',
        code: `WITH cte_variant AS (
    SELECT * FROM t1_variants WHERE variant_id = &p_variant_id
),
cte_dept_stats AS (
    SELECT
        e.department_id,
        COUNT(*) AS dept_employee_count,
        AVG(e.salary) AS dept_avg_salary,
        MAX(e.salary) AS dept_max_salary
    FROM t1_employees e WHERE e.department_id IS NOT NULL
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
ORDER BY ds.department_id;`,
      },
    ],
  },
  {
    id: 't1-transaccion',
    title: '4. Ejecución Transaccional',
    icon: '⚡',
    exercises: [
      {
        id: 'T1-4-INSERT',
        title: 'INSERT en auditoría (salary_before capturado antes del UPDATE)',
        concept: 'INSERT … SELECT con CTE + LEAST(ajuste, tope) + SAVEPOINT',
        explanation:
          'El INSERT se ejecuta PRIMERO para capturar salary_before con los datos originales. Proyecta salary_after con la misma lógica LEAST que usará el UPDATE, garantizando consistencia entre auditoría y tabla. El SAVEPOINT permite revertir si la validación intermedia falla.',
        code: `SAVEPOINT sv_before_adjustment;

INSERT INTO audit_salary_adjustments_t1 (
    audit_id, execution_tag, variant_id,
    employee_id, department_id,
    salary_before, salary_after,
    pct_gap_to_avg_before, rule_applied,
    executed_by, executed_at, notes
)
WITH cte_variant AS (
    SELECT * FROM t1_variants WHERE variant_id = &p_variant_id
),
cte_dept_stats AS (
    SELECT department_id, COUNT(*) AS dept_employee_count,
           AVG(salary) AS dept_avg_salary
    FROM t1_employees WHERE department_id IS NOT NULL
    GROUP BY department_id
),
cte_elegibles AS (
    SELECT
        e.employee_id, e.department_id,
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
        ROUND(((ds.dept_avg_salary - e.salary) / ds.dept_avg_salary) * 100, 2) AS pct_gap_to_avg_before,
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
      AND e.manager_id IS NOT NULL
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
)
SELECT
    AUDIT_SALARY_ADJ_T1_SEQ.NEXTVAL,
    '&p_execution_tag', &p_variant_id,
    el.employee_id, el.department_id,
    el.salary_before, el.salary_after,
    el.pct_gap_to_avg_before, el.rule_applied,
    USER, SYSDATE,
    'Ajuste salarial variante &p_variant_id - tag: &p_execution_tag'
FROM cte_elegibles el;`,
      },
      {
        id: 'T1-4-UPDATE',
        title: 'UPDATE de salarios (misma lógica LEAST que el INSERT)',
        concept: 'UPDATE correlacionado + subquery con EXISTS + tope LEAST',
        explanation:
          'Actualiza los salarios usando exactamente la misma lógica de LEAST(ajuste, tope) que se proyectó en el INSERT de auditoría. La cláusula WHERE EXISTS replica los mismos filtros de elegibilidad para asegurar que se afecta exactamente al mismo conjunto de empleados registrados.',
        code: `UPDATE t1_employees e
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
        SELECT department_id, COUNT(*) AS dept_employee_count,
               AVG(salary) AS dept_avg_salary
        FROM t1_employees WHERE department_id IS NOT NULL
        GROUP BY department_id
    ) ds,
    t1_variants v
    WHERE ds.department_id = e.department_id
      AND v.variant_id = &p_variant_id
)
WHERE EXISTS (
    SELECT 1
    FROM (
        SELECT department_id, COUNT(*) AS dept_employee_count,
               AVG(salary) AS dept_avg_salary
        FROM t1_employees WHERE department_id IS NOT NULL
        GROUP BY department_id
    ) ds,
    t1_variants v
    WHERE ds.department_id     = e.department_id
      AND v.variant_id         = &p_variant_id
      AND e.department_id     IS NOT NULL
      AND e.department_id     != v.excluded_department_id
      AND ds.dept_employee_count >= 3
      AND MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12 >= v.min_years_service
      AND e.manager_id        IS NOT NULL
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
);`,
      },
      {
        id: 'T1-4-VALID',
        title: 'Validación intermedia + COMMIT',
        concept: 'JOIN con auditoría + CASE de validación + decisión COMMIT/ROLLBACK',
        explanation:
          'Verifica que todos los empleados ajustados muestran validation_status = CUMPLE (salario ≤ tope permitido). Si alguno muestra EXCEDE_TOPE se ejecuta ROLLBACK TO SAVEPOINT; de lo contrario, COMMIT confirma la transacción completa.',
        code: `-- VALIDACIÓN INTERMEDIA (4.3)
WITH cte_variant AS (
    SELECT * FROM t1_variants WHERE variant_id = &p_variant_id
),
cte_dept_avg AS (
    SELECT department_id, AVG(salary) AS dept_avg_salary
    FROM t1_employees WHERE department_id IS NOT NULL
    GROUP BY department_id
)
SELECT
    e.employee_id, e.department_id,
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
INNER JOIN cte_dept_avg da ON e.department_id = da.department_id
CROSS JOIN cte_variant v
WHERE e.salary != a.salary_before
ORDER BY e.department_id, e.employee_id;

-- CONTROL TRANSACCIONAL (4.4)
-- Se ejecuta COMMIT porque la validación intermedia confirmó que todos
-- los empleados muestran validation_status = 'CUMPLE'.
COMMIT;
-- ROLLBACK TO SAVEPOINT sv_before_adjustment; -- Solo si hay EXCEDE_TOPE`,
      },
    ],
  },
  {
    id: 't1-posterior',
    title: '5. Validación Posterior',
    icon: '📊',
    exercises: [
      {
        id: 'T1-5-1',
        title: 'Salida 1 — Empleados impactados',
        concept: 'JOIN con tabla de auditoría por execution_tag',
        explanation:
          'Lista cada empleado afectado con su salario antes y después del ajuste. El filtro por execution_tag garantiza que solo se muestran los cambios de esta ejecución específica.',
        code: `SELECT
    e.employee_id, e.first_name, e.last_name,
    e.department_id,
    a.salary_before, a.salary_after,
    a.execution_tag
FROM t1_employees e
INNER JOIN audit_salary_adjustments_t1 a
    ON e.employee_id = a.employee_id
WHERE a.execution_tag = '&p_execution_tag'
ORDER BY e.department_id, e.employee_id;`,
      },
      {
        id: 'T1-5-2',
        title: 'Salida 2 — Resumen económico final',
        concept: 'SUM + COUNT desde tabla de auditoría',
        explanation:
          'Muestra el total de filas auditadas, la masa salarial antes y después, y el incremento total. Confirma que los números cuadran con la prevalidación.',
        code: `SELECT
    COUNT(*) AS total_rows_audited,
    ROUND(SUM(salary_before), 2) AS total_salary_before,
    ROUND(SUM(salary_after), 2)  AS total_salary_after,
    ROUND(SUM(salary_after - salary_before), 2) AS total_increment
FROM audit_salary_adjustments_t1
WHERE execution_tag = '&p_execution_tag';`,
      },
      {
        id: 'T1-5-4',
        title: 'Salida 4 — Registro de auditoría generado',
        concept: 'SELECT completo de audit_salary_adjustments_t1',
        explanation:
          'Muestra el registro completo de auditoría: quién ejecutó, cuándo, qué regla se aplicó y los valores antes/después. Evidencia el cumplimiento del principio de Durabilidad.',
        code: `SELECT
    audit_id, execution_tag, variant_id,
    employee_id, department_id,
    salary_before, salary_after,
    rule_applied, executed_by, executed_at
FROM audit_salary_adjustments_t1
WHERE execution_tag = '&p_execution_tag'
ORDER BY audit_id;`,
      },
    ],
  },
  {
    id: 't1-acid',
    title: '6. Justificación ACID',
    icon: '🛡️',
    exercises: [
      {
        id: 'T1-6',
        title: 'Atomicidad, Consistencia, Aislamiento, Durabilidad',
        concept: 'SAVEPOINT + COMMIT + Oracle Read Consistency + Redo Log',
        explanation:
          'Documentación técnica de cómo cada propiedad ACID queda garantizada en esta transacción: SAVEPOINT para atomicidad, validación intermedia para consistencia, read consistency de Oracle para aislamiento, y redo log para durabilidad.',
        code: `-- ATOMICIDAD:
-- La transacción está delimitada por SAVEPOINT y COMMIT al final.
-- Si cualquier operación falla (INSERT auditoría o UPDATE salarios),
-- se revierte todo con ROLLBACK TO SAVEPOINT.
-- Ningún cambio queda a medias: o se aplican todos o no se aplica ninguno.

-- CONSISTENCIA:
-- Antes de confirmar se ejecuta la validación intermedia (4.3), que
-- verifica que ningún salario actualizado supere el tope de la variante.
-- Los filtros de elegibilidad garantizan que solo empleados válidos
-- reciben ajuste, respetando las reglas de negocio de T1_VARIANTS.

-- AISLAMIENTO:
-- Oracle aplica lectura consistente por sentencia: cada SELECT ve una
-- instantánea de los datos al momento en que inicia.
-- Otras sesiones no verán los cambios hasta el COMMIT.
-- El SAVEPOINT no afecta el nivel de aislamiento de otras sesiones.

-- DURABILIDAD:
-- Una vez ejecutado el COMMIT, Oracle escribe en el redo log antes
-- de confirmar al cliente. Aunque ocurra una falla del sistema justo
-- después, la BD puede recuperar la transacción en el siguiente arranque.

-- USO DE SAVEPOINT / ROLLBACK:
-- SAVEPOINT sv_before_adjustment se define antes del INSERT y del UPDATE.
-- Permite revertir ambas operaciones si la validación detecta EXCEDE_TOPE.
SAVEPOINT sv_before_adjustment;
-- ... INSERT audit + UPDATE salary ...
-- Si validación OK:
COMMIT;
-- Si hay EXCEDE_TOPE:
-- ROLLBACK TO SAVEPOINT sv_before_adjustment;`,
      },
    ],
  },
];

// ============================================================
// TALLER 2 — NÓMINA PL/SQL — HotelGroup S.A.
// ============================================================
const t2Sections: Section[] = [
  {
    id: 't2-setup',
    title: 'Setup — Tablas y Parámetros',
    icon: '🗄️',
    exercises: [
      {
        id: 'T2-SETUP',
        title: 'Estructura de tablas y datos maestros',
        concept: 'DDL + PARAMETROS + EMPLEADOS + LIQUIDACION + LOG_NOMINA',
        explanation:
          'Define las 8 tablas del sistema de nómina: PARAMETROS (SMLMV, porcentajes), SEDES, EMPLEADOS (planta/temporal/servicios), HORAS_TRABAJADAS, SANCIONES, LIBRANZAS, EMBARGOS, LIQUIDACION y LOG_NOMINA. También crea las secuencias y limpia el entorno previo.',
        code: `-- Limpieza previa
BEGIN
  FOR r IN (SELECT table_name FROM user_tables WHERE table_name IN (
    'PARAMETROS','SEDES','EMPLEADOS','HORAS_TRABAJADAS','SANCIONES',
    'LIBRANZAS','EMBARGOS','LIQUIDACION','LOG_NOMINA'
  )) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE ' || r.table_name || ' CASCADE CONSTRAINTS PURGE';
  END LOOP;
END;
/

CREATE TABLE PARAMETROS (
  cod_parametro  VARCHAR2(30) PRIMARY KEY,
  valor_numerico NUMBER(15,2),
  descripcion    VARCHAR2(100)
);
-- SMLMV 2026, AUX_TRANSPORTE, PCT_SALUD (4%), PCT_PENSION (4%),
-- PCT_FONDO_SOLIDARIDAD (1%), UMBRAL_FONDO_SMLMV (4),
-- RECARGO_NOCTURNO (35%), RECARGO_DOMINICAL (75%), RECARGO_NOCT_DOM (110%),
-- RET_SERVICIOS (11%), BONO_CLIMA_SMA (80000), APORTE_VOL_BOG (20000)

CREATE TABLE EMPLEADOS (
  id_empleado       NUMBER(6) PRIMARY KEY,
  nombre            VARCHAR2(80) NOT NULL,
  tipo_contrato     VARCHAR2(20) NOT NULL CHECK (tipo_contrato IN ('PLANTA','TEMPORAL','SERVICIOS')),
  salario_base      NUMBER(12,2) NOT NULL,
  fecha_ingreso     DATE NOT NULL,
  cod_sede          VARCHAR2(5) REFERENCES SEDES(cod_sede),
  estado            VARCHAR2(10) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
  acepta_aporte_vol VARCHAR2(1)  DEFAULT 'N' CHECK (acepta_aporte_vol IN ('S','N'))
);

CREATE TABLE LIQUIDACION (
  id_liquidacion    NUMBER(10) PRIMARY KEY,
  id_empleado       NUMBER(6) REFERENCES EMPLEADOS(id_empleado),
  id_quincena       VARCHAR2(15),
  salario_base_q    NUMBER(12,2),
  recargos          NUMBER(12,2) DEFAULT 0,
  bonificacion      NUMBER(12,2) DEFAULT 0,
  auxilio_transp    NUMBER(12,2) DEFAULT 0,
  bono_sede         NUMBER(12,2) DEFAULT 0,
  bruto             NUMBER(12,2),
  deduccion_salud   NUMBER(12,2) DEFAULT 0,
  deduccion_pension NUMBER(12,2) DEFAULT 0,
  fondo_solidaridad NUMBER(12,2) DEFAULT 0,
  embargo           NUMBER(12,2) DEFAULT 0,
  libranzas         NUMBER(12,2) DEFAULT 0,
  aporte_voluntario NUMBER(12,2) DEFAULT 0,
  total_deducciones NUMBER(12,2),
  neto              NUMBER(12,2),
  fecha_liquidacion DATE DEFAULT SYSDATE,
  CONSTRAINT uk_liq_emp_quin UNIQUE (id_empleado, id_quincena)
);

CREATE TABLE LOG_NOMINA (
  id_log          NUMBER(10) PRIMARY KEY,
  fecha_hora      TIMESTAMP DEFAULT SYSTIMESTAMP,
  operacion       VARCHAR2(50),
  usuario         VARCHAR2(30) DEFAULT USER,
  detalle         VARCHAR2(500),
  empleados_ok    NUMBER(6)  DEFAULT 0,
  empleados_error NUMBER(6)  DEFAULT 0,
  monto_total     NUMBER(15,2) DEFAULT 0
);

CREATE SEQUENCE SEQ_LIQUIDACION START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE SEQ_LOG         START WITH 1 INCREMENT BY 1;`,
      },
    ],
  },
  {
    id: 't2-p1',
    title: 'Punto 1 — Bloque Anónimo Individual',
    icon: '📝',
    exercises: [
      {
        id: 'T2-P1',
        title: 'Liquidación quincenal — empleado 1001 (Carlos Mendez)',
        concept: 'DECLARE + CURSOR explícito + CASE tipo_contrato + bonificación por antigüedad',
        explanation:
          'Calcula manualmente la liquidación del empleado 1001 (PLANTA, sede BOG). Usa un cursor para recorrer sus horas y aplica recargos por tipo (nocturna 35%, dominical 75%, nocturna-dom 110%). La bonificación se calcula según antigüedad siempre que las sanciones en los últimos 6 meses sean ≤ 2.',
        code: `DECLARE
    vn_id_empleado EMPLEADOS.id_empleado%TYPE := 1001;
    vv_quincena    VARCHAR2(20)               := '2026-Q1-ENE';

    vv_nombre      EMPLEADOS.nombre%TYPE;
    vv_sede        EMPLEADOS.cod_sede%TYPE;
    vv_tipo        EMPLEADOS.tipo_contrato%TYPE;
    vd_fecha       EMPLEADOS.fecha_ingreso%TYPE;
    vn_salario     EMPLEADOS.salario_base%TYPE;

    vn_base_q      NUMBER := 0;
    vn_recargos    NUMBER := 0;
    vn_bonif       NUMBER := 0;
    vn_antig       NUMBER := 0;
    vn_valor_hora  NUMBER := 0;

    vn_ret_serv    PARAMETROS.valor_numerico%TYPE := 0;
    vn_rec_noct    PARAMETROS.valor_numerico%TYPE := 0;
    vn_rec_dom     PARAMETROS.valor_numerico%TYPE := 0;
    vn_rec_nd      PARAMETROS.valor_numerico%TYPE := 0;
    vn_sanc        NUMBER := 0;

    CURSOR c_horas IS
        SELECT tipo_hora, cantidad_horas
          FROM HORAS_TRABAJADAS
         WHERE id_empleado = vn_id_empleado
           AND id_quincena = vv_quincena;
BEGIN
    SELECT nombre, cod_sede, tipo_contrato, fecha_ingreso, salario_base
      INTO vv_nombre, vv_sede, vv_tipo, vd_fecha, vn_salario
      FROM EMPLEADOS WHERE id_empleado = vn_id_empleado;

    SELECT NVL(MAX(CASE WHEN cod_parametro = 'RET_SERVICIOS'    THEN valor_numerico END), 0),
           NVL(MAX(CASE WHEN cod_parametro = 'RECARGO_NOCTURNO'  THEN valor_numerico END), 0),
           NVL(MAX(CASE WHEN cod_parametro = 'RECARGO_DOMINICAL' THEN valor_numerico END), 0),
           NVL(MAX(CASE WHEN cod_parametro = 'RECARGO_NOCT_DOM'  THEN valor_numerico END), 0)
      INTO vn_ret_serv, vn_rec_noct, vn_rec_dom, vn_rec_nd
      FROM PARAMETROS;

    vn_antig := TRUNC(MONTHS_BETWEEN(SYSDATE, vd_fecha) / 12);

    IF vv_tipo = 'PLANTA' THEN
        vn_base_q     := vn_salario / 2;
        vn_valor_hora := vn_salario / 240;
    ELSIF vv_tipo = 'TEMPORAL' THEN
        vn_valor_hora := vn_salario;
        FOR r IN c_horas LOOP
            IF r.tipo_hora = 'NORMAL' THEN
                vn_base_q := vn_base_q + (vn_valor_hora * r.cantidad_horas);
            END IF;
        END LOOP;
    ELSIF vv_tipo = 'SERVICIOS' THEN
        vn_base_q := (vn_salario - (vn_salario * vn_ret_serv / 100)) / 2;
    END IF;

    IF vv_tipo <> 'SERVICIOS' THEN
        FOR r IN c_horas LOOP
            CASE r.tipo_hora
                WHEN 'NOCTURNA'     THEN
                    vn_recargos := vn_recargos + (r.cantidad_horas * vn_valor_hora * vn_rec_noct / 100);
                WHEN 'DOMINICAL'    THEN
                    vn_recargos := vn_recargos + (r.cantidad_horas * vn_valor_hora * vn_rec_dom  / 100);
                WHEN 'NOCTURNA_DOM' THEN
                    vn_recargos := vn_recargos + (r.cantidad_horas * vn_valor_hora * vn_rec_nd   / 100);
                ELSE NULL;
            END CASE;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO vn_sanc FROM SANCIONES
     WHERE id_empleado = vn_id_empleado
       AND fecha_sancion >= ADD_MONTHS(SYSDATE, -6);

    IF vv_tipo <> 'SERVICIOS' AND vn_sanc <= 2 THEN
        IF    vn_antig BETWEEN 3 AND 5  THEN vn_bonif := vn_base_q * 0.03;
        ELSIF vn_antig BETWEEN 6 AND 10 THEN vn_bonif := vn_base_q * 0.06;
        ELSIF vn_antig > 10             THEN vn_bonif := vn_base_q * 0.10;
        END IF;
    END IF;

    DBMS_OUTPUT.PUT_LINE('=== LIQUIDACION QUINCENAL ===');
    DBMS_OUTPUT.PUT_LINE('Empleado:      ' || vv_nombre || ' (' || vn_id_empleado || ')');
    DBMS_OUTPUT.PUT_LINE('Sede:          ' || vv_sede);
    DBMS_OUTPUT.PUT_LINE('Tipo contrato: ' || vv_tipo);
    DBMS_OUTPUT.PUT_LINE('Antiguedad:    ' || vn_antig || ' anios');
    DBMS_OUTPUT.PUT_LINE('-----------------------------');
    DBMS_OUTPUT.PUT_LINE('Salario base Q: ' || TO_CHAR(vn_base_q,  '999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('Recargos:       ' || TO_CHAR(vn_recargos, '999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('Bonificacion:   ' || TO_CHAR(vn_bonif,    '999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('-----------------------------');
    DBMS_OUTPUT.PUT_LINE('SUBTOTAL: ' ||
        TO_CHAR(vn_base_q + vn_recargos + vn_bonif, 'FM999,999,999.00'));
END;
/`,
      },
    ],
  },
  {
    id: 't2-p2',
    title: 'Punto 2 — Funciones Standalone',
    icon: '🧮',
    exercises: [
      {
        id: 'T2-FN-BASE',
        title: 'fn_salario_base_q — Regla 1: base quincenal por tipo',
        concept: 'FUNCTION + IF-ELSIF + subbloque DECLARE anidado + NO_DATA_FOUND',
        explanation:
          'Calcula la base quincenal según tipo de contrato: PLANTA = salario/2, TEMPORAL = valor_hora × horas_normales, SERVICIOS = (salario - retención_11%) / 2. Usa un subbloque anidado para el caso TEMPORAL para manejar NO_DATA_FOUND si no hay horas registradas.',
        code: `CREATE OR REPLACE FUNCTION fn_salario_base_q (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) RETURN NUMBER IS
    vv_tipo_contrato EMPLEADOS.tipo_contrato%TYPE;
    vdo_salario_base EMPLEADOS.salario_base%TYPE;
BEGIN
    SELECT tipo_contrato, salario_base
      INTO vv_tipo_contrato, vdo_salario_base
      FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

    IF vv_tipo_contrato = 'PLANTA' THEN
        RETURN ROUND(vdo_salario_base / 2, 2);

    ELSIF vv_tipo_contrato = 'TEMPORAL' THEN
        DECLARE
            vdo_horas_normales HORAS_TRABAJADAS.cantidad_horas%TYPE;
        BEGIN
            SELECT cantidad_horas INTO vdo_horas_normales
              FROM HORAS_TRABAJADAS
             WHERE id_empleado = p_id_empleado
               AND id_quincena = p_id_quincena
               AND tipo_hora   = 'NORMAL';
            RETURN ROUND(vdo_salario_base * vdo_horas_normales, 2);
        EXCEPTION
            WHEN NO_DATA_FOUND THEN RETURN 0;
        END;

    ELSIF vv_tipo_contrato = 'SERVICIOS' THEN
        DECLARE
            vdo_ret PARAMETROS.valor_numerico%TYPE;
        BEGIN
            SELECT valor_numerico INTO vdo_ret
              FROM PARAMETROS WHERE cod_parametro = 'RET_SERVICIOS';
            RETURN ROUND((vdo_salario_base - (vdo_salario_base * vdo_ret / 100)) / 2, 2);
        END;
    END IF;
    RETURN 0;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
    WHEN OTHERS        THEN RAISE;
END fn_salario_base_q;
/`,
      },
      {
        id: 'T2-FN-REC',
        title: 'fn_recargos — Regla 2: recargos por tipo de hora',
        concept: 'CURSOR parametrizado + CASE sobre tipo_hora + valor_hora diferenciado',
        explanation:
          'Recorre las horas no normales con un cursor parametrizado. Aplica el porcentaje de recargo según el tipo (nocturna 35%, dominical 75%, nocturna-dominical 110%) multiplicado por el valor/hora. SERVICIOS siempre retorna 0.',
        code: `CREATE OR REPLACE FUNCTION fn_recargos (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) RETURN NUMBER IS
    CURSOR cur_horas (cp_emp NUMBER, cp_quin VARCHAR2) IS
        SELECT tipo_hora, cantidad_horas
          FROM HORAS_TRABAJADAS
         WHERE id_empleado   = cp_emp
           AND id_quincena   = cp_quin
           AND tipo_hora    <> 'NORMAL'
           AND cantidad_horas > 0;

    vv_tipo_contrato   EMPLEADOS.tipo_contrato%TYPE;
    vdo_salario_base   EMPLEADOS.salario_base%TYPE;
    vdo_valor_hora     NUMBER(15,4);
    vdo_total_recargos NUMBER(15,2) := 0;
BEGIN
    SELECT tipo_contrato, salario_base INTO vv_tipo_contrato, vdo_salario_base
      FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

    IF vv_tipo_contrato = 'SERVICIOS' THEN RETURN 0; END IF;

    vdo_valor_hora := CASE vv_tipo_contrato
                        WHEN 'PLANTA'   THEN vdo_salario_base / 240
                        ELSE vdo_salario_base
                      END;

    FOR rec IN cur_horas(p_id_empleado, p_id_quincena) LOOP
        DECLARE
            vdo_pct PARAMETROS.valor_numerico%TYPE;
            vv_cod  PARAMETROS.cod_parametro%TYPE;
        BEGIN
            CASE rec.tipo_hora
                WHEN 'NOCTURNA'     THEN vv_cod := 'RECARGO_NOCTURNO';
                WHEN 'DOMINICAL'    THEN vv_cod := 'RECARGO_DOMINICAL';
                WHEN 'NOCTURNA_DOM' THEN vv_cod := 'RECARGO_NOCT_DOM';
                ELSE vv_cod := NULL;
            END CASE;
            IF vv_cod IS NOT NULL THEN
                SELECT valor_numerico INTO vdo_pct
                  FROM PARAMETROS WHERE cod_parametro = vv_cod;
                vdo_total_recargos := vdo_total_recargos
                    + (rec.cantidad_horas * vdo_valor_hora * vdo_pct / 100);
            END IF;
        END;
    END LOOP;
    RETURN ROUND(vdo_total_recargos, 2);
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
    WHEN OTHERS        THEN RAISE;
END fn_recargos;
/`,
      },
      {
        id: 'T2-FN-BON',
        title: 'fn_bonificacion — Regla 3: bono por antigüedad',
        concept: 'MONTHS_BETWEEN + TRUNC años + COUNT sanciones + escalas 3/6/10%',
        explanation:
          'Calcula la bonificación sobre el salario base quincenal según tramos de antigüedad: 3-5 años → 3%, 6-10 años → 6%, más de 10 años → 10%. Si el empleado tiene más de 2 sanciones en los últimos 6 meses, la bonificación es 0.',
        code: `CREATE OR REPLACE FUNCTION fn_bonificacion (
    p_id_empleado IN NUMBER
) RETURN NUMBER IS
    vv_tipo      EMPLEADOS.tipo_contrato%TYPE;
    vd_fecha     EMPLEADOS.fecha_ingreso%TYPE;
    vn_antig     NUMBER;
    vn_sanc      NUMBER;
    vn_salario_q NUMBER;
    vn_result    NUMBER := 0;
BEGIN
    SELECT tipo_contrato, fecha_ingreso INTO vv_tipo, vd_fecha
      FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

    IF vv_tipo = 'SERVICIOS' THEN RETURN 0; END IF;

    vn_salario_q := fn_salario_base_q(p_id_empleado, '2026-Q1-ENE');
    vn_antig     := TRUNC(MONTHS_BETWEEN(SYSDATE, vd_fecha) / 12);

    SELECT COUNT(*) INTO vn_sanc FROM SANCIONES
     WHERE id_empleado   = p_id_empleado
       AND fecha_sancion >= ADD_MONTHS(SYSDATE, -6);

    IF vn_sanc > 2 THEN RETURN 0; END IF;

    IF    vn_antig BETWEEN 3 AND 5  THEN vn_result := vn_salario_q * 0.03;
    ELSIF vn_antig BETWEEN 6 AND 10 THEN vn_result := vn_salario_q * 0.06;
    ELSIF vn_antig > 10             THEN vn_result := vn_salario_q * 0.10;
    END IF;

    RETURN ROUND(vn_result, 2);
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
    WHEN OTHERS        THEN RAISE;
END fn_bonificacion;
/`,
      },
      {
        id: 'T2-FN-BRUTO',
        title: 'fn_bruto — Reglas 4-6: salario bruto total',
        concept: 'Encadenamiento de funciones + auxilio_transporte ≤ 2 SMLMV + bono_sede SMA',
        explanation:
          'Orquesta las tres funciones anteriores y agrega: auxilio de transporte (solo si el salario mensual equivalente ≤ 2 SMLMV) y bono de clima para sede Santa Marta. Retorna el bruto quincenal completo.',
        code: `CREATE OR REPLACE FUNCTION fn_bruto (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) RETURN NUMBER IS
    vv_tipo_contrato EMPLEADOS.tipo_contrato%TYPE;
    vv_cod_sede      EMPLEADOS.cod_sede%TYPE;
    vdo_salario_base EMPLEADOS.salario_base%TYPE;

    vdo_salario_q    NUMBER(12,2);
    vdo_recargos     NUMBER(12,2);
    vdo_bonificacion NUMBER(12,2);
    vdo_aux_transp   NUMBER(12,2) := 0;
    vdo_bono_sede    NUMBER(12,2) := 0;

    vdo_smlmv        PARAMETROS.valor_numerico%TYPE;
    vdo_aux_mensual  PARAMETROS.valor_numerico%TYPE;
    vdo_bono_sma     PARAMETROS.valor_numerico%TYPE;
    vdo_sal_mens_equiv NUMBER(15,2) := 0;
BEGIN
    SELECT tipo_contrato, cod_sede, salario_base
      INTO vv_tipo_contrato, vv_cod_sede, vdo_salario_base
      FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

    vdo_salario_q    := fn_salario_base_q(p_id_empleado, p_id_quincena);
    vdo_recargos     := fn_recargos(p_id_empleado, p_id_quincena);
    vdo_bonificacion := fn_bonificacion(p_id_empleado);

    SELECT valor_numerico INTO vdo_smlmv      FROM PARAMETROS WHERE cod_parametro = 'SMLMV';
    SELECT valor_numerico INTO vdo_aux_mensual FROM PARAMETROS WHERE cod_parametro = 'AUX_TRANSPORTE';
    SELECT valor_numerico INTO vdo_bono_sma   FROM PARAMETROS WHERE cod_parametro = 'BONO_CLIMA_SMA';

    IF vv_tipo_contrato IN ('PLANTA', 'TEMPORAL') THEN
        IF vv_tipo_contrato = 'PLANTA' THEN
            vdo_sal_mens_equiv := vdo_salario_base;
        ELSE
            DECLARE vdo_h HORAS_TRABAJADAS.cantidad_horas%TYPE := 0; BEGIN
                SELECT NVL(cantidad_horas, 0) INTO vdo_h
                  FROM HORAS_TRABAJADAS
                 WHERE id_empleado = p_id_empleado
                   AND id_quincena = p_id_quincena
                   AND tipo_hora   = 'NORMAL';
                vdo_sal_mens_equiv := vdo_salario_base * vdo_h * 2;
            EXCEPTION WHEN NO_DATA_FOUND THEN vdo_sal_mens_equiv := 0;
            END;
        END IF;
        IF vdo_sal_mens_equiv <= (2 * vdo_smlmv) THEN
            vdo_aux_transp := vdo_aux_mensual / 2;
        END IF;
    END IF;

    IF vv_tipo_contrato IN ('PLANTA', 'TEMPORAL') AND vv_cod_sede = 'SMA' THEN
        vdo_bono_sede := vdo_bono_sma;
    END IF;

    RETURN ROUND(vdo_salario_q + vdo_recargos + vdo_bonificacion
                 + vdo_aux_transp + vdo_bono_sede, 2);
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
    WHEN OTHERS        THEN RAISE;
END fn_bruto;
/`,
      },
    ],
  },
  {
    id: 't2-p3',
    title: 'Punto 3 — Procedimiento con Excepciones',
    icon: '⚙️',
    exercises: [
      {
        id: 'T2-SP',
        title: 'sp_liquidar_empleado — 3 validaciones + cálculo completo + COMMIT',
        concept: 'RAISE_APPLICATION_ERROR -20001/-20002/-20003 + deducciones + INSERT LIQUIDACION',
        explanation:
          'Valida que el empleado existe (-20001), está ACTIVO (-20002) y no tiene liquidación duplicada (-20003). Calcula salud (4%), pensión (4%), fondo solidaridad (1% si bruto×2 > 4 SMLMV), embargo, libranzas y aporte voluntario. Inserta en LIQUIDACION y hace COMMIT. En error hace ROLLBACK y RAISE.',
        code: `CREATE OR REPLACE PROCEDURE sp_liquidar_empleado (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) IS
    vv_estado        EMPLEADOS.estado%TYPE;
    vv_tipo          EMPLEADOS.tipo_contrato%TYPE;
    vv_cod_sede      EMPLEADOS.cod_sede%TYPE;
    vv_aporte_vol    EMPLEADOS.acepta_aporte_vol%TYPE;
    vdo_salario_base EMPLEADOS.salario_base%TYPE;

    vn_bruto  NUMBER := 0;  vn_salud   NUMBER := 0;
    vn_pension NUMBER := 0; vn_fondo   NUMBER := 0;
    vn_embargo NUMBER := 0; vn_libranzas NUMBER := 0;
    vn_aporte_vol NUMBER := 0; vn_total_desc NUMBER := 0; vn_neto NUMBER := 0;

    vn_pct_salud   PARAMETROS.valor_numerico%TYPE;
    vn_pct_pension PARAMETROS.valor_numerico%TYPE;
    vn_pct_fondo   PARAMETROS.valor_numerico%TYPE;
    vn_umbral      PARAMETROS.valor_numerico%TYPE;
    vn_smlmv       PARAMETROS.valor_numerico%TYPE;
    vn_aporte_fijo PARAMETROS.valor_numerico%TYPE;
    vn_count       NUMBER;
    vn_base_embargo NUMBER := 0;
BEGIN
    -- Validación 1: empleado existe
    BEGIN
        SELECT estado, tipo_contrato, cod_sede, acepta_aporte_vol, salario_base
          INTO vv_estado, vv_tipo, vv_cod_sede, vv_aporte_vol, vdo_salario_base
          FROM EMPLEADOS WHERE id_empleado = p_id_empleado;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20001, 'Empleado no encontrado: ' || p_id_empleado);
    END;

    -- Validación 2: estado ACTIVO
    IF vv_estado <> 'ACTIVO' THEN
        RAISE_APPLICATION_ERROR(-20002, 'Empleado no activo: estado = ' || vv_estado);
    END IF;

    -- Validación 3: no existe liquidación duplicada
    SELECT COUNT(*) INTO vn_count FROM LIQUIDACION
     WHERE id_empleado = p_id_empleado AND id_quincena = p_id_quincena;
    IF vn_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20003,
            'Liquidacion ya existe para empleado ' || p_id_empleado ||
            ' quincena ' || p_id_quincena);
    END IF;

    SELECT valor_numerico INTO vn_pct_salud   FROM PARAMETROS WHERE cod_parametro = 'PCT_SALUD';
    SELECT valor_numerico INTO vn_pct_pension FROM PARAMETROS WHERE cod_parametro = 'PCT_PENSION';
    SELECT valor_numerico INTO vn_pct_fondo   FROM PARAMETROS WHERE cod_parametro = 'PCT_FONDO_SOLIDARIDAD';
    SELECT valor_numerico INTO vn_umbral      FROM PARAMETROS WHERE cod_parametro = 'UMBRAL_FONDO_SMLMV';
    SELECT valor_numerico INTO vn_smlmv       FROM PARAMETROS WHERE cod_parametro = 'SMLMV';
    SELECT valor_numerico INTO vn_aporte_fijo FROM PARAMETROS WHERE cod_parametro = 'APORTE_VOL_BOG';

    vn_bruto := fn_bruto(p_id_empleado, p_id_quincena);

    vn_salud   := ROUND(vn_bruto * vn_pct_salud   / 100, 2);
    vn_pension := ROUND(vn_bruto * vn_pct_pension  / 100, 2);
    IF (vn_bruto * 2) > (vn_umbral * vn_smlmv) THEN
        vn_fondo := ROUND(vn_bruto * vn_pct_fondo / 100, 2);
    END IF;

    vn_base_embargo := vn_bruto - vn_salud - vn_pension - vn_fondo;
    SELECT NVL(SUM(porcentaje), 0) INTO vn_embargo
      FROM EMBARGOS WHERE id_empleado = p_id_empleado AND estado = 'ACTIVO';
    vn_embargo := ROUND(vn_base_embargo * vn_embargo / 100, 2);

    SELECT NVL(SUM(cuota_mensual), 0) / 2 INTO vn_libranzas
      FROM LIBRANZAS WHERE id_empleado = p_id_empleado AND estado = 'ACTIVA';

    IF vv_cod_sede = 'BOG' AND vv_aporte_vol = 'S' THEN
        vn_aporte_vol := vn_aporte_fijo;
    END IF;

    vn_total_desc := vn_salud + vn_pension + vn_fondo + vn_embargo + vn_libranzas + vn_aporte_vol;
    vn_neto       := vn_bruto - vn_total_desc;

    INSERT INTO LIQUIDACION (
        ID_LIQUIDACION, ID_EMPLEADO, ID_QUINCENA,
        SALARIO_BASE_Q, RECARGOS, BONIFICACION, AUXILIO_TRANSP, BONO_SEDE, BRUTO,
        DEDUCCION_SALUD, DEDUCCION_PENSION, FONDO_SOLIDARIDAD,
        EMBARGO, LIBRANZAS, APORTE_VOLUNTARIO,
        TOTAL_DEDUCCIONES, NETO, FECHA_LIQUIDACION
    ) VALUES (
        SEQ_LIQUIDACION.NEXTVAL, p_id_empleado, p_id_quincena,
        fn_salario_base_q(p_id_empleado, p_id_quincena),
        fn_recargos(p_id_empleado, p_id_quincena),
        fn_bonificacion(p_id_empleado),
        0, 0, vn_bruto,
        vn_salud, vn_pension, vn_fondo,
        vn_embargo, vn_libranzas, vn_aporte_vol,
        vn_total_desc, vn_neto, SYSDATE
    );
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN ROLLBACK; RAISE;
END sp_liquidar_empleado;
/`,
      },
    ],
  },
  {
    id: 't2-p4',
    title: 'Punto 4 — Package PKG_NOMINA',
    icon: '📦',
    exercises: [
      {
        id: 'T2-PKG-SPEC',
        title: 'Spec del package — tipos, constante gc_smlmv, sobrecarga',
        concept: 'PACKAGE SPEC + TYPE RECORD + TYPE TABLE INDEX BY + sobrecarga de procedimiento',
        explanation:
          'Define la interfaz pública: gc_smlmv (asignada en el init block del body), el tipo t_concepto_liq (RECORD con todos los campos de liquidación), t_lista_liq (INDEX BY PLS_INTEGER), dos sobrecargas de sp_liquidar_quincena, fn_total_nomina_sede y fn_reporte_nomina PIPELINED.',
        code: `CREATE OR REPLACE PACKAGE PKG_NOMINA AS

    -- Variable pública inicializada en init block del body
    gc_smlmv NUMBER;

    TYPE t_concepto_liq IS RECORD (
        id_empleado       LIQUIDACION.id_empleado%TYPE,
        id_quincena       LIQUIDACION.id_quincena%TYPE,
        salario_base_q    LIQUIDACION.salario_base_q%TYPE,
        recargos          LIQUIDACION.recargos%TYPE,
        bonificacion      LIQUIDACION.bonificacion%TYPE,
        auxilio_transp    LIQUIDACION.auxilio_transp%TYPE,
        bono_sede         LIQUIDACION.bono_sede%TYPE,
        bruto             LIQUIDACION.bruto%TYPE,
        deduccion_salud   LIQUIDACION.deduccion_salud%TYPE,
        deduccion_pension LIQUIDACION.deduccion_pension%TYPE,
        fondo_solidaridad LIQUIDACION.fondo_solidaridad%TYPE,
        embargo           LIQUIDACION.embargo%TYPE,
        libranzas         LIQUIDACION.libranzas%TYPE,
        aporte_voluntario LIQUIDACION.aporte_voluntario%TYPE,
        total_deducciones LIQUIDACION.total_deducciones%TYPE,
        neto              LIQUIDACION.neto%TYPE
    );

    TYPE t_lista_liq IS TABLE OF t_concepto_liq INDEX BY PLS_INTEGER;

    -- Sobrecarga: liquidar un empleado
    PROCEDURE sp_liquidar_quincena (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    );

    -- Sobrecarga: liquidar TODOS los activos
    PROCEDURE sp_liquidar_quincena (
        p_id_quincena IN VARCHAR2
    );

    FUNCTION fn_total_nomina_sede (
        p_cod_sede    IN VARCHAR2,
        p_id_quincena IN VARCHAR2
    ) RETURN NUMBER;

    FUNCTION fn_reporte_nomina (
        p_cod_sede      IN VARCHAR2 DEFAULT NULL,
        p_tipo_contrato IN VARCHAR2 DEFAULT NULL
    ) RETURN t_lista_liq_pipe PIPELINED;

END PKG_NOMINA;
/`,
      },
      {
        id: 'T2-PKG-BULK',
        title: 'Body — sp_liquidar_quincena masiva (BULK COLLECT + FORALL)',
        concept: 'BULK COLLECT INTO + FORALL SAVE EXCEPTIONS + SQL%BULK_EXCEPTIONS',
        explanation:
          'Carga los IDs de empleados activos sin liquidación con BULK COLLECT. Calcula cada liquidación con calcular_concepto_liq y solo agrega a vt_lista los que no fallaron. El FORALL con SAVE EXCEPTIONS inserta todo en lote; los errores se procesan iterando SQL%BULK_EXCEPTIONS sin abortar el lote.',
        code: `PROCEDURE sp_liquidar_quincena (p_id_quincena IN VARCHAR2) IS
    TYPE t_ids IS TABLE OF EMPLEADOS.id_empleado%TYPE;
    vt_ids   t_ids;
    vt_lista t_lista_liq;

    vn_ok  NUMBER := 0; vn_err NUMBER := 0;
    vn_total NUMBER := 0;
    vn_idx   PLS_INTEGER := 0;

    bulk_errors EXCEPTION;
    PRAGMA EXCEPTION_INIT(bulk_errors, -24381);
BEGIN
    SELECT id_empleado BULK COLLECT INTO vt_ids
      FROM EMPLEADOS
     WHERE estado = 'ACTIVO'
       AND id_empleado NOT IN (
           SELECT id_empleado FROM LIQUIDACION WHERE id_quincena = p_id_quincena
       );

    IF vt_ids.COUNT = 0 THEN
        DBMS_OUTPUT.PUT_LINE('No hay empleados pendientes para ' || p_id_quincena);
        RETURN;
    END IF;

    -- Calcula y solo agrega a vt_lista si no hay error
    FOR i IN 1 .. vt_ids.COUNT LOOP
        BEGIN
            vn_idx := vn_idx + 1;
            vt_lista(vn_idx) := calcular_concepto_liq(vt_ids(i), p_id_quincena);
        EXCEPTION
            WHEN OTHERS THEN
                sp_log_nomina('ERROR_CALCULO',
                    'Empleado: ' || vt_ids(i) || ' | Error: ' || SQLERRM, 0, 1, 0);
                vn_err := vn_err + 1;
                vn_idx := vn_idx - 1;
        END;
    END LOOP;

    -- FORALL con SAVE EXCEPTIONS
    BEGIN
        FORALL i IN 1 .. vn_idx SAVE EXCEPTIONS
            INSERT INTO LIQUIDACION (
                ID_LIQUIDACION, ID_EMPLEADO, ID_QUINCENA,
                SALARIO_BASE_Q, RECARGOS, BONIFICACION, AUXILIO_TRANSP, BONO_SEDE, BRUTO,
                DEDUCCION_SALUD, DEDUCCION_PENSION, FONDO_SOLIDARIDAD,
                EMBARGO, LIBRANZAS, APORTE_VOLUNTARIO,
                TOTAL_DEDUCCIONES, NETO, FECHA_LIQUIDACION
            ) VALUES (
                SEQ_LIQUIDACION.NEXTVAL,
                vt_lista(i).id_empleado,    vt_lista(i).id_quincena,
                vt_lista(i).salario_base_q, vt_lista(i).recargos,
                vt_lista(i).bonificacion,   vt_lista(i).auxilio_transp,
                vt_lista(i).bono_sede,      vt_lista(i).bruto,
                vt_lista(i).deduccion_salud, vt_lista(i).deduccion_pension,
                vt_lista(i).fondo_solidaridad, vt_lista(i).embargo,
                vt_lista(i).libranzas,      vt_lista(i).aporte_voluntario,
                vt_lista(i).total_deducciones, vt_lista(i).neto, SYSDATE
            );
        vn_ok := vn_idx;
    EXCEPTION
        WHEN bulk_errors THEN
            FOR j IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
                sp_log_nomina('ERROR_INSERT_BULK',
                    'Indice: ' || SQL%BULK_EXCEPTIONS(j).ERROR_INDEX
                    || ' | Error: ' || SQLERRM(-SQL%BULK_EXCEPTIONS(j).ERROR_CODE),
                    0, 1, 0);
                vn_err := vn_err + 1;
            END LOOP;
            vn_ok := vn_idx - SQL%BULK_EXCEPTIONS.COUNT;
    END;

    sp_log_nomina('LIQUIDACION_MASIVA',
        'Quincena: ' || p_id_quincena || ' | OK: ' || vn_ok || ' | Err: ' || vn_err,
        vn_ok, vn_err, vn_total);
    COMMIT;
END sp_liquidar_quincena;`,
      },
      {
        id: 'T2-PKG-PIPE',
        title: 'Body — fn_reporte_nomina PIPELINED + init block',
        concept: 'PIPELINED + REF CURSOR + SQL dinámico con bind variables + init block',
        explanation:
          'Función PIPELINED que retorna filas de t_lista_liq_pipe (schema-level type). Usa SQL dinámico con REF CURSOR para filtrar opcionalmente por sede y/o tipo de contrato usando bind variables (sin concatenación, evitando SQL injection). El init block carga todos los parámetros al estado del package al iniciarse.',
        code: `FUNCTION fn_reporte_nomina (
    p_cod_sede      IN VARCHAR2 DEFAULT NULL,
    p_tipo_contrato IN VARCHAR2 DEFAULT NULL
) RETURN t_lista_liq_pipe PIPELINED IS
    vv_sql  VARCHAR2(2000);
    -- variables para FETCH
    vn_emp  NUMBER(6);  vv_quin VARCHAR2(15);
    vn_sbq  NUMBER(12,2); vn_rec  NUMBER(12,2); vn_bon NUMBER(12,2);
    vn_aux  NUMBER(12,2); vn_bse  NUMBER(12,2); vn_bru NUMBER(12,2);
    vn_sal  NUMBER(12,2); vn_pen  NUMBER(12,2); vn_fon NUMBER(12,2);
    vn_emb  NUMBER(12,2); vn_lib  NUMBER(12,2); vn_apr NUMBER(12,2);
    vn_tot  NUMBER(12,2); vn_net  NUMBER(12,2);

    TYPE t_ref IS REF CURSOR;
    cur_dyn t_ref;
BEGIN
    vv_sql :=
        'SELECT l.id_empleado, l.id_quincena,'
        || ' l.salario_base_q, l.recargos, l.bonificacion,'
        || ' l.auxilio_transp, l.bono_sede, l.bruto,'
        || ' l.deduccion_salud, l.deduccion_pension, l.fondo_solidaridad,'
        || ' l.embargo, l.libranzas, l.aporte_voluntario,'
        || ' l.total_deducciones, l.neto'
        || ' FROM LIQUIDACION l JOIN EMPLEADOS e ON e.id_empleado = l.id_empleado'
        || ' WHERE 1 = 1';

    IF p_cod_sede IS NOT NULL THEN
        vv_sql := vv_sql || ' AND e.cod_sede = :sede';
    END IF;
    IF p_tipo_contrato IS NOT NULL THEN
        vv_sql := vv_sql || ' AND e.tipo_contrato = :tipo';
    END IF;

    IF p_cod_sede IS NOT NULL AND p_tipo_contrato IS NOT NULL THEN
        OPEN cur_dyn FOR vv_sql USING p_cod_sede, p_tipo_contrato;
    ELSIF p_cod_sede IS NOT NULL THEN
        OPEN cur_dyn FOR vv_sql USING p_cod_sede;
    ELSIF p_tipo_contrato IS NOT NULL THEN
        OPEN cur_dyn FOR vv_sql USING p_tipo_contrato;
    ELSE
        OPEN cur_dyn FOR vv_sql;
    END IF;

    LOOP
        FETCH cur_dyn INTO
            vn_emp, vv_quin, vn_sbq, vn_rec, vn_bon, vn_aux, vn_bse,
            vn_bru, vn_sal, vn_pen, vn_fon, vn_emb, vn_lib, vn_apr, vn_tot, vn_net;
        EXIT WHEN cur_dyn%NOTFOUND;
        PIPE ROW(t_concepto_liq_obj(
            vn_emp, vv_quin, vn_sbq, vn_rec, vn_bon, vn_aux, vn_bse,
            vn_bru, vn_sal, vn_pen, vn_fon, vn_emb, vn_lib, vn_apr, vn_tot, vn_net
        ));
    END LOOP;
    CLOSE cur_dyn;
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        IF cur_dyn%ISOPEN THEN CLOSE cur_dyn; END IF; RAISE;
END fn_reporte_nomina;

-- INIT BLOCK — se ejecuta al cargar el package
BEGIN
    SELECT MAX(CASE WHEN cod_parametro = 'SMLMV'                THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'AUX_TRANSPORTE'        THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'PCT_SALUD'             THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'PCT_PENSION'           THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'PCT_FONDO_SOLIDARIDAD' THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'UMBRAL_FONDO_SMLMV'    THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'RECARGO_NOCTURNO'      THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'RECARGO_DOMINICAL'     THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'RECARGO_NOCT_DOM'      THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'RET_SERVICIOS'         THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'BONO_CLIMA_SMA'        THEN valor_numerico END),
           MAX(CASE WHEN cod_parametro = 'APORTE_VOL_BOG'        THEN valor_numerico END)
      INTO gr_params.smlmv, gr_params.aux_transporte,
           gr_params.pct_salud, gr_params.pct_pension,
           gr_params.pct_fondo, gr_params.umbral_fondo,
           gr_params.rec_nocturno, gr_params.rec_dominical,
           gr_params.rec_noct_dom, gr_params.ret_servicios,
           gr_params.bono_clima_sma, gr_params.aporte_vol_bog
      FROM PARAMETROS;
    gc_smlmv := gr_params.smlmv;
END PKG_NOMINA;
/`,
      },
    ],
  },
  {
    id: 't2-p5',
    title: 'Punto 5 — Compound Trigger',
    icon: '🔥',
    exercises: [
      {
        id: 'T2-TRG',
        title: 'TRG_LIQUIDACION_COMPOUND — neto negativo + actualizar libranzas',
        concept: 'COMPOUND TRIGGER + BEFORE EACH ROW + AFTER EACH ROW + AFTER STATEMENT',
        explanation:
          'BEFORE EACH ROW: valida salario base ≥ 0 y si el neto es negativo, ajusta embargo primero y luego libranzas para recuperar saldo positivo. AFTER EACH ROW: registra alerta en LOG_NOMINA y descuenta cuota_mensual/2 de cada libranza activa (marcando como PAGADA si saldo ≤ 0). AFTER STATEMENT: registra el lote en el log.',
        code: `CREATE OR REPLACE TRIGGER TRG_LIQUIDACION_COMPOUND
FOR INSERT ON LIQUIDACION
COMPOUND TRIGGER

    TYPE t_ajuste IS RECORD (
        id_empleado NUMBER, libranzas NUMBER,
        embargo NUMBER, neto_orig NUMBER
    );
    TYPE t_lista_ajuste IS TABLE OF t_ajuste INDEX BY PLS_INTEGER;
    vt_ajustes  t_lista_ajuste;
    vn_idx      PLS_INTEGER := 0;

    BEFORE EACH ROW IS
        vb_ajustado BOOLEAN := FALSE;
    BEGIN
        IF :NEW.salario_base_q < 0 THEN
            RAISE_APPLICATION_ERROR(-20010, 'Salario base no puede ser negativo');
        END IF;

        -- Ajuste de neto negativo
        IF :NEW.neto < 0 THEN
            vb_ajustado := TRUE;
            :NEW.total_deducciones := :NEW.total_deducciones - :NEW.embargo;
            :NEW.embargo           := 0;
            :NEW.neto              := :NEW.bruto - :NEW.total_deducciones;

            IF :NEW.neto < 0 THEN
                :NEW.total_deducciones := :NEW.total_deducciones - :NEW.libranzas;
                :NEW.libranzas         := 0;
                :NEW.neto              := :NEW.bruto - :NEW.total_deducciones;
            END IF;
        END IF;

        IF vb_ajustado THEN
            vn_idx := vn_idx + 1;
            vt_ajustes(vn_idx).id_empleado := :NEW.id_empleado;
            vt_ajustes(vn_idx).libranzas   := :NEW.libranzas;
            vt_ajustes(vn_idx).embargo     := :NEW.embargo;
            vt_ajustes(vn_idx).neto_orig   := :NEW.neto;
        END IF;
    END BEFORE EACH ROW;

    AFTER EACH ROW IS
    BEGIN
        -- Log de alerta si hubo ajuste
        FOR i IN 1 .. vt_ajustes.COUNT LOOP
            IF vt_ajustes(i).id_empleado = :NEW.id_empleado THEN
                INSERT INTO LOG_NOMINA (ID_LOG, FECHA_HORA, OPERACION, USUARIO, DETALLE)
                VALUES (SEQ_LOG.NEXTVAL, SYSTIMESTAMP, 'ALERTA_NETO_NEGATIVO', USER,
                    'Empleado: ' || :NEW.id_empleado
                    || ' | Embargo ajustado: ' || vt_ajustes(i).embargo
                    || ' | Libranzas ajustadas: ' || vt_ajustes(i).libranzas);
            END IF;
        END LOOP;

        -- Descontar cuota_mensual/2 de cada libranza activa
        IF :NEW.libranzas > 0 THEN
            UPDATE LIBRANZAS
               SET saldo_pendiente = saldo_pendiente - (cuota_mensual / 2)
             WHERE id_empleado = :NEW.id_empleado AND estado = 'ACTIVA';

            UPDATE LIBRANZAS SET estado = 'PAGADA'
             WHERE id_empleado = :NEW.id_empleado
               AND estado = 'ACTIVA' AND saldo_pendiente <= 0;
        END IF;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
    BEGIN
        INSERT INTO LOG_NOMINA (ID_LOG, FECHA_HORA, OPERACION, USUARIO, DETALLE)
        VALUES (SEQ_LOG.NEXTVAL, SYSTIMESTAMP, 'INSERT_LIQUIDACION', USER,
            'Lote procesado a las ' || TO_CHAR(SYSTIMESTAMP, 'HH24:MI:SS.FF3'));
    END AFTER STATEMENT;

END TRG_LIQUIDACION_COMPOUND;
/`,
      },
    ],
  },
  {
    id: 't2-p8',
    title: 'Punto 8 — Autonomous Transaction',
    icon: '🔒',
    exercises: [
      {
        id: 'T2-AUTON',
        title: 'sp_log_nomina — PRAGMA AUTONOMOUS_TRANSACTION',
        concept: 'PRAGMA AUTONOMOUS_TRANSACTION + log independiente del ROLLBACK principal',
        explanation:
          'Al declararse con PRAGMA AUTONOMOUS_TRANSACTION, este procedimiento abre su propia transacción independiente. Así, si la transacción principal hace ROLLBACK, los registros de log ya escritos y confirmados con COMMIT persisten en LOG_NOMINA. Garantiza trazabilidad incluso en caso de error.',
        code: `PROCEDURE sp_log_nomina (
    p_operacion       IN VARCHAR2,
    p_detalle         IN VARCHAR2,
    p_empleados_ok    IN NUMBER DEFAULT 0,
    p_empleados_error IN NUMBER DEFAULT 0,
    p_monto_total     IN NUMBER DEFAULT 0
)
IS
    PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
    INSERT INTO LOG_NOMINA (
        ID_LOG, FECHA_HORA, OPERACION, USUARIO,
        DETALLE, EMPLEADOS_OK, EMPLEADOS_ERROR, MONTO_TOTAL
    ) VALUES (
        SEQ_LOG.NEXTVAL, SYSTIMESTAMP, p_operacion, USER,
        p_detalle, p_empleados_ok, p_empleados_error, p_monto_total
    );
    COMMIT;  -- Confirma SOLO esta transacción autónoma
END sp_log_nomina;

-- Ejecución de prueba
BEGIN
    PKG_NOMINA.sp_liquidar_quincena('2026-Q1-ENE');
    DBMS_OUTPUT.PUT_LINE('Liquidacion masiva completada.');
END;
/

-- Verificación de resultados
SELECT e.nombre, e.tipo_contrato, e.cod_sede, l.id_quincena,
       l.bruto, l.total_deducciones, l.neto
FROM LIQUIDACION l JOIN EMPLEADOS e ON e.id_empleado = l.id_empleado
ORDER BY l.id_liquidacion;

SELECT 'BOG' AS sede, PKG_NOMINA.fn_total_nomina_sede('BOG','2026-Q1-ENE') AS total_neto FROM DUAL
UNION ALL SELECT 'MED', PKG_NOMINA.fn_total_nomina_sede('MED','2026-Q1-ENE') FROM DUAL
UNION ALL SELECT 'SMA', PKG_NOMINA.fn_total_nomina_sede('SMA','2026-Q1-ENE') FROM DUAL
UNION ALL SELECT 'CTG', PKG_NOMINA.fn_total_nomina_sede('CTG','2026-Q1-ENE') FROM DUAL;`,
      },
    ],
  },
];

// ============================================================
// TALLER 3 — MONGODB — sample_airbnb
// ============================================================
const t3Sections: Section[] = [
  {
    id: 't3-insert',
    title: 'Inserción de Documentos',
    icon: '📥',
    exercises: [
      {
        id: 'T3-S1',
        title: 'Scrip1 — insertOne básico',
        concept: 'insertOne — documento mínimo sin subdocumento',
        explanation: 'Inserta un documento con campos planos en la colección listingsAndReviews. MongoDB asigna automáticamente _id (ObjectId) si no se especifica.',
        code: `use("sample_airbnb")

db.listingsAndReviews.insertOne({
  name: "Cozy Cabin Retreat",
  summary: "Acogedor cabin en el bosque, ideal para escapadas de fin de semana.",
  property_type: "Cabin",
  price: NumberDecimal("150.00")
})`,
      },
      {
        id: 'T3-S2',
        title: 'Scrip2 — insertOne con documento anidado (address)',
        concept: 'Documento embebido — subdocumento address',
        explanation: 'Inserta un documento que incluye un subdocumento anidado (address). MongoDB es schema-less: los documentos de una misma colección no necesitan tener los mismos campos.',
        code: `use("sample_airbnb")

db.listingsAndReviews.insertOne({
  name: "Departamento Vista Cordillera",
  summary: "Hermoso departamento con vista a la Cordillera de los Andes.",
  property_type: "Apartment",
  price: NumberDecimal("120.00"),
  address: {
    country: "Chile",
    country_code: "CL",
    market: "Santiago",
    street: "Av. Providencia 1234",
    suburb: "Providencia"
  }
})`,
      },
      {
        id: 'T3-S3',
        title: 'Scrip3 & 4 — insertMany con array de amenities',
        concept: 'insertMany — arrays embebidos como campo nativo',
        explanation: 'insertMany inserta múltiples documentos en una sola operación. El campo amenities es un array nativo de strings, lo que permite luego filtrar por elementos del array sin tablas intermedias.',
        code: `use("sample_airbnb")

// Scrip3: insertMany básico
db.listingsAndReviews.insertMany([
  {
    name: "Studio de Arte Urbano",
    property_type: "Apartment",
    price: NumberDecimal("80.00"),
    summary: "Estudio creativo en el corazón del barrio artístico."
  },
  {
    name: "Loft Minimalista",
    property_type: "Loft",
    price: NumberDecimal("110.00"),
    summary: "Loft de diseño minimalista con acabados de alta calidad."
  }
])

// Scrip4: insertMany con array de amenities
db.listingsAndReviews.insertMany([
  {
    name: "Casa de la Playa Caribe",
    property_type: "House",
    price: NumberDecimal("200.00"),
    summary: "Frente al mar con todas las comodidades.",
    amenities: ["Wifi", "Kitchen", "Free parking", "Pool", "Air conditioning"],
    address: { country: "Colombia", market: "Cartagena" }
  }
])`,
      },
      {
        id: 'T3-S5',
        title: 'Scrip5 — _id duplicado y manejo de errores',
        concept: 'findOne para obtener _id existente + DuplicateKeyError',
        explanation: 'Primero obtiene un _id existente con findOne. Luego intenta insertar con ese mismo _id, lo que genera un error de clave duplicada (DuplicateKeyError). Demuestra que _id es la clave primaria única en MongoDB.',
        code: `use("sample_airbnb")

// Obtener un _id existente
db.listingsAndReviews.findOne({}, { _id: 1 })

// Intentar insertar con _id duplicado → DuplicateKeyError
db.listingsAndReviews.insertOne({
  _id: "10006546",
  name: "Listing Duplicado",
  price: NumberDecimal("50.00")
})`,
      },
    ],
  },
  {
    id: 't3-find',
    title: 'Consultas y Filtros',
    icon: '🔎',
    exercises: [
      {
        id: 'T3-S6',
        title: 'Scrip6 — find con proyección de campos',
        concept: 'find({filtro}, {proyección}) — _id:0 para excluir',
        explanation: 'Filtra documentos por campo anidado ("address.country") usando notación de punto. La proyección {_id:0, name:1, price:1} selecciona solo los campos necesarios y excluye _id.',
        code: `use("sample_airbnb")

db.listingsAndReviews.find(
  { "address.country": "Brazil" },
  { _id: 0, name: 1, price: 1 }
)`,
      },
      {
        id: 'T3-S7-8',
        title: 'Scrip7 & 8 — operadores $gt y $lt',
        concept: 'Operadores de comparación — $gt, $lt, $gte, $lte',
        explanation: 'Scrip7 busca listings con más de 5 camas ($gt: 5). Scrip8 filtra por precio menor a $75 usando NumberDecimal para mantener precisión decimal. Ambos aplican proyección para reducir el volumen de respuesta.',
        code: `use("sample_airbnb")

// Scrip7: beds > 5
db.listingsAndReviews.find(
  { beds: { $gt: 5 } },
  { _id: 0, name: 1, number_of_reviews: 1 }
)

// Scrip8: price < 75.00
db.listingsAndReviews.find(
  { price: { $lt: NumberDecimal("75.00") } },
  { _id: 0, name: 1, price: 1, property_type: 1 }
)`,
      },
      {
        id: 'T3-S9-10',
        title: 'Scrip9 & 10 — operadores $and e $in',
        concept: '$and para múltiples condiciones + $in para lista de valores',
        explanation: 'Scrip9 usa $and para combinar dos condiciones: tipo Apartment Y mercado New York. Scrip10 usa $in para buscar documentos cuyo property_type sea House O Condominium, equivalente a un IN de SQL.',
        code: `use("sample_airbnb")

// Scrip9: $and — Apartment en New York
db.listingsAndReviews.find(
  {
    $and: [
      { property_type: "Apartment" },
      { "address.market": "New York" }
    ]
  },
  { _id: 0, name: 1, property_type: 1, "address.market": 1 }
)

// Scrip10: $in — House o Condominium
db.listingsAndReviews.find(
  { property_type: { $in: ["House", "Condominium"] } },
  { _id: 0, name: 1, property_type: 1 }
)`,
      },
      {
        id: 'T3-S11-15',
        title: 'Scrip11–15 — $regex, arrays, $size, sort/limit, $exists',
        concept: '$regex insensible + array query + $size + .sort().limit() + $exists/$or',
        explanation: 'Consultas avanzadas: búsqueda por expresión regular case-insensitive, filtro por elemento de array (amenities: "Heating"), arrays de tamaño exacto ($size), ordenamiento y paginación (.sort().limit()), y documentos con campo nulo o inexistente ($or con $exists).',
        code: `use("sample_airbnb")

// Scrip11: regex insensible a mayúsculas
db.listingsAndReviews.find(
  { name: { $regex: "luxury", $options: "i" } },
  { _id: 0, name: 1 }
)

// Scrip12: elemento de array
db.listingsAndReviews.find(
  { amenities: "Heating" },
  { _id: 0, name: 1, amenities: 1 }
)

// Scrip13: array con tamaño exacto
db.listingsAndReviews.find(
  { amenities: { $size: 20 } },
  { _id: 0, name: 1, amenities: 1 }
)

// Scrip14: sort DESC + limit 10
db.listingsAndReviews.find(
  {},
  { _id: 0, name: 1, price: 1, "address.country": 1 }
).sort({ price: -1 }).limit(10)

// Scrip15: sin reseña reciente ($exists false o null)
db.listingsAndReviews.find(
  {
    $or: [
      { last_review: { $exists: false } },
      { last_review: null }
    ]
  },
  { _id: 0, name: 1, number_of_reviews: 1 }
).sort({ number_of_reviews: -1 })`,
      },
    ],
  },
  {
    id: 't3-update',
    title: 'Actualizaciones',
    icon: '✏️',
    exercises: [
      {
        id: 'T3-S16-17',
        title: 'Scrip16 & 17 — updateOne con $set y $push',
        concept: '$set para modificar campo + $push para agregar al array',
        explanation: 'Scrip16 cambia el property_type con $set (solo modifica ese campo, no reemplaza el documento). Scrip17 combina $set (añade campo last_modified) con $push (agrega un elemento al array amenities).',
        code: `use("sample_airbnb")

// Scrip16: $set — modificar un campo
db.listingsAndReviews.updateOne(
  { name: "Cozy Cabin Retreat" },
  { $set: { property_type: "Entire home/apt" } }
)

// Scrip17: $set + $push en una sola operación
db.listingsAndReviews.updateOne(
  { name: "Departamento Vista Cordillera" },
  {
    $set: { last_modified: new Date() },
    $push: { amenities: "Smart TV" }
  }
)`,
      },
      {
        id: 'T3-S18-20',
        title: 'Scrip18–20 — $inc, $pull y upsert',
        concept: 'updateMany + $inc para incrementar + $pull para eliminar del array + upsert',
        explanation: 'Scrip18: updateMany con $inc incrementa number_of_reviews en 1 para todos los listings de España. Scrip19: $pull elimina el elemento "Cable TV" de todos los arrays amenities. Scrip20: upsert:true inserta el documento si no existe o lo actualiza si sí existe.',
        code: `use("sample_airbnb")

// Scrip18: updateMany + $inc
db.listingsAndReviews.updateMany(
  { "address.country": "Spain" },
  { $inc: { number_of_reviews: 1 } }
)

// Scrip19: $pull — eliminar elemento de array en todos los documentos
db.listingsAndReviews.updateMany(
  { amenities: "Cable TV" },
  { $pull: { amenities: "Cable TV" } }
)

// Scrip20: upsert — insertar si no existe
db.listingsAndReviews.updateOne(
  { name: "Mansión de Prueba" },
  {
    $set: {
      name: "Mansión de Prueba",
      price: NumberDecimal("1500.00"),
      address: { country: "United States" },
      property_type: "Villa"
    }
  },
  { upsert: true }
)`,
      },
    ],
  },
  {
    id: 't3-agg',
    title: 'Aggregation Pipeline',
    icon: '📈',
    exercises: [
      {
        id: 'T3-S21-22',
        title: 'Scrip21 & 22 — $count y $group con $avg',
        concept: '$match + $count + $group + $avg + $sort',
        explanation: 'Scrip21: cuenta listings con más de 10 amenities usando $match con $expr y $size. Scrip22: agrupa por país y calcula precio promedio con $avg y $toDouble (conversión de Decimal128), ordenando de mayor a menor.',
        code: `use("sample_airbnb")

// Scrip21: contar listings con > 10 amenities
db.listingsAndReviews.aggregate([
  { $match: { $expr: { $gt: [{ $size: "$amenities" }, 10] } } },
  { $count: "listings_con_mas_de_10_amenities" }
])

// Scrip22: precio promedio por país
db.listingsAndReviews.aggregate([
  {
    $group: {
      _id: "$address.country",
      precio_promedio: { $avg: { $toDouble: "$price" } }
    }
  },
  { $sort: { precio_promedio: -1 } }
])`,
      },
      {
        id: 'T3-S23-24',
        title: 'Scrip23 & 24 — $unwind y group por tipo',
        concept: '$unwind para explotar array + $group + $sum + $limit',
        explanation: 'Scrip23: $unwind descompone el array amenities, creando un documento por cada amenidad. Luego agrupa y cuenta las 5 más frecuentes. Scrip24: cuenta listings por tipo de propiedad, equivalente a GROUP BY en SQL.',
        code: `use("sample_airbnb")

// Scrip23: top 5 amenities más frecuentes
db.listingsAndReviews.aggregate([
  { $unwind: "$amenities" },
  {
    $group: {
      _id: "$amenities",
      frecuencia: { $sum: 1 }
    }
  },
  { $sort: { frecuencia: -1 } },
  { $limit: 5 }
])

// Scrip24: cantidad de listings por tipo de propiedad
db.listingsAndReviews.aggregate([
  { $match: { property_type: { $exists: true } } },
  {
    $group: {
      _id: "$property_type",
      cantidad_listings: { $sum: 1 }
    }
  },
  { $sort: { cantidad_listings: -1 } }
])`,
      },
      {
        id: 'T3-S25-27',
        title: 'Scrip25–27 — $project, rating promedio y $bucket',
        concept: '$project con $toInt + $round + $bucket por rangos de precio',
        explanation: 'Scrip25: proyecta y convierte price a entero. Scrip26: calcula el rating promedio solo de listings con ≥ 10 reseñas, redondeado a 2 decimales. Scrip27: clasifica listings en cubetas de precio (0-100, 101-300, 301-1000, 1000+) con $bucket.',
        code: `use("sample_airbnb")

// Scrip25: proyección con conversión de tipo
db.listingsAndReviews.aggregate([
  {
    $project: {
      _id: 0, name: 1, price: 1,
      price_entero: { $toInt: "$price" }
    }
  },
  { $limit: 20 }
])

// Scrip26: promedio de rating (listings con >= 10 reviews)
db.listingsAndReviews.aggregate([
  {
    $match: {
      number_of_reviews: { $gte: 10 },
      "review_scores.review_scores_rating": { $exists: true, $ne: null }
    }
  },
  {
    $group: {
      _id: null,
      promedio_rating: { $avg: "$review_scores.review_scores_rating" },
      total_listings_analizados: { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      promedio_rating: { $round: ["$promedio_rating", 2] },
      total_listings_analizados: 1
    }
  }
])

// Scrip27: $bucket por rangos de precio
db.listingsAndReviews.aggregate([
  {
    $bucket: {
      groupBy: { $toDouble: "$price" },
      boundaries: [0, 101, 301, 1001],
      default: "1000+",
      output: { cantidad: { $sum: 1 } }
    }
  }
])`,
      },
      {
        id: 'T3-S28-30',
        title: 'Scrip28–30 — $lookup, promedio huéspedes y fechas',
        concept: '$lookup (JOIN) + $unwind + preserveNull + $year para agrupar por año',
        explanation: 'Scrip28: $lookup une listingsAndReviews con la colección hosts por host_id (equivalente a LEFT JOIN). Scrip29: promedio de huéspedes por tipo de propiedad. Scrip30: agrupa listings por año de last_review usando $year sobre un campo Date.',
        code: `use("sample_airbnb")

// Scrip28: $lookup — JOIN con colección hosts
db.listingsAndReviews.aggregate([
  { $project: { name: 1, price: 1, "host.host_id": 1 } },
  {
    $lookup: {
      from: "hosts",
      localField: "host.host_id",
      foreignField: "host_id",
      as: "host_info"
    }
  },
  { $unwind: { path: "$host_info", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      name: 1, price: 1,
      host_name: "$host_info.host_name",
      host_is_superhost: "$host_info.host_is_superhost"
    }
  }
])

// Scrip29: promedio de huéspedes por tipo de propiedad
db.listingsAndReviews.aggregate([
  { $match: { accommodates: { $exists: true, $ne: null }, property_type: { $exists: true } } },
  {
    $group: {
      _id: "$property_type",
      promedio_huespedes: { $avg: "$accommodates" },
      total_listings: { $sum: 1 }
    }
  },
  { $sort: { promedio_huespedes: -1 } },
  {
    $project: {
      _id: 0,
      property_type: "$_id",
      promedio_huespedes: { $round: ["$promedio_huespedes", 1] },
      total_listings: 1
    }
  }
])

// Scrip30: listings agrupados por año de última reseña
db.listingsAndReviews.aggregate([
  {
    $match: {
      last_review: { $exists: true, $ne: null, $type: "date" }
    }
  },
  {
    $group: {
      _id: { $year: "$last_review" },
      cantidad_listings: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      anio: "$_id",
      cantidad_listings: 1
    }
  }
])`,
      },
    ],
  },
];

const tabs: {
  id: TabId;
  label: string;
  sections: Section[];
  gradient: string;
  accent: string;
  langLabel: string;
}[] = [
  {
    id: 'taller1',
    label: 'Taller 1 — SQL + ACID',
    sections: t1Sections,
    gradient: 'from-blue-500 to-cyan-400',
    accent: 'text-blue-400',
    langLabel: 'SQL',
  },
  {
    id: 'taller2',
    label: 'Taller 2 — Nómina PL/SQL',
    sections: t2Sections,
    gradient: 'from-purple-500 to-violet-400',
    accent: 'text-purple-400',
    langLabel: 'PL/SQL',
  },
  {
    id: 'taller3',
    label: 'Taller 3 — MongoDB',
    sections: t3Sections,
    gradient: 'from-emerald-500 to-green-400',
    accent: 'text-emerald-400',
    langLabel: 'JavaScript',
  },
];

// ── Shared UI components ──────────────────────────────────────

function CodeBlock({ code, language, id }: { code: string; language: string; id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <div className="ev-code-wrapper">
      <div className="ev-code-header">
        <span className="ev-code-lang">{language}</span>
        <button
          onClick={handleCopy}
          className={`ev-copy-btn ${copied ? 'ev-copied' : ''}`}
          title="Copiar código"
          id={`tcopy-${id}`}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span>¡Copiado!</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="ev-code-body">
        <pre className="ev-code-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  isOpen,
  onToggle,
  accentColor,
  language,
  index,
}: {
  exercise: Exercise;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
  language: string;
  index: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen]);

  return (
    <div
      className={`ev-exercise-card ${isOpen ? 'ev-card-open' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
      id={`texercise-${exercise.id}`}
    >
      <button
        className="ev-card-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        id={`ttoggle-${exercise.id}`}
      >
        <div className="ev-card-header-left">
          <span className="ev-exercise-number">{exercise.id}</span>
          <div className="ev-card-title-group">
            <h3 className="ev-card-title">{exercise.title}</h3>
            <span className={`ev-concept-badge ${accentColor}`}>{exercise.concept}</span>
          </div>
        </div>
        <svg
          className={`ev-chevron ${isOpen ? 'ev-chevron-open' : ''}`}
          width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        className="ev-card-content"
        style={{ maxHeight: isOpen ? `${contentHeight}px` : '0px' }}
      >
        <div ref={contentRef} className="ev-card-content-inner">
          <p className="ev-explanation">{exercise.explanation}</p>
          <CodeBlock code={exercise.code} language={language} id={exercise.id} />
        </div>
      </div>
    </div>
  );
}

export default function TalleresViewer() {
  const [activeTab, setActiveTab] = useState<TabId>('taller1');
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const toggleCard = useCallback((id: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = currentTab.sections.flatMap((s) => s.exercises.map((e) => e.id));
    setOpenCards(new Set(allIds));
  }, [currentTab]);

  const collapseAll = useCallback(() => setOpenCards(new Set()), []);

  return (
    <div className="ev-root">
      <div className="ev-tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`ev-tab ${activeTab === tab.id ? 'ev-tab-active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setOpenCards(new Set()); }}
            id={`ttab-${tab.id}`}
          >
            <span className="ev-tab-label">{tab.label}</span>
            {activeTab === tab.id && (
              <div className={`ev-tab-indicator bg-gradient-to-r ${tab.gradient}`} />
            )}
          </button>
        ))}
      </div>

      <div className="ev-toolbar">
        <div className="ev-toolbar-actions">
          <button className="ev-action-btn" onClick={expandAll} title="Expandir todo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 13l5 5 5-5M7 6l5 5 5-5" /></svg>
            <span>Expandir</span>
          </button>
          <button className="ev-action-btn" onClick={collapseAll} title="Colapsar todo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 11l-5-5-5 5M17 18l-5-5-5 5" /></svg>
            <span>Colapsar</span>
          </button>
        </div>
      </div>

      <div className="ev-content" role="tabpanel">
        {currentTab.sections.map((section) => (
          <div key={section.id} className="ev-section" id={`tsection-${section.id}`}>
            <div className="ev-section-header">
              <h2 className="ev-section-title">{section.title}</h2>
              <span className="ev-section-count">{section.exercises.length} ejercicio{section.exercises.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="ev-exercises-list">
              {section.exercises.map((exercise, i) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  isOpen={openCards.has(exercise.id)}
                  onToggle={() => toggleCard(exercise.id)}
                  accentColor={currentTab.accent}
                  language={currentTab.langLabel}
                  index={i}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
