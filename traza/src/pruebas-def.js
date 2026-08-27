/*
 * TRAZA v1.0.0 — pruebas-def.js
 * Definición de las pruebas del núcleo. Este mismo archivo se ejecuta:
 *   - en Node, durante la construcción (herramientas/ejecutar-pruebas.js), y
 *   - en el navegador, dentro de pruebas.html (ejecutor visual verde/rojo).
 * No usa el DOM ni la red: recibe el núcleo y devuelve resultados.
 */
(function (raiz, fabrica) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.TRAZA_PRUEBAS = fabrica();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Pequeñas aserciones con mensajes en español. */
  function afirmar(condicion, mensaje) {
    if (!condicion) throw new Error(mensaje);
  }
  function iguales(a, b, mensaje) {
    if (a !== b) throw new Error(mensaje + " (esperado: " + JSON.stringify(b) + ", obtenido: " + JSON.stringify(a) + ")");
  }
  function igualesJSON(a, b, mensaje) {
    var ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) throw new Error(mensaje + "\n  esperado: " + jb + "\n  obtenido: " + ja);
  }

  var ETAPAS_CANONICAS = ["dns", "nat", "tcp", "tls", "http_solicitud", "http_respuesta"];
  var FECHA_FIJA = "2026-01-01T00:00:00.000Z"; // fecha fija: las pruebas son deterministas

  /* Lista de pruebas: { nombre, grupo, ejecutar(nucleo) }.
     Cada prueba lanza Error si falla; si no lanza, pasa. */
  var PRUEBAS = [

    { grupo: "Escenarios", nombre: "Existen exactamente 3 escenarios con clave, nombre y descripción",
      ejecutar: function (N) {
        var lista = N.listaEscenarios();
        iguales(lista.length, 3, "Debe haber 3 escenarios");
        var claves = lista.map(function (e) { return e.clave; });
        igualesJSON(claves, ["normal", "fallo-dns", "intentos-fallidos"], "Claves de escenario");
        lista.forEach(function (e) {
          afirmar(e.nombre && e.descripcion, "El escenario " + e.clave + " necesita nombre y descripción");
        });
      } },

    { grupo: "Escenarios", nombre: "Cada escenario tiene eventos ordenados por tiempo y con id único",
      ejecutar: function (N) {
        N.listaEscenarios().forEach(function (esc) {
          var evs = N.eventosDe(esc.clave);
          afirmar(evs.length >= 3, esc.clave + ": debe tener al menos 3 eventos");
          var vistos = {};
          for (var i = 0; i < evs.length; i++) {
            afirmar(!vistos[evs[i].id], esc.clave + ": id repetido " + evs[i].id);
            vistos[evs[i].id] = true;
            if (i > 0) afirmar(evs[i].t_ms >= evs[i - 1].t_ms,
              esc.clave + ": t_ms desordenado en " + evs[i].id);
          }
        });
      } },

    { grupo: "Escenarios", nombre: "Pedir un escenario desconocido lanza un error claro",
      ejecutar: function (N) {
        var fallo = null;
        try { N.eventosDe("inventado"); } catch (e) { fallo = e; }
        afirmar(fallo !== null, "Debía lanzar un error");
        afirmar(fallo.message.indexOf("inventado") >= 0, "El error debe nombrar el escenario pedido");
      } },

    { grupo: "Esquema", nombre: "Todos los eventos de todos los escenarios cumplen el esquema estable",
      ejecutar: function (N) {
        N.listaEscenarios().forEach(function (esc) {
          N.eventosDe(esc.clave).forEach(function (e) {
            var campos = Object.keys(e);
            igualesJSON(campos, N.CAMPOS_EVENTO,
              esc.clave + " " + e.id + ": los campos del evento deben coincidir con CAMPOS_EVENTO en el mismo orden");
            afirmar(typeof e.t_ms === "number" && e.t_ms >= 0, e.id + ": t_ms debe ser número >= 0");
            afirmar(["paquete", "estado"].indexOf(e.tipo) >= 0, e.id + ": tipo inválido " + e.tipo);
            afirmar(["ok", "info", "advertencia", "error"].indexOf(e.estado) >= 0, e.id + ": estado inválido " + e.estado);
            afirmar(ETAPAS_CANONICAS.indexOf(e.etapa) >= 0, e.id + ": etapa inválida " + e.etapa);
            afirmar(e.resumen && e.detalle && e.nota_aprender, e.id + ": faltan textos (resumen/detalle/nota_aprender)");
          });
        });
      } },

    { grupo: "Esquema", nombre: "Todo evento está marcado como sintético (sintetico === true)",
      ejecutar: function (N) {
        N.listaEscenarios().forEach(function (esc) {
          N.eventosDe(esc.clave).forEach(function (e) {
            iguales(e.sintetico, true, esc.clave + " " + e.id + ": debe declararse sintético");
          });
        });
      } },

    { grupo: "Esquema", nombre: "Los dominios usados pertenecen al TLD reservado .example (RFC 2606)",
      ejecutar: function (N) {
        afirmar(/\.example$/.test(N.DOMINIO), "DOMINIO debe terminar en .example");
        afirmar(/\.example$/.test(N.DOMINIO_INEXISTENTE), "DOMINIO_INEXISTENTE debe terminar en .example");
      } },

    { grupo: "Etapas", nombre: "El escenario normal recorre las seis etapas en orden canónico",
      ejecutar: function (N) {
        var presentes = N.etapasPresentes(N.eventosDe("normal"));
        igualesJSON(presentes, ETAPAS_CANONICAS, "Etapas del escenario normal");
      } },

    { grupo: "Etapas", nombre: "El fallo de DNS se detiene en la etapa DNS (sin TCP, TLS ni HTTP)",
      ejecutar: function (N) {
        var evs = N.eventosDe("fallo-dns");
        var presentes = N.etapasPresentes(evs);
        igualesJSON(presentes, ["dns"], "El fallo de DNS solo debe contener la etapa dns");
        var errores = evs.filter(function (e) { return e.estado === "error"; });
        afirmar(errores.length >= 2, "Debe haber al menos 2 eventos de error (respuesta NXDOMAIN y estado final)");
        afirmar(evs.some(function (e) { return e.detalle.indexOf("NXDOMAIN") >= 0; }),
          "La evidencia debe mencionar NXDOMAIN");
      } },

    { grupo: "Etapas", nombre: "Los intentos fallidos incluyen tres fallos, un 429 y la reacción defensiva",
      ejecutar: function (N) {
        var evs = N.eventosDe("intentos-fallidos");
        var fallos401 = evs.filter(function (e) { return e.detalle.indexOf("401 Unauthorized") >= 0; });
        iguales(fallos401.length, 2, "Debe haber exactamente 2 respuestas 401 antes del bloqueo");
        var bloqueo = evs.filter(function (e) { return e.detalle.indexOf("429 Too Many Requests") >= 0; });
        iguales(bloqueo.length, 1, "Debe haber exactamente una respuesta 429");
        iguales(bloqueo[0].estado, "error", "El 429 debe marcarse como error");
        var advertencias = evs.filter(function (e) { return e.estado === "advertencia"; });
        afirmar(advertencias.length >= 3, "Debe haber al menos 3 advertencias (dos 401 y el registro defensivo)");
        var ultimo = evs[evs.length - 1];
        afirmar(ultimo.tipo === "estado" && ultimo.nota_aprender.indexOf("MFA") >= 0,
          "El último evento debe ser el estado defensivo del servidor y mencionar MFA");
      } },

    { grupo: "Etapas", nombre: "Catálogo de etapas completo: nombre, término traducido, explicación y fuente",
      ejecutar: function (N) {
        iguales(N.ETAPAS.length, 6, "Debe haber 6 etapas");
        igualesJSON(N.ETAPAS.map(function (e) { return e.clave; }), ETAPAS_CANONICAS, "Orden canónico de etapas");
        N.ETAPAS.forEach(function (et) {
          afirmar(et.nombre && et.termino_en && et.termino_es && et.explicacion,
            et.clave + ": faltan textos de la etapa");
          afirmar(et.fuente && (et.fuente.indexOf("RFC") >= 0),
            et.clave + ": la fuente debe citar el RFC correspondiente");
          afirmar(et.fuente.indexOf("simulación") >= 0 || et.fuente.indexOf("simulacion") >= 0,
            et.clave + ": la fuente debe distinguir hecho de simulación");
        });
      } },

    { grupo: "Reproductor", nombre: "Estado inicial: antes del primer evento y en pausa",
      ejecutar: function (N) {
        var r = N.reproductorInicial();
        iguales(r.indice, -1, "índice inicial");
        iguales(r.reproduciendo, false, "reproducción inicial");
      } },

    { grupo: "Reproductor", nombre: "Avanzar recorre todos los eventos y se detiene en el último",
      ejecutar: function (N) {
        var total = 3;
        var r = N.reproductorInicial();
        r = N.avanzar(r, total); iguales(r.indice, 0, "primer avance");
        r = N.avanzar(r, total); iguales(r.indice, 1, "segundo avance");
        r = N.avanzar(r, total); iguales(r.indice, 2, "tercer avance");
        r = N.avanzar(r, total); iguales(r.indice, 2, "no debe pasar del último");
        iguales(r.reproduciendo, false, "al llegar al final se pausa");
      } },

    { grupo: "Reproductor", nombre: "Retroceder respeta el límite inferior (-1) y pausa",
      ejecutar: function (N) {
        var r = { indice: 1, reproduciendo: true };
        r = N.retroceder(r); iguales(r.indice, 0, "primer retroceso");
        iguales(r.reproduciendo, false, "retroceder pausa la reproducción");
        r = N.retroceder(r); iguales(r.indice, -1, "segundo retroceso");
        r = N.retroceder(r); iguales(r.indice, -1, "no debe bajar de -1");
      } },

    { grupo: "Reproductor", nombre: "Reiniciar vuelve al principio; pausar detiene sin mover el índice",
      ejecutar: function (N) {
        var r = N.reiniciar();
        iguales(r.indice, -1, "reiniciar → índice -1");
        iguales(r.reproduciendo, false, "reiniciar → en pausa");
        var p = N.pausar({ indice: 4, reproduciendo: true });
        iguales(p.indice, 4, "pausar no mueve el índice");
        iguales(p.reproduciendo, false, "pausar detiene");
      } },

    { grupo: "Reproductor", nombre: "Alternar reproducción: pausa/continúa, y al final vuelve a empezar",
      ejecutar: function (N) {
        var r = N.alternarReproduccion({ indice: 1, reproduciendo: false }, 5);
        iguales(r.reproduciendo, true, "de pausa a reproducción");
        r = N.alternarReproduccion(r, 5);
        iguales(r.reproduciendo, false, "de reproducción a pausa");
        var fin = N.alternarReproduccion({ indice: 4, reproduciendo: false }, 5);
        iguales(fin.indice, -1, "al final, reproducir reinicia");
        iguales(fin.reproduciendo, true, "…y arranca");
      } },

    { grupo: "Reproductor", nombre: "irA acota el índice y primerIndiceDeEtapa localiza etapas",
      ejecutar: function (N) {
        iguales(N.irA({ indice: 0, reproduciendo: true }, 99, 5).indice, 4, "irA acota por arriba");
        iguales(N.irA({ indice: 0, reproduciendo: true }, -99, 5).indice, -1, "irA acota por abajo");
        var evs = N.eventosDe("normal");
        var iTls = N.primerIndiceDeEtapa(evs, "tls");
        afirmar(iTls >= 0, "la etapa tls debe existir en el escenario normal");
        iguales(evs[iTls].etapa, "tls", "el índice devuelto apunta a la etapa pedida");
        iguales(N.primerIndiceDeEtapa(evs, "no-existe"), -1, "etapa inexistente → -1");
      } },

    { grupo: "Exportación", nombre: "El JSON exportado conserva exactamente los mismos eventos",
      ejecutar: function (N) {
        N.listaEscenarios().forEach(function (esc) {
          var evs = N.eventosDe(esc.clave);
          var doc = JSON.parse(N.exportarJSON(esc.clave, evs, FECHA_FIJA));
          iguales(doc.esquema, N.ESQUEMA_EVENTOS, "esquema declarado");
          iguales(doc.version_app, N.VERSION, "versión declarada");
          iguales(doc.escenario, esc.clave, "escenario declarado");
          iguales(doc.generado_en, FECHA_FIJA, "fecha declarada");
          afirmar(doc.aviso.indexOf("sintético") >= 0 || doc.aviso.indexOf("sintéticos") >= 0,
            "el JSON debe llevar el aviso de datos sintéticos");
          igualesJSON(doc.campos, N.CAMPOS_EVENTO, "lista de campos documentada");
          igualesJSON(doc.eventos, evs, esc.clave + ": los eventos exportados deben ser idénticos a los mostrados");
        });
      } },

    { grupo: "Exportación", nombre: "El LOG tiene una línea por evento con id, etapa y marca SINTETICO",
      ejecutar: function (N) {
        N.listaEscenarios().forEach(function (esc) {
          var evs = N.eventosDe(esc.clave);
          var log = N.exportarLOG(esc.clave, evs, FECHA_FIJA);
          var lineas = log.split("\n").filter(function (l) { return l.length > 0; });
          var cabeceras = lineas.filter(function (l) { return l.charAt(0) === "#"; });
          var cuerpo = lineas.filter(function (l) { return l.charAt(0) !== "#"; });
          iguales(cuerpo.length, evs.length, esc.clave + ": una línea de registro por evento");
          afirmar(cabeceras.length >= 5, "el LOG debe llevar cabecera con esquema, escenario, fecha y aviso");
          afirmar(cabeceras.some(function (l) { return l.indexOf(esc.clave) >= 0; }), "la cabecera nombra el escenario");
          cuerpo.forEach(function (linea, i) {
            afirmar(linea.indexOf(evs[i].id) >= 0, esc.clave + ": la línea " + i + " debe llevar el id " + evs[i].id);
            afirmar(linea.indexOf(evs[i].etapa) >= 0, esc.clave + ": la línea " + i + " debe llevar la etapa");
            afirmar(linea.indexOf("(SINTETICO)") >= 0, esc.clave + ": cada línea debe marcarse (SINTETICO)");
            afirmar(linea.indexOf("[+") === 0, esc.clave + ": cada línea empieza con el instante [+…ms]");
          });
        });
      } },

    { grupo: "Exportación", nombre: "JSON y LOG describen la misma secuencia de eventos",
      ejecutar: function (N) {
        var evs = N.eventosDe("intentos-fallidos");
        var doc = JSON.parse(N.exportarJSON("intentos-fallidos", evs, FECHA_FIJA));
        var log = N.exportarLOG("intentos-fallidos", evs, FECHA_FIJA);
        var idsJson = doc.eventos.map(function (e) { return e.id; });
        var idsLog = log.split("\n")
          .filter(function (l) { return l.length > 0 && l.charAt(0) !== "#"; })
          .map(function (l) { return l.replace(/^\[\+\s*\d+ ms\]\s+/, "").split(/\s+/)[0]; });
        igualesJSON(idsLog, idsJson, "los identificadores del LOG y del JSON deben coincidir en orden");
      } },

    { grupo: "Retos", nombre: "Hay 5 retos con título, pregunta, pista y explicación experta",
      ejecutar: function (N) {
        iguales(N.RETOS.length, 5, "número de retos");
        var claves = {};
        N.RETOS.forEach(function (r) {
          afirmar(r.clave && r.titulo && r.pregunta && r.pista && r.explicacion,
            "reto incompleto: " + (r.clave || "(sin clave)"));
          afirmar(!claves[r.clave], "clave de reto repetida: " + r.clave);
          claves[r.clave] = true;
          afirmar(r.explicacion.length >= 200, r.clave + ": la explicación experta debe ser sustanciosa");
          afirmar(r.explicacion.indexOf("simulación") >= 0 || r.explicacion.indexOf("Hecho") >= 0,
            r.clave + ": la explicación debe distinguir hecho de simulación");
        });
      } },

    { grupo: "Retos", nombre: "La revelación queda bloqueada hasta un intento propio suficiente",
      ejecutar: function (N) {
        iguales(N.puedeRevelar(""), false, "vacío no revela");
        iguales(N.puedeRevelar(null), false, "null no revela");
        iguales(N.puedeRevelar("corto"), false, "texto corto no revela");
        var soloEspacios = "                                                            ";
        iguales(N.puedeRevelar(soloEspacios), false, "solo espacios no revela");
        var casi = new Array(N.MIN_CARACTERES_INTENTO).join("a"); // longitud mínima - 1
        iguales(N.puedeRevelar(casi), false, "un carácter menos del mínimo no revela");
        var justo = new Array(N.MIN_CARACTERES_INTENTO + 1).join("a"); // longitud mínima exacta
        iguales(N.puedeRevelar(justo), true, "el mínimo exacto sí revela");
        iguales(N.puedeRevelar("El DNS traduce nombres de dominio a direcciones IP para poder encaminar."), true,
          "una explicación razonable revela");
      } },

    { grupo: "Contenido", nombre: "Glosario: cada término inglés lleva traducción, definición y fuente",
      ejecutar: function (N) {
        afirmar(N.GLOSARIO.length >= 12, "el glosario debe tener al menos 12 términos");
        var vistos = {};
        N.GLOSARIO.forEach(function (t) {
          afirmar(t.en && t.es && t.definicion && t.fuente, "término incompleto: " + (t.en || "(sin nombre)"));
          afirmar(!vistos[t.en], "término repetido: " + t.en);
          vistos[t.en] = true;
        });
      } },

    { grupo: "Contenido", nombre: "Las direcciones sintéticas declaran su procedencia (RFC 5737 / RFC 1918)",
      ejecutar: function (N) {
        var claves = Object.keys(N.DIRECCIONES);
        afirmar(claves.length === 5, "debe haber 5 direcciones catalogadas");
        claves.forEach(function (c) {
          var d = N.DIRECCIONES[c];
          afirmar(d.ip && d.fuente, c + ": necesita ip y fuente");
          afirmar(d.fuente.indexOf("RFC") >= 0, c + ": la fuente debe citar su RFC");
          afirmar(d.fuente.indexOf("sintético") >= 0, c + ": debe declarar que el valor concreto es sintético");
        });
      } },

    { grupo: "Contenido", nombre: "Los nodos del recorrido son 5 y explican los términos ingleses",
      ejecutar: function (N) {
        igualesJSON(N.NODOS.map(function (n) { return n.clave; }),
          ["equipo", "router", "dns", "proveedor", "servidor"], "orden de nodos");
        N.NODOS.forEach(function (n) {
          afirmar(n.nombre && n.descripcion, n.clave + ": necesita nombre y descripción");
        });
        var evs = N.eventosDe("normal");
        var clavesNodo = {};
        N.NODOS.forEach(function (n) { clavesNodo[n.clave] = true; });
        evs.forEach(function (e) {
          afirmar(clavesNodo[e.desde] && clavesNodo[e.hasta],
            e.id + ": desde/hasta deben ser nodos conocidos");
        });
      } },

    { grupo: "Alcance", nombre: "El núcleo no usa red ni azar: sin llamadas de red, sondas ni aleatoriedad",
      ejecutar: function (N) {
        // El núcleo es un objeto de datos y funciones puras; esta prueba
        // recorre el código fuente de todas sus funciones buscando usos prohibidos.
        // las cadenas se componen por partes para que no aparezcan literalmente
        // en los archivos construidos (el verificador de autocontención las busca)
        var prohibidos = ["fet" + "ch(", "XMLHttp" + "Request", "Web" + "Socket",
          "navigator.send" + "Beacon", "Math.ran" + "dom", "ev" + "al("];
        Object.keys(N).forEach(function (clave) {
          if (typeof N[clave] === "function") {
            var fuente = N[clave].toString();
            prohibidos.forEach(function (p) {
              afirmar(fuente.indexOf(p) < 0, "la función " + clave + " no debe usar " + p);
            });
          }
        });
      } }
  ];

  /* Ejecuta todas las pruebas y devuelve resultados estructurados. */
  function ejecutarTodas(nucleo) {
    return PRUEBAS.map(function (p) {
      var resultado = { grupo: p.grupo, nombre: p.nombre, paso: false, error: null };
      try {
        p.ejecutar(nucleo);
        resultado.paso = true;
      } catch (e) {
        resultado.error = e.message || String(e);
      }
      return resultado;
    });
  }

  return { PRUEBAS: PRUEBAS, ejecutarTodas: ejecutarTodas };
});
