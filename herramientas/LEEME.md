# Herramientas de análisis de la cola de latencia

Los cuatro scripts que produjeron los hallazgos de `memoria/` y `auditoria/`.
Corren en la VM de Tokio, sobre los `jean_flow_metrics.jsonl` de
`/home/trading/jean-flow-exec/staging_runs/`.

| script | para qué |
|---|---|
| `tabla_gates.py` | tabla de todos los gates, cola **normalizada por hora** |
| `flancos_packagekit.py` | flancos de subida del max y su distancia a PackageKit |
| `nulo_packagekit.py` | la prueba de concentración contra la hipótesis nula |
| `comparar_mascara.py` | comparación pre/post-máscara por mercado |

## El error que corrigen

La primera comparación que hice era inválida: comparé 18 minutos de un gate
contra 60 de otro, y saqué conclusiones del **máximo**. El máximo crece con la
exposición, así que eso no compara nada.

`tabla_gates.py` declara la **cobertura real** de cada fichero (los nombres de
directorio mienten: uno que dice "6h" cubre 18 min) y normaliza las excedencias
por hora. Esa es la cifra comparable.

## El método del flanco

En ventanas maduras (`evicted > 0`), un flanco es `max_t > max_{t-1}`. Si el
máximo publicado sube sin que la ventana se reinicie, alguna muestra nueva
superó el máximo anterior. El suceso queda acotado entre dos publicaciones,
con resolución ≈ 5 s.

Límite honesto: **no estima frecuencia**. Censura los sucesos menores que el
máximo vigente y tiene un período refractario de ~200 s, el tamaño de la ventana
rodante. Sirve para localizar sucesos en el tiempo, no para contarlos.

## La prueba contra el azar

Con PackageKit arrancando cada 600 s, siempre hay un arranque cerca de cualquier
instante: encontrar uno no prueba nada. Lo que prueba algo es que los desfases
se **agrupen** más de lo que agruparía el azar.

`nulo_packagekit.py` mide el período real desde el journal, calcula el ancho de
la banda donde caen los desfases observados, y da el p-valor de que n desfases
uniformes caigan en alguna banda de ese ancho: `p ≈ n·(ancho/T)^(n-1)`.

Medido: 6 desfases en una banda de 5.0 s dentro de un período de 600 s →
p ≈ 2.4 × 10⁻¹⁰.
