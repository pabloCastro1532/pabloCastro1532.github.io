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

type TabId = 'sql' | 'plsql' | 'mongo';

const sqlSections: Section[] = [
  {
    id: 'sql-consultas',
    title: 'Consultas SQL',
    icon: '🔍',
    exercises: [
      {
        id: 'sql-1',
        title: 'Empleados con más de un cargo',
        concept: 'JOIN + GROUP BY + HAVING',
        explanation:
          'Une la tabla de historial de cargos (job_history) con la de empleados (employees) usando employee_id. Agrupa por el nombre e ID del empleado y filtra mediante HAVING para mostrar solo a quienes tienen más de un registro en su historial.',
        code: `SELECT
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
    COUNT(*) > 1;`,
      },
      {
        id: 'sql-2',
        title: 'Empleados en Europa con salario entre $4,000 y $6,000',
        concept: 'JOIN en cadena (5 tablas) + WHERE + BETWEEN',
        explanation:
          'Se realiza un JOIN múltiple conectando empleados, departamentos, ubicaciones, países y regiones para identificar la región geográfica del empleado. El filtro WHERE limita los resultados a la región \'Europe\' y a salarios entre 4,000 y 6,000.',
        code: `SELECT
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
    e.salary;`,
      },
      {
        id: 'sql-3',
        title: 'Jerarquía de empleados con emails enmascarados',
        concept: 'LEFT JOIN reflexivo (Self-Join) + LPAD + SUBSTR',
        explanation:
          'Se une la tabla employees consigo misma para relacionar a cada empleado con su jefe (manager). Se formatea el correo electrónico extrayendo los 3 primeros caracteres con SUBSTR y rellenando con asteriscos a la izquierda con LPAD para ocultar la información sensible.',
        code: `SELECT
    e.first_name || ' ' || e.last_name       AS empleado,
    lpad(substr(e.email, 1, 3), 9, '*')      AS email_empleado,
    m.first_name || ' ' || m.last_name       AS jefe,
    lpad(substr(m.email, 1, 3), 9, '*')      AS email_jefe
FROM
    hr.employees e
    LEFT JOIN hr.employees m ON e.manager_id = m.employee_id
ORDER BY
    e.last_name;`,
      },
    ],
  },
];

