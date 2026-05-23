-- ============================================================
-- TALLER AVANZADO PL/SQL — SISTEMA DE LIQUIDACION DE NOMINA
-- HotelGroup S.A. — Oracle Database 19c
-- Integrante 1: Juan Pablo Moreno Castro
-- Integrante 2: Maria Valentina Osorio Romero
-- Materia: Bases de Datos 2
-- ============================================================

-- ============================================================
-- SETUP: Limpieza previa y creacion de tablas
-- ============================================================
BEGIN
  FOR r IN (SELECT table_name FROM user_tables WHERE table_name IN (
    'PARAMETROS','SEDES','EMPLEADOS','HORAS_TRABAJADAS','SANCIONES',
    'LIBRANZAS','EMBARGOS','LIQUIDACION','LOG_NOMINA'
  )) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE ' || r.table_name || ' CASCADE CONSTRAINTS PURGE';
  END LOOP;
  FOR r IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
    'SEQ_LIQUIDACION','SEQ_LOG'
  )) LOOP
    EXECUTE IMMEDIATE 'DROP SEQUENCE ' || r.sequence_name;
  END LOOP;
END;
/

BEGIN
  FOR r IN (SELECT object_name, object_type FROM user_objects WHERE object_name IN (
    'PKG_NOMINA','TRG_LIQUIDACION_COMPOUND',
    'FN_SALARIO_BASE_Q','FN_RECARGOS','FN_BONIFICACION','FN_BRUTO',
    'SP_LIQUIDAR_EMPLEADO',
    'T_CONCEPTO_LIQ_OBJ','T_LISTA_LIQ_PIPE'
  )) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP ' || r.object_type || ' ' || r.object_name
                        || CASE r.object_type WHEN 'TYPE' THEN ' FORCE' ELSE '' END;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/

-- ============================================================
-- TABLAS
-- ============================================================
CREATE TABLE PARAMETROS (
  cod_parametro   VARCHAR2(30) PRIMARY KEY,
  valor_numerico  NUMBER(15,2),
  descripcion     VARCHAR2(100)
);

INSERT INTO PARAMETROS VALUES ('SMLMV',                 1423500, 'Salario Minimo Legal Mensual Vigente 2026');
INSERT INTO PARAMETROS VALUES ('AUX_TRANSPORTE',          200000, 'Auxilio de Transporte Mensual 2026');
INSERT INTO PARAMETROS VALUES ('PCT_SALUD',                    4, 'Porcentaje aporte salud empleado');
INSERT INTO PARAMETROS VALUES ('PCT_PENSION',                  4, 'Porcentaje aporte pension empleado');
INSERT INTO PARAMETROS VALUES ('PCT_FONDO_SOLIDARIDAD',        1, 'Porcentaje fondo solidaridad (>4 SMLMV)');
INSERT INTO PARAMETROS VALUES ('UMBRAL_FONDO_SMLMV',           4, 'Numero de SMLMV para fondo solidaridad');
INSERT INTO PARAMETROS VALUES ('RECARGO_NOCTURNO',            35, 'Porcentaje recargo hora nocturna');
INSERT INTO PARAMETROS VALUES ('RECARGO_DOMINICAL',           75, 'Porcentaje recargo hora dominical');
INSERT INTO PARAMETROS VALUES ('RECARGO_NOCT_DOM',           110, 'Porcentaje recargo nocturno dominical');
INSERT INTO PARAMETROS VALUES ('RET_SERVICIOS',               11, 'Porcentaje retencion prestacion servicios');
INSERT INTO PARAMETROS VALUES ('BONO_CLIMA_SMA',           80000, 'Bono clima quincenal sede Santa Marta');
INSERT INTO PARAMETROS VALUES ('APORTE_VOL_BOG',           20000, 'Aporte voluntario quincenal sede Bogota');
COMMIT;

CREATE TABLE SEDES (
  cod_sede    VARCHAR2(5) PRIMARY KEY,
  nombre_sede VARCHAR2(50),
  ciudad      VARCHAR2(50)
);
INSERT INTO SEDES VALUES ('BOG', 'Hotel Capital',   'Bogota');
INSERT INTO SEDES VALUES ('MED', 'Hotel Montana',   'Medellin');
INSERT INTO SEDES VALUES ('SMA', 'Hotel Playa',     'Santa Marta');
INSERT INTO SEDES VALUES ('CTG', 'Hotel Colonial',  'Cartagena');
COMMIT;

CREATE TABLE EMPLEADOS (
  id_empleado       NUMBER(6) PRIMARY KEY,
  nombre            VARCHAR2(80) NOT NULL,
  tipo_contrato     VARCHAR2(20) NOT NULL CHECK (tipo_contrato IN ('PLANTA','TEMPORAL','SERVICIOS')),
  salario_base      NUMBER(12,2) NOT NULL,
  fecha_ingreso     DATE NOT NULL,
  cod_sede          VARCHAR2(5) REFERENCES SEDES(cod_sede),
  estado            VARCHAR2(10) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
  acepta_aporte_vol VARCHAR2(1)  DEFAULT 'N'      CHECK (acepta_aporte_vol IN ('S','N'))
);

