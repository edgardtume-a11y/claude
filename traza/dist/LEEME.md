# TRAZA v1.0.0 — laboratorio del viaje de una petición web

TRAZA es un laboratorio visual y educativo, **totalmente local**, que muestra el viaje de
una petición web desde un equipo doméstico hasta un servidor y de vuelta.

> **Todo lo que muestra TRAZA es una simulación con datos sintéticos.**
> No se contacta con ninguna red, dominio ni equipo real. No hay telemetría, cookies,
> llamadas externas ni dependencias. El propio archivo incluye una política de seguridad
> de contenido (CSP, *Content Security Policy*: política de seguridad de contenido) que
> bloquea cualquier conexión.

---

## Qué enseña

El recorrido completo de una petición HTTPS en seis etapas, con su vocabulario técnico
traducido y explicado:

1. **Resolución DNS** (*Domain Name System*: sistema de nombres de dominio) — traducir el
   nombre a una dirección IP.
2. **Traducción NAT** (*Network Address Translation*: traducción de direcciones de red) —
   cómo el router doméstico comparte una única dirección pública.
3. **Conexión TCP** (*Transmission Control Protocol*: protocolo de control de transmisión) —
   el apretón de manos en tres pasos.
4. **Negociación TLS** (*Transport Layer Security*: seguridad de la capa de transporte) —
   el cifrado, el certificado y lo que el cifrado **no** oculta.
5. **Petición HTTP** (*HyperText Transfer Protocol*: protocolo de transferencia de
   hipertexto) — método, ruta y cabeceras.
6. **Respuesta HTTP** — códigos de estado y llegada de la página.

Además: un escenario de **fallo de DNS** (NXDOMAIN) y otro de **intentos fallidos de
acceso** con la respuesta defensiva del servidor (códigos 401 y 429, limitación de tasa),
contado siempre desde el punto de vista de la defensa y la educación.

## Cómo abrirlo

1. Descomprime `TRAZA_v1.0.0.zip` en cualquier carpeta.
2. Haz **doble clic en `traza.html`**. Se abre en cualquier navegador de escritorio
   moderno (Chrome/Chromium, Edge, Firefox, Safari) **sin conexión a internet**.
3. Para comprobar el estado del producto, abre `pruebas.html` de la misma forma: verás
   cada prueba en verde (pasa) o rojo (falla) con su detalle.

No necesita instalación, servidor, ni permisos especiales.

## Controles

| Control | Acción |
| --- | --- |
| **Reproducir / Pausa** | Reproduce la simulación evento a evento o la detiene |
| **Adelante / Atrás** | Avanza o retrocede exactamente un evento |
| **Reiniciar** | Vuelve al estado inicial del escenario |
| **Fichas de etapa (01–06)** | Saltan al primer evento de esa etapa |
| **Registro de eventos** | Clic en cualquier fila para ir a ese evento |

Atajos de teclado (activos cuando no se está escribiendo en un campo):

| Tecla | Acción |
| --- | --- |
| `Espacio` | Reproducir / pausa |
| `→` / `←` | Un evento adelante / atrás |
| `Inicio` o `R` | Reiniciar |
| `Tab` | Recorre todos los controles (el primer tabulador ofrece saltar al contenido) |

## Modos

- **APRENDER**: cada evento incluye una explicación gradual y el contexto de su etapa.
- **INSPECCIONAR**: todos los datos técnicos: el evento completo en JSON y la
  procedencia de cada dirección sintética.

En ambos modos, el inspector lateral muestra instante, IP de origen y destino, puertos,
protocolo, tamaño, estado y evidencia. **Ningún dato simulado se presenta como medición
real**: todo el panel está sellado como «dato sintético».

## Escenarios

| Escenario | Qué ocurre |
| --- | --- |
| Navegación normal | Las seis etapas completas hasta que la página se dibuja |
| Fallo de DNS | El nombre no existe (NXDOMAIN) y el viaje se detiene en la etapa 1 |
| Intentos fallidos de acceso | Tres inicios de sesión fallidos; el servidor responde 401, luego 429 con bloqueo temporal y alerta |

## Retos guiados

Cinco retos al pie de la página. La explicación experta permanece **oculta** hasta que
escribas tu propia explicación (mínimo 40 caracteres útiles); solo entonces se puede
revelar. Cada explicación experta distingue qué es un hecho documentado (con su RFC) y
qué es parte de la simulación.

## Exportación de eventos

Dos botones en el panel «Registro de eventos» descargan **exactamente los eventos
mostrados** para el escenario actual:

