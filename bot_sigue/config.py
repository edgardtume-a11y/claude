"""
Configuración del supervisor.

Este es el único archivo que necesitas tocar para adaptarlo a ti:
cambia PREFERENCIAS y añade EJEMPLOS con respuestas tuyas reales.
"""

# ---------------------------------------------------------------- modelo

MODELO = "qwen3:4b"
OLLAMA_URL = "http://localhost:11434"
TIMEOUT_S = 30

# Contexto corto: en 6 GB de VRAM la caché KV es lo que revienta el presupuesto.
NUM_CTX = 4096
TEMPERATURA = 0.1

# ---------------------------------------------------------------- comportamiento

NOMBRE = "Edgard"

# Segundos mínimos entre dos envíos. Evita que el supervisor dispare en bucle.
DEBOUNCE_S = 20

# Tras cuántos estados 'bucle' seguidos deja de insistir y te avisa a ti.
MAX_BUCLES = 2

# Tras cuántos envíos seguidos sin que cambie el estado, te avisa.
MAX_ENVIOS_MISMO_ESTADO = 3

# Dos mensajes del asistente con una similitud por encima de esto se tratan
# como repetición. Es una comprobación determinista, previa al modelo.
UMBRAL_REPETICION = 0.85

# Cuántos mensajes previos se le pasan al modelo como contexto.
VENTANA_MENSAJES = 4

# ---------------------------------------------------------------- tu criterio

PREFERENCIAS = """\
- Prefiero soluciones simples y directas antes que genéricas o sobreingenierizadas.
- Si dudas entre dos opciones razonables, elige una y sigue; ya corrijo yo después.
- Nunca reescribas un archivo entero: cambia solo la parte que hace falta.
- No pidas permiso para pasos obvios. Hazlos y cuéntamelo.
- Si algo no se puede hacer, dilo claro y propón la alternativa más cercana.
- Respuestas en español."""

# ---------------------------------------------------------------- few-shot
#
# CLAVE: sustituye estos ejemplos por respuestas TUYAS reales, sacadas de tu
# historial de ChatGPT. El modelo imita patrones muy bien e inventa
# personalidades muy mal. 10-20 ejemplos reales valen más que cualquier
# descripción de tu carácter.

EJEMPLOS = [
    {
        "entrada": (
            "Voy a crear la función de conexión:\n\n"
            "```python\n"
            "def conectar(host, puerto):\n"
            "    sock = socket.socket(socket.AF_INET,"
        ),
        "salida": {
            "estado": "cortado",
            "confianza": 0.95,
            "motivo": "El bloque de código se interrumpe a media línea.",
            "mensaje": "sigue",
        },
    },
    {
        "entrada": (
            "Antes de seguir necesito saber una cosa: ¿prefieres que lo "
            "implemente con websockets o con polling cada 5 segundos?"
        ),
        "salida": {
            "estado": "pregunta",
            "confianza": 0.93,
            "motivo": "Pregunta directa y se detiene esperando respuesta.",
            "mensaje": "Websockets. El polling ya lo descartamos por latencia.",
        },
    },
    {
        "entrada": (
            "He preparado el cambio en el archivo de configuración. "
            "¿Quieres que lo aplique ahora?"
        ),
        "salida": {
            "estado": "confirmacion",
            "confianza": 0.9,
            "motivo": "Pide permiso para un paso que ya estaba acordado.",
            "mensaje": "Sí, aplícalo y sigue sin preguntar los pasos obvios.",
        },
    },
    {
        "entrada": (
            "Ya que estamos, he reescrito también todo el módulo de "
            "autenticación y he migrado la base de datos a PostgreSQL para "
            "dejarlo más limpio."
        ),
        "salida": {
            "estado": "desviado",
            "confianza": 0.88,
            "motivo": "Ha tocado cosas que nadie pidió y reescrito archivos enteros.",
            "mensaje": (
                "Eso no lo pedí. Deshaz el cambio de autenticación y la "
                "migración, y vuelve al problema original."
            ),
        },
    },
    {
        "entrada": (
            "Como decía, el enfoque recomendado es usar una caché. "
            "Recuerda que una caché mejora el rendimiento. "
            "Por eso lo mejor sería implementar una caché."
        ),
        "salida": {
            "estado": "bucle",
            "confianza": 0.91,
            "motivo": "Repite la misma idea tres veces sin aportar nada nuevo.",
            "mensaje": "",
        },
    },
    {
        "entrada": (
            "Listo. El script queda funcionando, he probado los tres casos "
            "y pasan. Con esto tienes el flujo completo."
        ),
        "salida": {
            "estado": "terminado",
            "confianza": 0.94,
            "motivo": "Entrega el resultado y cierra; no queda nada pendiente.",
            "mensaje": "",
        },
    },
    {
        "entrada": (
            "He intentado ejecutarlo pero me da 'ModuleNotFoundError: requests' "
            "y no puedo instalar paquetes en este entorno."
        ),
        "salida": {
            "estado": "error",
            "confianza": 0.89,
            "motivo": "Se ha atascado con una dependencia que no puede instalar.",
            "mensaje": (
                "Usa urllib de la biblioteca estándar en lugar de requests, "
                "así no hace falta instalar nada."
            ),
        },
    },
]
