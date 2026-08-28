# La costura que faltaba: comprobar que los días encajan entre sí

**Fecha:** 28/08/2026, 21:50 UTC
**Herramienta:** `puente_github/scripts/continuidad_dias.py`
**Estado: escrita y probada. Aprueba lo continuo y suspende lo roto.**

---

## 1. El hueco que tapa

Los 7 días hay que certificarlos **día a día**: la semana entera no cabe en
memoria (ver `planes/MEMORIA_AUDITOR_7DIAS.md`).

Pero **siete certificados diarios no equivalen a uno semanal.** Cada `journal`
comprueba la continuidad de `ingest_seq` *dentro* de su grupo de ficheros y no
sabe nada del día anterior. Entre el último evento de un día y el primero del
siguiente queda una costura que **no comprueba nadie**.

Si ahí se perdieran eventos, los siete informes dirían PASS y el fallo pasaría
desapercibido hasta que el modelo entrenara sobre una serie con un agujero.

---

## 2. Qué comprueba

Por mercado, entre cada par de días consecutivos:

1. **Contigüidad:** `último ingest_seq del día N + 1 == primero del día N+1`.
   Un salto son eventos perdidos; un retroceso, solapamiento.
2. **Misma sesión de captura:** `capture_session_id` idéntico en toda la
   semana. Si cambia, hubo un reinicio y no es una captura continua.
3. **Mismo esquema:** `schema_version` idéntico.
4. **Orden temporal:** el día N+1 empieza después de que acabe el N.

No repite lo que ya hace `journal` dentro de cada día. Sólo mira los bordes.

---

## 3. La prueba: dos de los tres casos DEBEN fallar

Lo que valida una comprobación no es que apruebe lo bueno, sino que **suspenda
lo roto**. Probada sobre los 10 segmentos reales de futuros de la captura del
operador, repartidos en dos «días» con enlaces simbólicos:

| Caso | Esperado | Resultado |
|---|---|---|
| **Continuo** (1-5 \| 6-10) | aprobar | **PASS**, costura `326103 → 326104`, hueco 0, salida 0 ✅ |
| **Falta un segmento** (1-5 \| 7-10) | suspender | **FAIL**, *«faltan 63 950 eventos (salta de 326103 a 390054)»*, salida 2 ✅ |
| **Solapamiento** (1-6 \| 6-10) | suspender | **FAIL**, *«solapamiento de 63 950 eventos»*, salida 2 ✅ |

Detecta el número exacto de eventos perdidos o repetidos, no sólo que algo
falla.

---

## 4. Una corrección de rendimiento por el camino

La primera versión leía **todas las filas de todos los ficheros** para
encontrar el primero y el último. Sobre 10 segmentos de 512 MB tardó más de
120 segundos y el puente la cortó.

Sobre 7 días eso habrían sido **horas** — para leer dos números.

Corregido en dos frentes:

- **Sólo hacen falta dos ficheros por día**, el primero y el último. Los de en
  medio ya los certifica `journal`.
- **La última fila se lee desde el final**: se abre el fichero, se salta al
  último MB y se sube hacia atrás. No se recorren 512 MB para ver su última
  línea.

Con eso, los tres casos completos corren en segundos.

Fue el puente cortando a los 120 s lo que me obligó a mirarlo. Sin ese límite
habría dejado una herramienta que «funciona» y que en producción habría tardado
horas.

---

## 5. Cómo se usa

```
continuidad_dias.py --mercado usdm_futures <dia1> <dia2> ... <dia7>
```

Cada tramo es un directorio o un patrón. Lee `.csv` y `.parquet`
indistintamente —así que sirve igual antes y después de comprimir— y respeta
`.csv.partial`: nunca toca un fichero que la captura esté escribiendo.

Salida 0 si todas las costuras encajan, 2 si alguna no. Igual que el auditor.

**Hay que correrla una vez por mercado**, y su PASS es tan necesario como los
siete diarios. Sin ella, la semana no está certificada: sólo lo están sus días.
