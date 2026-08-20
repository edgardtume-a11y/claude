# Expociencia 2026 — Croquis interactivo

Presentación HTML local. Un solo archivo (`index.html`), sin instalación y sin
servidor: se abre haciendo doble clic.

## Cómo funciona la navegación

```
Pantalla principal  →  clic en el botón 1–8  →  Croquis correspondiente
                    ←  botón inferior "Volver a la pantalla principal"  ←
```

Todas las pantallas comparten el mismo fondo, así que la transición se siente
continua. Además:

- El botón **atrás** del navegador y del celular también regresan al croquis
  anterior (la navegación usa el `#hash` de la URL).
- La tecla **Esc** regresa a la pantalla principal.
- Se puede enlazar directo a una ubicación: `index.html#croquis-5`.
- Funciona con teclado (Tab + Enter) y con lector de pantalla.

## Cómo agregar las imágenes de cada croquis

Un solo paso: **copia el archivo dentro de la carpeta `img/`** con el nombre
`croquis-N`, donde N es el número de la ubicación.

```
img/croquis-1.png   →  Patio Principal
img/croquis-2.png   →  Patio Inicial
img/croquis-3.png   →  Futsal
img/croquis-4.png   →  Comedor Nuevo
img/croquis-5.png   →  Zona de Kiosko
img/croquis-6.png   →  Pabellón 3
img/croquis-7.png   →  Pabellón 2
img/croquis-8.png   →  Cancha Sintética
```

No hay que editar el HTML: la página prueba sola las extensiones `.png`,
`.jpg`, `.jpeg` y `.webp`. Mientras falte una imagen, esa pantalla muestra un
marcador punteado indicando qué archivo agregar; nada se rompe.

Si un archivo tiene otro nombre, se puede indicar la ruta explícita en el
arreglo `UBICACIONES` (dentro de `index.html`):

```js
{ n:3, nombre:"Futsal", color:"#5aa82b",
  imagen:"img/futsal-final-v2.jpg",
  nota:"De 3.º a 6.º grado · Nivel II." },
```

## Textos de cada ubicación

En el mismo arreglo `UBICACIONES` se editan:

- `nombre` — el texto del botón y del título de la pantalla.
- `nota` — línea descriptiva bajo el título. Acepta `<b>negritas</b>`.
- `color` — color del número (uno por ubicación).

## Estructura

```
expociencia-2026/
├── index.html      Toda la presentación (HTML + CSS + JS)
├── img/            Aquí van los 8 croquis
└── README.md
```

## Notas

- Los tamaños usan `clamp()`, así que la presentación se adapta al proyector,
  a la laptop y al celular sin cortar contenido.
- La tipografía es Montserrat vía Google Fonts. Sin internet cae a la fuente
  del sistema y el diseño se mantiene.
- Los colores de los números están en `UBICACIONES` (campo `color`), uno por
  ubicación.
