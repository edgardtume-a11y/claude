# Los 21 GiB que quedaban: convertidos, verificados y borrados

**Fecha:** 28/08/2026, 11:47 UTC
**Herramienta:** `convertir_parquet.py` (autor: Gemini; revisión: Claude)
**Estado: HECHO. 21.34 GiB liberados, 0 fallos.**

---

## 1. Qué eran

60 ficheros CSV en `/home/trading/restore_stage_20260825/ubuntu/`, de capturas
reales del 21 y 23 de agosto: la estructura estándar
(`runs/<captura>/capture/{spot,usdm_futures}/`), 36 columnas,
`schema_version 2.0.0`. Datos buenos, sólo que sin comprimir.

Era el último bloque grande de disco sin tocar, y el disco es lo que decide si
los 7 días caben.

---

## 2. Cómo se hizo: dos pasadas, no una

Ésta es la parte que importa.

**Pasada 1 — generar y conservar.** Sin `--borrar`. Convierte los 60 y deja
los originales donde estaban.

```
Ficheros procesados : 60
Fallos              : 0
GiB antes           : 21.3352
GiB despues         : 0.3269
GiB liberados       : 0.0000      <-- a propósito
Factor medio        : 65.27x
```

**Pasada 2 — reverificar y borrar.** Con `--borrar`. La herramienta **vuelve a
comprobar en esa misma ejecución**: estado del manifiesto, número de filas,
columnas iguales, valores iguales comparados como texto, y `sha256`. Sólo si
las cuatro pasan, borra.

```
Ficheros procesados : 60
Fallos              : 0
GiB liberados       : 21.3352
lineas BORRADO      : 60
```

**Por qué dos pasadas y no una:** si algo hubiera fallado en la primera, se
habría descubierto con los 21 GiB originales todavía en disco. El coste de esa
prudencia fueron unos minutos. El beneficio es que el fallo, de haberlo, no
habría sido irreversible.

---

## 3. El resultado

| | Antes | Después |
|---|---|---|
| CSV | 60 ficheros, 21.34 GiB | **0** |
| Parquet | 0 | **60 ficheros, 0.327 GiB** |
| La carpeta entera | 22 GB | **812 MB** |
| Disco libre | 102 GB (48% usado) | **123 GB (37% usado)** |

Factores individuales medidos: **53× en spot, 70-75× en futuros**. Los futuros
comprimen más porque el libro de órdenes repite muchísimo entre filas
consecutivas, y eso es exactamente lo que Parquet con zstd explota.

---

## 4. Las redes de seguridad que había debajo

1. **La reversibilidad está demostrada**, no supuesta: un CSV reconstruido
   desde su Parquet dio el mismo `sha256` que el original
   (`fa837bb0f11332f8`), y el auditor lo certificó — 1 340 365 filas.
2. **Estos mismos ficheros están dentro del respaldo completo** de 35 partes
   del 28/08 03:08, que sigue en disco.
3. La herramienta aborta si hay una captura activa. No la había: se comprobó
   antes de lanzar.
4. Un solo punto de borrado en el código, bajo cuatro condiciones anidadas.

---

## 5. Lo que esto cambia para el objetivo

La captura escribe **3.74 GiB/h**. Siete días son 628 GiB en CSV, y hay 123 GB.
En Parquet, esos mismos 7 días son **~9.7 GiB**.

Con esto queda demostrado, sobre datos reales y a escala de 60 ficheros, que la
compresión sostiene la captura de 7 días. Lo único que falta demostrar es que
funciona **mientras graba, sin mover la latencia**: eso es el rotador, y esa
prueba necesita un gate corriendo.

---

## 6. Un dato operativo que costó una orden fallida

**El ejecutor del puente corta las órdenes a los 120 segundos**, no a los 300.
Lo descubrí al lanzar la pasada de borrado en línea: la orden dio `failed` por
tiempo aunque el trabajo (lanzado con `nohup`) siguió y terminó bien.

Regla: **lo que dure más de ~110 s se lanza despegado y se consulta con órdenes
cortas.** Es la misma lección de la conversión y del reinicio del guardián, en
su tercera forma.
