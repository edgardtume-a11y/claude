/*
 * TRAZA v1.0.0 — app.js
 * Controlador de la interfaz. Toda la lógica de simulación vive en el
 * núcleo (TRAZA_NUCLEO); aquí solo se dibuja, se escucha al teclado y al
 * ratón, y se descargan las exportaciones. Sin red, sin telemetría.
 */
(function () {
  "use strict";

  var N = window.TRAZA_NUCLEO;
  var $ = function (selector) { return document.querySelector(selector); };

  /* Posición horizontal de cada nodo dentro del lienzo SVG (viewBox 0 0 1000 200). */
  var POS_NODO = { equipo: 80, router: 290, dns: 500, proveedor: 710, servidor: 920 };
  var Y_NODO = 78;

  var reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Estado de la aplicación (solo interfaz; el reproductor es del núcleo). */
  var app = {
    escenario: "normal",
    eventos: N.eventosDe("normal"),
    reproductor: N.reproductorInicial(),
    modo: "aprender",       // "aprender" | "inspeccionar"
    temporizador: null
  };

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function eventoActual() {
    return app.reproductor.indice >= 0 ? app.eventos[app.reproductor.indice] : null;
  }

  function textoEstado(estado) {
    return { ok: "correcto", info: "informativo", advertencia: "advertencia", error: "error" }[estado] || estado;
  }

  function formatearInstante(t_ms) {
    return "+" + t_ms + " ms";
  }

  /* Pausa el temporizador de reproducción automática si existe. */
  function detenerTemporizador() {
    if (app.temporizador !== null) {
      window.clearTimeout(app.temporizador);
      app.temporizador = null;
    }
  }

  /* Si el reproductor está en marcha, planifica el siguiente paso.
     El ritmo se deriva del tiempo simulado, acotado para ser legible. */
  function planificarSiguiente() {
    detenerTemporizador();
    if (!app.reproductor.reproduciendo) return;
    var i = app.reproductor.indice;
    var dtSimulado = 60;
    if (i >= 0 && i < app.eventos.length - 1) {
      dtSimulado = app.eventos[i + 1].t_ms - app.eventos[i].t_ms;
    }
    var espera = Math.min(2200, Math.max(750, dtSimulado * 6));
    app.temporizador = window.setTimeout(function () {
      app.reproductor = N.avanzar(app.reproductor, app.eventos.length);
      render();
    }, espera);
  }

  /* ------------------------------------------------------------------ */
  /* Descargas locales (sin red: Blob + URL de objeto)                   */
  /* ------------------------------------------------------------------ */

  function descargar(nombreArchivo, contenido, tipoMime) {
    var blob = new Blob([contenido], { type: tipoMime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    avisar("Descargado: " + nombreArchivo);
  }

  function avisar(texto) {
    var zona = $("#avisos");
    var aviso = document.createElement("div");
    aviso.className = "aviso-flotante";
    aviso.setAttribute("role", "status");
    aviso.textContent = texto;
    zona.appendChild(aviso);
    window.setTimeout(function () { zona.removeChild(aviso); }, 3500);
  }

  /* ------------------------------------------------------------------ */
  /* Dibujo: lienzo (nodos y paquete)                                    */
  /* ------------------------------------------------------------------ */

  function renderLienzo() {
    var e = eventoActual();
    var paquete = $("#paquete");

    // nodos activos
    document.querySelectorAll(".lienzo .nodo").forEach(function (nodo) {
      var clave = nodo.getAttribute("data-nodo");
      var activo = e !== null && (e.desde === clave || e.hasta === clave);
      nodo.classList.toggle("activo", activo);
    });

    if (e === null) {
      paquete.classList.remove("visible");
      return;
    }

    paquete.classList.add("visible");
    paquete.setAttribute("class", "paquete visible estado-" + e.estado);

    var xDesde = POS_NODO[e.desde];
    var xHasta = POS_NODO[e.hasta];

    if (e.tipo === "estado" || xDesde === xHasta || reducirMovimiento.matches) {
      // sin desplazamiento: el paquete aparece en el nodo de destino
      paquete.style.transition = "none";
      paquete.style.transform = "translate(" + xHasta + "px, " + Y_NODO + "px)";
      // reactivar la transición en el siguiente cuadro para futuros eventos
      window.requestAnimationFrame(function () { paquete.style.transition = ""; });
    } else {
      // colocar en el origen sin animar…
      paquete.style.transition = "none";
      paquete.style.transform = "translate(" + xDesde + "px, " + Y_NODO + "px)";
      void paquete.getBoundingClientRect(); // forzar el cálculo de estilos
      // …y deslizar hasta el destino con la curva suave
      paquete.style.transition = "";
      paquete.style.transform = "translate(" + xHasta + "px, " + Y_NODO + "px)";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Dibujo: fichas de etapas                                            */
  /* ------------------------------------------------------------------ */

  function renderEtapas() {
    var presentes = N.etapasPresentes(app.eventos);
    var e = eventoActual();
    var indiceActual = app.reproductor.indice;

    document.querySelectorAll(".etapas button").forEach(function (boton) {
      var clave = boton.getAttribute("data-etapa");
      var presente = presentes.indexOf(clave) >= 0;
      var primerIndice = N.primerIndiceDeEtapa(app.eventos, clave);

      boton.classList.toggle("no-alcanzada", !presente);
      boton.disabled = !presente;
      boton.title = presente
        ? "Ir al primer evento de la etapa"
        : "Etapa no alcanzada en este escenario";

      var esActual = e !== null && e.etapa === clave;
      if (esActual) boton.setAttribute("aria-current", "step");
      else boton.removeAttribute("aria-current");

      // completada: ya se pasó su último evento
      var ultimoIndice = -1;
      for (var i = app.eventos.length - 1; i >= 0; i--) {
        if (app.eventos[i].etapa === clave) { ultimoIndice = i; break; }
      }
      boton.classList.toggle("completada", presente && ultimoIndice >= 0 && indiceActual > ultimoIndice);

      // marcar la etapa si alguno de sus eventos ya vistos es un error
      var conError = false;
      for (var j = 0; j <= indiceActual && j < app.eventos.length; j++) {
        if (app.eventos[j].etapa === clave && app.eventos[j].estado === "error") conError = true;
      }
      boton.classList.toggle("con-error", conError);
      void primerIndice; // el índice se usa al pulsar (manejador aparte)
    });
  }

  /* ------------------------------------------------------------------ */
  /* Dibujo: lista de eventos                                            */
  /* ------------------------------------------------------------------ */

  function renderListaEventos() {
    var lista = $("#lista-eventos");
    lista.innerHTML = "";
    app.eventos.forEach(function (e, i) {
      var li = document.createElement("li");
      if (i === app.reproductor.indice) li.className = "actual";
      else if (i > app.reproductor.indice) li.className = "futuro";

      var boton = document.createElement("button");
      boton.type = "button";
      boton.setAttribute("aria-label",
        "Ir al evento " + e.id + ", " + formatearInstante(e.t_ms) + ", " + e.resumen);

      var instante = document.createElement("span");
      instante.className = "instante";
      instante.textContent = formatearInstante(e.t_ms);

      var id = document.createElement("span");
      id.className = "id-evento";
      id.textContent = e.id;

      var resumen = document.createElement("span");
      resumen.className = "resumen";
      if (e.estado === "advertencia" || e.estado === "error") {
        var marca = document.createElement("span");
        marca.className = e.estado === "error" ? "marca-error" : "marca-advertencia";
        marca.textContent = "[" + textoEstado(e.estado) + "] ";
        resumen.appendChild(marca);
      }
      resumen.appendChild(document.createTextNode(e.resumen));

      boton.appendChild(instante);
      boton.appendChild(id);
      boton.appendChild(resumen);
      boton.addEventListener("click", function () {
        detenerTemporizador();
        app.reproductor = N.irA(app.reproductor, i, app.eventos.length);
        render();
      });
      li.appendChild(boton);
      lista.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Dibujo: inspector lateral                                           */
  /* ------------------------------------------------------------------ */

  function ponerCampo(idCampo, valor, claseExtra) {
    var dd = $("#" + idCampo);
    dd.textContent = "";
    dd.classList.toggle("vacio", valor === null || valor === undefined || valor === "—");
    if (claseExtra) {
      var span = document.createElement("span");
      span.className = claseExtra;
      span.textContent = valor;
      dd.appendChild(span);
    } else {
      dd.textContent = (valor === null || valor === undefined) ? "—" : String(valor);
    }
  }

  function renderInspector() {
    var e = eventoActual();
    var sinEvento = $("#sin-evento");
    var conEvento = $("#con-evento");

    if (e === null) {
      sinEvento.hidden = false;
      conEvento.hidden = true;
      return;
    }
    sinEvento.hidden = true;
    conEvento.hidden = false;

    var etapa = null;
    for (var i = 0; i < N.ETAPAS.length; i++) {
      if (N.ETAPAS[i].clave === e.etapa) { etapa = N.ETAPAS[i]; break; }
    }

    ponerCampo("campo-instante", formatearInstante(e.t_ms) + " (simulado)");
    ponerCampo("campo-evento", e.id + " · " + e.tipo);
    ponerCampo("campo-etapa", etapa ? etapa.nombre : e.etapa);
    ponerCampo("campo-protocolo", e.protocolo);
    ponerCampo("campo-origen", e.origen_ip ? e.origen_ip + " : " + e.origen_puerto : "—");
    ponerCampo("campo-destino", e.destino_ip ? e.destino_ip + " : " + e.destino_puerto : "—");
    ponerCampo("campo-tamano", e.tam_bytes === null ? "—" : e.tam_bytes + " bytes (simulado)");
    ponerCampo("campo-estado", textoEstado(e.estado), "estado-" + e.estado);

    $("#resumen-evento").textContent = e.resumen;
    $("#evidencia-texto").textContent = e.detalle;

    // modo APRENDER: nota gradual + explicación de la etapa
    var nota = $("#nota-aprender");
    nota.textContent = e.nota_aprender;

    if (etapa) {
      $("#etapa-titulo").textContent = etapa.nombre;
      $("#etapa-termino").textContent = etapa.termino_en + " — " + etapa.termino_es;
      $("#etapa-explicacion").textContent = etapa.explicacion;
      $("#etapa-fuente").textContent = etapa.fuente;
    }

    // modo INSPECCIONAR: evento crudo en JSON
    $("#json-crudo-texto").textContent = JSON.stringify(e, null, 2);
  }

  /* ------------------------------------------------------------------ */
  /* Dibujo: transporte y progreso                                       */
  /* ------------------------------------------------------------------ */

  function renderTransporte() {
    var total = app.eventos.length;
    var i = app.reproductor.indice;

    $("#boton-retroceder").disabled = i <= -1;
    $("#boton-avanzar").disabled = i >= total - 1;
    $("#boton-reiniciar").disabled = i <= -1 && !app.reproductor.reproduciendo;

    var botonReproducir = $("#boton-reproducir");
    var reproduciendo = app.reproductor.reproduciendo;
    botonReproducir.querySelector(".texto").textContent = reproduciendo ? "Pausa" : "Reproducir";
    botonReproducir.setAttribute("aria-label",
      reproduciendo ? "Pausar la reproducción" : "Reproducir la simulación");
    $("#icono-reproducir").style.display = reproduciendo ? "none" : "";
    $("#icono-pausa").style.display = reproduciendo ? "" : "none";

    $("#contador-eventos").textContent = (i + 1) + " / " + total;
    $("#barra-progreso-relleno").style.width =
      total > 0 ? Math.round(((i + 1) / total) * 100) + "%" : "0%";
  }

  /* ------------------------------------------------------------------ */
  /* Anuncio para lectores de pantalla                                   */
  /* ------------------------------------------------------------------ */

  function anunciar() {
    var e = eventoActual();
    $("#anuncio").textContent = e === null
      ? "Simulación al principio, ningún evento mostrado."
      : "Evento " + e.id + ", " + formatearInstante(e.t_ms) + ": " + e.resumen;
  }

  /* ------------------------------------------------------------------ */
  /* Render general                                                      */
  /* ------------------------------------------------------------------ */

  function render() {
    renderLienzo();
    renderEtapas();
    renderListaEventos();
    renderInspector();
    renderTransporte();
    anunciar();
    planificarSiguiente();
  }

  /* ------------------------------------------------------------------ */
  /* Escenarios                                                          */
  /* ------------------------------------------------------------------ */

  function cambiarEscenario(clave) {
    detenerTemporizador();
    app.escenario = clave;
    app.eventos = N.eventosDe(clave);
    app.reproductor = N.reproductorInicial();

    document.querySelectorAll(".escenarios button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-escenario") === clave ? "true" : "false");
    });
    var lista = N.listaEscenarios();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].clave === clave) {
        $("#descripcion-escenario").textContent = lista[i].descripcion;
      }
    }
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Modo APRENDER / INSPECCIONAR                                        */
  /* ------------------------------------------------------------------ */

  function cambiarModo(modo) {
    app.modo = modo;
    document.body.setAttribute("data-modo", modo);
    $("#modo-aprender").setAttribute("aria-pressed", modo === "aprender" ? "true" : "false");
    $("#modo-inspeccionar").setAttribute("aria-pressed", modo === "inspeccionar" ? "true" : "false");
    $("#bloque-aprender").hidden = modo !== "aprender";
    $("#bloque-inspeccionar").hidden = modo !== "inspeccionar";
  }

  /* ------------------------------------------------------------------ */
  /* Retos guiados                                                       */
  /* ------------------------------------------------------------------ */

  function construirRetos() {
    var contenedor = $("#lista-retos");
    N.RETOS.forEach(function (reto) {
      var articulo = document.createElement("article");
      articulo.className = "reto";

      var titulo = document.createElement("h3");
      titulo.textContent = reto.titulo;
      titulo.id = "titulo-" + reto.clave;

      var pregunta = document.createElement("p");
      pregunta.className = "pregunta";
      pregunta.textContent = reto.pregunta;

      var pista = document.createElement("p");
      pista.className = "pista";
      var pistaClave = document.createElement("span");
      pistaClave.className = "clave";
      pistaClave.textContent = "Pista: ";
      pista.appendChild(pistaClave);
      pista.appendChild(document.createTextNode(reto.pista));

      var area = document.createElement("textarea");
      area.setAttribute("aria-labelledby", "titulo-" + reto.clave);
      area.placeholder = "Escribe primero tu propia explicación (mínimo "
        + N.MIN_CARACTERES_INTENTO + " caracteres) para poder revelar la experta…";

      var pie = document.createElement("div");
      pie.className = "pie-reto";

      var contador = document.createElement("span");
      contador.className = "contador-intento";
      contador.setAttribute("aria-hidden", "true");
      contador.textContent = "0 / " + N.MIN_CARACTERES_INTENTO + " caracteres";

      var boton = document.createElement("button");
      boton.type = "button";
      boton.className = "revelar";
      boton.disabled = true;
      boton.textContent = "Revelar explicación experta";
      boton.setAttribute("aria-expanded", "false");

      var explicacion = document.createElement("div");
      explicacion.className = "explicacion-experta";
      explicacion.hidden = true;
      explicacion.textContent = reto.explicacion;

      area.addEventListener("input", function () {
        var util = area.value.trim().length;
        contador.textContent = Math.min(util, 999) + " / " + N.MIN_CARACTERES_INTENTO + " caracteres";
        if (explicacion.hidden) boton.disabled = !N.puedeRevelar(area.value);
      });

      boton.addEventListener("click", function () {
        if (!N.puedeRevelar(area.value)) return; // defensa adicional
        explicacion.hidden = false;
        boton.disabled = true;
        boton.textContent = "Explicación revelada";
        boton.setAttribute("aria-expanded", "true");
      });

      pie.appendChild(contador);
      pie.appendChild(boton);
      articulo.appendChild(titulo);
      articulo.appendChild(pregunta);
      articulo.appendChild(pista);
      articulo.appendChild(area);
      articulo.appendChild(pie);
      articulo.appendChild(explicacion);
      contenedor.appendChild(articulo);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Glosario                                                            */
  /* ------------------------------------------------------------------ */

  function construirGlosario() {
    var contenedor = $("#lista-glosario");
    N.GLOSARIO.forEach(function (termino) {
      var detalles = document.createElement("details");
      var resumen = document.createElement("summary");

      var nombre = document.createElement("span");
      nombre.textContent = termino.en;
      var traduccion = document.createElement("span");
      traduccion.className = "traduccion";
      traduccion.textContent = termino.es;

      resumen.appendChild(nombre);
      resumen.appendChild(traduccion);

      var cuerpo = document.createElement("div");
      cuerpo.className = "cuerpo-termino";
      cuerpo.textContent = termino.definicion;

      var fuente = document.createElement("p");
      fuente.className = "fuente-termino";
      fuente.textContent = "Fuente: " + termino.fuente;
      cuerpo.appendChild(fuente);

      detalles.appendChild(resumen);
      detalles.appendChild(cuerpo);
      contenedor.appendChild(detalles);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Procedencia de las direcciones (modo INSPECCIONAR)                  */
  /* ------------------------------------------------------------------ */

  function construirFuentesDirecciones() {
    var contenedor = $("#fuentes-direcciones");
    var nombres = {
      equipo_lan: "Equipo (LAN)",
      router_lan: "Router (LAN)",
      router_wan: "Router (WAN)",
      resolvedor: "Resolvedor DNS",
      servidor: "Servidor web"
    };
    Object.keys(N.DIRECCIONES).forEach(function (clave) {
      var d = N.DIRECCIONES[clave];
      var parrafo = document.createElement("p");
      parrafo.className = "procedencia";
      var ip = document.createElement("span");
      ip.className = "dato";
      ip.textContent = d.ip;
      parrafo.appendChild(ip);
      parrafo.appendChild(document.createTextNode(
        " — " + (nombres[clave] || clave) + ". " + d.fuente));
      contenedor.appendChild(parrafo);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Controles                                                           */
  /* ------------------------------------------------------------------ */

  function accionReproducir() {
    app.reproductor = N.alternarReproduccion(app.reproductor, app.eventos.length);
    render();
  }
  function accionAvanzar() {
    detenerTemporizador();
    app.reproductor = N.pausar(app.reproductor);
    app.reproductor = N.avanzar(app.reproductor, app.eventos.length);
    render();
  }
  function accionRetroceder() {
    detenerTemporizador();
    app.reproductor = N.retroceder(app.reproductor);
    render();
  }
  function accionReiniciar() {
    detenerTemporizador();
    app.reproductor = N.reiniciar();
    render();
  }

  function conectarControles() {
    $("#boton-reproducir").addEventListener("click", accionReproducir);
    $("#boton-avanzar").addEventListener("click", accionAvanzar);
    $("#boton-retroceder").addEventListener("click", accionRetroceder);
    $("#boton-reiniciar").addEventListener("click", accionReiniciar);

    document.querySelectorAll(".escenarios button").forEach(function (b) {
      b.addEventListener("click", function () {
        cambiarEscenario(b.getAttribute("data-escenario"));
      });
    });

    document.querySelectorAll(".etapas button").forEach(function (b) {
      b.addEventListener("click", function () {
        var indice = N.primerIndiceDeEtapa(app.eventos, b.getAttribute("data-etapa"));
        if (indice >= 0) {
          detenerTemporizador();
          app.reproductor = N.irA(app.reproductor, indice, app.eventos.length);
          render();
        }
      });
    });

    $("#modo-aprender").addEventListener("click", function () { cambiarModo("aprender"); });
    $("#modo-inspeccionar").addEventListener("click", function () { cambiarModo("inspeccionar"); });

    $("#exportar-json").addEventListener("click", function () {
      var contenido = N.exportarJSON(app.escenario, app.eventos, new Date().toISOString());
      descargar("traza_" + app.escenario + ".json", contenido, "application/json");
    });
    $("#exportar-log").addEventListener("click", function () {
      var contenido = N.exportarLOG(app.escenario, app.eventos, new Date().toISOString());
      descargar("traza_" + app.escenario + ".log", contenido, "text/plain");
    });

    /* Atajos de teclado (se ignoran mientras se escribe en un campo). */
    document.addEventListener("keydown", function (evento) {
      var objetivo = evento.target;
      var etiqueta = objetivo && objetivo.tagName ? objetivo.tagName.toLowerCase() : "";
      if (etiqueta === "textarea" || etiqueta === "input" || etiqueta === "select" ||
          (objetivo && objetivo.isContentEditable)) {
        return;
      }
      switch (evento.key) {
        case " ":
          evento.preventDefault();
          accionReproducir();
          break;
        case "ArrowRight":
          evento.preventDefault();
          accionAvanzar();
          break;
        case "ArrowLeft":
          evento.preventDefault();
          accionRetroceder();
          break;
        case "Home":
          evento.preventDefault();
          accionReiniciar();
          break;
        case "r":
        case "R":
          accionReiniciar();
          break;
      }
    });

    /* Si cambia la preferencia de movimiento, redibujar sin animación. */
    if (typeof reducirMovimiento.addEventListener === "function") {
      reducirMovimiento.addEventListener("change", render);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  function iniciar() {
    construirRetos();
    construirGlosario();
    construirFuentesDirecciones();
    conectarControles();
    cambiarModo("aprender");
    cambiarEscenario("normal");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
