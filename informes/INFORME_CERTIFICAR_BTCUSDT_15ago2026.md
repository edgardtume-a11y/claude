# INFORME — `CERTIFICAR_BTCUSDT.cmd` (15-ago-2026)

## Motivo

El usuario vio `TUT` en una corrida y pidió expresamente BTCUSDT. `TUTUSDT` es
el default histórico del proyecto (`config.py`, `--symbol` de `main.py`,
`dual_main.py` y `launcher.py`); en modos certificables (2 y 3) el launcher ya
propone `BTCUSDT` desde 2.3.2, pero la elección sigue dependiendo de dos
respuestas escritas a mano en la consola. Ocho días de intentos han mostrado
que ese es el eslabón que falla: basta pulsar Enter en el momento equivocado —
o elegir 1 en vez de 3 — para tirar tres horas de captura.

## Qué es este entregable

Un `.cmd` de doble clic que arranca la certificación completa **sin ninguna
pregunta**: localiza la instalación con el motor más nuevo bajo `C:\JF` y llama
al `INICIAR.cmd` oficial con `--mode full --symbol BTCUSDT`.

No copia, no modifica y no reimplementa nada del árbol instalado: delega en
`INICIAR.cmd`, que conserva la detección de Python 3.12 x64, el arranque
aislado y el resto del contrato. La captura queda como hija directa de la
consola (PowerShell solo se usa para elegir la carpeta y termina antes de
arrancar), así que no añade proceso alguno durante las ~3 horas.

Selección de instalación: exige que junto al `INICIAR.cmd` existan
`jean_flow_launcher.py` y `binance_phase1_collector` (descarta carpetas a
medias), lee la versión del propio `title JEAN_FLOW <x.y.z>` del `.cmd` —no de
la ruta, que el usuario renombra— y ordena por versión y luego por fecha. En el
equipo del usuario conviven 8 copias, así que esto importa. Si la mejor versión
encontrada es anterior a 2.3.9, avisa antes de arrancar.

## Verificación

Que `--mode full --symbol BTCUSDT` NO pregunta nada se comprobó sobre el AST
del `launcher.py` sellado, no de memoria:

```
Bloque de preguntas guardado por: args.mode is None
Preguntas dentro del bloque: ["input('Opción [1]: ')", "input(f'Símbolo [{suggested}]: ')"]
Total de input() en main(): 2 -> todas dentro del bloque: True
Opciones de --mode: ['normal', '10m', 'full']
```

`INICIAR.cmd` reenvía `%*` al launcher y `jean_flow_launcher.py` pasa
`sys.argv[1:]` a `launcher_main`, de modo que los dos argumentos llegan intactos.

Sintaxis: `Parser::ParseFile` → PARSE OK. Fichero ASCII puro con CRLF.
Escenarios ejecutados con PowerShell real (7.4.6):

| Escenario | Resultado |
|---|---|
| 3 instalaciones (2.3.8 más reciente en disco) + 1 carpeta incompleta | ✅ elige la 2.3.9; la incompleta ni aparece |
| Ruta entregada al `.cmd` | ✅ UTF-8 sin BOM y sin salto final (el `.cmd` corre con `chcp 65001`) |
| Solo motor 2.3.7 | ✅ avisa «anterior a 2.3.9» y continúa |
| Sin instalaciones | ✅ no escribe ruta; el `.cmd` aborta sin iniciar nada |

## Sello

```
49fa18d50627590d6f2969e43266949107923288f02eb28261cdccff09baa019  CERTIFICAR_BTCUSDT.cmd
```

## Nota de criterio

El símbolo elegido sigue quedando registrado en identidad, commitment y
certificado como siempre: esto no salta ningún gate ni cambia ningún criterio,
solo fija las dos respuestas que el usuario ya tenía que dar a mano.
