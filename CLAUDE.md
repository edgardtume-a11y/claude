# Preferencias de Jean

## Estilo visual de TODO lo que se le entrega

Jean pidió expresamente (20-ago-2026) que los documentos se hagan **en la paleta clásica
de Claude**, no en el azul genérico y **no en oscuro**. Esto aplica **siempre**, a todo
entregable visual: PDF, HTML, artefactos, informes, gráficos.

| Rol | Color | Hex |
|---|---|---|
| Fondo de página | marfil | `#FAF9F5` |
| Cajas y tarjetas | crema | `#F0EEE6` |
| Bandas y cabeceras de tabla | manila | `#E5DFD3` |
| Cajas de refuerzo | arena | `#EDE9DD` |
| Filas alternas | `#F4F1E9` |
| Bordes | `#D8D0C0` |
| **Acento principal** | **arcilla** | **`#CC785C`** |
| Títulos y texto sobre claro | arcilla oscuro | `#8C4A32` |
| Caja de aviso (fondo / borde) | durazno | `#F8E7DB` / `#DFAF90` |
| Texto | tinta | `#2C2A26` |
| Texto secundario | gris cálido | `#6E6A60` |

Tipografía: **serif para los títulos** (DejaVu Serif si está instalada), sans para el
cuerpo. Filetes y viñetas en arcilla. Nunca azul `#0B4F76`/`#00A3D9` ni fondos negros.

Para PDF ya está resuelto: usar `plantillas/estilo_claude_pdf.py`, que trae la paleta,
los estilos y los elementos (`h1`, `caja`, `tabla`, `bullets`, `documento`). Requiere
`reportlab`.

## Cómo comunicarse con Jean

- Español simple, directo, sin filosofía. Jean no es programador y no debe necesitar serlo.
- Una pregunta por mensaje como máximo, en texto plano. No usar el widget de opciones.
- Si algo salió mal por culpa nuestra, reconocerlo sin rodeos.
- Para el proyecto JEAN_FLOW 555 manda el protocolo de la habilidad `jean-flow-555`,
  que prevalece sobre este archivo en lo que se refiera a ese proyecto.

## Estudios

Jean estudia **Diseño de Interfaces de Programación** (TECSUP). Cuando suba material del
curso y pida un resumen, entregarlo como PDF de estudio con la paleta de arriba:
idea central, secciones numeradas, tabla comparativa, glosario, autoevaluación con
respuestas y una hoja de repaso rápido al final.
