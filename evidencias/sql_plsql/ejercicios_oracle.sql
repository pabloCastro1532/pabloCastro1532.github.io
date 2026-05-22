-- ============================================================
-- ARCHIVO : ejercicios_oracle.sql
-- AUTOR   : Juan Pablo Moreno Castro
-- PORTAFOLIO: pabloCastro1532.github.io
-- DESC.   : Recopilación de ejercicios de Bases de Datos.
--           Parte 1: SQL y PL/SQL (Oracle)
-- ============================================================

SET SERVEROUTPUT ON;

-- ============================================================
-- SECCIÓN 1: CONSULTAS SQL
-- Concepto general: SELECT, JOINs, funciones de grupo
--                   y operadores de cadena sobre el esquema HR.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 1: Empleados con más de un cargo
-- CONCEPTO  : JOIN + GROUP BY + HAVING
-- EXPLICACIÓN: Une la tabla de historial de cargos (job_history) 
--              con la de empleados (employees) usando employee_id.
--              Agrupa por el nombre e ID del empleado y filtra
--              mediante HAVING para mostrar solo a quienes tienen
--              más de un registro en su historial.
-- ----------------------------------------------------------
SELECT
/* Autor: Juan Pablo Moreno Castro
   Fecha: 04/02/2026
   Descripción: Empleados con más de un cargo registrado en job_history
*/
    e.first_name,
    h.employee_id,
    COUNT(*) AS job_count
FROM
         hr.job_history h
    JOIN hr.employees e ON h.employee_id = e.employee_id
GROUP BY
    e.first_name,
    h.employee_id
HAVING
    COUNT(*) > 1;


-- ----------------------------------------------------------
-- EJERCICIO 2: Empleados en Europa con salario entre $4,000 y $6,000
-- CONCEPTO  : JOIN en cadena (5 tablas) + WHERE + BETWEEN
-- EXPLICACIÓN: Se realiza un JOIN múltiple conectando empleados,
--              departamentos, ubicaciones, países y regiones 
--              para identificar la región geográfica del empleado.
--              El filtro WHERE limita los resultados a la región 
--              'Europe' y a salarios entre 4,000 y 6,000.
-- ----------------------------------------------------------
SELECT
/* Autor: Juan Pablo Moreno Castro
   Fecha: 04/02/2026
   Descripción: Empleados en Europa con salario entre 4000 y 6000 dólares
*/
    e.employee_id,
    e.first_name || ' ' || e.last_name AS nombre_completo,
    e.salary,
    r.region_name
FROM
         hr.employees   e
    JOIN hr.departments d ON e.department_id = d.department_id
    JOIN hr.locations   l ON d.location_id   = l.location_id
    JOIN hr.countries   c ON l.country_id    = c.country_id
    JOIN hr.regions     r ON c.region_id     = r.region_id
WHERE
        r.region_name = 'Europe'
    AND e.salary BETWEEN 4000 AND 6000
ORDER BY
    e.salary;


-- ----------------------------------------------------------
-- EJERCICIO 3: Jerarquía de empleados con emails enmascarados
-- CONCEPTO  : LEFT JOIN reflexivo (Self-Join) + LPAD + SUBSTR
-- EXPLICACIÓN: Se une la tabla employees consigo misma para relacionar
--              a cada empleado con su jefe (manager). Se formatea
--              el correo electrónico extrayendo los 3 primeros caracteres
--              con SUBSTR y rellenando con asteriscos a la izquierda 
--              con LPAD para ocultar la información sensible.
-- ----------------------------------------------------------
SELECT
/* Autor: Juan Pablo Moreno Castro
   Fecha: 04/02/2026
   Descripción: Jerarquía empleado-jefe con emails parcialmente ocultos
*/
    e.first_name || ' ' || e.last_name       AS empleado,
    lpad(substr(e.email, 1, 3), 9, '*')      AS email_empleado,
    m.first_name || ' ' || m.last_name       AS jefe,
    lpad(substr(m.email, 1, 3), 9, '*')      AS email_jefe
FROM
    hr.employees e
    LEFT JOIN hr.employees m ON e.manager_id = m.employee_id
ORDER BY
    e.last_name;


