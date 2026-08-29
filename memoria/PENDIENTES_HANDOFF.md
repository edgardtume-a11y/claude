# Dónde está JEAN FLOW y qué falta

**Actualizado:** 29/08/2026, 00:35 UTC (28/08, 19:35 Perú)
**Documento maestro:** `planes/RUTA_7_DIAS.md` — la ruta completa en orden de
ejecución. Lo de aquí abajo es el estado; aquello es el procedimiento.

---

## 1. Lo que espera al operador

| | Qué | Estado |
|---|---|---|
| 1 | **Orden para la prueba comparativa** (1 h sobre `20260828T143727Z_auditparquet`) | Es el **Paso 0** y no se puede saltar |
| 2 | **Bajarse los respaldos** | Siguen sólo en la VM. Un fallo de disco se lleva todo |
| 3 | **Saldo de Google** | Límite del calendario nº 8: cada lunes, parar por debajo de ~30 USD |
| 4 | **Recortar el PAT de GitHub** a Contents RW | Hoy tiene más permisos de los que usa |
| 5 | **Decidir los límites de latencia** | Sólo después del Paso 0 |

**RDC ya está autorizado y funcionando** — el gate de hoy se lanzó por ahí.
Ese bloqueador desapareció.

---

## 2. Lo que se construyó y probó hoy (28/08)

| | Prueba |
|---|---|
| **21,34 GB liberados** | 60 ficheros, factor 65×, 0 fallos, borrado sólo tras reverificar |
| **Liquidaciones forzadas** (`FORCE_ORDER`) | revisado; base intacta; esquema intacto |
| **Precio de marca y financiación** (`MARK_PRICE`) | revisado; comprobado que no se duplica entre sockets |
| **El auditor lee Parquet** | reproduce el informe certificado del gate 4 con el **mismo hash canónico del libro** |
| **Auditoría en paralelo** | **2,35×** (577 s → 245 s); guion escrito y validado: mismos códigos, mismos informes |
| **Continuidad entre días** | probada contra datos rotos: detecta huecos y solapamientos con el número exacto de eventos |
| **El puente** | de 30 s a **4-5 s** por orden, medido |
| Pruebas del colector | **33 pasan** |

**El staging bueno es `20260828T143727Z_auditparquet`.** Lleva todo.
La instalación base **nunca se toca**.

---

## 3. Lo que se descubrió hoy y no sabíamos

1. **El auditor no cabía en memoria para 7 días.** Gasta 58 MB + 290 MB por
   millón de filas; `identity` habría pedido ~28 GB de 32, y las tres fases en
   paralelo ~55 GB. **De ahí sale certificar día a día.**
   (`planes/MEMORIA_AUDITOR_7DIAS.md`)
2. **El gate 4 certificó en un mercado dormido.** El gate del operador de hoy,
   con los trades ×9-12 y BTC cayendo 554 USD en 16 minutos, **no certificó**:
   7 umbrales de latencia. Como línea base para una semana, el gate 4 era
   optimista. (`operaciones/GATE_POSTMASK_FALLO_ANALISIS.md`)
3. **22 resincronizaciones del libro en una hora** de mercado movido. El dato
   está íntegro —era el sistema curándose— pero **ninguna ventana de
   características puede cruzar una frontera de época.**
   (`operaciones/INVARIANTES_LIBRO_NO_ERAN_FALLO.md`)

---

## 4. Sin resolver

1. **Interés abierto.** Sólo por REST, no por websocket. Meter HTTP en un
   colector de websockets es un cambio de otra naturaleza. **No capturado.**
2. **El rotador nunca ha corrido junto a una captura viva.** Es el Paso 1.
3. **Los respaldos siguen sólo en la VM.**

---

## 5. Cosas que cuestan si se olvidan

| | Lección |
|---|---|
| **El guardián real** | `/home/trading/puente_github_watcher.py`, no la copia del repositorio |
| **120 segundos** | El puente corta ahí. Lo que dure más va despegado (`nohup`) y se consulta con órdenes cortas |
| **La cola de Gemini es serie** | Un encargo urgente no adelanta a uno atascado |
| **Trocear los encargos** | Tres largos han caducado con el trabajo casi hecho |
| **Nadie se reinicia a sí mismo** | Costó 18 minutos de guardián muerto |
| **El `PYTHONPATH` es el de la captura** | Nunca el de la base: no conoce `FORCE_ORDER` ni `MARK_PRICE` |
| **Comprobar la edad de cada respuesta** | Un id `monitor-<HHMM>` colisiona cada 24 h y devuelve el dato de ayer sin dar error |
| **Sospechar primero de la prueba** | Hoy falló el arnés tres veces, no lo que se probaba |
| **Juzgar por el informe** | No por el nombre de un contador |
| **Releer lo propio antes de encargar** | Acoté un encargo fuera de donde estaba el problema, y el dato lo tenía yo escrito |

---

## 6. Seguridad — vigente

- **Producción automática, purga de CSV y Cloud Storage: prohibidos sin orden expresa**
- **Ninguna captura se lanza sin orden del operador**
- **Nada se toca mientras hay una captura activa**
- **Los dos respaldos contienen credenciales.** No subirlos a GitHub ni
  compartirlos sin limpiarlos
- La clave SSH privada se subió al chat. Recomendé rotarla; el operador decidió
  dejarlo. Queda anotado: sigue siendo aconsejable, y es su decisión
