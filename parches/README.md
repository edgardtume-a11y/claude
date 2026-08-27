# Parches certificados

Cambios de código validados en un gate real, guardados aquí porque los
directorios de `staging_runs/` son efímeros y el cambio no debe morir con ellos.

**Ninguno está aplicado en la instalación base.** Promover cualquiera a
producción requiere orden expresa del operador.

| Parche | Qué hace | Estado |
|---|---|---|
| `uvloop_gcfreeze_dual_main.patch` | uvloop como bucle de eventos + `gc.freeze()` antes de arrancar | Certificado en el gate 4: 4/4 auditorías PASS. No promovido. |

## Cómo se certificó cada uno

El flujo está en `operaciones/PROTOCOLO_ROLES_AUTOR_REVISOR.md`. En resumen:
el autor (Gemini) escribe bajo contrato acotado a archivos concretos; el revisor
(Claude) lee el código real antes de encargar, ejecuta las pruebas, hace prueba
de humo, lanza el gate y compara contra una línea base medida con el mismo
método. El autor nunca certifica su propio trabajo.

## Requisito de instalación

`uvloop_gcfreeze_dual_main.patch` necesita `uvloop` en el entorno:

```
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python -m pip install uvloop
```

Versión validada: **0.22.1** sobre CPython 3.12.3. Si falta, el código cae al
bucle estándar de asyncio y la captura arranca igual — el parche degrada con
elegancia a propósito.
