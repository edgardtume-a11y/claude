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

1. Guarda la imagen dentro de la carpeta `img/` con el nombre `croquis-N.png`
   (por ejemplo `img/croquis-3.png` para Futsal).
2. Abre `index.html`, busca el bloque **`UBICACIONES`** cerca del final y
   escribe la ruta en la línea correspondiente:

```js
{ n:3, nombre:"Futsal", color:"#5aa82b",
  imagen:"img/croquis-3.png",
  nota:"Stands de energías renovables" },
```

`nota` es opcional: si la dejas vacía, no aparece nada bajo el título.

Mientras una ubicación no tenga imagen, su pantalla muestra un marcador
punteado que indica exactamente qué archivo falta. Nada se rompe.

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