-- ============================================================
-- SECCIÓN 2: PL/SQL BÁSICO — VARIABLES Y TIPOS DE DATOS
-- Concepto general: bloques anónimos DECLARE/BEGIN/END,
--                   variables escalares, %TYPE, %ROWTYPE
--                   y SELECT INTO.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 2.1: Hola Mundo — bloque mínimo sin variables
-- CONCEPTO  : Estructura básica de un bloque PL/SQL anónimo
-- EXPLICACIÓN: Muestra la estructura más elemental de PL/SQL,
--              la cual no requiere sección DECLARE si no hay variables.
--              Usa DBMS_OUTPUT.PUT_LINE para imprimir el texto.
-- ----------------------------------------------------------
BEGIN
/* Autor: Juan Pablo Moreno Castro
   Fecha: 16/02/2026
   Descripción: Bloque PL/SQL mínimo, sin sección DECLARE
*/
    dbms_output.put_line('Hola Mundo');
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 2.2: Variable declarada y asignada en BEGIN
-- CONCEPTO  : DECLARE + asignación con :=
-- EXPLICACIÓN: Declaración de una variable VARCHAR2 de longitud 50.
--              La asignación del valor se realiza dentro de la sección 
--              ejecutable (BEGIN..END) utilizando el operador :=.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 16/02/2026
   Descripción: Variable VARCHAR2 declarada y asignada por separado
*/
    vv_miprimeravariable VARCHAR2(50);
BEGIN
    vv_miprimeravariable := 'Hola Mundo';
    dbms_output.put_line(vv_miprimeravariable);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 2.3: Variable inicializada en DECLARE
-- CONCEPTO  : Inicialización directa con := en la declaración
-- EXPLICACIÓN: Demuestra cómo inicializar el valor de una variable
--              directamente al momento de declararla en la sección
--              DECLARE, haciendo el código más limpio.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 16/02/2026
   Descripción: Variable inicializada directamente en DECLARE
*/
    vv_miprimeravariable VARCHAR2(50) := 'Hola Mundo';
BEGIN
    dbms_output.put_line(vv_miprimeravariable);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 2.4: Variable con valor de cadena
-- CONCEPTO  : Declaración de VARCHAR2
-- EXPLICACIÓN: Declaración e impresión de una variable de tipo 
--              cadena (VARCHAR2) inicializada con el texto 'valentina'.
-- ----------------------------------------------------------
DECLARE
    vv_variable VARCHAR2(50) := 'valentina';
BEGIN
    dbms_output.put_line(vv_variable);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 2.5: SELECT INTO con variables escalares
-- CONCEPTO  : SELECT INTO para asignar valores de la BD a variables
-- EXPLICACIÓN: Ejecuta una consulta SELECT para obtener el primer_nombre
--              y apellido de un empleado con ID 110 y los guarda en 
--              variables locales mediante la cláusula INTO.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 16/02/2026
   Descripción: SELECT INTO con variables escalares para un empleado
*/
    vv_nombre   VARCHAR2(50);
    vv_apellido VARCHAR2(50);
BEGIN
    SELECT first_name, last_name
    INTO   vv_nombre, vv_apellido
    FROM   hr.employees
    WHERE  employee_id = 110;

    dbms_output.put_line('El nombre del empleado es: ' || vv_nombre || ' ' || vv_apellido);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 2.6: SELECT INTO con %TYPE (tipo ancla)
-- CONCEPTO  : Atributo %TYPE para tipado dinámico
-- EXPLICACIÓN: El atributo %TYPE asocia dinámicamente el tipo de 
--              la variable al tipo de datos de la columna de la tabla.
--              Si el tipo de columna cambia en la BD, el programa 
--              se adapta automáticamente sin requerir mantenimiento.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 16/02/2026
   Descripción: Variables ancladas al tipo de columna con %TYPE
*/
    vv_nombre   hr.employees.first_name%TYPE;
    vv_apellido hr.employees.last_name%TYPE;
BEGIN
    SELECT first_name, last_name
    INTO   vv_nombre, vv_apellido
    FROM   hr.employees
    WHERE  employee_id = 110;

    dbms_output.put_line('El nombre del empleado es: ' || vv_nombre || ' ' || vv_apellido);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 2.7: SELECT INTO con %ROWTYPE (fila completa)
-- CONCEPTO  : Atributo %ROWTYPE para registros completos
-- EXPLICACIÓN: Define un registro que representa una fila completa
--              de la tabla employees. Permite recuperar y manejar 
--              todos los campos de una fila en una única variable 
--              usando la notación de punto (variable.campo).
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 16/02/2026
   Descripción: %ROWTYPE almacena una fila completa de employees
*/
    vv_empleado hr.employees%ROWTYPE;
