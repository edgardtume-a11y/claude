# Dónde está JEAN FLOW y qué falta

**Actualizado:** 28/08/2026, 14:45 UTC (09:45 Perú)

---

## 1. Lo que espera una decisión o una acción tuya

| | Qué | Por qué importa |
|---|---|---|
| 1 | **Orden para el gate de 6 h** | Es donde se prueba el rotador **en vivo** —lo único que falta demostrar— y donde se comprueba que llegan liquidaciones y precios de marca de verdad |
| 2 | **Autorizar RDC** | `sudo systemctl restart desktop-commander-remote` y meter el código en `mcp.desktopcommander.app/device/verify`. Lleva las órdenes de ~5 s a ~1 s |
| 3 | **Decidir cómo se certifican los 7 días** | Ver `planes/BLOQUEADOR_AUDITOR_NO_LEE_PARQUET.md`. Estoy construyendo la opción B; la decisión de usarla es tuya |
| 4 | **Bajarte los respaldos** | Siguen sólo en la VM. Primero `RESPALDO_JEAN_FLOW_20260828T003137Z.zip` (625.83 MB); luego `respaldo_24_27/` (35 partes, 31.86 GiB) |
| 5 | **Mirar el saldo de Google** | Límite del calendario nº 8: cada lunes, parar por debajo de ~30 USD |
| 6 | **Recortar el PAT de GitHub** a Contents RW | Hoy tiene más permisos de los que usa |

---

## 2. Lo que está hecho y certificado

- **Gate 4 certificado 4/4** (27/08). Códigos de retorno `0,0,0,0`
- **Liquidaciones forzadas** (`FORCE_ORDER`) — revisadas y aprobadas
- **Precio de marca y financiación** (`MARK_PRICE`) — revisados y aprobados. **31 pruebas pasan**
- **Rotador de Parquet** — escrito, revisado (13 salvaguardas) y probado en laboratorio
- **Conversor de Parquet** — 60 ficheros, 0 fallos, factor 65×
- **Reversibilidad demostrada** byte a byte: `sha256` idéntico y auditor certificando el CSV reconstruido
- **Disco:** 123 GB libres (37% usado). Eran 102 GB esta mañana

**El staging bueno para los 7 días es `20260828T122455Z_markprice`.** Lleva
liquidaciones *y* precio de marca. Los anteriores quedan superados.

---

## 3. Lo que estoy haciendo ahora

**Que el auditor sepa leer Parquet** (opción B del bloqueador). Gemini escribe
el lector en el staging `20260828T143727Z_auditparquet`; el banco de pruebas ya
está escrito y esperando.

La prueba es la que decide: el gate 4 **ya no tiene CSV** —sólo Parquet—, pero
sí tiene sus informes certificados. Si el auditor nuevo reproduce esos informes
leyendo Parquet, y también leyendo un CSV reconstruido, la capacidad queda
demostrada sin cambiar ningún criterio.

El número que decide es `replay.sha256` = `1d749fd5d6c741b1...`, el hash
canónico del libro de spot. Si una sola fila cambiara, cambia.

---

## 4. Trabajo listo, en orden de valor

1. **Paralelizar la auditoría.** Las cuatro fases son de sólo lectura y escriben
   a ficheros distintos; hoy corren en serie y la máquina usa 1 de 8 núcleos.
   No toca `audit.py`: es el guion que lo llama. **Medir antes de suponer.**
2. **Interés abierto.** No existe como flujo de websocket: sólo REST. Meter
   HTTP en un colector de websockets es un cambio de otra naturaleza, con
   límites de peticiones y un fallo posible en el camino caliente. Se decide
   aparte.
3. **Probar el rotador con una captura de verdad al lado.** Necesita el gate.

---

## 5. Cosas que hemos aprendido y que cuestan si se olvidan

| | Lección |
|---|---|
| **El guardián real** | Es `/home/trading/puente_github_watcher.py`, **no** la copia del repositorio |
| **120 segundos** | El ejecutor del puente corta ahí. Lo que dure más se lanza despegado (`nohup`) y se consulta con órdenes cortas |
| **La cola de Gemini es serie** | Un encargo urgente **no adelanta** a uno atascado. Hay que dar por muerto el primero |
| **Trocear desde el principio** | Tres encargos largos han caducado con el trabajo casi hecho. Tres cortos valen más que uno de 80 minutos |
| **Nadie se reinicia a sí mismo** | Un proceso no ejecuta su propio `systemctl restart` desde dentro de la tarea. Costó 18 minutos de guardián muerto |
| **El `PYTHONPATH` es el de la captura** | Cualquier herramienta que importe módulos del colector usa `<run>/overlay/src`, no la base. La base es el punto de partida de los overlays, no lo que corre |
| **Medir antes de optimizar** | El "problema de los 19 ms" no existía: salía de no excluir el calentamiento, que `audit.py` ya excluía. Dos hipótesis construidas sobre un número sin comprobar |
| **Leer antes de encargar** | M1 y M2 ya estaban en el código. `parquet_store.py` ya existía, con 641 líneas sin usar |

---

## 6. Seguridad — sigue vigente

- **Producción automática, purga de CSV y Cloud Storage: prohibidos sin orden expresa**
- **Ninguna captura se lanza sin orden del operador**
- **Nada se toca mientras hay una captura activa**
- **Los dos respaldos contienen credenciales.** No subirlos a GitHub ni
  compartirlos sin limpiarlos antes
- La clave SSH privada se subió al chat. Recomendé rotarla; decidiste dejarlo.
  Queda anotado: sigue siendo aconsejable, y es tu decisión
