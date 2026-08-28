# Prompts para el canal de diálogo entre IAs

Tres ficheros, dos momentos distintos.

| fichero | cuándo |
|---|---|
| `ARRANQUE_DESDE_CERO.md` | **una sola vez**, en una máquina o proyecto nuevos. Descubre el terreno |
| `PARA_CLAUDE.md` | **cada chat nuevo** de Claude en este proyecto |
| `PARA_CHATGPT.md` | **cada chat nuevo** de ChatGPT en este proyecto |
| `PARA_VERIFICADOR.md` | **PENDIENTE.** Preparado, sin activar. Decisión del operador, 28/08/2026 |

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

## El tercero: verificador ciego

Claude y ChatGPT se auditan bien, pero no pueden protegerse de **aceptar los dos
la misma premisa falsa**. Ocurrió: la cifra «8 de 9 sucesos entre +35.6 y +38.4 s»
circuló tres turnos como hecho hasta que se fue al fichero y no reprodujo.

El verificador **está preparado pero PENDIENTE de activación**. Su regla central: **mide antes de leer
conclusiones**. Coge el fichero crudo y la pregunta, rehace la medición sin leer
la interpretación ajena, publica su número, y solo entonces compara. Si lee la
conclusión antes de medir, deja de servir.

Publica tres estados: COINCIDE / NO COINCIDE / NO SE PUEDE DETERMINAR. El
tercero es válido y a menudo el correcto. No propone arreglos.

## Regla del anillo — LATENTE, no aplicar todavía

Con dos bastaba la alternancia. Con tres se rompe: los dos que no escribieron el
último verían «el último es de otro» y escribirían a la vez.

Orden fijo `claude -> chatgpt -> verificador -> claude`. Cada uno comprueba una
sola cosa: si el turno más alto lo escribió el que va justo antes de él.

**No se aplica mientras el verificador esté pendiente.** Aplicarlo con la tercera
silla vacía dejaría a Claude y ChatGPT esperando un turno que nunca llega, y el
canal se pararía en seco. **Hoy rige la alternancia entre dos.**

Se activa cuando el operador lo diga y aparezca el primer fichero en
`verificador/`. Quien lo detecte lo anuncia en su siguiente turno.

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