BEGIN
    SELECT *
    INTO   vv_empleado
    FROM   hr.employees
    WHERE  employee_id = 110;

    dbms_output.put_line('El nombre del empleado es: '
                         || vv_empleado.first_name || ' ' || vv_empleado.last_name);
END;
/


-- ============================================================
-- SECCIÓN 3: ESTRUCTURAS DE CONTROL
-- Concepto general: IF/ELSIF/ELSE, LOOP con EXIT WHEN,
--                   WHILE LOOP y MOD para control de flujo.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 3.1a: Día actual — número primo (versión con IN)
-- CONCEPTO  : Estructura condicional IF-THEN-ELSE + Operador IN
-- EXPLICACIÓN: Extrae el día del mes actual como un número y verifica
--              si pertenece al conjunto predefinido de números primos
--              de un mes de hasta 31 días utilizando la cláusula IN.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 18/02/2026
   Descripción: Verifica si el día de hoy es número primo usando IN
*/
    vd_current_date NUMBER := TO_NUMBER(TO_CHAR(SYSDATE, 'DD'));
BEGIN
    IF vd_current_date IN (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31) THEN
        dbms_output.put_line('HOLA PRIMO');
    ELSE
        dbms_output.put_line('NO ES PRIMO');
    END IF;
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 3.1b: Día actual — número primo (versión ELSIF)
-- CONCEPTO  : IF - ELSIF - ELSE + Función matemática MOD
-- EXPLICACIÓN: Determina si el día del mes actual es primo mediante 
--              lógica matemática: excluye menores o iguales a 1, 
--              hace caso especial para el número 2, descarta los
--              números pares usando MOD(dia, 2) = 0 y asume primos
--              en los casos restantes (simplificado).
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 18/02/2026
   Descripción: Verifica si el día de hoy es primo con lógica de paridad
*/
    vd_hoy INT;
BEGIN
    SELECT TO_NUMBER(TO_CHAR(SYSDATE, 'DD'))
    INTO   vd_hoy
    FROM   dual;

    IF vd_hoy = 2 THEN
        dbms_output.put_line('ES PRIMO');
    ELSIF vd_hoy <= 1 OR MOD(vd_hoy, 2) = 0 THEN
        dbms_output.put_line('NO ES PRIMO');
    ELSE
        dbms_output.put_line('HOLA PRIMO');
    END IF;
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 3.2: Serie de Fibonacci hasta 100
-- CONCEPTO  : Bucle básico (LOOP) + Salida condicional (EXIT WHEN)
-- EXPLICACIÓN: Genera la sucesión de Fibonacci de manera iterativa. 
--              El bucle ejecuta la suma acumulativa de los dos
--              términos anteriores y se interrumpe con EXIT WHEN
--              tan pronto como el término actual supera el valor 100.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 18/02/2026
   Descripción: Imprime la serie de Fibonacci mientras el valor sea <= 100
*/
    vn_a    NUMBER := 0;
    vn_b    NUMBER := 1;
    vn_temp NUMBER;
BEGIN
    dbms_output.put_line('Serie Fibonacci hasta 100:');
    LOOP
        EXIT WHEN vn_a > 100;
        dbms_output.put_line(vn_a);
        vn_temp := vn_a + vn_b;
        vn_a    := vn_b;
        vn_b    := vn_temp;
    END LOOP;
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 3.3a: MCM — búsqueda por múltiplos (WHILE)
-- CONCEPTO  : Bucle WHILE + Lógica del Mínimo Común Múltiplo
-- EXPLICACIÓN: Encuentra el MCM de 12 y 18 empezando desde el 
--              mayor de ambos números y sumando sucesivamente
--              este valor máximo hasta que se cumpla que el residuo 
--              de la división con ambos números sea exactamente cero.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 18/02/2026
   Descripción: MCM incrementando el mayor hasta encontrar múltiplo común
*/
    vn_num1  NUMBER := 12;
    vn_num2  NUMBER := 18;
    vn_mayor NUMBER;
    vn_mcm   NUMBER;
BEGIN
    IF vn_num1 > vn_num2 THEN
        vn_mayor := vn_num1;
    ELSE
        vn_mayor := vn_num2;
    END IF;

    vn_mcm := vn_mayor;

    WHILE MOD(vn_mcm, vn_num1) != 0 OR MOD(vn_mcm, vn_num2) != 0 LOOP
        vn_mcm := vn_mcm + vn_mayor;
    END LOOP;

    dbms_output.put_line('El MCM de ' || vn_num1 || ' y ' || vn_num2 || ' es: ' || vn_mcm);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 3.3b: MCM con algoritmo de Euclides (MCD)