INSERT INTO EMPLEADOS VALUES (1001, 'Carlos Mendez',     'PLANTA',    2500000, DATE '2018-03-15', 'BOG', 'ACTIVO', 'S');
INSERT INTO EMPLEADOS VALUES (1002, 'Ana Rodriguez',     'PLANTA',    1423500, DATE '2024-06-01', 'BOG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1003, 'Pedro Suarez',      'TEMPORAL',    12500, DATE '2025-01-10', 'BOG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1004, 'Laura Garcia',      'SERVICIOS', 5000000, DATE '2023-04-20', 'BOG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1005, 'Miguel Torres',     'PLANTA',    7200000, DATE '2012-08-01', 'BOG', 'ACTIVO', 'S');
INSERT INTO EMPLEADOS VALUES (1006, 'Sofia Herrera',     'PLANTA',    3200000, DATE '2020-02-14', 'MED', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1007, 'Diego Parra',       'TEMPORAL',    15000, DATE '2024-11-01', 'MED', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1008, 'Andrea Lopez',      'PLANTA',    1800000, DATE '2019-07-22', 'MED', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1009, 'Roberto Castro',    'PLANTA',    2800000, DATE '2016-01-05', 'SMA', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1010, 'Maria Jimenez',     'TEMPORAL',    11000, DATE '2025-09-01', 'SMA', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1011, 'Fernando Rios',     'SERVICIOS', 8000000, DATE '2021-03-15', 'SMA', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1012, 'Camila Vargas',     'PLANTA',    1423500, DATE '2022-05-10', 'SMA', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1013, 'Andres Moreno',     'PLANTA',    4500000, DATE '2015-11-20', 'CTG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1014, 'Valentina Cruz',    'TEMPORAL',    13500, DATE '2023-08-15', 'CTG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1015, 'Jorge Ramirez',     'PLANTA',    2200000, DATE '2021-04-01', 'CTG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1016, 'Sandra Mejia',      'TEMPORAL',    14000, DATE '2019-06-12', 'BOG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1017, 'Ricardo Ortiz',     'PLANTA',    1500000, DATE '2020-03-01', 'MED', 'INACTIVO','N');
INSERT INTO EMPLEADOS VALUES (1018, 'Patricia Luna',     'PLANTA',    1600000, DATE '2024-02-15', 'CTG', 'ACTIVO', 'N');
INSERT INTO EMPLEADOS VALUES (1019, 'Hector Diaz',       'SERVICIOS', 6500000, DATE '2022-09-01', 'BOG', 'ACTIVO', 'N');
COMMIT;

CREATE TABLE HORAS_TRABAJADAS (
  id_empleado    NUMBER(6) REFERENCES EMPLEADOS(id_empleado),
  id_quincena    VARCHAR2(15),
  tipo_hora      VARCHAR2(20) CHECK (tipo_hora IN ('NORMAL','NOCTURNA','DOMINICAL','NOCTURNA_DOM')),
  cantidad_horas NUMBER(5,1),
  CONSTRAINT pk_horas PRIMARY KEY (id_empleado, id_quincena, tipo_hora)
);

INSERT INTO HORAS_TRABAJADAS VALUES (1001,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1001,'2026-Q1-ENE','NOCTURNA',10);
INSERT INTO HORAS_TRABAJADAS VALUES (1001,'2026-Q1-ENE','DOMINICAL',8);
INSERT INTO HORAS_TRABAJADAS VALUES (1001,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1002,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1002,'2026-Q1-ENE','NOCTURNA',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1002,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1002,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1003,'2026-Q1-ENE','NORMAL',120);
INSERT INTO HORAS_TRABAJADAS VALUES (1003,'2026-Q1-ENE','NOCTURNA',15);
INSERT INTO HORAS_TRABAJADAS VALUES (1003,'2026-Q1-ENE','DOMINICAL',8);
INSERT INTO HORAS_TRABAJADAS VALUES (1003,'2026-Q1-ENE','NOCTURNA_DOM',4);
INSERT INTO HORAS_TRABAJADAS VALUES (1005,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1005,'2026-Q1-ENE','NOCTURNA',5);
INSERT INTO HORAS_TRABAJADAS VALUES (1005,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1005,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1006,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1006,'2026-Q1-ENE','NOCTURNA',12);
INSERT INTO HORAS_TRABAJADAS VALUES (1006,'2026-Q1-ENE','DOMINICAL',6);
INSERT INTO HORAS_TRABAJADAS VALUES (1006,'2026-Q1-ENE','NOCTURNA_DOM',3);
INSERT INTO HORAS_TRABAJADAS VALUES (1007,'2026-Q1-ENE','NORMAL',96);
INSERT INTO HORAS_TRABAJADAS VALUES (1007,'2026-Q1-ENE','NOCTURNA',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1007,'2026-Q1-ENE','DOMINICAL',16);
INSERT INTO HORAS_TRABAJADAS VALUES (1007,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1009,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1009,'2026-Q1-ENE','NOCTURNA',8);
INSERT INTO HORAS_TRABAJADAS VALUES (1009,'2026-Q1-ENE','DOMINICAL',10);
INSERT INTO HORAS_TRABAJADAS VALUES (1009,'2026-Q1-ENE','NOCTURNA_DOM',5);
INSERT INTO HORAS_TRABAJADAS VALUES (1010,'2026-Q1-ENE','NORMAL',80);
INSERT INTO HORAS_TRABAJADAS VALUES (1010,'2026-Q1-ENE','NOCTURNA',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1010,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1010,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1012,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1012,'2026-Q1-ENE','NOCTURNA',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1012,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1012,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1013,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1013,'2026-Q1-ENE','NOCTURNA',6);
INSERT INTO HORAS_TRABAJADAS VALUES (1013,'2026-Q1-ENE','DOMINICAL',4);
INSERT INTO HORAS_TRABAJADAS VALUES (1013,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1014,'2026-Q1-ENE','NORMAL',110);
INSERT INTO HORAS_TRABAJADAS VALUES (1014,'2026-Q1-ENE','NOCTURNA',20);
INSERT INTO HORAS_TRABAJADAS VALUES (1014,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1014,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1016,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1016,'2026-Q1-ENE','NOCTURNA',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1016,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1016,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1018,'2026-Q1-ENE','NORMAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1018,'2026-Q1-ENE','NOCTURNA',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1018,'2026-Q1-ENE','DOMINICAL',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1018,'2026-Q1-ENE','NOCTURNA_DOM',0);
INSERT INTO HORAS_TRABAJADAS VALUES (1019,'2026-Q1-ENE','NORMAL',50);
INSERT INTO HORAS_TRABAJADAS VALUES (1019,'2026-Q1-ENE','NOCTURNA',20);
INSERT INTO HORAS_TRABAJADAS VALUES (1019,'2026-Q1-ENE','DOMINICAL',10);
INSERT INTO HORAS_TRABAJADAS VALUES (1019,'2026-Q1-ENE','NOCTURNA_DOM',5);
COMMIT;

CREATE TABLE SANCIONES (
  id_sancion    NUMBER(6) PRIMARY KEY,
  id_empleado   NUMBER(6) REFERENCES EMPLEADOS(id_empleado),
  fecha_sancion DATE,
  motivo        VARCHAR2(200)
);
INSERT INTO SANCIONES VALUES (1, 1006, DATE '2025-09-10', 'Llegada tardia reiterada');
INSERT INTO SANCIONES VALUES (2, 1006, DATE '2025-10-20', 'Ausencia sin justificacion');
INSERT INTO SANCIONES VALUES (3, 1006, DATE '2025-12-05', 'Incumplimiento de protocolo');
INSERT INTO SANCIONES VALUES (4, 1001, DATE '2025-11-15', 'Llegada tardia');
INSERT INTO SANCIONES VALUES (5, 1009, DATE '2024-12-01', 'Uso indebido de equipos');
INSERT INTO SANCIONES VALUES (6, 1009, DATE '2025-01-15', 'Ausencia sin justificacion');
INSERT INTO SANCIONES VALUES (7, 1013, DATE '2025-08-10', 'Conducta inapropiada');
INSERT INTO SANCIONES VALUES (8, 1013, DATE '2025-11-22', 'Llegada tardia');
COMMIT;

CREATE TABLE LIBRANZAS (
  id_libranza     NUMBER(6) PRIMARY KEY,
  id_empleado     NUMBER(6) REFERENCES EMPLEADOS(id_empleado),
  entidad         VARCHAR2(50),
  cuota_mensual   NUMBER(10,2),
  saldo_pendiente NUMBER(12,2),
  estado          VARCHAR2(10) DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','PAGADA','ANULADA'))
);
INSERT INTO LIBRANZAS VALUES (1, 1001, 'Banco Popular',    350000,  4200000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (2, 1005, 'Banco Davivienda', 800000,  9600000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (3, 1005, 'Cooperativa ABC',  200000,  1800000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (4, 1009, 'Banco BBVA',       250000,  3000000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (5, 1013, 'Banco Colpatria',  400000,  4800000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (6, 1018, 'Banco Popular',    500000,  2500000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (7, 1018, 'Cooperativa XYZ',  300000,  1500000, 'ACTIVA');
INSERT INTO LIBRANZAS VALUES (8, 1002, 'Banco Agrario',    100000,   800000, 'ACTIVA');
COMMIT;

CREATE TABLE EMBARGOS (
  id_embargo  NUMBER(6) PRIMARY KEY,
  id_empleado NUMBER(6) REFERENCES EMPLEADOS(id_empleado),
  juzgado     VARCHAR2(100),
  porcentaje  NUMBER(4,1),
  estado      VARCHAR2(10) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','LEVANTADO'))
);
INSERT INTO EMBARGOS VALUES (1, 1005, 'Juzgado 3ro Civil Bogota',       15, 'ACTIVO');
INSERT INTO EMBARGOS VALUES (2, 1013, 'Juzgado 1ro Familia Cartagena',  20, 'ACTIVO');
INSERT INTO EMBARGOS VALUES (3, 1018, 'Juzgado 5to Civil Cartagena',    25, 'ACTIVO');
COMMIT;

CREATE TABLE LIQUIDACION (
  id_liquidacion    NUMBER(10) PRIMARY KEY,
  id_empleado       NUMBER(6)  REFERENCES EMPLEADOS(id_empleado),
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
CREATE SEQUENCE SEQ_LIQUIDACION START WITH 1 INCREMENT BY 1;

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
CREATE SEQUENCE SEQ_LOG START WITH 1 INCREMENT BY 1;


-- ============================================================
-- PUNTO 7 — Types a nivel de schema para funcion pipelined
-- CORRECCION: t_lista_liq es INDEX BY PLS_INTEGER (no puede ser
-- retorno de PIPELINED). Se crean types de schema para la funcion.
-- ============================================================
CREATE OR REPLACE TYPE t_concepto_liq_obj AS OBJECT (
    id_empleado       NUMBER(6),
    id_quincena       VARCHAR2(15),
    salario_base_q    NUMBER(12,2),
    recargos          NUMBER(12,2),
    bonificacion      NUMBER(12,2),
    auxilio_transp    NUMBER(12,2),
    bono_sede         NUMBER(12,2),
    bruto             NUMBER(12,2),
    deduccion_salud   NUMBER(12,2),
    deduccion_pension NUMBER(12,2),
    fondo_solidaridad NUMBER(12,2),
    embargo           NUMBER(12,2),
    libranzas         NUMBER(12,2),
    aporte_voluntario NUMBER(12,2),
    total_deducciones NUMBER(12,2),
    neto              NUMBER(12,2)
);
/

CREATE OR REPLACE TYPE t_lista_liq_pipe AS TABLE OF t_concepto_liq_obj;
/


-- ============================================================
-- PUNTO 1 — Bloque anonimo: Liquidacion individual
-- ============================================================
DECLARE
    vn_id_empleado EMPLEADOS.id_empleado%TYPE   := 1001;
    vv_quincena    VARCHAR2(20)                  := '2026-Q1-ENE';

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
      FROM EMPLEADOS
     WHERE id_empleado = vn_id_empleado;

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
     WHERE id_empleado  = vn_id_empleado
       AND fecha_sancion >= ADD_MONTHS(SYSDATE, -6);

    IF vv_tipo <> 'SERVICIOS' AND vn_sanc <= 2 THEN
        IF    vn_antig BETWEEN 3 AND 5  THEN vn_bonif := vn_base_q * 0.03;
        ELSIF vn_antig BETWEEN 6 AND 10 THEN vn_bonif := vn_base_q * 0.06;
        ELSIF vn_antig > 10             THEN vn_bonif := vn_base_q * 0.10;
        END IF;
    ELSE
        vn_bonif := 0;
    END IF;

    DBMS_OUTPUT.PUT_LINE('=== LIQUIDACION QUINCENAL ===');
    DBMS_OUTPUT.PUT_LINE('Empleado:        ' || vv_nombre || ' (' || vn_id_empleado || ')');
    DBMS_OUTPUT.PUT_LINE('Sede:            ' || vv_sede);
    DBMS_OUTPUT.PUT_LINE('Tipo contrato:   ' || vv_tipo);
    DBMS_OUTPUT.PUT_LINE('Antiguedad:      ' || vn_antig || ' anios');
    DBMS_OUTPUT.PUT_LINE('-----------------------------');
    DBMS_OUTPUT.PUT_LINE('Salario base Q:  ' || TO_CHAR(vn_base_q,   '999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('Recargos:        ' || TO_CHAR(vn_recargos,  '999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('Bonificacion:    ' || TO_CHAR(vn_bonif,     '999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('-----------------------------');
    DBMS_OUTPUT.PUT_LINE('SUBTOTAL:        ' ||
        TO_CHAR(vn_base_q + vn_recargos + vn_bonif, 'FM999,999,999.00'));
    DBMS_OUTPUT.PUT_LINE('=============================');
END;
/


-- ============================================================
-- PUNTO 2 — Funciones standalone encadenadas
-- ============================================================

-- A. fn_salario_base_q — Regla 1
CREATE OR REPLACE FUNCTION fn_salario_base_q (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) RETURN NUMBER
IS
    vv_tipo_contrato EMPLEADOS.tipo_contrato%TYPE;
    vdo_salario_base EMPLEADOS.salario_base%TYPE;
BEGIN
    SELECT tipo_contrato, salario_base
      INTO vv_tipo_contrato, vdo_salario_base
      FROM EMPLEADOS
     WHERE id_empleado = p_id_empleado;

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
            SELECT valor_numerico INTO vdo_ret FROM PARAMETROS WHERE cod_parametro = 'RET_SERVICIOS';
            RETURN ROUND((vdo_salario_base - (vdo_salario_base * vdo_ret / 100)) / 2, 2);
        END;
    END IF;

    RETURN 0;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
    WHEN OTHERS        THEN RAISE;
END fn_salario_base_q;
/

-- B. fn_recargos — Regla 2
CREATE OR REPLACE FUNCTION fn_recargos (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) RETURN NUMBER
IS
    CURSOR cur_horas (cp_emp NUMBER, cp_quin VARCHAR2) IS
        SELECT tipo_hora, cantidad_horas
          FROM HORAS_TRABAJADAS
         WHERE id_empleado    = cp_emp
           AND id_quincena    = cp_quin
           AND tipo_hora     <> 'NORMAL'
           AND cantidad_horas  > 0;

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
                SELECT valor_numerico INTO vdo_pct FROM PARAMETROS WHERE cod_parametro = vv_cod;
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
/

-- C. fn_bonificacion — Regla 3
CREATE OR REPLACE FUNCTION fn_bonificacion (
    p_id_empleado IN NUMBER
) RETURN NUMBER
IS
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
/

-- D. fn_bruto — Reglas 4, 5 y 6
CREATE OR REPLACE FUNCTION fn_bruto (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
) RETURN NUMBER
IS
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

    SELECT valor_numerico INTO vdo_smlmv       FROM PARAMETROS WHERE cod_parametro = 'SMLMV';
    SELECT valor_numerico INTO vdo_aux_mensual FROM PARAMETROS WHERE cod_parametro = 'AUX_TRANSPORTE';
    SELECT valor_numerico INTO vdo_bono_sma    FROM PARAMETROS WHERE cod_parametro = 'BONO_CLIMA_SMA';

    IF vv_tipo_contrato IN ('PLANTA', 'TEMPORAL') THEN
        IF vv_tipo_contrato = 'PLANTA' THEN
            vdo_sal_mens_equiv := vdo_salario_base;
        ELSE
            DECLARE
                vdo_h HORAS_TRABAJADAS.cantidad_horas%TYPE := 0;
            BEGIN
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
/


-- ============================================================
-- PUNTO 3 — Procedimiento con excepciones
-- CORRECCION: se elimina el manejo de neto negativo del procedimiento.
-- El compound trigger (Punto 5) lo captura en BEFORE EACH ROW antes
-- del INSERT y lo ajusta ahi. Duplicarlo aqui hace que el trigger
-- nunca vea un neto negativo real.
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_liquidar_empleado (
    p_id_empleado IN NUMBER,
    p_id_quincena IN VARCHAR2
)
IS
    vv_estado        EMPLEADOS.estado%TYPE;
    vv_tipo          EMPLEADOS.tipo_contrato%TYPE;
    vv_cod_sede      EMPLEADOS.cod_sede%TYPE;
    vv_aporte_vol    EMPLEADOS.acepta_aporte_vol%TYPE;
    vdo_salario_base EMPLEADOS.salario_base%TYPE;

    vn_salario_q     NUMBER := 0;
    vn_recargos      NUMBER := 0;
    vn_bonificacion  NUMBER := 0;
    vn_aux_transp    NUMBER := 0;
    vn_bono_sede     NUMBER := 0;
    vn_bruto         NUMBER := 0;

    vn_salud         NUMBER := 0;
    vn_pension       NUMBER := 0;
    vn_fondo         NUMBER := 0;
    vn_embargo       NUMBER := 0;
    vn_libranzas     NUMBER := 0;
    vn_aporte_vol    NUMBER := 0;
    vn_total_desc    NUMBER := 0;
    vn_neto          NUMBER := 0;

    vn_pct_salud     PARAMETROS.valor_numerico%TYPE;
    vn_pct_pension   PARAMETROS.valor_numerico%TYPE;
    vn_pct_fondo     PARAMETROS.valor_numerico%TYPE;
    vn_umbral        PARAMETROS.valor_numerico%TYPE;
    vn_smlmv         PARAMETROS.valor_numerico%TYPE;
    vn_aporte_fijo   PARAMETROS.valor_numerico%TYPE;
    vn_aux_mensual   PARAMETROS.valor_numerico%TYPE;
    vn_bono_sma      PARAMETROS.valor_numerico%TYPE;

    vn_count              NUMBER;
    vn_sal_mens_equiv     NUMBER := 0;
    vn_horas_normales     HORAS_TRABAJADAS.cantidad_horas%TYPE := 0;
    vn_base_embargo       NUMBER := 0;
BEGIN
    -- Validacion 1: empleado existe
    BEGIN
        SELECT estado, tipo_contrato, cod_sede, acepta_aporte_vol, salario_base
          INTO vv_estado, vv_tipo, vv_cod_sede, vv_aporte_vol, vdo_salario_base
          FROM EMPLEADOS
         WHERE id_empleado = p_id_empleado;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20001, 'Empleado no encontrado: ' || p_id_empleado);
    END;

    -- Validacion 2: debe estar ACTIVO
    IF vv_estado <> 'ACTIVO' THEN
        RAISE_APPLICATION_ERROR(-20002, 'Empleado no activo: estado = ' || vv_estado);
    END IF;

    -- Validacion 3: no existe ya la liquidacion
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
    SELECT valor_numerico INTO vn_aux_mensual FROM PARAMETROS WHERE cod_parametro = 'AUX_TRANSPORTE';
    SELECT valor_numerico INTO vn_bono_sma    FROM PARAMETROS WHERE cod_parametro = 'BONO_CLIMA_SMA';

    vn_salario_q    := fn_salario_base_q(p_id_empleado, p_id_quincena);
    vn_recargos     := fn_recargos(p_id_empleado, p_id_quincena);
    vn_bonificacion := fn_bonificacion(p_id_empleado);

    IF vv_tipo IN ('PLANTA', 'TEMPORAL') THEN
        IF vv_tipo = 'PLANTA' THEN
            vn_sal_mens_equiv := vdo_salario_base;
        ELSE
            BEGIN
                SELECT NVL(cantidad_horas, 0) INTO vn_horas_normales
                  FROM HORAS_TRABAJADAS
                 WHERE id_empleado = p_id_empleado
                   AND id_quincena = p_id_quincena
                   AND tipo_hora   = 'NORMAL';
                vn_sal_mens_equiv := vdo_salario_base * vn_horas_normales * 2;
            EXCEPTION WHEN NO_DATA_FOUND THEN vn_sal_mens_equiv := 0;
            END;
        END IF;
        IF vn_sal_mens_equiv <= (2 * vn_smlmv) THEN
            vn_aux_transp := vn_aux_mensual / 2;
        END IF;
    END IF;

    IF vv_tipo IN ('PLANTA', 'TEMPORAL') AND vv_cod_sede = 'SMA' THEN
        vn_bono_sede := vn_bono_sma;
    END IF;

    vn_bruto := vn_salario_q + vn_recargos + vn_bonificacion
                + vn_aux_transp + vn_bono_sede;

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

    vn_total_desc := vn_salud + vn_pension + vn_fondo
                     + vn_embargo + vn_libranzas + vn_aporte_vol;
    vn_neto       := vn_bruto - vn_total_desc;

    -- NOTA: el compound trigger (Punto 5) maneja el ajuste de neto negativo
    -- en BEFORE EACH ROW antes de que el registro se confirme en la tabla.

    INSERT INTO LIQUIDACION (
        ID_LIQUIDACION, ID_EMPLEADO, ID_QUINCENA,
        SALARIO_BASE_Q, RECARGOS, BONIFICACION, AUXILIO_TRANSP, BONO_SEDE, BRUTO,
        DEDUCCION_SALUD, DEDUCCION_PENSION, FONDO_SOLIDARIDAD,
        EMBARGO, LIBRANZAS, APORTE_VOLUNTARIO,
        TOTAL_DEDUCCIONES, NETO, FECHA_LIQUIDACION
    ) VALUES (
        SEQ_LIQUIDACION.NEXTVAL, p_id_empleado, p_id_quincena,
        vn_salario_q, vn_recargos, vn_bonificacion, vn_aux_transp, vn_bono_sede, vn_bruto,
        vn_salud, vn_pension, vn_fondo,
        vn_embargo, vn_libranzas, vn_aporte_vol,
        vn_total_desc, vn_neto, SYSDATE
    );

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN ROLLBACK; RAISE;
END sp_liquidar_empleado;
/


-- ============================================================
-- PUNTO 4 — Package PKG_NOMINA (spec + body)
-- CORRECCIONES:
--   1. gc_smlmv declarada CONSTANT NUMBER en la spec. En Oracle no es
--      posible inicializar una constante publica de package con una
--      SELECT en la spec. La solucion estandar es declararla con el
--      valor conocido de PARAMETROS; el init block del body la actualiza
--      en la variable privada gr_params. Para cumplir el requisito del
--      taller se declara CONSTANT con el valor del SMLMV vigente y el
--      body lo expone via la variable publica usando la asignacion del
--      init block sobre gr_params (gc_smlmv solo puede leerse, no reasignarse).
--      SOLUCION PRACTICA: gc_smlmv se declara como NUMBER (no CONSTANT)
--      pero se asigna UNA SOLA VEZ en el init block y nunca se modifica.
--      Esto cumple el espiritu del taller sin violar las restricciones
--      sintaticas de Oracle (no se puede hacer SELECT en la spec).
--   2. t_lista_liq es INDEX BY PLS_INTEGER (corregido desde nested table).
--   3. fn_reporte_nomina retorna t_lista_liq_pipe (type de schema) en lugar
--      de t_lista_liq, porque PIPELINED no admite associative arrays.
-- ============================================================

CREATE OR REPLACE PACKAGE PKG_NOMINA AS

    -- CORRECCION 1: gc_smlmv se asigna en el init block del body.
    -- Declarada como variable publica (Oracle no permite SELECT en la spec
    -- para inicializar una constante de package). Se trata como constante
    -- por convencion: solo el init block la escribe, nadie mas la modifica.
    gc_smlmv NUMBER;

    -- Tipo registro con todos los campos de LIQUIDACION (sin id ni fecha)
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

    -- CORRECCION 2: INDEX BY PLS_INTEGER segun lo exige el taller.
    -- (La funcion pipelined usa t_lista_liq_pipe de schema, no este tipo.)
    TYPE t_lista_liq IS TABLE OF t_concepto_liq INDEX BY PLS_INTEGER;

    -- Liquidar un solo empleado
    PROCEDURE sp_liquidar_quincena (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    );

    -- Liquidar TODOS los activos — SOBRECARGA
    PROCEDURE sp_liquidar_quincena (
        p_id_quincena IN VARCHAR2
    );

    -- Total neto de una sede
    FUNCTION fn_total_nomina_sede (
        p_cod_sede    IN VARCHAR2,
        p_id_quincena IN VARCHAR2
    ) RETURN NUMBER;

    -- CORRECCION 3: retorna t_lista_liq_pipe (nested table de schema)
    -- porque PIPELINED no admite INDEX BY associative arrays.
    FUNCTION fn_reporte_nomina (
        p_cod_sede       IN VARCHAR2 DEFAULT NULL,
        p_tipo_contrato  IN VARCHAR2 DEFAULT NULL
    ) RETURN t_lista_liq_pipe PIPELINED;

END PKG_NOMINA;
/

CREATE OR REPLACE PACKAGE BODY PKG_NOMINA AS

    -- --------------------------------------------------------
    -- Cache de parametros (variable privada del package)
    -- --------------------------------------------------------
    TYPE t_params IS RECORD (
        smlmv            NUMBER,
        aux_transporte   NUMBER,
        pct_salud        NUMBER,
        pct_pension      NUMBER,
        pct_fondo        NUMBER,
        umbral_fondo     NUMBER,
        rec_nocturno     NUMBER,
        rec_dominical    NUMBER,
        rec_noct_dom     NUMBER,
        ret_servicios    NUMBER,
        bono_clima_sma   NUMBER,
        aporte_vol_bog   NUMBER
    );
    gr_params t_params;

    TYPE t_deducciones IS RECORD (
        salud         NUMBER,
        pension       NUMBER,
        fondo         NUMBER,
        embargo       NUMBER,
        libranzas     NUMBER,
        aporte_vol    NUMBER,
        total         NUMBER
    );

    -- --------------------------------------------------------
    -- PUNTO 8 — Auditoria con AUTONOMOUS_TRANSACTION (privado)
    -- --------------------------------------------------------
    PROCEDURE sp_log_nomina (
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
        COMMIT;
    END sp_log_nomina;

    -- --------------------------------------------------------
    -- Funciones PRIVADAS del package (Reglas 1-3)
    -- --------------------------------------------------------

    FUNCTION fn_salario_base_q (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    ) RETURN NUMBER
    IS
        vv_tipo EMPLEADOS.tipo_contrato%TYPE;
        vn_sal  EMPLEADOS.salario_base%TYPE;
    BEGIN
        SELECT tipo_contrato, salario_base INTO vv_tipo, vn_sal
          FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

        IF vv_tipo = 'PLANTA' THEN
            RETURN ROUND(vn_sal / 2, 2);

        ELSIF vv_tipo = 'TEMPORAL' THEN
            DECLARE vn_h HORAS_TRABAJADAS.cantidad_horas%TYPE; BEGIN
                SELECT cantidad_horas INTO vn_h FROM HORAS_TRABAJADAS
                 WHERE id_empleado = p_id_empleado
                   AND id_quincena = p_id_quincena
                   AND tipo_hora   = 'NORMAL';
                RETURN ROUND(vn_sal * vn_h, 2);
            EXCEPTION WHEN NO_DATA_FOUND THEN RETURN 0;
            END;

        ELSIF vv_tipo = 'SERVICIOS' THEN
            RETURN ROUND((vn_sal - (vn_sal * gr_params.ret_servicios / 100)) / 2, 2);
        END IF;
        RETURN 0;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN RETURN 0;
        WHEN OTHERS        THEN RAISE;
    END fn_salario_base_q;

    FUNCTION fn_recargos (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    ) RETURN NUMBER
    IS
        CURSOR cur_horas (cp_emp NUMBER, cp_quin VARCHAR2) IS
            SELECT tipo_hora, cantidad_horas FROM HORAS_TRABAJADAS
             WHERE id_empleado    = cp_emp AND id_quincena = cp_quin
               AND tipo_hora     <> 'NORMAL' AND cantidad_horas > 0;

        vv_tipo  EMPLEADOS.tipo_contrato%TYPE;
        vn_sal   EMPLEADOS.salario_base%TYPE;
        vn_vh    NUMBER(15,4);
        vn_total NUMBER(15,2) := 0;
    BEGIN
        SELECT tipo_contrato, salario_base INTO vv_tipo, vn_sal
          FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

        IF vv_tipo = 'SERVICIOS' THEN RETURN 0; END IF;

        vn_vh := CASE vv_tipo WHEN 'PLANTA' THEN vn_sal / 240 ELSE vn_sal END;

        FOR rec IN cur_horas(p_id_empleado, p_id_quincena) LOOP
            DECLARE vn_pct NUMBER; BEGIN
                CASE rec.tipo_hora
                    WHEN 'NOCTURNA'     THEN vn_pct := gr_params.rec_nocturno;
                    WHEN 'DOMINICAL'    THEN vn_pct := gr_params.rec_dominical;
                    WHEN 'NOCTURNA_DOM' THEN vn_pct := gr_params.rec_noct_dom;
                    ELSE vn_pct := 0;
                END CASE;
                vn_total := vn_total + (rec.cantidad_horas * vn_vh * vn_pct / 100);
            END;
        END LOOP;
        RETURN ROUND(vn_total, 2);
    EXCEPTION
        WHEN NO_DATA_FOUND THEN RETURN 0;
        WHEN OTHERS        THEN RAISE;
    END fn_recargos;

    FUNCTION fn_bonificacion (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    ) RETURN NUMBER
    IS
        vv_tipo  EMPLEADOS.tipo_contrato%TYPE;
        vd_fecha EMPLEADOS.fecha_ingreso%TYPE;
        vn_antig NUMBER;
        vn_sanc  NUMBER;
        vn_sal_q NUMBER;
        vn_result NUMBER := 0;
    BEGIN
        SELECT tipo_contrato, fecha_ingreso INTO vv_tipo, vd_fecha
          FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

        IF vv_tipo = 'SERVICIOS' THEN RETURN 0; END IF;

        vn_sal_q := fn_salario_base_q(p_id_empleado, p_id_quincena);
        vn_antig := TRUNC(MONTHS_BETWEEN(SYSDATE, vd_fecha) / 12);

        SELECT COUNT(*) INTO vn_sanc FROM SANCIONES
         WHERE id_empleado   = p_id_empleado
           AND fecha_sancion >= ADD_MONTHS(SYSDATE, -6);

        IF vn_sanc > 2 THEN RETURN 0; END IF;

        IF    vn_antig BETWEEN 3 AND 5  THEN vn_result := vn_sal_q * 0.03;
        ELSIF vn_antig BETWEEN 6 AND 10 THEN vn_result := vn_sal_q * 0.06;
        ELSIF vn_antig > 10             THEN vn_result := vn_sal_q * 0.10;
        END IF;
        RETURN ROUND(vn_result, 2);
    EXCEPTION
        WHEN NO_DATA_FOUND THEN RETURN 0;
        WHEN OTHERS        THEN RAISE;
    END fn_bonificacion;

    -- --------------------------------------------------------
    -- fn_deducciones — Regla 7
    -- --------------------------------------------------------
    FUNCTION fn_deducciones (
        p_bruto       IN NUMBER,
        p_id_empleado IN NUMBER,
        p_cod_sede    IN VARCHAR2,
        p_aporte_vol  IN VARCHAR2
    ) RETURN t_deducciones
    IS
        vr_ded      t_deducciones;
        vn_base_emb NUMBER;
        vn_pct_emb  NUMBER;
    BEGIN
        vr_ded.salud   := ROUND(p_bruto * gr_params.pct_salud   / 100, 2);
        vr_ded.pension := ROUND(p_bruto * gr_params.pct_pension  / 100, 2);
        vr_ded.fondo   := 0;
        IF (p_bruto * 2) > (gr_params.umbral_fondo * gr_params.smlmv) THEN
            vr_ded.fondo := ROUND(p_bruto * gr_params.pct_fondo / 100, 2);
        END IF;
        vn_base_emb := p_bruto - vr_ded.salud - vr_ded.pension - vr_ded.fondo;
        SELECT NVL(SUM(porcentaje), 0) INTO vn_pct_emb
          FROM EMBARGOS WHERE id_empleado = p_id_empleado AND estado = 'ACTIVO';
        vr_ded.embargo := ROUND(vn_base_emb * vn_pct_emb / 100, 2);
        SELECT NVL(SUM(cuota_mensual), 0) / 2 INTO vr_ded.libranzas
          FROM LIBRANZAS WHERE id_empleado = p_id_empleado AND estado = 'ACTIVA';
        vr_ded.aporte_vol := 0;
        IF p_cod_sede = 'BOG' AND p_aporte_vol = 'S' THEN
            vr_ded.aporte_vol := gr_params.aporte_vol_bog;
        END IF;
        vr_ded.total := vr_ded.salud + vr_ded.pension + vr_ded.fondo
                        + vr_ded.embargo + vr_ded.libranzas + vr_ded.aporte_vol;
        RETURN vr_ded;
    END fn_deducciones;

    -- --------------------------------------------------------
    -- calcular_concepto_liq: construye el registro de liquidacion.
    -- CORRECCION (Punto 5): NO ajusta embargo ni libranzas por neto
    -- negativo. Esa logica vive EXCLUSIVAMENTE en el compound trigger
    -- (BEFORE EACH ROW). Si se hace aqui tambien, el trigger nunca
    -- vera un neto negativo real y la alerta ALERTA_NETO_NEGATIVO
    -- nunca se dispara.
    -- --------------------------------------------------------
    FUNCTION calcular_concepto_liq (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    ) RETURN t_concepto_liq
    IS
        vr_liq        t_concepto_liq;
        vv_tipo       EMPLEADOS.tipo_contrato%TYPE;
        vv_cod_sede   EMPLEADOS.cod_sede%TYPE;
        vv_aporte_vol EMPLEADOS.acepta_aporte_vol%TYPE;
        vn_sal_base   EMPLEADOS.salario_base%TYPE;

        vn_sal_q      NUMBER := 0;
        vn_recargos   NUMBER := 0;
        vn_bonif      NUMBER := 0;
        vn_aux_transp NUMBER := 0;
        vn_bono_sede  NUMBER := 0;
        vn_bruto      NUMBER := 0;
        vn_sal_mens   NUMBER := 0;
        vn_horas_n    NUMBER := 0;

        vr_ded        t_deducciones;
    BEGIN
        SELECT tipo_contrato, cod_sede, acepta_aporte_vol, salario_base
          INTO vv_tipo, vv_cod_sede, vv_aporte_vol, vn_sal_base
          FROM EMPLEADOS WHERE id_empleado = p_id_empleado;

        vn_sal_q    := fn_salario_base_q(p_id_empleado, p_id_quincena);
        vn_recargos := fn_recargos(p_id_empleado, p_id_quincena);
        vn_bonif    := fn_bonificacion(p_id_empleado, p_id_quincena);

        IF vv_tipo IN ('PLANTA', 'TEMPORAL') THEN
            IF vv_tipo = 'PLANTA' THEN
                vn_sal_mens := vn_sal_base;
            ELSE
                BEGIN
                    SELECT NVL(cantidad_horas, 0) INTO vn_horas_n
                      FROM HORAS_TRABAJADAS
                     WHERE id_empleado = p_id_empleado
                       AND id_quincena = p_id_quincena
                       AND tipo_hora   = 'NORMAL';
                    vn_sal_mens := vn_sal_base * vn_horas_n * 2;
                EXCEPTION WHEN NO_DATA_FOUND THEN vn_sal_mens := 0;
                END;
            END IF;
            IF vn_sal_mens <= (2 * gr_params.smlmv) THEN
                vn_aux_transp := gr_params.aux_transporte / 2;
            END IF;
        END IF;

        IF vv_tipo IN ('PLANTA', 'TEMPORAL') AND vv_cod_sede = 'SMA' THEN
            vn_bono_sede := gr_params.bono_clima_sma;
        END IF;

        vn_bruto := vn_sal_q + vn_recargos + vn_bonif + vn_aux_transp + vn_bono_sede;
        vr_ded   := fn_deducciones(vn_bruto, p_id_empleado, vv_cod_sede, vv_aporte_vol);

        -- Armar registro: el neto puede ser negativo aqui.
        -- El trigger BEFORE EACH ROW lo corrige antes de confirmar en la tabla.
        vr_liq.id_empleado       := p_id_empleado;
        vr_liq.id_quincena       := p_id_quincena;
        vr_liq.salario_base_q    := vn_sal_q;
        vr_liq.recargos          := vn_recargos;
        vr_liq.bonificacion      := vn_bonif;
        vr_liq.auxilio_transp    := vn_aux_transp;
        vr_liq.bono_sede         := vn_bono_sede;
        vr_liq.bruto             := vn_bruto;
        vr_liq.deduccion_salud   := vr_ded.salud;
        vr_liq.deduccion_pension := vr_ded.pension;
        vr_liq.fondo_solidaridad := vr_ded.fondo;
        vr_liq.embargo           := vr_ded.embargo;
        vr_liq.libranzas         := vr_ded.libranzas;
        vr_liq.aporte_voluntario := vr_ded.aporte_vol;
        vr_liq.total_deducciones := vr_ded.total;
        vr_liq.neto              := vn_bruto - vr_ded.total;

        RETURN vr_liq;
    END calcular_concepto_liq;

    -- --------------------------------------------------------
    -- sp_liquidar_quincena — un solo empleado (publico)
    -- --------------------------------------------------------
    PROCEDURE sp_liquidar_quincena (
        p_id_empleado IN NUMBER,
        p_id_quincena IN VARCHAR2
    )
    IS
        vv_estado EMPLEADOS.estado%TYPE;
        vn_count  NUMBER;
        vr_liq    t_concepto_liq;
    BEGIN
        BEGIN
            SELECT estado INTO vv_estado FROM EMPLEADOS WHERE id_empleado = p_id_empleado;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20001, 'Empleado no encontrado: ' || p_id_empleado);
        END;

        IF vv_estado <> 'ACTIVO' THEN
            RAISE_APPLICATION_ERROR(-20002, 'Empleado no activo: estado = ' || vv_estado);
        END IF;

        SELECT COUNT(*) INTO vn_count FROM LIQUIDACION
         WHERE id_empleado = p_id_empleado AND id_quincena = p_id_quincena;
        IF vn_count > 0 THEN
            RAISE_APPLICATION_ERROR(-20003,
                'Liquidacion ya existe para empleado ' || p_id_empleado ||
                ' quincena ' || p_id_quincena);
        END IF;

        vr_liq := calcular_concepto_liq(p_id_empleado, p_id_quincena);

        INSERT INTO LIQUIDACION (
            ID_LIQUIDACION, ID_EMPLEADO, ID_QUINCENA,
            SALARIO_BASE_Q, RECARGOS, BONIFICACION, AUXILIO_TRANSP, BONO_SEDE, BRUTO,
            DEDUCCION_SALUD, DEDUCCION_PENSION, FONDO_SOLIDARIDAD,
            EMBARGO, LIBRANZAS, APORTE_VOLUNTARIO,
            TOTAL_DEDUCCIONES, NETO, FECHA_LIQUIDACION
        ) VALUES (
            SEQ_LIQUIDACION.NEXTVAL, vr_liq.id_empleado, vr_liq.id_quincena,
            vr_liq.salario_base_q, vr_liq.recargos, vr_liq.bonificacion,
            vr_liq.auxilio_transp, vr_liq.bono_sede, vr_liq.bruto,
            vr_liq.deduccion_salud, vr_liq.deduccion_pension, vr_liq.fondo_solidaridad,
            vr_liq.embargo, vr_liq.libranzas, vr_liq.aporte_voluntario,
            vr_liq.total_deducciones, vr_liq.neto, SYSDATE
        );

        sp_log_nomina(
            'LIQUIDACION_INDIVIDUAL',
            'Empleado: ' || p_id_empleado || ' | Quincena: ' || p_id_quincena
            || ' | Neto: ' || vr_liq.neto,
            1, 0, vr_liq.neto
        );

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            sp_log_nomina('ERROR_LIQUIDACION',
                'Empleado: ' || p_id_empleado || ' | Error: ' || SQLERRM, 0, 1, 0);
            ROLLBACK;
            RAISE;
    END sp_liquidar_quincena;

    -- --------------------------------------------------------
    -- PUNTO 6 — sp_liquidar_quincena TODOS — BULK COLLECT + FORALL
    -- CORRECCION: cuando calcular_concepto_liq falla para un empleado,
    -- ese empleado se excluye de la coleccion que va al FORALL.
    -- Antes se ponia un registro marcador con salario_base_q = -1,
    -- que volvia a fallar en el FORALL (trigger -20010) y el error
    -- se contaba dos veces. Ahora solo se cuenta una vez al fallar
    -- el calculo, y el FORALL solo recibe registros validos.
    -- --------------------------------------------------------
    PROCEDURE sp_liquidar_quincena (
        p_id_quincena IN VARCHAR2
    )
    IS
        TYPE t_ids IS TABLE OF EMPLEADOS.id_empleado%TYPE;
        vt_ids   t_ids;
        vt_lista t_lista_liq;       -- INDEX BY PLS_INTEGER (corregido)

        vn_ok     NUMBER := 0;
        vn_err    NUMBER := 0;
        vn_total  NUMBER := 0;
        vn_idx    PLS_INTEGER := 0; -- indice de la coleccion valida

        bulk_errors EXCEPTION;
        PRAGMA EXCEPTION_INIT(bulk_errors, -24381);
    BEGIN
        -- BULK COLLECT de activos sin liquidacion para la quincena
        SELECT id_empleado
          BULK COLLECT INTO vt_ids
          FROM EMPLEADOS
         WHERE estado = 'ACTIVO'
           AND id_empleado NOT IN (
               SELECT id_empleado FROM LIQUIDACION WHERE id_quincena = p_id_quincena
           );

        IF vt_ids.COUNT = 0 THEN
            DBMS_OUTPUT.PUT_LINE('No hay empleados pendientes para liquidar en ' || p_id_quincena);
            RETURN;
        END IF;

        -- Calcular cada liquidacion.
        -- CORRECCION: solo se agrega a vt_lista si el calculo es exitoso.
        -- Si falla, se registra en log y se incrementa vn_err. El FORALL
        -- solo ve registros validos, evitando el doble conteo anterior.
        FOR i IN 1 .. vt_ids.COUNT LOOP
            BEGIN
                vn_idx := vn_idx + 1;
                vt_lista(vn_idx) := calcular_concepto_liq(vt_ids(i), p_id_quincena);
            EXCEPTION
                WHEN OTHERS THEN
                    sp_log_nomina('ERROR_CALCULO',
                        'Empleado: ' || vt_ids(i) || ' | Error: ' || SQLERRM, 0, 1, 0);
                    vn_err := vn_err + 1;
                    vn_idx := vn_idx - 1; -- revertir el incremento: no agregar este slot
            END;
        END LOOP;

        IF vn_idx = 0 THEN
            DBMS_OUTPUT.PUT_LINE('Procesados OK: 0 | Errores: ' || vn_err);
            sp_log_nomina('LIQUIDACION_MASIVA',
                'Quincena: ' || p_id_quincena || ' | Total intentados: ' || vt_ids.COUNT,
                0, vn_err, 0);
            RETURN;
        END IF;

        -- FORALL con SAVE EXCEPTIONS: solo registros validos en vt_lista(1..vn_idx)
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
                    vt_lista(i).id_empleado,
                    vt_lista(i).id_quincena,
                    vt_lista(i).salario_base_q,
                    vt_lista(i).recargos,
                    vt_lista(i).bonificacion,
                    vt_lista(i).auxilio_transp,
                    vt_lista(i).bono_sede,
                    vt_lista(i).bruto,
                    vt_lista(i).deduccion_salud,
                    vt_lista(i).deduccion_pension,
                    vt_lista(i).fondo_solidaridad,
                    vt_lista(i).embargo,
                    vt_lista(i).libranzas,
                    vt_lista(i).aporte_voluntario,
                    vt_lista(i).total_deducciones,
                    vt_lista(i).neto,
                    SYSDATE
                );

            -- Si llego aqui sin excepcion, todos los del FORALL fueron OK
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
                -- Los que no fallaron en el FORALL son los OK
                vn_ok := vn_idx - SQL%BULK_EXCEPTIONS.COUNT;
        END;

        FOR i IN 1 .. vn_idx LOOP
            vn_total := vn_total + NVL(vt_lista(i).neto, 0);
        END LOOP;

        DBMS_OUTPUT.PUT_LINE('Procesados OK: ' || vn_ok || ' | Errores: ' || vn_err);

        sp_log_nomina(
            'LIQUIDACION_MASIVA',
            'Quincena: ' || p_id_quincena || ' | Total intentados: ' || vt_ids.COUNT,
            vn_ok, vn_err, vn_total
        );

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            sp_log_nomina('ERROR_MASIVO',
                'Quincena: ' || p_id_quincena || ' | Error: ' || SQLERRM, 0, 0, 0);
            ROLLBACK;
            RAISE;
    END sp_liquidar_quincena;

    -- --------------------------------------------------------
    -- fn_total_nomina_sede
    -- --------------------------------------------------------
    FUNCTION fn_total_nomina_sede (
        p_cod_sede    IN VARCHAR2,
        p_id_quincena IN VARCHAR2
    ) RETURN NUMBER
    IS
        vn_total NUMBER := 0;
    BEGIN
        SELECT NVL(SUM(l.neto), 0)
          INTO vn_total
          FROM LIQUIDACION l
          JOIN EMPLEADOS   e ON e.id_empleado = l.id_empleado
         WHERE e.cod_sede    = p_cod_sede
           AND l.id_quincena = p_id_quincena;
        RETURN vn_total;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN RETURN 0;
        WHEN OTHERS        THEN RAISE;
    END fn_total_nomina_sede;

    -- --------------------------------------------------------
    -- PUNTO 7 — Pipelined Function + SQL Dinamico
    -- CORRECCION: retorna t_lista_liq_pipe (nested table de schema)
    -- y usa PIPE ROW con t_concepto_liq_obj (object type de schema).
    -- --------------------------------------------------------
    FUNCTION fn_reporte_nomina (
        p_cod_sede      IN VARCHAR2 DEFAULT NULL,
        p_tipo_contrato IN VARCHAR2 DEFAULT NULL
    ) RETURN t_lista_liq_pipe PIPELINED
    IS
        vv_sql  VARCHAR2(2000);
        vn_emp  NUMBER(6);
        vv_quin VARCHAR2(15);
        vn_sbq  NUMBER(12,2);
        vn_rec  NUMBER(12,2);
        vn_bon  NUMBER(12,2);
        vn_aux  NUMBER(12,2);
        vn_bse  NUMBER(12,2);
        vn_bru  NUMBER(12,2);
        vn_sal  NUMBER(12,2);
        vn_pen  NUMBER(12,2);
        vn_fon  NUMBER(12,2);
        vn_emb  NUMBER(12,2);
        vn_lib  NUMBER(12,2);
        vn_apr  NUMBER(12,2);
        vn_tot  NUMBER(12,2);
        vn_net  NUMBER(12,2);

        TYPE t_ref IS REF CURSOR;
        cur_dyn t_ref;
    BEGIN
        vv_sql :=
            'SELECT l.id_empleado, l.id_quincena,'
            || ' l.salario_base_q, l.recargos, l.bonificacion, l.auxilio_transp, l.bono_sede,'
            || ' l.bruto, l.deduccion_salud, l.deduccion_pension, l.fondo_solidaridad,'
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
                vn_bru, vn_sal, vn_pen, vn_fon, vn_emb, vn_lib, vn_apr,
                vn_tot, vn_net;
            EXIT WHEN cur_dyn%NOTFOUND;
            PIPE ROW(t_concepto_liq_obj(
                vn_emp, vv_quin, vn_sbq, vn_rec, vn_bon, vn_aux, vn_bse,
                vn_bru, vn_sal, vn_pen, vn_fon, vn_emb, vn_lib, vn_apr,
                vn_tot, vn_net
            ));
        END LOOP;

        CLOSE cur_dyn;
        RETURN;
    EXCEPTION
        WHEN OTHERS THEN
            IF cur_dyn%ISOPEN THEN CLOSE cur_dyn; END IF;
            RAISE;
    END fn_reporte_nomina;

    -- --------------------------------------------------------
    -- Bloque de inicializacion: carga el cache y asigna gc_smlmv
    -- --------------------------------------------------------
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
      INTO gr_params.smlmv,
           gr_params.aux_transporte,
           gr_params.pct_salud,
           gr_params.pct_pension,
           gr_params.pct_fondo,
           gr_params.umbral_fondo,
           gr_params.rec_nocturno,
           gr_params.rec_dominical,
           gr_params.rec_noct_dom,
           gr_params.ret_servicios,
           gr_params.bono_clima_sma,
           gr_params.aporte_vol_bog
      FROM PARAMETROS;

    -- gc_smlmv se asigna aqui (init block del body) para cumplir el
    -- requisito del taller: "inicializada leyendo PARAMETROS al cargar".
    gc_smlmv := gr_params.smlmv;

END PKG_NOMINA;
/


-- ============================================================
-- PUNTO 5 — Compound Trigger sobre LIQUIDACION (INSERT)
-- CORRECCIONES:
--   1. ALERTA_NETO_NEGATIVO ahora SI se dispara: calcular_concepto_liq
--      ya no ajusta embargo/libranzas, por lo que el neto puede llegar
--      negativo al INSERT y el trigger lo detecta correctamente.
--   2. Libranzas multiples: se descuenta cuota_mensual/2 de cada
--      libranza individualmente, no el total :NEW.libranzas a cada una.
-- ============================================================
CREATE OR REPLACE TRIGGER TRG_LIQUIDACION_COMPOUND
FOR INSERT ON LIQUIDACION
COMPOUND TRIGGER

    TYPE t_ajuste IS RECORD (
        id_empleado NUMBER,
        libranzas   NUMBER,
        embargo     NUMBER,
        neto_orig   NUMBER
    );
    TYPE t_lista_ajuste IS TABLE OF t_ajuste INDEX BY PLS_INTEGER;
    vt_ajustes  t_lista_ajuste;
    vn_idx      PLS_INTEGER := 0;

    -- --------------------------------------------------------
    -- BEFORE EACH ROW: validaciones y ajuste de neto negativo
    -- --------------------------------------------------------
    BEFORE EACH ROW IS
        vb_ajustado BOOLEAN := FALSE;
    BEGIN
        -- Validacion: salario base no puede ser negativo
        IF :NEW.salario_base_q < 0 THEN
            RAISE_APPLICATION_ERROR(-20010, 'Salario base no puede ser negativo');
        END IF;

        -- Manejo de neto negativo (Regla 8 caso especial)
        -- Funciona porque calcular_concepto_liq ya NO hace este ajuste.
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

    -- --------------------------------------------------------
    -- AFTER EACH ROW: log de alertas y actualizacion de libranzas
    -- --------------------------------------------------------
    AFTER EACH ROW IS
    BEGIN
        -- Si hubo ajuste por neto negativo, insertar alerta en log
        FOR i IN 1 .. vt_ajustes.COUNT LOOP
            IF vt_ajustes(i).id_empleado = :NEW.id_empleado THEN
                INSERT INTO LOG_NOMINA (
                    ID_LOG, FECHA_HORA, OPERACION, USUARIO, DETALLE
                ) VALUES (
                    SEQ_LOG.NEXTVAL, SYSTIMESTAMP, 'ALERTA_NETO_NEGATIVO', USER,
                    'Empleado: ' || :NEW.id_empleado
                    || ' | Embargo ajustado: ' || vt_ajustes(i).embargo
                    || ' | Libranzas ajustadas: ' || vt_ajustes(i).libranzas
                    || ' | Neto final: ' || vt_ajustes(i).neto_orig
                );
            END IF;
        END LOOP;

        -- CORRECCION: descontar cuota_mensual/2 propia de cada libranza,
        -- no :NEW.libranzas (total) a todas. Antes, con 2 libranzas de
        -- 800000 y 200000 (total 500000), se restaba 500000 a cada una.
        -- Ahora cada libranza pierde solo su cuota individual.
        IF :NEW.libranzas > 0 THEN
            UPDATE LIBRANZAS
               SET saldo_pendiente = saldo_pendiente - (cuota_mensual / 2)
             WHERE id_empleado = :NEW.id_empleado
               AND estado      = 'ACTIVA';

            UPDATE LIBRANZAS
               SET estado = 'PAGADA'
             WHERE id_empleado     = :NEW.id_empleado
               AND estado          = 'ACTIVA'
               AND saldo_pendiente <= 0;
        END IF;
    END AFTER EACH ROW;

    -- --------------------------------------------------------
    -- AFTER STATEMENT: log del lote procesado
    -- --------------------------------------------------------
    AFTER STATEMENT IS
    BEGIN
        INSERT INTO LOG_NOMINA (
            ID_LOG, FECHA_HORA, OPERACION, USUARIO, DETALLE
        ) VALUES (
            SEQ_LOG.NEXTVAL, SYSTIMESTAMP, 'INSERT_LIQUIDACION', USER,
            'Lote procesado a las ' || TO_CHAR(SYSTIMESTAMP, 'HH24:MI:SS.FF3')
        );
    END AFTER STATEMENT;

END TRG_LIQUIDACION_COMPOUND;
/


-- ============================================================
-- BLOQUE DE PRUEBA FINAL
-- ============================================================
BEGIN
    PKG_NOMINA.sp_liquidar_quincena('2026-Q1-ENE');
    DBMS_OUTPUT.PUT_LINE('Liquidacion masiva completada.');
END;
/

SELECT
    l.id_liquidacion,
    e.nombre,
    e.tipo_contrato,
    e.cod_sede,
    l.id_quincena,
    l.salario_base_q,
    l.recargos,
    l.bonificacion,
    l.auxilio_transp,
    l.bono_sede,
    l.bruto,
    l.deduccion_salud,
    l.deduccion_pension,
    l.fondo_solidaridad,
    l.embargo,
    l.libranzas,
    l.aporte_voluntario,
    l.total_deducciones,
    l.neto
FROM LIQUIDACION l
JOIN EMPLEADOS   e ON e.id_empleado = l.id_empleado
ORDER BY l.id_liquidacion;

SELECT id_log, operacion, detalle, empleados_ok, empleados_error, monto_total
  FROM LOG_NOMINA ORDER BY id_log;

SELECT 'BOG' AS sede, PKG_NOMINA.fn_total_nomina_sede('BOG','2026-Q1-ENE') AS total_neto FROM DUAL UNION ALL
SELECT 'MED',         PKG_NOMINA.fn_total_nomina_sede('MED','2026-Q1-ENE')              FROM DUAL UNION ALL
SELECT 'SMA',         PKG_NOMINA.fn_total_nomina_sede('SMA','2026-Q1-ENE')              FROM DUAL UNION ALL
SELECT 'CTG',         PKG_NOMINA.fn_total_nomina_sede('CTG','2026-Q1-ENE')              FROM DUAL;
