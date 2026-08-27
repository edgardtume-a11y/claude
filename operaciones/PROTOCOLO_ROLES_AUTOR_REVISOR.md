# PROTOCOLO DE ROLES — Quién escribe, quién revisa, quién decide
Regla constitucional de JEAN FLOW. Acordada con el operador y verificada en producción
el 27/08/2026 (atrapó dos defectos reales el mismo día).

## Los cuatro roles (no se mezclan)
| Rol | Quién | Responsabilidad | Lo que NUNCA hace |
|---|---|---|---|
| **Director** | El operador (Jean Pool) | Ordena, decide, autoriza acciones sensibles | Escribir código bajo presión |
| **Arquitecto / Revisor** | Claude | Recupera contexto, diagnostica, define el CONTRATO, revisa sin confiar, registra | Escribir el código del motor |
| **Programador** | Gemini 3.7 (vía router JEAN FLOW) | Escribe y aplica el código dentro del contrato | Tocar archivos no autorizados; auto-aprobarse |
| **Juez** | La suite de pruebas + auditorías | Veredicto binario: 100% o no pasa | Negociar |

## El flujo completo
```
Operador da la orden
   ↓
Revisor: recupera contexto (Notion/GitHub) y define el CONTRATO
   · archivos exactos autorizados  · lo prohibido  · reglas de forma
   · clave idempotente única        · respuesta esperada (OK o ABORT)
   ↓
Router JEAN FLOW (idempotente: si se repite, duplicate=true, jamás dos veces)
   ↓
Gemini escribe el código y responde OK / ABORT
   ↓
Revisor verifica SIN CONFIAR en el reporte del autor:
   · diff y contenido contra el contrato
   · reglas de forma (cat -A: sin continuaciones de línea, sin espacios finales)
   · integridad de alcance (nada fuera de lo autorizado)
   · ejecuta él mismo la suite de pruebas
   ↓
¿Defectos? → orden CORRECTIVA a Gemini con reglas endurecidas (bucle) — el revisor NO parcha el motor
¿Todo aprobado? → cambio aceptado → registro en Notion + GitHub
```

## Quién corrige qué (la regla fina)
| Tipo de problema | Lo arregla |
|---|---|
| Defecto en el código del motor | **Gemini**, vía orden correctiva. El revisor redacta reglas más estrictas |
| Basura de entorno (restos, permisos, archivos heredados) | **El revisor**, directo. No es código de autor |
| Scripts del puente, documentos, contratos, memoria | **El revisor**, directo. Son herramientas, no el motor certificado |

### Por qué el revisor NO parcha el motor aunque sepa hacerlo
1. **Trazabilidad**: cada línea del motor tiene un autor identificable.
2. **Independencia**: quien escribe no puede revisar con ojos frescos (juez y parte).
3. **Aprendizaje del contrato**: cada corrección endurece las reglas para las siguientes órdenes.
El revisor DEBE saber programar — si no, su auditoría sería un sello de goma. Sabe hacerlo
y elige no hacerlo: eso es control de calidad, no duplicar el trabajo.

## Evidencia de que el flujo funciona (27/08/2026)
- **Gate 45 min**: Gemini sustituyó continuaciones de línea por espacios finales — bash lo
  aceptaba y las pruebas de contenido pasaban, pero la semántica estaba rota. El revisor lo
  detectó con `cat -A` → orden correctiva con reglas anti-continuación → 10/10 ACEPTADO.
  Esas reglas quedaron incorporadas a todos los contratos posteriores.
- **Gate 3 (2 h)**: Gemini reportó cumplimiento correcto, pero la revisión encontró PRUEBAS
  FANTASMA de gates anteriores arrastradas en el overlay (referenciaban sesiones viejas).
  El revisor las retiró (basura de entorno, no código de autor) → 10/10.
- **Idempotencia verificada en vivo**: un reintento de la misma orden devolvió duplicate=true
  sin re-ejecutar nada.

## Reglas permanentes que ningún rol puede saltarse
1. Un timeout del proceso envolvente NUNCA se cuenta como éxito sin inspección independiente.
2. Nunca dos capturas a la vez (guarda anti-doble-arranque antes de cada lanzamiento).
3. Producción automática, purga de CSV y Cloud Storage: prohibidos sin orden expresa.
4. Ninguna captura se lanza sin orden del operador.
5. Nada se toca mientras hay una captura activa (invalidaría la certificación en curso).
6. Todo cambio se registra en Notion + GitHub, sin secretos ni tokens.
7. Un solo orquestador al mando por tarea.
8. Cuando dos IAs discrepan, se contrasta hasta converger — y la discrepancia se DEJA ESCRITA
   si no converge (principio del operador).