-- CONCEPTO  : Algoritmo de Euclides para MCD + Cálculo de MCM
-- EXPLICACIÓN: Utiliza el bucle WHILE para aplicar el algoritmo
--              de Euclides y obtener el Máximo Común Divisor (MCD).
--              Posteriormente, calcula el MCM mediante la fórmula:
--              MCM = (A * B) / MCD. Esta aproximación es mucho
--              más eficiente y escalable para números grandes.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 18/02/2026
   Descripción: MCM usando el Máximo Común Divisor con algoritmo de Euclides
*/
    a   NUMBER := 12;
    b   NUMBER := 18;
    mcd NUMBER;
    mcm NUMBER;
    x   NUMBER;
    y   NUMBER;
BEGIN
    x := a;
    y := b;
    WHILE y != 0 LOOP
        mcd := MOD(x, y);
        x   := y;
        y   := mcd;
    END LOOP;

    mcd := x;
    mcm := (a * b) / mcd;
    dbms_output.put_line('El MCM es: ' || mcm);
END;
/


-- ============================================================
-- SECCIÓN 4: PROCEDIMIENTOS ALMACENADOS
-- Concepto general: CREATE OR REPLACE PROCEDURE, parámetros
--                   IN con DEFAULT y funciones de fecha.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 4.1: SP_holaMundo — procedimiento con parámetro
-- CONCEPTO  : Procedimiento almacenado + Parámetro IN con DEFAULT
-- EXPLICACIÓN: Declara un procedimiento reusable que recibe un 
--              nombre y genera un saludo en consola. Si no se provee 
--              ningún argumento al llamarlo, utiliza el valor 
--              por defecto 'JAIBER'.
-- ----------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_holaMundo (param_nombre IN VARCHAR2 DEFAULT 'JAIBER')
/*
   AUTOR      : Juan Pablo Moreno Castro
   FECHA      : 16/02/2026
   DESCRIPCION: Saluda al nombre recibido; usa 'JAIBER' si no se pasa argumento
*/
IS
    vv_mensaje VARCHAR2(40);
BEGIN
    vv_mensaje := 'Hola el nombre es: ' || param_nombre;
    DBMS_OUTPUT.PUT_LINE(vv_mensaje);
END SP_holaMundo;
/

-- Prueba de ejecución del procedimiento
BEGIN
    SP_holaMundo('DAVID');
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 4.2: Cálculo de fecha con funciones de calendario
-- CONCEPTO  : Funciones de fecha integradas de Oracle
-- EXPLICACIÓN: Utiliza LAST_DAY para determinar el fin de mes, 
--              retrocede 7 días para asegurar estar en la última 
--              semana, busca el próximo viernes con NEXT_DAY 
--              y finalmente suma 2 meses completos con ADD_MONTHS.
-- ----------------------------------------------------------
SELECT ADD_MONTHS(NEXT_DAY(LAST_DAY(SYSDATE) - 7, 'FRIDAY'), 2)
FROM DUAL;


-- ----------------------------------------------------------
-- EJERCICIO 4.3: Plantilla de procedimiento sin parámetros
-- CONCEPTO  : Estructura básica de creación de un procedimiento
-- EXPLICACIÓN: Muestra la sintaxis para definir un procedimiento sin 
--              parámetros. Utiliza la instrucción NULL para que 
--              compile correctamente aun sin tener lógica implementada.
-- ----------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_saludar
/*
   AUTOR      : Juan Pablo Moreno Castro
   FECHA      : 16/02/2026
   DESCRIPCION: Plantilla base — implementación pendiente
*/
IS
BEGIN
    NULL;
END sp_saludar;
/


-- ============================================================
-- SECCIÓN 5: CURSORES EXPLÍCITOS
-- Concepto general: CURSOR, OPEN, FETCH, CLOSE y cursores
--                   con parámetros.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 5.1: Cursor explícito fijo (departamento 80)
-- CONCEPTO  : Ciclo clásico del cursor (DECLARACIÓN → OPEN → FETCH → CLOSE)
-- EXPLICACIÓN: Declara explícitamente un puntero de base de datos
--              para recorrer empleados del departamento 80. Abre 
--              el cursor (OPEN), recupera la primera fila en variables 
--              (FETCH) y cierra el cursor (CLOSE) para liberar memoria.
-- ----------------------------------------------------------
DECLARE
    CURSOR C_MYEMPLOYEES IS
        SELECT First_Name, department_id
        FROM   spinzonv.employees
        WHERE  department_id = 80;

    vv_firtsName    VARCHAR2(30);
    vn_departmentID NUMBER(4, 0);
