// ============================================================
// ARCHIVO : mundial2026.js
// AUTOR   : Juan Pablo Moreno Castro
// PORTAFOLIO: pabloCastro1532.github.io
// DESC.   : Introducción a MongoDB (NoSQL)
//           Crea la BD "mundial2026" con 5 colecciones 
//           haciendo uso de insertMany.
//           Ejecutar en mongosh o MongoDB Compass Shell.
// ============================================================

// ----------------------------------------------------------
// BASE DE DATOS: mundial2026
// CONCEPTO  : Selección y creación implícita de base de datos
// EXPLICACIÓN: use("nombre") cambia a la BD especificada. 
//              En MongoDB, la base de datos y sus colecciones
//              no necesitan definirse previamente; se crean de 
//              forma implícita tan pronto como se inserta el primer
//              documento.
// ----------------------------------------------------------
use("mundial2026");


// ----------------------------------------------------------
// COLECCIÓN: selecciones
// CONCEPTO  : insertMany — Inserción de múltiples documentos
// EXPLICACIÓN: Registra un conjunto de selecciones de fútbol. 
//              Cada selección se define como un objeto JSON. 
//              Campos: continente (String), pais (String), 
//              capital (String), poblacion (Number), 
//              colorCamiseta (String), mundialesGanados (Number).
//              MongoDB asigna automáticamente una clave primaria 
//              única llamada _id (de tipo ObjectId) a cada documento.
// ----------------------------------------------------------
db.selecciones.insertMany([
    { continente: "América del Sur",   pais: "Colombia",            capital: "Bogotá",          poblacion: 60000000,  colorCamiseta: "Amarillo", mundialesGanados: 0 },
    { continente: "Europa",            pais: "Inglaterra",          capital: "Londres",          poblacion: 56000000,  colorCamiseta: "Blanco",   mundialesGanados: 1 },
    { continente: "África",            pais: "República del Congo", capital: "Brazzaville",      poblacion: 5500000,   colorCamiseta: "Rojo",     mundialesGanados: 0 },
    { continente: "América del Sur",   pais: "Argentina",           capital: "Buenos Aires",     poblacion: 46000000,  colorCamiseta: "Celeste",  mundialesGanados: 3 },
    { continente: "América del Sur",   pais: "Brasil",              capital: "Brasilia",         poblacion: 214000000, colorCamiseta: "Amarillo", mundialesGanados: 5 },
    { continente: "Europa",            pais: "Francia",             capital: "París",            poblacion: 67000000,  colorCamiseta: "Azul",     mundialesGanados: 2 },
    { continente: "Europa",            pais: "España",              capital: "Madrid",           poblacion: 48000000,  colorCamiseta: "Rojo",     mundialesGanados: 1 },
    { continente: "Europa",            pais: "Alemania",            capital: "Berlín",           poblacion: 83000000,  colorCamiseta: "Blanco",   mundialesGanados: 4 },
    { continente: "América del Norte", pais: "México",              capital: "Ciudad de México", poblacion: 126000000, colorCamiseta: "Verde",    mundialesGanados: 0 },
    { continente: "Asia",              pais: "Japón",               capital: "Tokio",            poblacion: 125000000, colorCamiseta: "Azul",     mundialesGanados: 0 }
]);


// ----------------------------------------------------------
// COLECCIÓN: jugadores
// CONCEPTO  : Documentos con tipos de datos heterogéneos
// EXPLICACIÓN: Se guardan los perfiles de jugadores destacados. 
//              El motor schema-less (sin esquema rígido) de MongoDB 
//              permite que las propiedades varíen o que se incluyan
//              números y texto indistintamente.
//              Campos: nombre, apellido, nacionalidad, club, rol, golesSeleccion.
// ----------------------------------------------------------
db.jugadores.insertMany([
    { nombre: "James",     apellido: "Rodriguez",   nacionalidad: "Colombia", club: "Minnesota United F.C.", rol: "Mediocentro ofensivo", golesSeleccion: 31  },
    { nombre: "Lionel",    apellido: "Messi",       nacionalidad: "Argentina",club: "Inter Miami",           rol: "Delantero",            golesSeleccion: 106 },
    { nombre: "Cristiano", apellido: "Ronaldo",     nacionalidad: "Portugal", club: "Al-Nassr",              rol: "Delantero",            golesSeleccion: 128 },
    { nombre: "Robert",    apellido: "Lewandowski", nacionalidad: "Polonia",  club: "FC Barcelona",          rol: "Delantero",            golesSeleccion: 82  },
    { nombre: "Kylian",    apellido: "Mbappé",      nacionalidad: "Francia",  club: "PSG",                   rol: "Delantero",            golesSeleccion: 46  },
    { nombre: "Neymar",    apellido: "Jr",          nacionalidad: "Brasil",   club: "Al-Hilal",              rol: "Delantero",            golesSeleccion: 79  },
    { nombre: "Luka",      apellido: "Modric",      nacionalidad: "Croacia",  club: "Real Madrid",           rol: "Mediocampista",        golesSeleccion: 24  },
    { nombre: "Kevin",     apellido: "De Bruyne",   nacionalidad: "Bélgica",  club: "Manchester City",       rol: "Mediocampista",        golesSeleccion: 27  },
    { nombre: "Erling",    apellido: "Haaland",     nacionalidad: "Noruega",  club: "Manchester City",       rol: "Delantero",            golesSeleccion: 27  },
    { nombre: "Luis",      apellido: "Díaz",        nacionalidad: "Colombia", club: "Liverpool",             rol: "Extremo",              golesSeleccion: 14  }
]);