const plsqlSections: Section[] = [
  {
    id: 'plsql-vars',
    title: 'Variables y Tipos de Datos',
    icon: '📦',
    exercises: [
      {
        id: 'pl-2.1',
        title: 'Hola Mundo — bloque mínimo sin variables',
        concept: 'Estructura básica de un bloque PL/SQL anónimo',
        explanation:
          'Muestra la estructura más elemental de PL/SQL, la cual no requiere sección DECLARE si no hay variables. Usa DBMS_OUTPUT.PUT_LINE para imprimir el texto.',
        code: `BEGIN
    dbms_output.put_line('Hola Mundo');
END;
/`,
      },
      {
        id: 'pl-2.2',
        title: 'Variable declarada y asignada en BEGIN',
        concept: 'DECLARE + asignación con :=',
        explanation:
          'Declaración de una variable VARCHAR2 de longitud 50. La asignación del valor se realiza dentro de la sección ejecutable (BEGIN..END) utilizando el operador :=.',
        code: `DECLARE
    vv_miprimeravariable VARCHAR2(50);
BEGIN
    vv_miprimeravariable := 'Hola Mundo';
    dbms_output.put_line(vv_miprimeravariable);
END;
/`,
      },
      {
        id: 'pl-2.3',
        title: 'Variable inicializada en DECLARE',
        concept: 'Inicialización directa con := en la declaración',
        explanation:
          'Demuestra cómo inicializar el valor de una variable directamente al momento de declararla en la sección DECLARE, haciendo el código más limpio.',
        code: `DECLARE
    vv_miprimeravariable VARCHAR2(50) := 'Hola Mundo';
BEGIN
    dbms_output.put_line(vv_miprimeravariable);
END;
/`,
      },
      {
        id: 'pl-2.4',
        title: 'Variable con valor de cadena',
        concept: 'Declaración de VARCHAR2',
        explanation:
          'Declaración e impresión de una variable de tipo cadena (VARCHAR2) inicializada con el texto \'valentina\'.',
        code: `DECLARE
    vv_variable VARCHAR2(50) := 'valentina';
BEGIN
    dbms_output.put_line(vv_variable);
END;
/`,
      },
      {
        id: 'pl-2.5',
        title: 'SELECT INTO con variables escalares',
        concept: 'SELECT INTO para asignar valores de la BD a variables',
        explanation:
          'Ejecuta una consulta SELECT para obtener el primer_nombre y apellido de un empleado con ID 110 y los guarda en variables locales mediante la cláusula INTO.',
        code: `DECLARE
    vv_nombre   VARCHAR2(50);
    vv_apellido VARCHAR2(50);
BEGIN
    SELECT first_name, last_name
    INTO   vv_nombre, vv_apellido
    FROM   hr.employees
    WHERE  employee_id = 110;

    dbms_output.put_line('El nombre del empleado es: '
        || vv_nombre || ' ' || vv_apellido);
END;
/`,
      },
      {
        id: 'pl-2.6',
        title: 'SELECT INTO con %TYPE (tipo ancla)',
        concept: 'Atributo %TYPE para tipado dinámico',
        explanation:
          'El atributo %TYPE asocia dinámicamente el tipo de la variable al tipo de datos de la columna de la tabla. Si el tipo de columna cambia en la BD, el programa se adapta automáticamente sin requerir mantenimiento.',
        code: `DECLARE
    vv_nombre   hr.employees.first_name%TYPE;
    vv_apellido hr.employees.last_name%TYPE;
BEGIN
    SELECT first_name, last_name
    INTO   vv_nombre, vv_apellido
    FROM   hr.employees
    WHERE  employee_id = 110;

    dbms_output.put_line('El nombre del empleado es: '
        || vv_nombre || ' ' || vv_apellido);
END;
/`,
      },
      {
        id: 'pl-2.7',
        title: 'SELECT INTO con %ROWTYPE (fila completa)',
        concept: 'Atributo %ROWTYPE para registros completos',
        explanation:
          'Define un registro que representa una fila completa de la tabla employees. Permite recuperar y manejar todos los campos de una fila en una única variable usando la notación de punto (variable.campo).',
        code: `DECLARE
    vv_empleado hr.employees%ROWTYPE;
BEGIN
    SELECT *
    INTO   vv_empleado
    FROM   hr.employees
    WHERE  employee_id = 110;

    dbms_output.put_line('El nombre del empleado es: '
        || vv_empleado.first_name || ' '
        || vv_empleado.last_name);
END;
/`,
      },
    ],
  },
  {
    id: 'plsql-control',
    title: 'Estructuras de Control',
    icon: '🔄',
    exercises: [
      {
        id: 'pl-3.1a',
        title: 'Día actual — número primo (versión con IN)',
        concept: 'IF-THEN-ELSE + Operador IN',
        explanation:
          'Extrae el día del mes actual como un número y verifica si pertenece al conjunto predefinido de números primos de un mes de hasta 31 días utilizando la cláusula IN.',
        code: `DECLARE
    vd_current_date NUMBER := TO_NUMBER(TO_CHAR(SYSDATE, 'DD'));
BEGIN
    IF vd_current_date IN (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31) THEN
        dbms_output.put_line('HOLA PRIMO');
    ELSE
        dbms_output.put_line('NO ES PRIMO');
    END IF;
END;
/`,
      },
      {
        id: 'pl-3.1b',
        title: 'Día actual — número primo (versión ELSIF)',
        concept: 'IF - ELSIF - ELSE + Función MOD',
        explanation:
          'Determina si el día del mes actual es primo mediante lógica matemática: excluye menores o iguales a 1, hace caso especial para el número 2, descarta los números pares usando MOD(dia, 2) = 0.',
        code: `DECLARE
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
/`,
      },
      {
        id: 'pl-3.2',
        title: 'Serie de Fibonacci hasta 100',
        concept: 'Bucle LOOP + EXIT WHEN',
        explanation:
          'Genera la sucesión de Fibonacci de manera iterativa. El bucle ejecuta la suma acumulativa de los dos términos anteriores y se interrumpe con EXIT WHEN tan pronto como el término actual supera el valor 100.',
        code: `DECLARE
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
/`,
      },
      {
        id: 'pl-3.3a',
        title: 'MCM — búsqueda por múltiplos (WHILE)',
        concept: 'Bucle WHILE + Mínimo Común Múltiplo',
        explanation:
          'Encuentra el MCM de 12 y 18 empezando desde el mayor de ambos números y sumando sucesivamente este valor máximo hasta que se cumpla que el residuo de la división con ambos números sea exactamente cero.',
        code: `DECLARE
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

    WHILE MOD(vn_mcm, vn_num1) != 0
       OR MOD(vn_mcm, vn_num2) != 0 LOOP
        vn_mcm := vn_mcm + vn_mayor;
    END LOOP;

    dbms_output.put_line('El MCM de '
        || vn_num1 || ' y ' || vn_num2
        || ' es: ' || vn_mcm);
END;
/`,
      },
      {
        id: 'pl-3.3b',
        title: 'MCM con algoritmo de Euclides (MCD)',
        concept: 'Algoritmo de Euclides para MCD + MCM',
        explanation:
          'Utiliza el bucle WHILE para aplicar el algoritmo de Euclides y obtener el Máximo Común Divisor (MCD). Posteriormente, calcula el MCM mediante la fórmula: MCM = (A * B) / MCD. Esta aproximación es mucho más eficiente para números grandes.',
        code: `DECLARE
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
/`,
      },
    ],
  },
  {
    id: 'plsql-procedures',
    title: 'Procedimientos Almacenados',
    icon: '⚙️',
    exercises: [
      {
        id: 'pl-4.1',
        title: 'SP_holaMundo — procedimiento con parámetro',
        concept: 'Procedimiento almacenado + Parámetro IN con DEFAULT',
        explanation:
          'Declara un procedimiento reusable que recibe un nombre y genera un saludo en consola. Si no se provee ningún argumento al llamarlo, utiliza el valor por defecto \'JAIBER\'.',
        code: `CREATE OR REPLACE PROCEDURE SP_holaMundo (
    param_nombre IN VARCHAR2 DEFAULT 'JAIBER'
)
IS
    vv_mensaje VARCHAR2(40);
BEGIN
    vv_mensaje := 'Hola el nombre es: ' || param_nombre;
    DBMS_OUTPUT.PUT_LINE(vv_mensaje);
END SP_holaMundo;
/

-- Prueba de ejecución
BEGIN
    SP_holaMundo('DAVID');
END;
/`,
      },
      {
        id: 'pl-4.2',
        title: 'Cálculo de fecha con funciones de calendario',
        concept: 'Funciones de fecha integradas de Oracle',
        explanation:
          'Utiliza LAST_DAY para determinar el fin de mes, retrocede 7 días para asegurar estar en la última semana, busca el próximo viernes con NEXT_DAY y finalmente suma 2 meses completos con ADD_MONTHS.',
        code: `SELECT ADD_MONTHS(
    NEXT_DAY(LAST_DAY(SYSDATE) - 7, 'FRIDAY'),
    2
)
FROM DUAL;`,
      },
      {
        id: 'pl-4.3',
        title: 'Plantilla de procedimiento sin parámetros',
        concept: 'Estructura básica de creación de un procedimiento',
        explanation:
          'Muestra la sintaxis para definir un procedimiento sin parámetros. Utiliza la instrucción NULL para que compile correctamente aun sin tener lógica implementada.',
        code: `CREATE OR REPLACE PROCEDURE sp_saludar
IS
BEGIN
    NULL;
END sp_saludar;
/`,
      },
    ],
  },
  {
    id: 'plsql-cursors',
    title: 'Cursores Explícitos',
    icon: '📍',
    exercises: [
      {
        id: 'pl-5.1',
        title: 'Cursor explícito fijo (departamento 80)',
        concept: 'Ciclo clásico del cursor (OPEN → FETCH → CLOSE)',
        explanation:
          'Declara explícitamente un puntero de base de datos para recorrer empleados del departamento 80. Abre el cursor (OPEN), recupera la primera fila en variables (FETCH) y cierra el cursor (CLOSE) para liberar memoria.',
        code: `DECLARE
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
/`,
      },
      {
        id: 'pl-5.2',
        title: 'Cursor con parámetro (departamento dinámico)',
        concept: 'Cursor parametrizado + Variable de sustitución',
        explanation:
          'Permite pasar un argumento al cursor al abrirlo. La variable de sustitución &user pide dinámicamente el código de departamento al usuario al ejecutar el bloque anónimo.',
        code: `DECLARE
    CURSOR C_MYEMPLOYEES2 (
        param_department_id IN NUMBER
    ) IS
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
/`,
      },
      {
        id: 'pl-5.3',
        title: 'Cursor sobre tabla de países',
        concept: 'Cursor sobre tablas externas a HR',
        explanation:
          'Muestra el uso de cursores sobre cualquier tabla del sistema de base de datos actual (tabla personalizada \'pais\'), realizando la lectura e impresión de su primer registro.',
        code: `DECLARE
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
/`,
      },
    ],
  },
  {
    id: 'plsql-functions',
    title: 'Funciones',
    icon: '🧮',
    exercises: [
      {
        id: 'pl-6.1',
        title: 'Función para obtener el precio de un producto',
        concept: 'Funciones almacenadas (RETURN) + Manejo de excepciones',
        explanation:
          'A diferencia de los procedimientos, una función retorna obligatoriamente un valor de un tipo específico. Esta función captura de manera interna la excepción NO_DATA_FOUND para retornar el valor alternativo 0 en caso de que el código de producto consultado no exista.',
        code: `CREATE OR REPLACE FUNCTION fm_obtener_precio (
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

-- Bloque de prueba
DECLARE
    valor NUMBER;
BEGIN
    valor := fm_obtener_precio('000100');
    dbms_output.put_line('Precio: ' || valor);
END;
/`,
      },
    ],
  },
  {
    id: 'plsql-exceptions',
    title: 'Manejo de Excepciones',
    icon: '🛡️',
    exercises: [
      {
        id: 'pl-7.1',
        title: 'Excepción personalizada con RAISE',
        concept: 'Definición, lanzamiento y captura de excepciones propias',
        explanation:
          'Declara una excepción local de tipo EXCEPTION y la lanza explícitamente en el flujo usando RAISE. El bloque EXCEPTION captura tanto este error manual como otros imprevistos mediante la cláusula WHEN OTHERS.',
        code: `DECLARE
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
/`,
      },
      {
        id: 'pl-7.2',
        title: 'RAISE_APPLICATION_ERROR',
        concept: 'Errores definidos por el usuario con códigos del sistema',
        explanation:
          'RAISE_APPLICATION_ERROR interrumpe el flujo y lanza un código de error negativo en el rango -20000 a -20999 junto con un mensaje personalizado. Muy útil para comunicar reglas de negocio violadas a aplicaciones cliente.',
        code: `DECLARE
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
        raise_application_error(
            -20455,
            'Les dije que pongan atención'
        );
END;
/`,
      },
    ],
  },
  {
    id: 'plsql-bulk',
    title: 'Inserción Masiva de Datos',
    icon: '📊',
    exercises: [
      {
        id: 'pl-8.1',
        title: 'Inserción masiva de 5,000 empleados de prueba',
        concept: 'CONNECT BY LEVEL + DBMS_RANDOM + Subconsultas',
        explanation:
          'Utiliza la consulta CONNECT BY LEVEL <= 5000 para generar 5,000 registros ficticios. Genera nombres secuenciales, calcula fechas hacia atrás, emplea DBMS_RANDOM para comisiones y resuelve claves foráneas (FK) válidas mediante subconsultas aleatorias.',
        code: `INSERT INTO spinzonv.EMPLOYEES (
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
        FROM (
            SELECT employee_id
            FROM spinzonv.employees
            ORDER BY DBMS_RANDOM.VALUE
        )
        WHERE ROWNUM = 1
    ),
    (
        SELECT department_id
        FROM (
            SELECT department_id
            FROM spinzonv.departments
            ORDER BY DBMS_RANDOM.VALUE
        )
        WHERE ROWNUM = 1
    )
FROM dual
CONNECT BY LEVEL <= 5000;

COMMIT;`,
      },
    ],
  },
];