BEGIN
    OPEN  C_MYEMPLOYEES;
    FETCH C_MYEMPLOYEES INTO vv_firtsName, vn_departmentID;
    dbms_output.put_line(vv_firtsName || ' ' || vn_departmentID);
    CLOSE C_MYEMPLOYEES;
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 5.2: Cursor con parámetro (departamento dinámico)
-- CONCEPTO  : Cursor parametrizado + Variable de sustitución
-- EXPLICACIÓN: Permite pasar un argumento al cursor al abrirlo. 
--              La variable de sustitución &user pide dinámicamente 
--              el código de departamento al usuario al ejecutar 
--              el bloque anónimo.
-- ----------------------------------------------------------
DECLARE
    CURSOR C_MYEMPLOYEES2 (param_department_id IN NUMBER) IS
        SELECT First_Name, department_id
        FROM   spinzonv.employees
        WHERE  department_id = param_department_id;

    vv_firtsName    VARCHAR2(30);
    vn_departmentID NUMBER(4, 0);
BEGIN
    OPEN  C_MYEMPLOYEES2(&user);
    FETCH C_MYEMPLOYEES2 INTO vv_firtsName, vn_departmentID;
    dbms_output.put_line(vv_firtsName || ' ' || vn_departmentID);
    CLOSE C_MYEMPLOYEES2;
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 5.3: Cursor sobre tabla de países
-- CONCEPTO  : Cursor sobre tablas externas a HR
-- EXPLICACIÓN: Muestra el uso de cursores sobre cualquier tabla del 
--              sistema de base de datos actual (tabla personalizada 'pais'), 
--              realizando la lectura e impresión de su primer registro.
-- ----------------------------------------------------------
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 02/03/2026
   Descripción: Cursor que muestra id y nombre de la tabla pais
*/
    CURSOR cursor_paises IS
        SELECT id_pais, nombre_pais
        FROM   pais;

    idr NUMBER(2);
    nom VARCHAR2(40);
BEGIN
    OPEN  cursor_paises;
    FETCH cursor_paises INTO idr, nom;
    DBMS_OUTPUT.PUT_LINE(idr || ' ' || nom);
    CLOSE cursor_paises;
END;
/


-- ============================================================
-- SECCIÓN 6: FUNCIONES
-- Concepto general: CREATE FUNCTION, cláusula RETURN y manejo
--                   de excepción NO_DATA_FOUND.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 6.1: Función para obtener el precio de un producto
-- CONCEPTO  : Funciones almacenadas (RETURN) + Manejo de excepciones
-- EXPLICACIÓN: A diferencia de los procedimientos, una función 
--              retorna obligatoriamente un valor de un tipo específico.
--              Esta función captura de manera interna la excepción 
--              NO_DATA_FOUND para retornar el valor alternativo 0 
--              en caso de que el código de producto consultado no exista.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fm_obtener_precio (
/* Autor: Juan Pablo Moreno Castro
   Fecha: 04/03/2026
   Descripción: Retorna el precio de un producto; devuelve 0 si no existe
*/
    p_producto VARCHAR2
) RETURN NUMBER IS
    result NUMBER;
BEGIN
    SELECT precio
    INTO   result
    FROM   precios_productos
    WHERE  co_producto = p_producto;

    RETURN (result);
EXCEPTION
    WHEN no_data_found THEN
        RETURN 0;
END fm_obtener_precio;
/

-- Bloque anónimo de prueba para la función
DECLARE
/* Autor: Juan Pablo Moreno Castro
   Fecha: 04/03/2026
   Descripción: Prueba de invocación de fm_obtener_precio
*/
    valor NUMBER;
BEGIN
    valor := fm_obtener_precio('000100');
    dbms_output.put_line('Precio: ' || valor);
END;
/


-- ============================================================
-- SECCIÓN 7: MANEJO DE EXCEPCIONES
-- Concepto general: EXCEPTION, RAISE, excepciones predefinidas
--                   (ZERO_DIVIDE), OTHERS y RAISE_APPLICATION_ERROR.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 7.1: Excepción personalizada con RAISE
-- CONCEPTO  : Definición, lanzamiento y captura de excepciones propias
-- EXPLICACIÓN: Declara una excepción local de tipo EXCEPTION y la 
--              lanza explícitamente en el flujo usando RAISE.
--              El bloque EXCEPTION captura tanto este error manual
--              como otros imprevistos mediante la cláusula WHEN OTHERS.
-- ----------------------------------------------------------
DECLARE
    err_num                NUMBER;
    exc_miprimeraexception EXCEPTION;
    err_msg                VARCHAR2(255);
    result                 NUMBER;
