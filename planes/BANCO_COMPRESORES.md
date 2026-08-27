# Qué compresor conviene: medido sobre datos reales del disco

**Fecha:** 27/08/2026, ~23:25 UTC (18:25 Perú)
**Orden del operador:** *"busca qué librería o lo que sea usar para reducir su
tamaño sin perder calidad"*
**Método:** no citar manuales. Comprimir muestras reales de este disco, en esta
máquina, y cronometrar.

---

## 0. Aclaración: aquí no existe "perder calidad"

Todos los compresores de esta comparación son **sin pérdida**: lo que sale al
descomprimir es idéntico **bit a bit** a lo que entró. La compresión con pérdida
—la que sí degrada— sólo existe para imagen, audio y vídeo, donde se puede tirar
información que el ojo o el oído no notan.

Para datos no hay tal cosa. Un solo bit distinto rompería la certificación de
identidad. Así que la pregunta no es *cuánta calidad se pierde* (cero), sino
**cuánto tarda y cuánto encoge**.

---

## 1. Muestra A: un CSV de captura (50 MB reales del gate de agosto)

| Compresor | Resultado | Ratio | Velocidad |
|---|---|---|---|
| `gzip -9` | 1.44 MB | 34.71× | 94.0 MB/s |
| `zstd -3` | 1.37 MB | **36.42×** | **961.5 MB/s** |
| `zstd -12` | 1.15 MB | **43.54×** | **147.9 MB/s** |
| `xz -9 -T8` | 1.08 MB | 46.20× | 7.9 MB/s |
| `bzip2 -9` | 1.05 MB | 47.65× | 3.5 MB/s |
| `xz -6 -T8` | 1.06 MB | **46.98×** | 17.8 MB/s |
| `zstd -19` | 1.05 MB | 47.83× | 2.6 MB/s |
| `zstd -22 --long` | 0.97 MB | **51.36×** | 0.6 MB/s |

### Tres cosas que salen de aquí

**1. `zstd -3` le gana a `gzip -9` en las dos cosas a la vez.**
Más compresión (36.4× contra 34.7×) y **diez veces más rápido** (961 contra 94
MB/s). No hay compensación que discutir: es mejor en ambos ejes. Donde hoy se
use gzip por costumbre, zstd es una mejora sin contrapartida.

**2. `xz -9` comprime PEOR que `xz -6`, y tarda el doble.**
46.20× contra 46.98×, a menos de la mitad de velocidad. Subir el nivel al
máximo **empeoró el resultado**. Es el ejemplo perfecto de por qué hay que medir
en vez de suponer que "más es mejor": el nivel 9 usa un diccionario más grande
que en estos datos no ayuda y estorba.

**3. Los rendimientos decrecientes son brutales al final de la escala.**

| De | A | Ganancia | Coste en tiempo |
|---|---|---|---|
| `zstd -3` → `zstd -12` | 36.4× → 43.5× | +19 % | 6.5× más lento |
| `zstd -12` → `zstd -19` | 43.5× → 47.8× | +10 % | **57× más lento** |
| `zstd -19` → `zstd -22` | 47.8× → 51.4× | +7 % | 4× más lento |

De `-12` a `-19`: se paga **57 veces más tiempo** por un **10 % más** de
compresión. Sobre 22 GB eso son horas contra minutos.

---

## 2. Muestra B: el entorno del colector — y el hallazgo que importa

| Compresor | Ratio |
|---|---|
| `gzip -9` | 1.01× |
| `bzip2 -9` | 1.00× |
| `zstd -3` | 1.03× |
| `zstd -19` | 1.04× |
| `zstd -22 --long` | 1.04× |
| `xz -6 -T8` | 1.04× |

**Ninguno comprime nada.** Un ratio de 1.03× significa que ese contenido **ya
está comprimido**: son las librerías binarias del entorno de Python, ruedas ya
empaquetadas y ejecutables.

Y esto no es un detalle menor, es la regla de diseño del respaldo:

> **Recomprimir lo ya comprimido gasta minutos y no gana nada.**
> `zstd -22` tardó 18.6 s en ese trozo para ahorrar un 4 %. Sobre gigabytes,
> son horas tiradas.

Por eso el respaldo debe clasificar antes de apretar: lo ya comprimido
(`.zip`, `.gz`, `.xz`, `.zst`, `.parquet`) **se guarda tal cual**; sólo se
comprime lo que de verdad encoge.

---

## 3. La decisión

### Para el respaldo que se entrega en `.zip`

Formato `.zip` porque el operador lo pidió y porque se abre en cualquier PC.
Dentro, dos tratamientos:

- **Ficheros ya comprimidos** (`.zip .gz .xz .zst .bz2 .parquet .png .jpg`) →
  `ZIP_STORED`, sin recomprimir.
- **Todo lo demás** → `ZIP_LZMA`, el mejor método que admite el formato zip.

Advertencia que va escrita dentro del propio respaldo: **el explorador de
Windows puede no leer LZMA dentro de un zip**; con 7-Zip o WinRAR se abre sin
problema.

### Para comprimir datos de captura en el futuro

**Parquet + zstd sigue ganando por goleada.** Esta noche dio **65×** sobre las
capturas reales, frente a los 43-51× de los compresores generales. La razón es
que Parquet no comprime el fichero como un chorro de bytes: lo reorganiza **por
columnas**, y como cada columna tiene datos parecidos entre sí, comprime muchísimo
mejor. Además se puede leer sin descomprimirlo entero.

Un compresor general no sabe que eso es una tabla. Parquet sí.

### Si alguna vez hay que comprimir en caliente, durante una captura

`zstd -3`. Va a 961 MB/s, es decir **257 veces más rápido** que el ritmo de
escritura del colector (3.74 GiB/h ≈ 1 MB/s), y aun así comprime más que
`gzip -9`. El impacto sobre la latencia sería inapreciable.

---

## 4. Aplicación inmediata que este banco destapa

El censo del disco encontró **22 GB de CSV sin comprimir** en
`/home/trading/restore_stage_20260825` — capturas del 21 al 23 de agosto que
nadie tocó.

Con los números de arriba:

| Vía | Resultado | Tiempo estimado |
|---|---|---|
| `zstd -12` | 22 GB → ~505 MB | ~2.5 min |
| `xz -6` | 22 GB → ~468 MB | ~21 min |
| **Parquet+zstd (65×)** | **22 GB → ~338 MB** | ~7 min |

Parquet gana también aquí, y además deja los datos consultables. **Requiere
orden del operador**, porque implica borrar los CSV originales tras verificarlos,
igual que se hizo esta noche con los otros 32 GB.
