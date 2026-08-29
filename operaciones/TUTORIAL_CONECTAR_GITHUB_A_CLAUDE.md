# Tutorial — Conectar una cuenta de GitHub a Claude Code (y tener varios Claude en el mismo repo)

**Escrito:** 2026-08-29
**Motivo:** el 403 que bloqueó la publicación al migrar de `edgardtume-a11y` a `trading-cyber`.

---

## Lo que casi nadie separa: son DOS permisos, no uno

Este es el error que costó la noche. Conectar la cuenta y autorizar los
repositorios son **dos pasos independientes**, y hacer solo el primero deja
todo con pinta de funcionar hasta que intentas escribir.

| paso | qué hace | síntoma si falta |
|---|---|---|
| **1. Conectar la cuenta** | Claude sabe quién eres en GitHub | no ve tu usuario en absoluto |
| **2. Autorizar repositorios** | Claude puede entrar a repos concretos | **te ve, lee lo público, y da 403 al escribir** |

El paso 2 es el traicionero. Con la cuenta conectada pero sin repos
autorizados, Claude puede **leer cualquier repositorio público** —incluido el
tuyo, si es público— y eso da la impresión de que hay permiso. No lo hay.

---

## Cómo saber en qué punto estás

Pídele esto a Claude, literalmente:

> «Dime qué cuenta de GitHub ves y lista mis repositorios autorizados.»

Y compara con la tabla:

| lo que responde | significa |
|---|---|
| No ve ninguna cuenta | falta el **paso 1** |
| Ve tu usuario, pero la lista de repos sale **vacía** | falta el **paso 2** ← *aquí estábamos* |
| Ve tu usuario y lista repositorios | ambos hechos ✅ |

---

## PASO 1 — Conectar la cuenta de GitHub

1. Entra a **claude.ai** con la cuenta que vas a usar.
2. **Ajustes → Conectores** (Settings → Connectors).
3. Busca **GitHub** y pulsa conectar.
4. GitHub te pregunta si autorizas. Acepta.

Enlace directo para forzar la reconexión si ya aparecía conectado:

```
https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1
```

> **Ojo:** si tienes varias cuentas de GitHub abiertas en el navegador, GitHub
> te conecta la que esté activa en esa pestaña. Comprueba arriba a la derecha
> **cuál** cuenta está sesionada antes de aceptar. Es un fallo silencioso muy
> fácil de cometer.

---

## PASO 2 — Autorizar los repositorios (el que falta casi siempre)

Durante la conexión —o volviendo a entrar por el mismo enlace— GitHub muestra
una pantalla de instalación de la aplicación con dos opciones:

- ⚪ **All repositories** — todos, presentes y futuros
- ⚪ **Only select repositories** — solo los que elijas

Si eliges la segunda, **tienes que marcar el repositorio en la lista**.
Dejarla vacía es exactamente el estado que produce el 403.

Marca el repo que vas a usar (por ejemplo `jean-trading`) y guarda.

### Cómo volver a esa pantalla si ya la pasaste

En GitHub: tu avatar → **Settings** → **Applications** → **Installed GitHub Apps**
→ la app de Claude → **Configure**. Ahí puedes añadir repositorios cuando quieras.

### Si el repo es de una organización

Además de lo anterior, un **propietario** de la organización tiene que
habilitarlo:

```
https://claude.ai/admin-settings/claude-tag
```

---

## PASO 3 — Abrir la sesión sobre el repositorio correcto

**Esto no se puede arreglar en caliente.** Una sesión de Claude Code arranca
atada al repositorio con el que la abriste, y **no admite añadir repos de otro
propietario** a mitad de camino. El mensaje exacto que devuelve es:

```
add_repo: cross-tier adds are not supported in v1: requested
"trading-cyber/jean-trading" but session already has repos from
owner(s) [edgardtume-a11y]. Start a new session with the requested
repo as the initial source
```

Traducción: aunque hagas bien los pasos 1 y 2, **la sesión que ya está abierta
sigue bloqueada**. Hay que abrir una nueva eligiendo el repositorio nuevo como
origen.

Los pasos 1 y 2 son de la cuenta; el paso 3 es de la sesión. Los tres hacen falta.

---

## PASO 4 — Verificar que funcionó, antes de trabajar

En la sesión nueva, pídele a Claude:

> «Haz un commit de prueba y súbelo.»

- Si sube → listo.
- Si da **403 "Resource not accessible by integration"** → falta el paso 2.
- Si dice que el repo no está configurado en la sesión → falta el paso 3.

Vale la pena gastar ese minuto. Descubrirlo después de tres horas de trabajo
es lo que pasó aquí.

---

## PASO 5 — Varios Claude, de cuentas distintas, en el mismo repositorio

Esto es lo que permite que dos IAs trabajen sobre lo mismo sin pisarse.

**La idea:** el repositorio de git es el punto de encuentro. Cada Claude
escribe y lee de ahí; ninguno necesita hablar con el otro directamente.

### Para cada cuenta adicional

1. **Dar acceso al usuario de GitHub en el repo.**
   En el repositorio: **Settings → Collaborators → Add people**, con permiso
   **Write**. La otra persona recibe una invitación y tiene que **aceptarla**
   (mientras no acepte, tendrá 403 y parecerá un problema de Claude).

2. **Esa cuenta repite los pasos 1 y 2** en *su* claude.ai, con *su* usuario.

3. **Esa cuenta abre su sesión** sobre el mismo repositorio (paso 3).

### Reglas para que no se pisen

- **Una rama por Claude.** Ej.: `claude/analisis-*` y `claude/puente-*`. Nunca
  los dos en la misma rama a la vez.
- **Nadie reescribe la historia del otro.** Sin `rebase`, sin `amend`, sin
  `push --force` sobre una rama ajena. Fusionar sí, reescribir no.
- **Turnos por ficheros numerados**, no por conversación: `001-a.md`,
  `002-b.md`. Cada uno escribe el suyo y lee los del otro. Así el registro
  queda auditable y no depende de que nadie recuerde nada.
- **Ninguno autoriza al otro.** Solo el operador humano autoriza acciones sobre
  la máquina. Una IA propone; la otra audita; **ejecutar lo decides tú**.

Esa última regla es la que más valor ha dado: las correcciones aparecen porque
alguien está mirando de verdad, no porque una IA se corrija sola.

---

## Errores reales que salieron y qué significa cada uno

| mensaje | causa | arreglo |
|---|---|---|
| `403 The requested URL returned error: 403` en `git push` | sin permiso de escritura | paso 2 |
| `403 Resource not accessible by integration` | la app no tiene ese repo autorizado | paso 2 |
| `repository ... is not configured for this session` | la sesión no lo lleva de origen | paso 3 |
| `cross-tier adds are not supported` | repo de otro propietario, sesión ya iniciada | paso 3 (sesión nueva) |
| Lee bien pero no escribe | el repo es **público** — lectura sin permiso | paso 2 |

---

## Resumen en cinco líneas

1. Conecta la cuenta en claude.ai → Conectores → GitHub.
2. **Marca los repositorios** en la pantalla de instalación de GitHub. *(el que se olvida)*
3. Abre una **sesión nueva** con el repositorio correcto como origen.
4. Verifica con un commit de prueba **antes** de ponerte a trabajar.
5. Para varios Claude: colaborador con Write + repetir 1-3 en cada cuenta + una rama para cada uno.