BEGIN
    IF 1 = 1 THEN
        RAISE exc_miprimeraexception;
    ELSE
        SELECT 1 / 0 INTO result FROM dual;
    END IF;
EXCEPTION
    WHEN exc_miprimeraexception THEN
        dbms_output.put_line('Penalti para el yuyu');
    WHEN zero_divide THEN
        dbms_output.put_line('Junior no es el papá de nadie');
    WHEN OTHERS THEN
        err_num := SQLCODE;
        err_msg := SQLERRM;
        dbms_output.put_line('Error: ' || TO_CHAR(err_num));
        dbms_output.put_line(err_msg);
END;
/


-- ----------------------------------------------------------
-- EJERCICIO 7.2: RAISE_APPLICATION_ERROR
-- CONCEPTO  : Errores definidos por el usuario con códigos del sistema
-- EXPLICACIÓN: RAISE_APPLICATION_ERROR interrumpe el flujo y lanza un 
--              código de error negativo en el rango -20000 a -20999 
--              junto con un mensaje personalizado. Muy útil para 
--              comunicar reglas de negocio violadas a aplicaciones cliente.
-- ----------------------------------------------------------
DECLARE
    err_num                NUMBER;
    exc_miprimeraexception EXCEPTION;
    err_msg                VARCHAR2(255);
    result                 NUMBER;
BEGIN
    IF 1 = 0 THEN
        RAISE exc_miprimeraexception;
    ELSE
        SELECT 1 / 0 INTO result FROM dual;
    END IF;
EXCEPTION
    WHEN exc_miprimeraexception THEN
        dbms_output.put_line('Penalti para el yuyu');
    WHEN OTHERS THEN
        raise_application_error(-20455, 'Les dije que pongan atención');
END;
/


-- ============================================================
-- SECCIÓN 8: INSERCIÓN MASIVA DE DATOS
-- Concepto general: INSERT ... SELECT con CONNECT BY LEVEL
--                   para generar filas sintéticas y DBMS_RANDOM
--                   para valores aleatorios.
-- ============================================================

-- ----------------------------------------------------------
-- EJERCICIO 8.1: Inserción masiva de 5,000 empleados de prueba
-- CONCEPTO  : CONNECT BY LEVEL + DBMS_RANDOM + Subconsultas aleatorias
-- EXPLICACIÓN: Utiliza la consulta CONNECT BY LEVEL <= 5000 para
--              generar y proyectar 5,000 registros ficticios de forma
--              instantánea en memoria.
--              Genera nombres secuenciales, calcula fechas hacia atrás,
--              emplea DBMS_RANDOM para comisiones y resuelve claves 
--              foráneas (FK) válidas mediante subconsultas ordenadas 
--              de forma aleatoria y limitadas a ROWNUM = 1.
-- ----------------------------------------------------------
-- Mostrar cantidad de empleados actual
SELECT COUNT(*) FROM spinzonv.employees;

-- Inserción masiva de datos sintéticos
INSERT INTO spinzonv.EMPLOYEES (
    EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL,
    PHONE_NUMBER, HIRE_DATE, JOB_ID, SALARY,
    COMMISSION_PCT, MANAGER_ID, DEPARTMENT_ID
)
SELECT
    1000 + LEVEL,
    'Nombre'   || LEVEL,
    'Apellido' || LEVEL,
    'EMP'      || (1000 + LEVEL),
    '300'      || LPAD(LEVEL, 7, '0'),
    SYSDATE    - MOD(LEVEL, 3650),
    'IT_PROG',
    3000       + MOD(LEVEL, 5000),
    CASE
        WHEN MOD(LEVEL, 5) = 0
        THEN ROUND(DBMS_RANDOM.VALUE(0.05, 0.30), 2)
        ELSE NULL
    END,
    (
        SELECT employee_id
        FROM ( SELECT employee_id FROM spinzonv.employees ORDER BY DBMS_RANDOM.VALUE )
        WHERE ROWNUM = 1
    ),
    (
        SELECT department_id
        FROM ( SELECT department_id FROM spinzonv.departments ORDER BY DBMS_RANDOM.VALUE )
        WHERE ROWNUM = 1
    )
FROM dual
CONNECT BY LEVEL <= 5000;

COMMIT;
