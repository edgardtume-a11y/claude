# Manual de invocación — Puerta Universal JEAN FLOW (sin secretos)

**Propósito:** que cualquier IA orquestadora autorizada (ChatGPT, Claude, Gemini u otra)
pueda darle órdenes a JEAN FLOW en Tokio por HTTPS directo, sin depender de
Remote Desktop Commander ni de conectores propietarios.

Verificado en producción el 27/08/2026 (~13:10 UTC).

## La puerta

- **URL base:** `https://jean-flow-gcp.lorvellancapital.com`
- **Dónde vive:** VM `jean-flow-02-tokyo` (asia-northeast1-a, IP fija 34.180.96.105),
  servicio `jean-flow-bridge` + túnel `cloudflared` (ambos `enabled`, reviven solos al reiniciar).
- **Autenticación:** cabecera `Authorization: Bearer <token>`. Sin token válido responde
  `{"error":{"code":"unauthorized",...},"ok":false}` — comprobado desde navegador externo.

## El token (la llave)

- **Nunca** se escribe en Notion, GitHub ni en chats. Lo custodia el operador.
- Vive en la VM: `/home/trading/.config/jean-flow-unrestricted/job_token`
  (64 caracteres hexadecimales).
- **Rotación automática:** cada reinicio del servicio `jean-flow-bridge` genera un token
  nuevo y mata el anterior (`JEAN_FLOW_ROTATE_JOB_TOKEN=1`, comportamiento por defecto
  definido en `INICIAR_PUENTE_GCP.sh`). La rotación se niega si hay jobs pendientes.

### Procedimiento del operador tras cada reinicio (o para rotar a demanda)

```bash
# 1) (opcional, rota la llave a demanda)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo systemctl restart jean-flow-bridge && sleep 6 && sudo systemctl is-active jean-flow-bridge"

# 2) leer la llave vigente (solo para los ojos del operador)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo cat /home/trading/.config/jean-flow-unrestricted/job_token"
```

El operador entrega la llave a cada IA autorizada por el canal privado de esa IA.
Regla aprendida el 27/08: si la llave queda pegada en un chat u otro lugar no previsto,
se rota de inmediato (30 segundos, sin impacto en capturas en curso).

## Reglas de uso para toda IA orquestadora

1. Recuperar contexto desde Notion (Memoria operativa + página 19) ANTES de ordenar nada.
2. Toda orden lleva **clave idempotente**; si se repite, el sistema responde `duplicate=true`
   y NO ejecuta dos veces (verificado en vivo el 27/08 con el gate 2).
3. Un solo orquestador al mando por tarea; nunca dos IAs sobre el mismo staging.
4. Prohibiciones vigentes sin orden expresa del operador: producción automática,
   purga de CSV, Cloud Storage, borrado de datos.
5. Todo cambio de código pasa por el flujo: contrato → router → Gemini → revisión
   independiente (diff/hashes/pruebas) → registro en Notion.

## Rutas y formatos de la API

El detalle de rutas (endpoints, verbos, esquema JSON de órdenes) está implementado en
`/home/trading/import_backup/JEAN_FLOW_UNRESTRICTED/bridge/PUENTE_CARPETA_IA_engine.py`.
Pendiente de documentar aquí en la próxima inspección de la VM (no bloquea: la sesión
ChatGPT ya operó contra esta API y su contrato vive en el propio engine).

## Jerarquía de vías de acceso (decisión del operador, 27/08)

1. **Principal:** esta puerta HTTPS universal (órdenes <1 s, agnóstica de la IA).
2. **Plan B:** buzón de órdenes por GitHub (pendiente de construir vía flujo Gemini).
3. **Emergencia:** Remote Desktop Commander (el conector que hoy se cae a cada rato).
4. **Manual:** Cloud Shell del operador (siempre funciona, requiere humano).
