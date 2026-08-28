# CALENDARIO JEAN FLOW — plazos, límites y metas

**Creado:** 28/08/2026
**Operador:** Jean Pool Anghelo Chunga
**Dedicación:** 16 h/día
**Meta final:** captura continua de 7 días → entrenamiento → simulación → operación automatizada

---

## 0. El hecho que manda sobre todo el calendario

> **Tus 16 horas diarias no acortan una grabación de 7 días.**

El camino crítico de este proyecto **no es tiempo de trabajo: es tiempo de reloj**.
Grabar 6 h tarda 6 h. Grabar 7 días tarda 7 días. Da igual cuánta gente, cuánta
máquina o cuántas horas se le echen.

Sumando la escalera pendiente:

| Gate | Duración |
|---|---|
| 6 h | 0.25 días |
| 24 h | 1 día |
| 7 días | 7 días |
| **Mínimo irreducible** | **8.25 días de grabación pura** |

Más el tiempo de auditar cada uno y el margen para un reintento.

### La consecuencia práctica, y es toda la estrategia

Hay **dos carriles que corren a la vez**:

| Carril | Quién lo mueve | Qué lo limita |
|---|---|---|
| **A — La escalera de captura** | la máquina, sola | el reloj |
| **B — El cerebro del sistema** | tú, 16 h/día | tu tiempo |

**El carril A no espera al B, y el B no espera al A.** Mientras la máquina graba
7 días, tú construyes las características, el entrenamiento y el simulador. Si
esperas a tener los datos para empezar a pensar qué hacer con ellos, pierdes
una semana entera.

**Regla del calendario: nunca dejes la máquina parada mientras trabajas, ni te
quedes esperando a la máquina.**

---

## 1. Estado a día de hoy (28/08/2026)

### Cerrado y certificado

| | Estado |
|---|---|
| Motor con uvloop | **4/4 auditorías PASAN** (primera vez) |
| Identidad de los datos | ratio 1.0, 0 conflictos, 0 errores |
| Disco | resuelto: 32 GB → 638 MB, factor 65× |
| Latencia | investigada a fondo: **no queda nada que ganar** |
| Respaldo | 35 partes, 31.86 GB, verificado |
| Respaldos incrementales | funcionando, con marca segura |
| Acceso por WinSCP | operativo |

### Listo pero sin probar en vivo

- **Rotador de Parquet** — comprime durante la captura. Revisado y probado en
  laboratorio; **falta una captura real al lado**.

### Pendiente

- 21.34 GiB de grabaciones viejas sin comprimir
- Contrato de características (14) — **sin aprobar por el operador**
- Promover uvloop a la instalación base

---

## 2. Los plazos

### FASE 1 — La escalera de captura (28/08 → 07/09)

| Fecha | Carril A (máquina) | Carril B (tú) | Meta que cierra |
|---|---|---|---|
| **Vie 28/08** | Gate de **6 h** + rotador sin borrar | Aprobar el contrato de características | Rotador probado en vivo |
| **Sáb 29/08** | Veredicto 6 h → lanzar **24 h** | Comprimir las grabaciones viejas | 6 h certificado |
| **Dom 30/08** | 24 h grabando | Construir el extractor de características | — |
| **Lun 31/08** | Veredicto 24 h → lanzar **7 días** | Extractor terminado y probado | 24 h certificado |
| **01–06/09** | **7 días grabando** | Entrenamiento y simulador | — |
| **Lun 07/09** | Veredicto 7 días | Todo listo para recibir los datos | **DATOS CERTIFICADOS** |

**Hito de la fase:** el 07/09 tienes 7 días de datos certificados **y** el
sistema para procesarlos ya construido. No un día de retraso entre las dos cosas.

### FASE 2 — Entrenamiento (07/09 → 14/09)

| Fecha | Meta |
|---|---|
| 07–08/09 | Convertir 7 días a características. Validar que no hay huecos ni fugas temporales |
| 09–11/09 | Entrenar los primeros modelos. Separación estricta entrenamiento / validación / prueba |
| 12–13/09 | Evaluación honesta: ¿bate a no hacer nada? ¿Bate a comprar y esperar? |
| **Lun 14/09** | **MODELO EVALUADO** — con su número, bueno o malo |

### FASE 3 — Simulación (14/09 → 28/09)

| Fecha | Meta |
|---|---|
| 14–17/09 | Simulador con costes reales: comisiones, deslizamiento, latencia medida |
| 18–21/09 | Simulación sobre los 7 días. Métricas: rendimiento, caída máxima, ratio de acierto |
| 22–27/09 | Simulación en tiempo real sobre mercado en vivo, **sin dinero** |
| **Lun 28/09** | **VEREDICTO DE SIMULACIÓN** |

### FASE 4 — Papel (28/09 → 12/10)

| Fecha | Meta |
|---|---|
| 28/09–12/10 | 2 semanas operando en papel, con datos reales y decisiones reales, **cero dinero** |
| **Lun 12/10** | **VEREDICTO DE PAPEL** — se compara con lo que predijo la simulación |

### FASE 5 — Dinero real (a partir del 12/10, sólo si se cumplen los límites)

Ver sección 4. **No hay fecha comprometida.** Esta fase no se calendariza: se
gana.

---

## 3. Límites duros — lo que NO se hace, pase lo que pase

### Sobre las capturas

1. **Ninguna captura se lanza sin orden expresa del operador.** Sigue vigente.
2. **No se sube un escalón sin certificar el anterior.** Si el gate de 24 h no
   da 4/4, no se lanza el de 7 días. Se arregla o se documenta por qué se acepta.
3. **Nada se toca mientras hay una captura activa.**
4. **Nunca dos capturas a la vez.**

### Sobre los datos

