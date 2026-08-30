# JEAN_FLOW 555 META_QUANT

Captura certificable de mercado (BTCUSDT) con gates de latencia, sellos SHA-256 e instalador para Windows.

Versión documentada vigente: **v2.4.1** (15-ago-2026).

Repo: https://github.com/edgardtume-a11y/claude

## Carpetas

```
.
├── README.md              ← este archivo
├── informes/              ← historial de releases y entregables
├── entregables/           ← ZIP, instaladores .cmd, protocolo, sellos
│   ├── JEAN_FLOW_555_META_QUANT_v2.4.1.zip
│   ├── INSTALAR_EN_C_v241.cmd
│   ├── CERTIFICAR_BTCUSDT.cmd
│   ├── ARREGLAR_RELOJ.cmd
│   ├── RECOGER_EVIDENCIA_TODO.cmd
│   └── SELLOS.sha256
└── skills/
    ├── jean-flow-555/SKILL.md
    └── quant-dev-senior/SKILL.md
```

## Qué no se toca

- `entregables/` es el árbol sellado. No mover ZIPs ni `.cmd`: rompe hashes y rutas `C:\JF\...`.
- Los límites, gates y criterios del motor solo cambian con release oficial.

## Arranque rápido (Windows)

1. Poner juntos el ZIP v2.4.1 y `INSTALAR_EN_C_v241.cmd`.
2. Doble clic NORMAL al instalador (nunca como administrador).
3. Certificar con `CERTIFICAR_BTCUSDT.cmd` (modo full, BTCUSDT, sin preguntas).
4. Laptop enchufada, consola visible, no usar el equipo durante la corrida.
5. Recoger evidencia con `RECOGER_EVIDENCIA_TODO.cmd`.

## Informes

Están en [`informes/`](informes/).

| Archivo | Tema |
|---|---|
| INFORME_RELEASE_v2.4.1_15ago2026.md | Panel no se abre en certificación |
| INFORME_RELEASE_v2.4.0_15ago2026.md | Fix EcoQoS (handle ctypes) |
| INFORME_RELEASE_v2.3.9_14ago2026.md | Exclusión de calentamiento p99 |
| INFORME_RELEASE_v2.3.8_14ago2026.md | Mantenimiento documental |
| INFORME_ARREGLAR_RELOJ_15ago2026.md | Reparación NTP de un clic |
| INFORME_CERTIFICAR_BTCUSDT_15ago2026.md | Arranque sin preguntas |
| INFORME_MANTENIMIENTO_SKILLS_14ago2026.md | Skills jean-flow / quant |

## Ramas

- `main` — estructura ordenada (esta rama).
- `claude/mejora-verificacion-wqqjgm` — default original del repo (no se borró).
- El resto de `claude/*` son sesiones experimentales.

Para ver este árbol por defecto en GitHub: Settings → General → Default branch → `main`.
