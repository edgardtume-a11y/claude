# bot_sigue

Supervisor local para un chat automatizado. Sustituye el `enviar("sigue")`
ciego por una decisión con cuatro salidas.

`sigue` funciona bien en un caso y falla en los otros seis:

| Estado real del asistente | `sigue` | bot_sigue |
|---|---|---|
| Se cortó a mitad | ✅ correcto | envía `sigue` |
| Te hizo una pregunta | ❌ la ignora | **la responde por ti** |
| Pide confirmación | ❌ ambiguo | confirma o rechaza |
| Se desvió del objetivo | ❌ profundiza el error | reencauza |
| Está en bucle | ❌ más bucle | cambia el enfoque, y si insiste te avisa |
| **Ya terminó** | ❌ genera relleno y gasta cuota | **para** |
| Se atascó con un error | ❌ no aporta nada | reformula |

Los dos que más cuestan hoy son **«ya terminó»** (sigues pagando tokens por
relleno que degrada lo que ya estaba bien) y **«te hizo una pregunta»**
(el trabajo avanza en una dirección aleatoria en vez de la tuya).

## Garantía de seguridad

**Nunca puede comportarse peor que tu programa actual.** Si Ollama está
caído, tarda demasiado, devuelve JSON inválido o inventa un estado, el
supervisor devuelve `enviar("sigue")` — exactamente lo que haces hoy —
y marca la decisión con `fallback=True`. Integrarlo no puede romper nada.

## Instalación

Sin dependencias: solo biblioteca estándar de Python 3.10+.

```bash
# 1. Ollama (una vez)
curl -fsSL https://ollama.com/install.sh | sh

# 2. El modelo: ~2,5 GB en Q4, entra de sobra en 6 GB de VRAM
ollama pull qwen3:4b

# 3. Comprueba que responde
ollama ps
```

Verifica el nombre exacto del tag en `ollama.com/library` y ajústalo en
`config.py` si no coincide.

## Comprobar que funciona

```bash
python3 -m bot_sigue.probar --demo
```

Pasa 7 casos, uno por estado, y te da el porcentaje de acierto y los
milisegundos por decisión. **Por debajo del 70 % no integres todavía**:
añade ejemplos tuyos reales a `EJEMPLOS` en `config.py`, que es lo que más
sube el acierto.

Un mensaje suelto:

```bash
python3 -m bot_sigue.probar --texto "¿Uso websockets o polling?"
cat mensaje.txt | python3 -m bot_sigue.probar
```

## Integración

Donde hoy tienes `enviar("sigue")`:

```python
from bot_sigue import Supervisor

sup = Supervisor()          # uno por chat; sup.reiniciar() al empezar otro

d = sup.decidir(mensajes_del_asistente)   # lista de strings, los últimos primero->último

if d.accion == "enviar":
    enviar(d.mensaje)        # a veces "sigue", a veces algo específico
elif d.accion == "parar":
    marcar_completado()      # ← lo que hoy no tienes
elif d.accion == "avisar":
    notificarme(d.motivo)    # bucle o atasco: te llama a ti
# "esperar" -> dentro del debounce, no hacer nada
```

Ejemplo ejecutable con las tres ramas:

```bash
python3 -m bot_sigue.ejemplo_integracion
```

## Configuración

Todo en `config.py`:

| Ajuste | Para qué |
|---|---|
| `MODELO`, `OLLAMA_URL` | qué modelo y dónde |
| `NUM_CTX` | 4096. En 6 GB la caché KV es lo que revienta la VRAM, no los pesos |
| `DEBOUNCE_S` | segundos mínimos entre envíos |
| `MAX_BUCLES` | bucles seguidos antes de avisarte |
| `MAX_ENVIOS_MISMO_ESTADO` | envíos en el mismo estado antes de avisarte |
| `PREFERENCIAS` | tu criterio, se usa al responder preguntas |
| `EJEMPLOS` | **lo más importante** — ver abajo |

### Los ejemplos son la pieza clave

Un prompt del tipo «actúa como Edgard» no funciona en un modelo de 4B. Lo que
sí funciona son **ejemplos literales tuyos**: el modelo imita patrones muy bien
e inventa personalidades muy mal.

Saca 10-20 respuestas reales de tu historial de ChatGPT
(Configuración → Controles de datos → Exportar datos) y sustituye los ejemplos
de plantilla que trae `config.py`.

## Pruebas

```bash
python3 -m unittest discover -s bot_sigue -t .
```

18 pruebas, sin necesidad de Ollama (la llamada HTTP se sustituye).
Cubren los 7 estados, las 4 acciones, el debounce, los contadores de sesión,
la detección determinista de repetición y los cinco caminos de fallback.

## Si más adelante quieres afinarlo

El fine-tuning es el **último** paso, no el primero. Antes:

1. Prompt + esquema JSON ← ya lo tienes
2. Few-shot con tus ejemplos ← `config.py`
3. Medir con `--demo` y añadir ejemplos donde falle

Solo si con 500+ ejemplos reales sigues por debajo de lo que necesitas,
entrena un LoRA en Google Colab (gratis, T4 de 16 GB), descarga el adaptador
de ~100 MB y ejecútalo en tu 3050. Entrenar es algo que haces una vez;
inferir es lo que haces cada minuto — entrena donde es fácil, ejecuta donde
es tuyo.
