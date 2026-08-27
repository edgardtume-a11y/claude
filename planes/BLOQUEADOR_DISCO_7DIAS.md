# BLOQUEADOR: el disco no aguanta los 7 días en CSV

> ## ✅ RESUELTO el 27/08/2026 a las 21:51 UTC
>
> Se aplicó la salida **A (Parquet)**. Resultado real, no estimado:
> **32 GB → 638 MB**, disco libre de 119 GB a **150 GB**, 74 ficheros
> convertidos, **0 fallos**, en 6 minutos.
>
> Los 7 días pasan de 628 GiB a **~9.6 GiB**: caben quince veces.
> Coste: **0 USD**. No hizo falta ni disco nuevo ni Cloud Storage.
>
> Detalle y pruebas: `operaciones/CONVERSION_PARQUET_RESULTADO.md`.
>
> **Queda una pieza:** la compresión en vivo durante la captura, para la que
> `parquet_store.py` ya existe y solo hay que probar y enganchar
> (`planes/PARQUET_STORE_YA_EXISTIA.md`).


**Detectado:** 27/08/2026 ~20:20 UTC (15:20 Perú), midiendo el gate 3 ya terminado.
**Severidad:** ALTA — impide el objetivo final tal como está planteado hoy.
**Estado:** identificado, con solución ya probada. Requiere orden del operador.

---

## 1. El dato medido (no estimado)

Del gate 3 real en la máquina n2 de Tokio:

| Medición | Valor |
|---|---|
| Ficheros CSV producidos | 37 |
| Bytes escritos | 19 148 482 088 (**17.83 GiB**) |
| Duración real de captura | **4.77 h** |
| **Tasa de escritura** | **3.74 GiB/h** |

## 2. La proyección

| Objetivo | CSV (hoy) | Parquet+zstd (71.93×) |
|---|---|---|
| Gate 6 h | 22.4 GiB | 0.31 GiB |
| Gate 24 h | 89.8 GiB | 1.25 GiB |
| **7 días (meta final)** | **628.4 GiB** | **8.74 GiB** |

## 3. El disco que tenemos

```
Filesystem      Size  Used Avail Use%
/dev/root       193G   74G  120G  38%
```

- **Total: 193 GB. Libre: 120 GB.**
- Ya ocupado por capturas antiguas: **32 GB** en `staging_runs/`.

### El choque

- 7 días en CSV pide **628 GiB**. Tenemos **120 GiB libres**.
- **Falta 5.2× el espacio disponible.** La captura moriría por disco lleno
  aproximadamente a las **32 horas** (120 GiB / 3.74 GiB/h), no a los 7 días.
- Incluso el gate de 24 h (89.8 GiB) dejaría el disco al **97 %** — sin margen
  para auditorías, logs ni el propio sistema operativo.

**Conclusión: el gate de 24 h es el último que cabe en CSV, y con riesgo.
Los 7 días son imposibles sin cambiar algo.**

---

## 4. Las tres salidas (ordenadas por lo que yo recomiendo)

### A) Parquet en rotación — RECOMENDADA
Cuando el colector cierra un CSV y abre el siguiente, un proceso aparte
convierte el cerrado a Parquet+zstd y borra el CSV solo tras verificar que la
tabla es idéntica ida y vuelta.

- **Coste: 0 USD.** No se toca la máquina ni el plan de facturación.
- 7 días pasan de 628 GiB a **8.74 GiB**. Cabe 13 veces en el disco actual.
- Ya está verificado: 71.93× de compresión sobre datos reales, ida y vuelta
  idéntica (`PARQUET_PRUEBA_OK`), y el repositorio ya tiene `parquet_store.py`
  (641 líneas) escrito de antes.
- **Riesgo:** el conversor es código nuevo en el camino de los datos. Debe
  entrar por el flujo autor/revisor (`operaciones/PROTOCOLO_ROLES_AUTOR_REVISOR.md`)
  y **nunca** borrar un CSV sin verificación byte a byte previa.

### B) Disco más grande
Añadir ~700 GB de disco persistente.

- **Coste: ~119 USD/mes** (700 GB × 0.17 USD/GB-mes, pd-ssd Tokio).
  Más que la propia máquina n2-standard-8.
- No arregla nada de fondo: en memecoins con 20 símbolos el problema vuelve
  multiplicado por 20.
- Sirve solo como parche si se necesita correr los 7 días **esta semana** sin
  tocar código.

### C) Subir a Cloud Storage y borrar local
Volcado continuo a un bucket y purga del disco.

- Coste de almacenamiento bajo, pero **la purga de CSV y el uso de Cloud Storage
  están PROHIBIDOS sin orden expresa del operador** (restricción vigente).
- Añade dependencia de red en el camino caliente de los datos.
- **No la ejecuto** salvo orden explícita.

---

## 5. Lo que NO se debe hacer

- Borrar capturas antiguas "para hacer sitio" sin orden. Los 32 GB de
  `staging_runs/` son evidencia de certificación de los gates 1, 2 y 3.
- Bajar la frecuencia de captura o filtrar eventos para ahorrar disco: eso
  degrada el dato que es justamente el producto.
- Lanzar el gate de 7 días "a ver qué pasa". Moriría a las ~32 h con el disco
  lleno, y un disco lleno puede corromper el fichero abierto.

---

## 6. Decisión pendiente del operador

> **Antes del gate de 24 h hay que elegir A, B o C.**
> El gate de 6 h (22.4 GiB) sí cabe hoy sin tocar nada — se puede correr
> mientras se decide.

Mi recomendación: **A**, y construir el conversor por el flujo autor/revisor
inmediatamente después de cerrar el A/B de M1/M2/M3.