5. **No se borra ningún original sin verificarlo en esa misma ejecución.**
6. **El rotador nunca toca un fichero abierto** (`.csv.partial`).
7. **La purga de CSV y el uso de Cloud Storage siguen prohibidos sin orden expresa.**

### Sobre el dinero

8. **Límite de gasto: revisar el saldo de Google cada lunes.** Si baja de
   30 USD equivalentes, se apaga la máquina y se decide antes de seguir.
9. **La máquina de Singapur se queda apagada.**
10. **No se contrata disco adicional.** El problema de espacio está resuelto por
    compresión, no por gasto.

### Sobre el dinero real (fase 5)

11. **Nada de dinero real hasta que se cumpla TODO esto:**
    - Simulación positiva sobre los 7 días
    - 2 semanas en papel que **confirmen** lo que predijo la simulación
    - Diferencia entre papel y simulación menor del 20 %
    - Un mecanismo de parada de emergencia probado
    - Una pérdida máxima diaria definida **por escrito antes de empezar**
12. **La primera cantidad real es la que puedes perder entera sin que cambie
    nada en tu vida.** Si esa cantidad es cero, la fase 5 espera.
13. **Si el sistema pierde durante 3 días seguidos, se para y se revisa.**
    Automático, sin discusión ni excepciones.

### Sobre el método (lo aprendido el 27/08)

14. **Buscar antes de construir.** Tres veces en un día se reescribió algo que
    el sistema ya tenía. Antes de encargar cualquier función: `grep` del
    concepto en el código. Treinta segundos.
15. **Medir antes de arreglar.** De cinco hipótesis de latencia, una acertó.
    Refutar cuesta minutos; "arreglar" a ciegas cuesta días y deja el sistema
    peor.
16. **Comprobar que el número está bien calculado antes de investigar por qué
    es malo.** El "problema de los 19 ms" no existía: era un error de mi cálculo.
17. **Ninguna orden del puente debe esperar.** Lo largo se lanza en segundo
    plano.
18. **El autor escribe, el revisor verifica.** El autor nunca certifica su
    propio trabajo.

---

## 4. Las metas, y cómo se sabe si se cumplieron

Una meta sin criterio de comprobación es un deseo. Cada una lleva el suyo.

| # | Meta | Fecha | Se cumple cuando |
|---|---|---|---|
| M1 | Rotador probado en vivo | 28/08 | Un gate de 6 h con el rotador al lado, sin que la latencia empeore |
| M2 | Gate de 24 h certificado | 31/08 | 4/4 auditorías, ratio de identidad 1.0, 0 parciales |
| M3 | **7 días capturados** | 07/09 | 4/4 auditorías sobre los 7 días completos |
| M4 | Características extraídas | 08/09 | Sin huecos, sin fugas de futuro, reproducible desde cero |
| M5 | Modelo evaluado | 14/09 | Un número honesto sobre datos que el modelo nunca vio |
| M6 | Simulador con costes reales | 17/09 | Incluye comisión, deslizamiento y latencia medida — no supuesta |
| M7 | Veredicto de simulación | 28/09 | Positivo o negativo, pero **con números** |
| M8 | 2 semanas en papel | 12/10 | Papel y simulación coinciden dentro del 20 % |

### El criterio que decide todo el proyecto

> **M7 y M8 son la puerta.** Si la simulación sale negativa, el proyecto **no
> ha fracasado**: has construido un sistema de captura certificado que vale por
> sí mismo, y sabes que esa estrategia concreta no funciona — que es
> exactamente lo que la simulación existe para averiguar, y por eso se hace
> antes de arriesgar dinero y no después.

---

## 5. Los riesgos reales, nombrados

| Riesgo | Probabilidad | Qué hacer |
|---|---|---|
| **Se acaba el crédito de Google** | **Alta** | Revisar saldo cada lunes. Apagar la máquina entre gates si hace falta |
| Un gate largo falla a mitad | Media | La escalera existe para esto: si el de 24 h falla, no se pierden 7 días |
| El modelo no gana dinero | **Media-alta** | Es el resultado más probable del primer intento. Por eso M7 y M8 |
| Sobreajuste (el modelo memoriza en vez de aprender) | **Alta** | Separación estricta y una prueba final que el modelo nunca vio |
| Perder trabajo por un fallo de disco | Baja ahora | Respaldo hecho + incrementales funcionando |

### El riesgo que más cuesta ver

**El sobreajuste.** Un modelo puede dar resultados espectaculares sobre los
datos con los que se entrenó y perder dinero desde el primer minuto en el
mercado. No se detecta mirando el resultado del entrenamiento: sólo se detecta
guardando datos que el modelo **nunca ha visto** y probándolo ahí.

Por eso los 7 días se parten desde el principio: una parte para entrenar, otra
para validar, **y una tercera que no se toca hasta el final**. Si se mira esa
tercera parte antes de tiempo, deja de servir para siempre.

---

## 6. Qué hacer cada día

### Al empezar
1. `estado` de la máquina: disco, carga, capturas activas
2. Si hay captura corriendo: comprobar que sigue sana, **no tocar nada más**
3. Si no la hay: mirar el calendario, ver qué toca

### Al terminar
1. Lanzar lo que la máquina pueda hacer sola mientras no estás
2. Guardar el contexto en GitHub — memoria y pendientes
3. Dejar anotado el siguiente paso concreto, no "seguir con lo del modelo"

### Cada lunes
1. **Saldo de Google.** Es el límite 8 y es el que puede matar el proyecto
2. Revisar este calendario: qué se cumplió, qué se movió y **por qué**
3. Si algo se retrasó más de 2 días, **replanificar en vez de acumular deuda**

---

## 7. La regla que resume el calendario

> **La máquina nunca para. Tú tampoco esperas a la máquina.**

Todo lo demás son detalles.
