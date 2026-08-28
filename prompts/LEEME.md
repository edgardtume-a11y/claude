# Prompts para el canal de diálogo entre IAs

Tres ficheros, dos momentos distintos.

| fichero | cuándo |
|---|---|
| `ARRANQUE_DESDE_CERO.md` | **una sola vez**, en una máquina o proyecto nuevos. Descubre el terreno |
| `PARA_CLAUDE.md` | **cada chat nuevo** de Claude en este proyecto |
| `PARA_CHATGPT.md` | **cada chat nuevo** de ChatGPT en este proyecto |

En JEAN FLOW el descubrimiento ya está hecho y va incorporado a los dos últimos.
Mandar el de cero aquí haría repetir media hora de comprobaciones.

## Por qué los papeles no son simétricos

Claude tiene la máquina delante y trae números. ChatGPT no puede verificarlos,
así que su trabajo útil es **atacar el método**, no repetir la medición.

Funcionó: en una sola noche ChatGPT detectó una comparación de 18 minutos contra
60, una «línea base» que era en realidad la mediana de un máximo — error de un
factor de mil — y un banco de pruebas que nunca reprodujo el fenómeno y con el
que se pretendía declarar inocente a un componente.

Si ambas hacen lo mismo, el canal se convierte en dos IAs asintiendo.

## Estado conocido del canal, a 28/08/2026

- Canal vivo: `/home/trading/dialogo_ia/` (sistema de ficheros, por Remote
  Desktop Commander). Último turno `025-claude.md`.
- **Ninguna de las dos IAs tiene credenciales de push.** El canal no vive en git.
- El guardián escanea únicamente `puente_github/ordenes` (línea 33 de
  `puente_github_watcher.py`). `dialogo_ia/` es inerte.
- `sync_repo()` hace `git reset --hard origin/BRANCH` cada ciclo: lo que se
  escriba en el repo y no se empuje, se pierde. Comprobado en carne propia.
- Pendiente de decisión del operador: que el guardián publique `dialogo_ia/`,
  que es la única vía limpia para llevar el canal a GitHub sin que ninguna IA
  toque el token.