- `traza_<escenario>.json` — documento JSON.
- `traza_<escenario>.log` — registro de texto plano.

### Esquema estable `traza.eventos.v1`

El documento JSON tiene esta forma:

```json
{
  "esquema": "traza.eventos.v1",
  "version_app": "1.0.0",
  "generado_en": "<fecha ISO 8601 de la exportación>",
  "escenario": "normal | fallo-dns | intentos-fallidos",
  "aviso": "<aviso de datos sintéticos>",
  "campos": ["<lista de campos de cada evento>"],
  "eventos": [ { …evento… } ]
}
```

Campos de cada evento (siempre presentes, siempre en este orden):

| Campo | Tipo | Significado |
| --- | --- | --- |
| `id` | texto | Identificador estable del evento (`E01`, `E02`…) |
| `t_ms` | número | Instante **simulado** en milisegundos desde el inicio |
| `etapa` | texto | `dns` · `nat` · `tcp` · `tls` · `http_solicitud` · `http_respuesta` |
| `tipo` | texto | `paquete` (algo viaja) o `estado` (algo cambia en un nodo) |
| `desde`, `hasta` | texto | Nodo de partida y de llegada (`equipo`, `router`, `dns`, `proveedor`, `servidor`) |
| `origen_ip`, `origen_puerto` | texto/número o `null` | Origen del paquete (sintético) |
| `destino_ip`, `destino_puerto` | texto/número o `null` | Destino del paquete (sintético) |
| `protocolo` | texto | `UDP` · `TCP` · `TLS` · `HTTP` · `—` |
| `tam_bytes` | número o `null` | Tamaño simulado del mensaje |
| `estado` | texto | `ok` · `info` · `advertencia` · `error` |
| `resumen` | texto | Qué ocurre, en una línea |
| `detalle` | texto | Evidencia sintética (contenido plausible del mensaje) |
| `nota_aprender` | texto | Explicación gradual del modo APRENDER |
| `sintetico` | booleano | Siempre `true`: marca de dato inventado |

### Formato del registro `.log`

Cabecera de líneas `#` (esquema, escenario, fecha y aviso) y después una línea por
evento:

```
[+   t_ms ms] id  etapa  tipo  protocolo  origen -> destino  tamaño  estado  :: resumen (SINTETICO)
```

Los identificadores y el orden del `.log` coinciden exactamente con los del JSON y con el
registro en pantalla (verificado por las pruebas).

## Accesibilidad

- Manejo completo con teclado; foco siempre visible; enlace «saltar al contenido».
- Región viva (`aria-live`) que anuncia cada evento a los lectores de pantalla.
- Contraste alto sobre fondo oscuro; texto principal a opacidad .92.
- `prefers-reduced-motion` (preferencia del sistema «reducir movimiento»): todas las
  animaciones y transiciones quedan anuladas.
- Diseño verificado en 1366×768 y 390×844 (sin desplazamiento horizontal).

## Limitaciones

- Es una **maqueta educativa**, no un analizador de tráfico: no captura ni puede capturar
  paquetes reales; los tiempos, tamaños y contenidos son inventados con magnitudes
  plausibles.
- La negociación TLS se muestra **simplificada** (TLS 1.3 en un viaje de ida y vuelta;
  sin reanudación, sin detalles de extensiones) y el HTTP mostrado corresponde a HTTP/1.1
  para que el texto sea legible.
- La caché DNS, la fragmentación IP, el control de congestión TCP y otros matices quedan
  fuera del alcance de la versión 1.0.0.
- El ritmo de reproducción comprime los tiempos simulados para que sean observables; el
  instante real simulado de cada evento es el campo `t_ms`.
- Probado de forma automatizada en Chromium; el resto de navegadores modernos usan las
  mismas API estándar, pero no se verificaron uno a uno.

## Archivos del paquete

| Archivo | Contenido |
| --- | --- |
| `traza.html` | La aplicación completa (HTML + CSS + JavaScript incrustados) |
| `pruebas.html` | Ejecutor de pruebas del núcleo, verde/rojo con detalle |
| `LEEME.md` | Este documento |
| `FUENTES.md` | Fuentes técnicas por etapa y distinción hecho/simulación |
| `MANIFIESTO-SHA256.txt` | Hash SHA-256 de cada archivo del paquete |

Para verificar la integridad: `sha256sum -c MANIFIESTO-SHA256.txt` (Linux/macOS) o
`Get-FileHash <archivo> -Algorithm SHA256` (PowerShell) comparando con el manifiesto.
