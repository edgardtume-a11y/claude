/* Sondeo de casos límite para la auditoría externa (solo lectura del dist entregado). */
"use strict";
const { chromium } = require("playwright-core");
const path = require("path");
const URL_TRAZA = "file://" + path.join(__dirname, "..", "dist", "traza.html");

(async () => {
  const nav = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
  });
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
  await p.goto(URL_TRAZA);
  await p.waitForTimeout(300);

  // P1: cambiar de escenario en plena reproducción
  await p.keyboard.press(" ");
  await p.waitForTimeout(1600);
  const antes = (await p.textContent("#contador-eventos")).trim();
  await p.click(".escenarios button[data-escenario='fallo-dns']");
  const tras = (await p.textContent("#contador-eventos")).trim();
  await p.waitForTimeout(1500);
  const tras2 = (await p.textContent("#contador-eventos")).trim();
  console.log("P1 cambio de escenario en reproducción: antes=" + antes + " tras=" + tras + " +1.5s=" + tras2);

  // P2: al final, espacio reinicia
  await p.click(".escenarios button[data-escenario='fallo-dns']");
  for (let i = 0; i < 5; i++) await p.click("#boton-avanzar").catch(()=>{});
  const alFinal = (await p.textContent("#contador-eventos")).trim();
  const avanzarDeshab = await p.isDisabled("#boton-avanzar");
  await p.keyboard.press(" ");
  await p.waitForTimeout(900);
  const trasEspacio = (await p.textContent("#contador-eventos")).trim();
  console.log("P2 al final: contador=" + alFinal + " avanzarDisabled=" + avanzarDeshab + " trasEspacio(reproduce)=" + trasEspacio);

  // P3: pérdida de foco por reconstrucción de la lista de eventos
  await p.click(".escenarios button[data-escenario='normal']");
  await p.click("#lista-eventos li:nth-child(2) button");
  const focoAntes = await p.evaluate(() => document.activeElement.closest("#lista-eventos") ? "en la lista" : document.activeElement.tagName);
  await p.click("#boton-avanzar"); // reconstruye la lista
  const focoDespues = await p.evaluate(() => {
    const a = document.activeElement;
    return (a.closest && a.closest("#lista-eventos")) ? "en la lista" : (a.id || a.tagName);
  });
  console.log("P3 foco: tras clic en fila=" + focoAntes + " · tras avanzar (lista reconstruida)=" + focoDespues);

  // P3b: foco dentro de la lista durante reproducción automática
  await p.focus("#lista-eventos li:nth-child(3) button");
  const f1 = await p.evaluate(() => document.activeElement.closest("#lista-eventos") ? "lista" : (document.activeElement.id || document.activeElement.tagName));
  await p.click("#boton-reproducir");
  await p.waitForTimeout(1200);
  const f2 = await p.evaluate(() => document.activeElement.closest("#lista-eventos") ? "lista" : (document.activeElement.id || document.activeElement.tagName));
  await p.click("#boton-reproducir").catch(()=>{});
  console.log("P3b foco con autoplay: antes=" + f1 + " después=" + f2);

  // P4: exportar sin haber mostrado ningún evento
  await p.keyboard.press("Home");
  const contadorCero = (await p.textContent("#contador-eventos")).trim();
  const [d] = await Promise.all([p.waitForEvent("download"), p.click("#exportar-json")]);
  const ruta = "/tmp/claude-0/-home-user-claude/c62b6565-edf5-5ad7-a2ab-9062bef89365/scratchpad/exportar-en-cero.json";
  await d.saveAs(ruta);
  const nEventos = require(ruta).eventos.length;
  console.log("P4 exportar con contador " + contadorCero + ": el JSON contiene " + nEventos + " eventos");

  // P5: contraste real de las etiquetas dt del inspector (tinta-4)
  await p.click("#boton-avanzar");
  const colorDt = await p.evaluate(() => getComputedStyle(document.querySelector(".campo dt")).color);
  const colorNum = await p.evaluate(() => getComputedStyle(document.querySelector(".etapas .numero")).color);
  console.log("P5 colores: campo dt=" + colorDt + " · etapas .numero=" + colorNum + " (sobre fondo #05070a↦#0b0f15)");

  // P6: pulsaciones rápidas entrelazadas
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press(i % 3 === 0 ? "ArrowLeft" : "ArrowRight");
  }
  console.log("P6 40 pulsaciones rápidas: contador=" + (await p.textContent("#contador-eventos")).trim());

  // P7: fichas deshabilitadas en fallo-dns → ¿alcanzables con Tab / lector?
  await p.click(".escenarios button[data-escenario='fallo-dns']");
  const deshab = await p.$$eval(".etapas button[disabled]", bs => bs.length);
  console.log("P7 fallo-dns: " + deshab + " fichas con atributo disabled (fuera del orden de tabulación y sin nombre para el lector)");

  // P8: el enlace de salto ¿mueve el foco?
  await p.goto(URL_TRAZA); await p.waitForTimeout(300);
  await p.keyboard.press("Tab");
  await p.keyboard.press("Enter");
  const focoSalto = await p.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  console.log("P8 tras activar el enlace de salto, el foco queda en: " + focoSalto);

  // P9: última etapa ¿se marca completada al terminar?
  await p.click(".escenarios button[data-escenario='normal']");
  for (let i = 0; i < 12; i++) await p.click("#boton-avanzar").catch(()=>{});
  const clasesUltima = await p.getAttribute(".etapas button[data-etapa='http_respuesta']", "class");
  console.log("P9 al llegar a 12/12, clases de la ficha 06: «" + (clasesUltima||"") + "»");

  console.log("Errores de consola/página durante el sondeo: " + (errores.length ? errores.join(" | ") : "ninguno"));
  await nav.close();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
