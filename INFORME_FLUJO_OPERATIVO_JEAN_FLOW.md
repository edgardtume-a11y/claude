# INFORME — Flujo operativo actual de JEAN FLOW (27/08/2026)

Este documento describe el flujo completo que se sigue hoy para cualquier cambio o operación
del sistema, verificado en la práctica durante los gates del 27/08/2026.

## El flujo, paso a paso

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TÚ (el operador)                                             │
│    Das la orden en lenguaje natural ("lanza el gate", "arregla │
│    el timeout"). Eres el único que autoriza acciones sensibles. │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. IA ORQUESTADORA / REVISORA (Claude Code o ChatGPT)           │
│    a) Recupera el contexto desde NOTION (memoria compartida)    │
│    b) Define el alcance y los controles del cambio:             │
│       - qué archivos exactos se pueden tocar                    │
│       - qué está prohibido                                      │
│       - clave de idempotencia única                             │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. REMOTE DESKTOP COMMANDER (el puente)                         │
│    Conecta la IA con la VM jean-flow-01 (Google Cloud).         │
│    Por aquí pasan: comandos, lecturas de archivos/logs,         │
│    escritura de prompts y scripts.                              │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. JEAN FLOW (el router en la VM)                               │
│    Recibe la orden con clave idempotente (si se repite,         │
│    devuelve duplicate=true, nunca ejecuta dos veces).           │
│    Cola de trabajos, timeout de 900 s, política de fallback     │
│    (3.7 primario → 3.6 solo por disponibilidad/capacidad).      │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. GEMINI 3.7 (el programador, en Vertex AI)                    │
│    Genera y aplica el código, SOLO en los archivos autorizados  │
│    por el contrato. Falla cerrado si no puede cumplir todo.     │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. LA IA REVISORA VERIFICA (vía Remote Desktop Commander)       │
│    - Diff y contenido contra el contrato                        │
│    - Integridad de alcance: sha256sum -c de los manifiestos     │
│      PRE (nada fuera de los archivos autorizados)               │
│    - Ejecuta la suite de pruebas (pytest) de forma              │
│      independiente — no confía en lo que Gemini reporte         │
│                                                                 │
│    ¿HAY ERRORES? → vuelve al paso 2: nueva orden correctiva     │
│    a Gemini con reglas endurecidas (bucle hasta aprobar)        │
│    ¿TODO APROBADO (100% pruebas + integridad)? → sigue          │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. CAMBIO ACEPTADO                                              │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. REGISTRO EN NOTION (la memoria compartida)                   │
│    Sincronización sanitizada: qué se hizo, evidencia, hashes,   │
│    veredictos. Sin secretos, tokens ni código completo.         │
│    Cualquier IA que entre después recupera este contexto con    │
│    la frase-llave y continúa donde quedó la anterior.           │
└─────────────────────────────────────────────────────────────────┘

           EN PARALELO, SIEMPRE ACTIVO:
           - Rutina de monitoreo horario de la VM (solo lectura)
           - Chequeos programados de capturas en curso
           - Guardas anti doble arranque antes de lanzar capturas
```

## Los roles en una frase cada uno

| Actor | Rol | Analogía |
|---|---|---|
| **Tú** | Director: ordenas y autorizas | El dueño de la obra |
| **Claude Code / ChatGPT** | Orquestador y revisor: contexto, contratos, verificación | El ingeniero residente |
| **Notion** | Memoria compartida entre todas las IAs | El cuaderno de obra |
| **Remote Desktop Commander** | Puente hacia la VM | Las manos |
| **JEAN FLOW** | Mensajero idempotente con cola y timeouts | La ventanilla de trámites |
| **Gemini 3.7 (Vertex)** | Programador que escribe el código | El maestro constructor |
| **Pruebas + auditorías** | Juez imparcial: 100% o no pasa | El inspector municipal |
| **GitHub (repo)** | Respaldo de entregables e informes | El archivo notarial |

## Reglas de oro del flujo (no negociables)

1. Gemini solo toca los archivos autorizados en el contrato; la integridad se verifica con hashes.
2. Un timeout del proceso envolvente NUNCA se cuenta como éxito sin inspección independiente.
3. El revisor no confía en el reporte del autor: ejecuta las pruebas él mismo.
4. Nunca dos capturas a la vez (guarda pgrep antes de cada lanzamiento).
5. Producción automática, purga de CSV y Cloud Storage permanecen desactivados hasta orden expresa.
6. Todo lo relevante se registra en Notion; sin secretos, tokens ni identificadores de sesión.
7. Un solo orquestador al mando por tarea (Claude o ChatGPT, no ambos sobre el mismo staging).

## Evidencia de que el flujo funciona (hoy)

- Diagnóstico y corrección de la causa raíz del timeout del router (120 s → 900 s, reversible).
- Gate de 45 min: Gemini escribió → el revisor detectó un defecto real (continuaciones de
  línea rotas) → orden correctiva → Gemini corrigió → 10/10 pruebas → ACEPTADO.
- Gate de 6 h: aceptado a la primera con el contrato endurecido.
- Captura de 2 h lanzada y monitoreada; latencia E2E medida sobre 19.553 eventos reales.
- Registro completo en Notion: sincronizaciones 16G → 16M.
