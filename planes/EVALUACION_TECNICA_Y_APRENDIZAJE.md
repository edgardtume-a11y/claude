# EVALUACIÓN TÉCNICA DEL PROYECTO Y RUTA DE APRENDIZAJE DEL OPERADOR
Radiografía real del código (leída en vivo 27/08/2026) + qué conviene aprender.

## Radiografía objetiva del sistema actual
| Métrica | Valor real | Lectura |
|---|---|---|
| Módulos Python | 26 archivos | Arquitectura modular, no un script gigante |
| Líneas de código | 13.287 | Proyecto mediano-serio (un TFG típico tiene 1.000-3.000) |
| **Pruebas automáticas** | **175 archivos de test** | Ratio test/código altísimo — nivel profesional |
| Tipado estático presente | 25 de 26 módulos | Casi total; muy por encima del promedio |
| Dependencias | 23, todas mínimas y justificadas | Sin "dependencitis"; orjson/websockets/pyarrow = elecciones de rendimiento correctas |
| Documentación de versiones | 13+ archivos CAMBIOS_vX | Disciplina de release real |

Módulos clave: launcher (2.921), collector (1.433), audit (1.347), dashboard (950),
dual_main (809), parquet_store (641), reconstruct (573), runtime, writer, order_book,
supply_chain. Nota: **parquet_store.py ya existe (641 líneas)** — la capa Parquet está
escrita en el motor; lo que falta es certificarla, no construirla desde cero.

## Veredicto honesto
El sistema está **por encima del nivel de un proyecto amateur** y por encima de muchos
sistemas "de producción" que se ven en empresas: hay separación de responsabilidades,
auditoría independiente, reconstrucción determinística del libro, control de versiones,
y una suite de pruebas grande. Lo construyó una IA bajo dirección del operador — y eso
NO le quita mérito: el mérito está en el método (contratos, revisión cruzada, gates).

## Dónde está la verdadera brecha del operador
No es "saber programar Python". Es **poder juzgar** lo que la IA produce. Hoy el operador
delega en la revisión automatizada (pytest, auditorías) — eso está bien y es lo que hacen
los equipos serios. La brecha aparecerá en la Fase 2, donde los errores NO los atrapa un test:
un modelo con leakage pasa todas las pruebas y aun así es inútil en vivo.

## Ruta de aprendizaje recomendada (ordenada por retorno real)
### Nivel 1 — Leer código (no escribirlo). 2-3 semanas, 30 min/día
Objetivo: entender qué hace cada módulo al leerlo, aunque no puedas escribirlo desde cero.
- Empezar por `order_book.py` (391 líneas, concepto puro) y `writer.py` (405).
- Preguntar a la IA "explícame esta función línea por línea" — es el mejor tutor posible.
- Meta medible: poder decir en una frase qué hace cada uno de los 11 módulos principales.

### Nivel 2 — Los 4 conceptos que deciden la Fase 2. 1 semana
Leakage · walk-forward · triple-barrera · Sharpe. Sin estos, no se puede juzgar un modelo.
Es el conocimiento de MAYOR retorno de toda la lista: previene el error que arruina proyectos.

### Nivel 3 — Python práctico para inspeccionar datos. 2-4 semanas
No para escribir el sistema (eso lo hace Gemini), sino para MIRAR los datos por cuenta propia:
pandas/polars básico, leer un Parquet, graficar una serie, calcular un promedio móvil.
Con eso el operador puede verificar por sí mismo lo que la IA afirma.

### Nivel 4 — Fundamentos de sistemas (opcional pero potente). Continuo
Qué es un percentil p99 y por qué importa más que el promedio; qué es una cola de mensajes;
por qué CPU dedicada vs compartida cambia las latencias (ya vivido hoy en carne propia).

### Lo que NO conviene estudiar ahora
- Aprender Rust/C++ "para bajar latencia": el cuello de botella no está ahí.
- Cursos genéricos de "trading algorítmico" de YouTube: la mayoría enseña estrategias
  sobreajustadas sin costos ni validación temporal — justo lo contrario de este proyecto.
- Certificaciones de nube: útil para empleo, irrelevante para este sistema.

## Mejora técnica concreta detectada en el código (candidata, no urgente)
`launcher.py` con 2.921 líneas es el módulo más grande y probablemente el que más
responsabilidades acumula (arranque, supervisión, señales, contratos STOP). Cuando haya
un hueco entre certificaciones, un refactor guiado (dividirlo en submódulos, con la suite
de pruebas como red de seguridad) reduciría el riesgo de tocarlo en el futuro. NO hacerlo
durante la escalera de gates: primero certificar, después refactorizar.
