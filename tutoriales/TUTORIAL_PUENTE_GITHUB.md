# TUTORIAL — Puente GitHub de JEAN FLOW, de principio a fin

Cómo conectar una IA (Claude u otra) con la máquina de Tokio usando GitHub como
mensajero, sin depender de conectores que se caen. Probado en producción el 27/08/2026.

## ¿Qué construye este tutorial?

```
IA escribe orden.json en el repo → Guardián en la VM (revisa cada 30 s)
→ ejecuta (Gemini, auditorías, estado...) → sube resultado.json → la IA lo lee
```

Piezas: un repositorio de GitHub, una "llave de escritura" (PAT), y el guardián
(un programita que vive en la VM). Todo el código está en `puente_github/` de este repo.

---

## PASO 1 — Crear la llave de GitHub (PAT)

La llave le da permiso a la máquina para subir resultados al repo. Se crea en la
cuenta dueña del repositorio.

1. Entrar a GitHub con la cuenta dueña del repo
2. Ir directo a: **github.com/settings/personal-access-tokens/new**
   (equivale a: foto de perfil → Settings → al fondo "Developer settings" →
   Personal access tokens → Fine-grained tokens → Generate new token)
3. Llenar:
   - **Token name**: `puente-tokio` (o el nombre que quieras)
   - **Expiration**: 90 days (anotar la fecha: habrá que renovarlo)
   - **Repository access**: "Only select repositories" → elegir SOLO el repo del puente
   - **Permissions → Repository permissions → Contents: Read and write** (nada más;
     "Metadata: Read" se marca solo, es normal)
4. Botón verde **Generate token** → aparece la cadena `github_pat_...`
5. **Copiarla DE INMEDIATO** (solo se muestra una vez) y guardarla en un lugar seguro

⚠️ ERRORES QUE YA COMETIMOS (para no repetir):
- **Nunca pegar la llave en chats ni documentos.** Si pasa: la llave se considera
  expuesta → regenerarla (mismo lugar, botón "Regenerate token").
- **Cuidado con las máscaras**: algunas pantallas muestran la llave como
  `github_p••••••••`. Si copias ESO, guardas puntitos y nada funciona.
  Copiar siempre con el botón de copiar 📋 de GitHub.

## PASO 2 — Guardar la llave dentro de la VM

En Cloud Shell (reemplazar `<PAT>` por la llave real; armar el comando en un bloc
de notas primero):

```bash
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo mkdir -p /home/trading/.config/puente-github && echo '<PAT>' | sudo tee /home/trading/.config/puente-github/pat >/dev/null && sudo chown -R trading:trading /home/trading/.config/puente-github && sudo chmod 600 /home/trading/.config/puente-github/pat && echo GUARDADO"
```

Respuesta esperada: `GUARDADO`.

**Verificar que se guardó la llave real y no una máscara:**

```bash
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo head -c 15 /home/trading/.config/puente-github/pat && echo && sudo wc -c /home/trading/.config/puente-github/pat"
```

- Bien: empieza `github_pat_...` y pesa ~90-100 bytes
- Mal: se ven `•` o pesa ~264 bytes → repetir el Paso 2 copiando bien

## PASO 3 — Instalar el guardián

Un solo comando (sirve para instalar la primera vez Y para actualizar después):

```bash
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="curl -fsSL https://raw.githubusercontent.com/edgardtume-a11y/claude/claude/google-cloud-remote-commander-pjqhc3/puente_github/instalar_guardian.sh | sudo bash"
```

Respuesta esperada: termina en `active`. Eso significa: guardián corriendo como
servicio del sistema (revive solo tras reinicios de la máquina).

## PASO 4 — Probar

La IA crea un archivo `puente_github/ordenes/mi-prueba-001.json` en el repo:

```json
{"id": "mi-prueba-001", "accion": "estado"}
```

En ~30-60 segundos aparece `puente_github/resultados/mi-prueba-001.json` con la
salud de la máquina. Si aparece: el puente está VIVO.

## Órdenes disponibles (lista cerrada, por seguridad)

| Acción | Para qué | Campos extra |
|---|---|---|
| `estado` | Salud de la máquina | — |
| `gemini_enqueue` | Darle una orden a Gemini vía el router idempotente | `prompt`, `idempotency_key` |
| `gemini_result` | Leer el resultado de un trabajo de Gemini | `job_id` |
| `auditar_staging` | Lanzar las auditorías de un gate | `staging` |
| `latencia_e2e` | Medir latencia real de una captura | `staging` |
| `leer_archivo` | Leer un archivo (.json/.log/.txt, solo de staging_runs) | `ruta` |

Reglas: cada `id` se procesa UNA sola vez (idempotencia); nombres de archivo en
minúsculas-y-guiones; nada de comandos de shell libres — si se necesita una acción
nueva, se agrega a la lista del guardián y se reinstala (Paso 3).

## Problemas conocidos y sus curas

| Síntoma | Causa | Cura |
|---|---|---|
| Resultado nunca llega | Llave enmascarada o vencida | Verificación del Paso 2; regenerar PAT |
| `ERROR: You do not currently have an active account` en Cloud Shell | Credenciales de Cloud Shell caducas | `gcloud auth login` → responder `Y` → abrir enlace → pegar código |
| Guardián corriendo versión vieja | El servicio no se reinició | Re-ejecutar el Paso 3 (el instalador ya reinicia) |
| Ver qué hace el guardián | — | `sudo journalctl -u puente-github -n 20 --no-pager` (vía SSH) |

## Mantenimiento

- **Renovar el PAT** antes de su vencimiento: crear/regenerar (Paso 1) + guardar (Paso 2). Sin reinstalar.
- **Actualizar el guardián**: editar `puente_github/watcher.py` en el repo + Paso 3.
- **Apagar el puente**: `sudo systemctl disable --now puente-github` (vía SSH).
