# BITÁCORA DE COMANDOS — 27/08/2026 (sanitizada, sin secretos)

Registro literal de los comandos operativos usados hoy, para repetirlos cuando haga falta.
Los valores secretos van como <PLACEHOLDER> — los reales los custodia el operador.

## Migración y ampliación de la VM (Cloud Shell)

```bash
# Apagar Singapur (reversible)
gcloud compute instances stop jean-flow-01 --zone=asia-southeast1-a

# Cambiar tamaño de Tokio (requiere VM detenida)
gcloud compute instances stop jean-flow-02-tokyo --zone=asia-northeast1-a
gcloud compute instances set-machine-type jean-flow-02-tokyo --zone=asia-northeast1-a --machine-type=e2-custom-12-49152
gcloud compute instances start jean-flow-02-tokyo --zone=asia-northeast1-a
# La IP fija 34.180.96.105 se conserva sola (está reservada)
```

## Túnel HTTPS y puente de órdenes (en Tokio, vía SSH)

```bash
# Encender el túnel (identidad única: solo con Singapur apagada)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo systemctl enable --now cloudflared && sleep 8 && sudo systemctl is-active cloudflared"

# Rotar la llave de la puerta HTTPS (cada reinicio del bridge genera llave nueva)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo systemctl restart jean-flow-bridge && sleep 6 && sudo systemctl is-active jean-flow-bridge"

# Leer la llave vigente (solo ojos del operador; NUNCA pegarla en chats/docs)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo cat /home/trading/.config/jean-flow-unrestricted/job_token"
```

## Puente GitHub (guardián)

```bash
# 1) Guardar el PAT de GitHub en la VM (reemplazar <PAT>; verificar con head/wc que no queden máscaras ••••)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo mkdir -p /home/trading/.config/puente-github && echo '<PAT>' | sudo tee /home/trading/.config/puente-github/pat >/dev/null && sudo chown -R trading:trading /home/trading/.config/puente-github && sudo chmod 600 /home/trading/.config/puente-github/pat && echo GUARDADO"

# Verificación de que el PAT es real y no una máscara (94 bytes aprox = bien; ~264 = máscara)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo head -c 15 /home/trading/.config/puente-github/pat && echo && sudo wc -c /home/trading/.config/puente-github/pat"

# 2) Instalar/actualizar el guardián (mismo comando para instalar y para actualizar)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="curl -fsSL https://raw.githubusercontent.com/edgardtume-a11y/claude/claude/google-cloud-remote-commander-pjqhc3/puente_github/instalar_guardian.sh | sudo bash"

# Diario del guardián (diagnóstico)
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command="sudo journalctl -u puente-github -n 20 --no-pager"
```

## Formato de órdenes del puente (archivos en puente_github/ordenes/<id>.json)

```json
{"id": "mi-orden-001", "accion": "estado"}
{"id": "mi-orden-002", "accion": "latencia_e2e", "staging": "/home/trading/jean-flow-exec/staging_runs/<RUN>"}
{"id": "mi-orden-003", "accion": "auditar_staging", "staging": "/home/trading/jean-flow-exec/staging_runs/<RUN>"}
{"id": "mi-orden-004", "accion": "leer_archivo", "ruta": "/home/trading/jean-flow-exec/staging_runs/<RUN>/audit/return_codes.json"}
{"id": "mi-orden-005", "accion": "gemini_enqueue", "prompt": "<ORDEN PARA GEMINI>", "idempotency_key": "<CLAVE-UNICA>"}
{"id": "mi-orden-006", "accion": "gemini_result", "job_id": "jfr-<ID-DEL-JOB>"}
```
La respuesta aparece en puente_github/resultados/<id>.json en ~30-60 s. Un id nunca se reprocesa.

## Router de Gemini por socket local (desde la propia VM)

```python
# {"method":"enqueue","payload":{"prompt":"...","idempotency_key":"..."}}
# {"method":"result","payload":{"id":"jfr-..."}}
# CLAVE: tras sendall hacer s.shutdown(socket.SHUT_WR) o el router no responde.
# Socket: /run/jean-flow-router.sock (uid autorizado: trading)
```

## Estado de una captura (gate)

```bash
gcloud compute ssh jean-flow-02-tokyo --zone=asia-northeast1-a \
  --command='R=/home/trading/jean-flow-exec/staging_runs/<RUN>; pgrep -f "binance_collector[.]dual_main" >/dev/null && echo GRABANDO || echo TERMINADO; find $R/capture -name "*partial*" | wc -l; tail -2 $R/launcher_console.log'
```

## Cura de credenciales caducas de Cloud Shell

```bash
gcloud auth login        # responder Y, abrir el enlace, elegir la cuenta, pegar el código
gcloud auth list         # verificar
gcloud config set account trading@lorvellancapital.com   # si la cuenta figura pero inactiva
gcloud compute instances list   # prueba inofensiva de que revivió
```

## ⚠️ Nota de seguridad sobre historiales personales

El Doc personal del operador ("HISTORIAL IA AVANZADO PROYECTO LLM") guarda transcripciones
crudas de la terminal — útil, pero las transcripciones INCLUYEN llaves reales (job_token, PAT).
Regla: en cualquier historial, reemplazar las llaves por <PLACEHOLDER> antes de pegar,
o mantener el documento estrictamente privado. Las llaves de hoy ya fueron rotadas
(bridge) o asumidas por decisión del operador (PAT).