const mongoSections: Section[] = [
  {
    id: 'mongo-collections',
    title: 'Colecciones del Mundial 2026',
    icon: '🏆',
    exercises: [
      {
        id: 'mongo-db',
        title: 'Crear Base de Datos — mundial2026',
        concept: 'Selección y creación implícita de base de datos',
        explanation:
          'use("mundial2026"); cambia a la BD especificada. En MongoDB, la base de datos y sus colecciones no necesitan definirse previamente; se crean de forma implícita tan pronto como se inserta el primer documento.',
        code: `use("mundial2026");`,
      },
      {
        id: 'mongo-selecciones',
        title: 'Colección: selecciones',
        concept: 'insertMany — Inserción de múltiples documentos',
        explanation:
          'Registra un conjunto de selecciones de fútbol. Cada selección se define como un objeto JSON. Campos: continente, pais, capital, poblacion, colorCamiseta, mundialesGanados. MongoDB asigna automáticamente una clave primaria única llamada _id (de tipo ObjectId) a cada documento.',
        code: `db.selecciones.insertMany([
    { continente: "América del Sur",   pais: "Colombia",
      capital: "Bogotá",        poblacion: 60000000,
      colorCamiseta: "Amarillo", mundialesGanados: 0 },
    { continente: "Europa",            pais: "Inglaterra",
      capital: "Londres",       poblacion: 56000000,
      colorCamiseta: "Blanco",   mundialesGanados: 1 },
    { continente: "África",            pais: "República del Congo",
      capital: "Brazzaville",   poblacion: 5500000,
      colorCamiseta: "Rojo",     mundialesGanados: 0 },
    { continente: "América del Sur",   pais: "Argentina",
      capital: "Buenos Aires",  poblacion: 46000000,
      colorCamiseta: "Celeste", mundialesGanados: 3 },
    { continente: "América del Sur",   pais: "Brasil",
      capital: "Brasilia",      poblacion: 214000000,
      colorCamiseta: "Amarillo", mundialesGanados: 5 },
    { continente: "Europa",            pais: "Francia",
      capital: "París",         poblacion: 67000000,
      colorCamiseta: "Azul",     mundialesGanados: 2 },
    { continente: "Europa",            pais: "España",
      capital: "Madrid",        poblacion: 48000000,
      colorCamiseta: "Rojo",     mundialesGanados: 1 },
    { continente: "Europa",            pais: "Alemania",
      capital: "Berlín",        poblacion: 83000000,
      colorCamiseta: "Blanco",   mundialesGanados: 4 },
    { continente: "América del Norte", pais: "México",
      capital: "Ciudad de México", poblacion: 126000000,
      colorCamiseta: "Verde",    mundialesGanados: 0 },
    { continente: "Asia",              pais: "Japón",
      capital: "Tokio",         poblacion: 125000000,
      colorCamiseta: "Azul",     mundialesGanados: 0 }
]);`,
      },
      {
        id: 'mongo-jugadores',
        title: 'Colección: jugadores',
        concept: 'Documentos con tipos de datos heterogéneos',
        explanation:
          'Se guardan los perfiles de jugadores destacados. El motor schema-less (sin esquema rígido) de MongoDB permite que las propiedades varíen o que se incluyan números y texto indistintamente. Campos: nombre, apellido, nacionalidad, club, rol, golesSeleccion.',
        code: `db.jugadores.insertMany([
    { nombre: "James",     apellido: "Rodriguez",
      nacionalidad: "Colombia", club: "Minnesota United F.C.",
      rol: "Mediocentro ofensivo", golesSeleccion: 31  },
    { nombre: "Lionel",    apellido: "Messi",
      nacionalidad: "Argentina", club: "Inter Miami",
      rol: "Delantero",           golesSeleccion: 106 },
    { nombre: "Cristiano", apellido: "Ronaldo",
      nacionalidad: "Portugal",  club: "Al-Nassr",
      rol: "Delantero",           golesSeleccion: 128 },
    { nombre: "Robert",    apellido: "Lewandowski",
      nacionalidad: "Polonia",   club: "FC Barcelona",
      rol: "Delantero",           golesSeleccion: 82  },
    { nombre: "Kylian",    apellido: "Mbappé",
      nacionalidad: "Francia",   club: "PSG",
      rol: "Delantero",           golesSeleccion: 46  },
    { nombre: "Neymar",    apellido: "Jr",
      nacionalidad: "Brasil",    club: "Al-Hilal",
      rol: "Delantero",           golesSeleccion: 79  },
    { nombre: "Luka",      apellido: "Modric",
      nacionalidad: "Croacia",   club: "Real Madrid",
      rol: "Mediocampista",       golesSeleccion: 24  },
    { nombre: "Kevin",     apellido: "De Bruyne",
      nacionalidad: "Bélgica",   club: "Manchester City",
      rol: "Mediocampista",       golesSeleccion: 27  },
    { nombre: "Erling",    apellido: "Haaland",
      nacionalidad: "Noruega",   club: "Manchester City",
      rol: "Delantero",           golesSeleccion: 27  },
    { nombre: "Luis",      apellido: "Díaz",
      nacionalidad: "Colombia",  club: "Liverpool",
      rol: "Extremo",             golesSeleccion: 14  }
]);`,
      },
      {
        id: 'mongo-estadios',
        title: 'Colección: estadios',
        concept: 'Datos numéricos (capacidad) para consultas de rango',
        explanation:
          'Registra los estadios donde se jugarán los partidos. El campo \'capacidad\' se define como un valor numérico entero, lo cual hace posible ejecutar filtros avanzados de rangos numéricos como $gt (mayor que) o $lt (menor que) en futuras consultas.',
        code: `db.estadios.insertMany([
    { nombre: "MetLife Stadium", pais: "Estados Unidos",
      ciudad: "Nueva York",   capacidad: 82500 },
    { nombre: "Azteca",          pais: "México",
      ciudad: "CDMX",         capacidad: 87000 },
    { nombre: "Camp Nou",        pais: "España",
      ciudad: "Barcelona",    capacidad: 99000 },
    { nombre: "Wembley",         pais: "Inglaterra",
      ciudad: "Londres",      capacidad: 90000 },
    { nombre: "Maracaná",        pais: "Brasil",
      ciudad: "Río",          capacidad: 78000 },
    { nombre: "Allianz Arena",   pais: "Alemania",
      ciudad: "Múnich",       capacidad: 75000 },
    { nombre: "Stade de France", pais: "Francia",
      ciudad: "París",        capacidad: 80000 },
    { nombre: "San Siro",        pais: "Italia",
      ciudad: "Milán",        capacidad: 76000 },
    { nombre: "Lusail Stadium",  pais: "Qatar",
      ciudad: "Lusail",       capacidad: 88000 },
    { nombre: "Monumental",      pais: "Argentina",
      ciudad: "Buenos Aires", capacidad: 83000 }
]);`,
      },
      {
        id: 'mongo-partidos',
        title: 'Colección: partidos',
        concept: 'Fechas estructuradas (String ISO YYYY-MM-DD)',
        explanation:
          'Organiza el fixture del mundial. Las fechas se guardan en formato estándar ISO 8601 de cadena, asegurando consistencia en la ordenación y legibilidad. En entornos de producción complejos, se recomendaría utilizar el tipo nativo ISODate() de BSON.',
        code: `db.partidos.insertMany([
    { local: "Colombia",  visitante: "Inglaterra",
      estadio: "MetLife Stadium", fecha: "2026-06-15" },
    { local: "Argentina", visitante: "Brasil",
      estadio: "Maracaná",        fecha: "2026-06-16" },
    { local: "Francia",   visitante: "España",
      estadio: "Stade de France", fecha: "2026-06-17" },
    { local: "Alemania",  visitante: "México",
      estadio: "Allianz Arena",   fecha: "2026-06-18" },
    { local: "Japón",     visitante: "Colombia",
      estadio: "Azteca",          fecha: "2026-06-19" },
    { local: "Brasil",    visitante: "España",
      estadio: "Camp Nou",        fecha: "2026-06-20" },
    { local: "Argentina", visitante: "Francia",
      estadio: "Wembley",         fecha: "2026-06-21" },
    { local: "México",    visitante: "Japón",
      estadio: "Lusail Stadium",  fecha: "2026-06-22" },
    { local: "Alemania",  visitante: "Inglaterra",
      estadio: "San Siro",        fecha: "2026-06-23" },
    { local: "Colombia",  visitante: "Brasil",
      estadio: "Monumental",      fecha: "2026-06-24" }
]);`,
      },
      {
        id: 'mongo-grupos',
        title: 'Colección: grupos',
        concept: 'Arrays embebidos (Datos anidados de 1 a N)',
        explanation:
          'Asocia las selecciones que componen cada grupo. A diferencia del modelo relacional SQL (que obligaría a crear una tabla intermedia para romper una relación N:M), MongoDB permite guardar arrays directamente dentro del documento principal. Esto optimiza el rendimiento al evitar operaciones JOIN.',
        code: `db.grupos.insertMany([
    { grupo: "A", equipos: ["México",         "Sudáfrica",
                             "Corea",          "Chequia"] },
    { grupo: "B", equipos: ["Canadá",         "Bosnia",
                             "Qatar",          "Suiza"] },
    { grupo: "C", equipos: ["Brasil",         "Marruecos",
                             "Haití",          "Escocia"] },
    { grupo: "D", equipos: ["Estados Unidos", "Paraguay",
                             "Australia",      "Turquía"] },
    { grupo: "E", equipos: ["Alemania",       "Curazao",
                             "Costa de Marfil","Ecuador"] },
    { grupo: "F", equipos: ["Países Bajos",   "Japón",
                             "Suecia",         "Túnez"] },
    { grupo: "G", equipos: ["Bélgica",        "Egipto",
                             "Irán",           "Nueva Zelanda"] },
    { grupo: "H", equipos: ["España",         "Cabo Verde",
                             "Arabia Saudita", "Uruguay"] },
    { grupo: "I", equipos: ["Francia",        "Senegal",
                             "Irak",           "Noruega"] },
    { grupo: "J", equipos: ["Argentina",      "Argelia",
                             "Austria",        "Jordania"] },
    { grupo: "K", equipos: ["Portugal",       "RD Congo",
                             "Uzbekistán",     "Colombia"] },
    { grupo: "L", equipos: ["Inglaterra",     "Croacia",
                             "Ghana",          "Panamá"] }
]);`,
      },
    ],
  },
];