// ----------------------------------------------------------
// COLECCIÓN: estadios
// CONCEPTO  : Datos numéricos (capacidad) para consultas de rango
// EXPLICACIÓN: Registra los estadios donde se jugarán los partidos. 
//              El campo 'capacidad' se define explícitamente como 
//              un valor numérico entero, lo cual hace posible 
//              ejecutar filtros avanzados de rangos numéricos como
//              $gt (mayor que) o $lt (menor que) en futuras consultas.
// ----------------------------------------------------------
db.estadios.insertMany([
    { nombre: "MetLife Stadium", pais: "Estados Unidos", ciudad: "Nueva York",   capacidad: 82500 },
    { nombre: "Azteca",          pais: "México",         ciudad: "CDMX",         capacidad: 87000 },
    { nombre: "Camp Nou",        pais: "España",         ciudad: "Barcelona",    capacidad: 99000 },
    { nombre: "Wembley",         pais: "Inglaterra",     ciudad: "Londres",      capacidad: 90000 },
    { nombre: "Maracaná",        pais: "Brasil",         ciudad: "Río",          capacidad: 78000 },
    { nombre: "Allianz Arena",   pais: "Alemania",       ciudad: "Múnich",       capacidad: 75000 },
    { nombre: "Stade de France", pais: "Francia",        ciudad: "París",        capacidad: 80000 },
    { nombre: "San Siro",        pais: "Italia",         ciudad: "Milán",        capacidad: 76000 },
    { nombre: "Lusail Stadium",  pais: "Qatar",          ciudad: "Lusail",       capacidad: 88000 },
    { nombre: "Monumental",      pais: "Argentina",      ciudad: "Buenos Aires", capacidad: 83000 }
]);


// ----------------------------------------------------------
// COLECCIÓN: partidos
// CONCEPTO  : Fechas estructuradas (String ISO YYYY-MM-DD)
// EXPLICACIÓN: Organiza el fixture del mundial. Las fechas se guardan
//              en formato estándar ISO 8601 de cadena, asegurando
//              consistencia en la ordenación y legibilidad.
//              En entornos de producción complejos, se recomendaría
//              utilizar el tipo nativo ISODate() de BSON.
// ----------------------------------------------------------
db.partidos.insertMany([
    { local: "Colombia",  visitante: "Inglaterra", estadio: "MetLife Stadium", fecha: "2026-06-15" },
    { local: "Argentina", visitante: "Brasil",     estadio: "Maracaná",        fecha: "2026-06-16" },
    { local: "Francia",   visitante: "España",     estadio: "Stade de France", fecha: "2026-06-17" },
    { local: "Alemania",  visitante: "México",     estadio: "Allianz Arena",   fecha: "2026-06-18" },
    { local: "Japón",     visitante: "Colombia",   estadio: "Azteca",          fecha: "2026-06-19" },
    { local: "Brasil",    visitante: "España",     estadio: "Camp Nou",        fecha: "2026-06-20" },
    { local: "Argentina", visitante: "Francia",    estadio: "Wembley",         fecha: "2026-06-21" },
    { local: "México",    visitante: "Japón",      estadio: "Lusail Stadium",  fecha: "2026-06-22" },
    { local: "Alemania",  visitante: "Inglaterra", estadio: "San Siro",        fecha: "2026-06-23" },
    { local: "Colombia",  visitante: "Brasil",     estadio: "Monumental",      fecha: "2026-06-24" }
]);


// ----------------------------------------------------------
// COLECCIÓN: grupos
// CONCEPTO  : Arrays embebidos (Datos anidados de 1 a N)
// EXPLICACIÓN: Asocia las selecciones que componen cada grupo.
//              A diferencia del modelo relacional SQL (que obligaría
//              a crear una tabla intermedia o pivote para romper una
//              relación N:M), MongoDB permite guardar arrays directamente
//              dentro del documento principal. Esto optimiza el
//              rendimiento al evitar operaciones JOIN.
// ----------------------------------------------------------
db.grupos.insertMany([
    { grupo: "A", equipos: ["México",         "Sudáfrica",    "Corea",           "Chequia"]       },
    { grupo: "B", equipos: ["Canadá",         "Bosnia",       "Qatar",           "Suiza"]         },
    { grupo: "C", equipos: ["Brasil",         "Marruecos",    "Haití",           "Escocia"]       },
    { grupo: "D", equipos: ["Estados Unidos", "Paraguay",     "Australia",       "Turquía"]       },
    { grupo: "E", equipos: ["Alemania",       "Curazao",      "Costa de Marfil", "Ecuador"]       },
    { grupo: "F", equipos: ["Países Bajos",   "Japón",        "Suecia",          "Túnez"]         },
    { grupo: "G", equipos: ["Bélgica",        "Egipto",       "Irán",            "Nueva Zelanda"] },
    { grupo: "H", equipos: ["España",         "Cabo Verde",   "Arabia Saudita",  "Uruguay"]       },
    { grupo: "I", equipos: ["Francia",        "Senegal",      "Irak",            "Noruega"]       },
    { grupo: "J", equipos: ["Argentina",      "Argelia",      "Austria",         "Jordania"]      },
    { grupo: "K", equipos: ["Portugal",       "RD Congo",     "Uzbekistán",      "Colombia"]      },
    { grupo: "L", equipos: ["Inglaterra",     "Croacia",      "Ghana",           "Panamá"]        }
]);
