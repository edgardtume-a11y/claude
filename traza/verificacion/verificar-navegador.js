/*
 * TRAZA v1.0.0 — verificación en navegador real (Chromium, file://).
 * Comprueba: consola limpia, ausencia de peticiones de red, pruebas.html en
 * verde, interacción completa (teclado, escenarios, transporte), exportaciones
 * idénticas a los eventos mostrados y bloqueo de los retos.
 * Herramienta de desarrollo: NO forma parte del producto entregado.
 */
"use strict";
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const CAPTURAS = path.join(__dirname, "capturas");
fs.mkdirSync(CAPTURAS, { recursive: true });

const URL_TRAZA = "file://" + path.join(DIST, "traza.html");
const URL_PRUEBAS = "file://" + path.join(DIST, "pruebas.html");

let fallos = 0;
function comprobar(nombre, condicion, detalle) {
  const marca = condicion ? "PASA " : "FALLA";
  if (!condicion) fallos++;
  console.log(`${marca} ${nombre}${condicion ? "" : "  → " + detalle}`);
}

(async () => {
  const navegador = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
  });

  /* ------------------ pruebas.html ------------------ */
  {
    const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 } });
    const pagina = await ctx.newPage();
    const errores = [];
    const peticionesRed = [];
    pagina.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
    pagina.on("pageerror", e => errores.push(String(e)));
    pagina.on("request", r => { if (!r.url().startsWith("file://")) peticionesRed.push(r.url()); });

    await pagina.goto(URL_PRUEBAS);
    await pagina.waitForTimeout(400);

    const titulo = await pagina.title();
    comprobar("pruebas.html: todas las pruebas en verde (título: " + titulo + ")",
      /—\s*(\d+)\/(\1)$/.test(titulo.replace("TRAZA pruebas ", "TRAZA pruebas ")) || /(\d+)\/\1$/.test(titulo),
      "título obtenido: " + titulo);
    const marcador = await pagina.textContent("#marcador");
    const detalleMarcador = await pagina.textContent("#detalle-marcador");
    comprobar("pruebas.html: marcador «" + marcador.trim() + " — " + detalleMarcador.trim() + "»",
      detalleMarcador.includes("todas las pruebas superadas"), detalleMarcador);
    comprobar("pruebas.html: consola sin errores", errores.length === 0, errores.join(" | "));
    comprobar("pruebas.html: cero peticiones de red no locales", peticionesRed.length === 0, peticionesRed.join(", "));

    // botón repetir funciona
    await pagina.click("#repetir");
    await pagina.waitForTimeout(200);
    const marcador2 = await pagina.textContent("#marcador");
    comprobar("pruebas.html: «Repetir pruebas» vuelve a ejecutar", marcador2.trim() === marcador.trim(), marcador2);

    await pagina.screenshot({ path: path.join(CAPTURAS, "pruebas-1366x768.png"), fullPage: false });
    await ctx.close();
  }

  /* ------------------ traza.html: flujo completo ------------------ */
  {
    const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
    const pagina = await ctx.newPage();
    const errores = [];
    const peticionesRed = [];
    pagina.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
    pagina.on("pageerror", e => errores.push(String(e)));
    pagina.on("request", r => { if (!r.url().startsWith("file://")) peticionesRed.push(r.url()); });

    await pagina.goto(URL_TRAZA);
    await pagina.waitForTimeout(400);

    comprobar("traza.html: título correcto", (await pagina.title()).includes("TRAZA"), await pagina.title());
    const sello = await pagina.textContent(".sello-simulacion");
    comprobar("traza.html: aviso de simulación visible en pantalla",
      sello.toLowerCase().includes("simulación"), sello);

    // estado inicial
    comprobar("estado inicial: contador 0/12", (await pagina.textContent("#contador-eventos")).trim() === "0 / 12",
      await pagina.textContent("#contador-eventos"));
    comprobar("estado inicial: inspector sin evento", await pagina.isVisible("#sin-evento"), "");

    // avanzar con botón
    await pagina.click("#boton-avanzar");
    comprobar("avanzar: contador 1/12", (await pagina.textContent("#contador-eventos")).trim() === "1 / 12",
      await pagina.textContent("#contador-eventos"));
    comprobar("avanzar: inspector muestra E01",
      (await pagina.textContent("#campo-evento")).includes("E01"), await pagina.textContent("#campo-evento"));
    comprobar("avanzar: IP origen sintética en el inspector",
      (await pagina.textContent("#campo-origen")).includes("192.168.1.23"), await pagina.textContent("#campo-origen"));

    // teclado: flecha derecha, izquierda, Home, espacio
    await pagina.keyboard.press("ArrowRight");
    comprobar("teclado →: contador 2/12", (await pagina.textContent("#contador-eventos")).trim() === "2 / 12",
      await pagina.textContent("#contador-eventos"));
    await pagina.keyboard.press("ArrowLeft");
    comprobar("teclado ←: contador 1/12", (await pagina.textContent("#contador-eventos")).trim() === "1 / 12",
      await pagina.textContent("#contador-eventos"));
    await pagina.keyboard.press("Home");
    comprobar("teclado Inicio: reinicia a 0/12", (await pagina.textContent("#contador-eventos")).trim() === "0 / 12",
      await pagina.textContent("#contador-eventos"));

    await pagina.keyboard.press(" ");
    await pagina.waitForTimeout(1000);
    const trasEspacio = (await pagina.textContent("#contador-eventos")).trim();
    comprobar("teclado espacio: la reproducción avanza sola (ahora " + trasEspacio + ")",
      trasEspacio !== "0 / 12", trasEspacio);
    await pagina.keyboard.press(" ");
    const enPausa = (await pagina.textContent("#contador-eventos")).trim();
    await pagina.waitForTimeout(1300);
    const sigueIgual = (await pagina.textContent("#contador-eventos")).trim();
    comprobar("teclado espacio: la pausa detiene el avance", enPausa === sigueIgual,
      enPausa + " → " + sigueIgual);

    // reproducir hasta el final
    await pagina.click("#boton-reproducir");
    await pagina.waitForFunction(
      () => document.getElementById("contador-eventos").textContent.trim() === "12 / 12",
      null, { timeout: 30000 });
    comprobar("reproducción completa: llega a 12/12 y se detiene", true, "");
    const botonTexto = await pagina.textContent("#boton-reproducir .texto");
    comprobar("al terminar, el botón vuelve a «Reproducir»", botonTexto.trim() === "Reproducir", botonTexto);

    // navegación por fichas de etapa
    await pagina.click(".etapas button[data-etapa='tls']");
    comprobar("ficha de etapa TLS: salta al primer evento TLS (E07)",
      (await pagina.textContent("#campo-evento")).includes("E07"), await pagina.textContent("#campo-evento"));

    // registro de eventos: clic en un evento
    await pagina.click("#lista-eventos li:nth-child(4) button");
    comprobar("registro: clic en la cuarta fila selecciona E04",
      (await pagina.textContent("#campo-evento")).includes("E04"), await pagina.textContent("#campo-evento"));

    // modo INSPECCIONAR
    await pagina.click("#modo-inspeccionar");
    comprobar("modo inspeccionar: JSON crudo visible", await pagina.isVisible("#json-crudo-texto"), "");
    comprobar("modo inspeccionar: nota de aprendizaje oculta", !(await pagina.isVisible("#nota-aprender")), "");
    const jsonCrudo = await pagina.textContent("#json-crudo-texto");
    comprobar("modo inspeccionar: el JSON declara sintetico:true", jsonCrudo.includes('"sintetico": true'), "");
    await pagina.click("#modo-aprender");
    comprobar("modo aprender: nota de aprendizaje visible de nuevo", await pagina.isVisible("#nota-aprender"), "");

    // exportaciones: JSON y LOG con los mismos eventos mostrados
    const eventosMostrados = await pagina.evaluate(() =>
      Array.from(document.querySelectorAll("#lista-eventos .id-evento")).map(e => e.textContent));
    const [descargaJson] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#exportar-json")]);
    const rutaJson = path.join(CAPTURAS, "descarga-normal.json");
    await descargaJson.saveAs(rutaJson);
    comprobar("exportar JSON: nombre de archivo", descargaJson.suggestedFilename() === "traza_normal.json",
      descargaJson.suggestedFilename());
    const docJson = JSON.parse(fs.readFileSync(rutaJson, "utf8"));
    comprobar("exportar JSON: esquema traza.eventos.v1", docJson.esquema === "traza.eventos.v1", docJson.esquema);
    comprobar("exportar JSON: mismos eventos que el registro mostrado (" + eventosMostrados.length + ")",
      JSON.stringify(docJson.eventos.map(e => e.id)) === JSON.stringify(eventosMostrados),
      JSON.stringify(docJson.eventos.map(e => e.id)));

    const [descargaLog] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#exportar-log")]);
    const rutaLog = path.join(CAPTURAS, "descarga-normal.log");
    await descargaLog.saveAs(rutaLog);
    comprobar("exportar LOG: nombre de archivo", descargaLog.suggestedFilename() === "traza_normal.log",
      descargaLog.suggestedFilename());
    const log = fs.readFileSync(rutaLog, "utf8");
    const lineasLog = log.split("\n").filter(l => l.length > 0 && !l.startsWith("#"));
    comprobar("exportar LOG: una línea por evento mostrado",
      lineasLog.length === eventosMostrados.length, lineasLog.length + " líneas");
    comprobar("exportar LOG: mismos identificadores y orden",
      JSON.stringify(lineasLog.map(l => l.replace(/^\[\+\s*\d+ ms\]\s+/, "").split(/\s+/)[0])) === JSON.stringify(eventosMostrados), "");
    comprobar("exportar LOG: cada línea marcada (SINTETICO)", lineasLog.every(l => l.includes("(SINTETICO)")), "");

    // escenario: fallo de DNS
    await pagina.click(".escenarios button[data-escenario='fallo-dns']");
    comprobar("fallo-dns: contador reiniciado a 0/3", (await pagina.textContent("#contador-eventos")).trim() === "0 / 3",
      await pagina.textContent("#contador-eventos"));
    const noAlcanzadas = await pagina.$$eval(".etapas button.no-alcanzada", bs => bs.length);
    comprobar("fallo-dns: 5 etapas marcadas como no alcanzadas", noAlcanzadas === 5, String(noAlcanzadas));
    await pagina.click("#boton-avanzar"); await pagina.click("#boton-avanzar");
    const estadoCampo = await pagina.textContent("#campo-estado");
    comprobar("fallo-dns: el segundo evento es un error (NXDOMAIN)", estadoCampo.trim() === "error", estadoCampo);
    await pagina.screenshot({ path: path.join(CAPTURAS, "traza-fallo-dns-1366x768.png") });

    // escenario: intentos fallidos
    await pagina.click(".escenarios button[data-escenario='intentos-fallidos']");
    comprobar("intentos-fallidos: 12 eventos", (await pagina.textContent("#contador-eventos")).trim() === "0 / 12",
      await pagina.textContent("#contador-eventos"));
    const [descargaJson2] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#exportar-json")]);
    comprobar("intentos-fallidos: exportación nombra el escenario",
      descargaJson2.suggestedFilename() === "traza_intentos-fallidos.json", descargaJson2.suggestedFilename());

    // retos: bloqueo antes del intento propio
    const primerReto = pagina.locator(".reto").first();
    comprobar("retos: hay 5 retos en pantalla", await pagina.locator(".reto").count() === 5,
      String(await pagina.locator(".reto").count()));
    comprobar("retos: explicación oculta al cargar",
      await primerReto.locator(".explicacion-experta").isHidden(), "");
    comprobar("retos: botón revelar deshabilitado al cargar",
      await primerReto.locator(".revelar").isDisabled(), "");
    await primerReto.locator("textarea").fill("respuesta corta");
    comprobar("retos: un intento corto no habilita el botón",
      await primerReto.locator(".revelar").isDisabled(), "");
    comprobar("retos: la explicación sigue oculta tras el intento corto",
      await primerReto.locator(".explicacion-experta").isHidden(), "");
    await primerReto.locator("textarea").fill(
      "El equipo necesita el DNS porque los paquetes solo viajan hacia direcciones IP y el nombre debe traducirse antes de abrir la conexión.");
    comprobar("retos: un intento suficiente habilita el botón",
      await primerReto.locator(".revelar").isEnabled(), "");
    await primerReto.locator(".revelar").click();
    comprobar("retos: al revelar se muestra la explicación experta",
      await primerReto.locator(".explicacion-experta").isVisible(), "");
    const explicacion = await primerReto.locator(".explicacion-experta").textContent();
    comprobar("retos: la explicación distingue hecho de simulación",
      explicacion.includes("Hecho") && explicacion.includes("simulación"), "");

    // accesibilidad básica: foco visible y salto de contenido (página recién cargada)
    await pagina.goto(URL_TRAZA);
    await pagina.waitForTimeout(300);
    await pagina.keyboard.press("Tab");
    const primerFoco = await pagina.evaluate(() => document.activeElement.className);
    comprobar("accesibilidad: el primer tabulador cae en el enlace de salto", primerFoco === "salto", primerFoco);
    const vivo = await pagina.getAttribute("#anuncio", "aria-live");
    comprobar("accesibilidad: región viva para lectores de pantalla", vivo === "polite", String(vivo));

    // captura final de escritorio en escenario normal, modo inspeccionar
    await pagina.click("#modo-inspeccionar");
    for (let i = 0; i < 7; i++) await pagina.keyboard.press("ArrowRight");
    await pagina.waitForTimeout(1100);
    await pagina.screenshot({ path: path.join(CAPTURAS, "traza-normal-1366x768.png") });

    comprobar("traza.html: consola sin errores en todo el flujo", errores.length === 0, errores.join(" | "));
    comprobar("traza.html: cero peticiones de red no locales", peticionesRed.length === 0, peticionesRed.join(", "));
    await ctx.close();
  }

  /* ------------------ traza.html: móvil 390x844 ------------------ */
  {
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const pagina = await ctx.newPage();
    const errores = [];
    pagina.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
    pagina.on("pageerror", e => errores.push(String(e)));
    await pagina.goto(URL_TRAZA);
    await pagina.waitForTimeout(400);
    const desbordamiento = await pagina.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    comprobar("móvil 390x844: sin desplazamiento horizontal del documento (desborde " + desbordamiento + "px)",
      desbordamiento <= 0, desbordamiento + "px");
    await pagina.click("#boton-avanzar");
    comprobar("móvil: avanzar funciona", (await pagina.textContent("#contador-eventos")).trim() === "1 / 12",
      await pagina.textContent("#contador-eventos"));
    comprobar("móvil: consola sin errores", errores.length === 0, errores.join(" | "));
    await pagina.screenshot({ path: path.join(CAPTURAS, "traza-390x844.png") });
    await ctx.close();
  }

  /* ------------------ movimiento reducido ------------------ */
  {
    const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
    const pagina = await ctx.newPage();
    const errores = [];
    pagina.on("pageerror", e => errores.push(String(e)));
    await pagina.goto(URL_TRAZA);
    await pagina.waitForTimeout(300);
    await pagina.click("#boton-avanzar");
    const transicion = await pagina.evaluate(() =>
      getComputedStyle(document.getElementById("paquete")).transitionDuration);
    comprobar("movimiento reducido: transición del paquete anulada (" + transicion + ")",
      transicion.split(",").every(v => v.trim() === "0s"), transicion);
    comprobar("movimiento reducido: sin errores", errores.length === 0, errores.join(" | "));
    await ctx.close();
  }

  await navegador.close();
  console.log(`\n${fallos === 0 ? "VERIFICACIÓN COMPLETA EN VERDE" : fallos + " comprobaciones fallidas"}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error("ERROR FATAL:", e); process.exit(1); });