const tabs: { id: TabId; label: string; sections: Section[]; gradient: string; accent: string; langLabel: string }[] = [
  {
    id: 'sql',
    label: 'SQL',
    sections: sqlSections,
    gradient: 'from-blue-500 to-cyan-400',
    accent: 'text-blue-400',
    langLabel: 'SQL',
  },
  {
    id: 'plsql',
    label: 'PL/SQL',
    sections: plsqlSections,
    gradient: 'from-purple-500 to-violet-400',
    accent: 'text-purple-400',
    langLabel: 'PL/SQL',
  },
  {
    id: 'mongo',
    label: 'MongoDB',
    sections: mongoSections,
    gradient: 'from-emerald-500 to-green-400',
    accent: 'text-emerald-400',
    langLabel: 'JavaScript',
  },
];


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
          id={`copy-${id}`}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>¡Copiado!</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
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
      id={`exercise-${exercise.id}`}
    >
      <button
        className="ev-card-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        id={`toggle-${exercise.id}`}
      >
        <div className="ev-card-header-left">
          <span className="ev-exercise-number">{exercise.id.toUpperCase()}</span>
          <div className="ev-card-title-group">
            <h3 className="ev-card-title">{exercise.title}</h3>
            <span className={`ev-concept-badge ${accentColor}`}>{exercise.concept}</span>
          </div>
        </div>
        <svg
          className={`ev-chevron ${isOpen ? 'ev-chevron-open' : ''}`}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        className="ev-card-content"
        style={{
          maxHeight: isOpen ? `${contentHeight}px` : '0px',
        }}
      >
        <div ref={contentRef} className="ev-card-content-inner">
          <p className="ev-explanation">{exercise.explanation}</p>
          <CodeBlock code={exercise.code} language={language} id={exercise.id} />
        </div>
      </div>
    </div>
  );
}

