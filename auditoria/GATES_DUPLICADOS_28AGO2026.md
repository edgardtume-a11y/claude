# Cuatro "gates" distintos son el mismo fichero

28/08/2026 · hallazgo de auditoría · **afecta a la cadena de release**

## Lo que pasa

Cuatro directorios de `staging_runs/` con nombres y fechas distintos contienen
**el mismo fichero de métricas**, byte por byte:

```
sha256 : 065dbc06764759405333848a544c1614...   (2 924 107 bytes)
mtime  : 2026-08-27 21:00:08

  20260827T195636Z_tokyo_n2_gate4_mejoras_30m     <- el original
  20260828T083219Z_forceorder                     <- copia
  20260828T122455Z_markprice                      <- copia
  20260828T143727Z_auditparquet                   <- copia
```

Los tres del día 28 llevan en el nombre una fecha que no corresponde a su
contenido: los datos son de la captura del día **27** a las 21:00.

## Cómo se detectó

Al normalizar la cola de latencia por hora de exposición, cuatro filas salieron
idénticas **hasta el segundo decimal**:

```
mediana 24.00 | p95 42.00 | max 42.00 | >20/h 415.7 | >100/h 0.0
```

Cuatro ejecuciones independientes no producen estadísticas idénticas a dos
decimales. El `sha256sum` lo confirmó.

## Por qué importa

`forceorder`, `markprice` y `auditparquet` **no son evidencia independiente**.
Cualquier análisis que los cuente como tres experimentos distintos está contando
tres veces el mismo, y cualquier conclusión que se apoye en su "coincidencia"
es circular.

Nota técnica: los controles de identidad del worktree (`f1d183b`, rechazo de
identidad mezclada por sesión) **no detectan esto**. Están diseñados para
detectar mezcla *dentro* de una sesión; aquí hay una sola sesión duplicada en
tres directorios, y cada copia es internamente coherente.

## Qué falta arreglar

1. Comprobar si algo en la cadena de release cuenta estos directorios como
   capturas distintas. Si es así, corregirlo.
2. Hacer obligatorio `evidence/source_commit.txt` en cada lanzamiento, y que el
   arranque falle si no existe.

## Hallazgo relacionado: el baseline no declara runtime

De todos los gates en `staging_runs/`, **solo** `20260828T155419Z_tokyo_postmask_gate_30m`
tiene `evidence/source_commit.txt`. En los demás el fichero no existe.

Consecuencia directa: la precondición prerregistrada para el gate post-máscara
—*"runtime/release idéntico al baseline o diferencia declarada"*— **no se puede
verificar**, porque el baseline no declara su runtime. La comparación
pre/post-máscara no es auditable en ninguna dirección mientras eso siga así.