export default function EvidenciasViewer() {
  const [activeTab, setActiveTab] = useState<TabId>('sql');
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

  const collapseAll = useCallback(() => {
    setOpenCards(new Set());
  }, []);

  return (
    <div className="ev-root">
      <div className="ev-tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`ev-tab ${activeTab === tab.id ? 'ev-tab-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setOpenCards(new Set());
            }}
            id={`tab-${tab.id}`}
          >
            <span className="ev-tab-label">{tab.label}</span>
            {activeTab === tab.id && <div className={`ev-tab-indicator bg-gradient-to-r ${tab.gradient}`} />}
          </button>
        ))}
      </div>

      <div className="ev-toolbar">
        <div className="ev-toolbar-actions">
          <button className="ev-action-btn" onClick={expandAll} id="expand-all" title="Expandir todo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>
            <span>Expandir</span>
          </button>
          <button className="ev-action-btn" onClick={collapseAll} id="collapse-all" title="Colapsar todo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 11l-5-5-5 5M17 18l-5-5-5 5"/></svg>
            <span>Colapsar</span>
          </button>
        </div>
      </div>

      <div className="ev-content" role="tabpanel">
        {currentTab.sections.map((section) => (
          <div key={section.id} className="ev-section" id={`section-${section.id}`}>
            <div className="ev-section-header">
              <h2 className="ev-section-title">{section.title}</h2>
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
