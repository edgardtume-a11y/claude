# PLAN — Respaldo completo autosuficiente (POR HACER, tras el gate 3)
Origen: conversación con el operador 27/08/2026. Objetivo: un solo .tar.gz del que se
pueda RENACER la máquina completa en un Ubuntu vacío, sin depender de la memoria de nadie.

## Problema del respaldo actual (v1)
`respaldo_total.sh` empaqueta solo `/home/trading`. Eso deja fuera:
- Los servicios systemd (viven en /etc/systemd/system/): jean-flow-router, jean-flow-gemini,
  jean-flow-bridge, cloudflared, puente-github, desktop-commander-remote.
- La configuración del túnel Cloudflare (/etc/cloudflared/).
- La lista de paquetes del sistema (apt) y la versión exacta del SO.
Resultado: "los muebles sin la instalación eléctrica". Reconstruible, pero a mano.

## Estructura objetivo del respaldo (v2)
```
respaldo_jean_flow_<TS>.tar.gz
├── proyecto/          # /home/trading (código, datos, venv, configs)
├── servicios/         # copias de las unidades systemd + config del túnel
├── instaladores/      # ruedas .whl congeladas (pip download) de las 23 deps
│                      # versiones exactas: pyarrow 25.0.1, websockets 17.0.1, orjson 3.11.9...
├── sistema/           # SO y kernel (ficha), lista de paquetes apt, nproc/RAM/disco
└── RESTAURAR.md       # manual paso a paso de resurrección
```

## Por qué congelar las ruedas de Python (y no solo la lista)
La certificación depende de versiones exactas. Si dentro de un año una librería cambia de
comportamiento, el sistema certificado ya no sería el mismo. Con los .whl guardados, el
entorno se reconstruye idéntico incluso sin internet. Coste: ~100-200 MB extra. Vale la pena.

## Por qué NO guardar instaladores del sistema operativo
Ubuntu y apt sí se reinstalan desde su fuente (siempre disponible) y ocuparían GB. Basta con
registrar la versión exacta (24.04.4 LTS, kernel 6.17.0-1022-gcp) y la lista de paquetes.

## Reglas de seguridad del respaldo
- El .tar.gz CONTIENE SECRETOS (token del puente, PAT de GitHub, credenciales de agentes).
  Nunca subirlo a GitHub ni compartirlo con terceros sin limpiar antes esas rutas:
  /home/trading/.config/jean-flow-unrestricted/, /home/trading/.config/puente-github/,
  /home/trading/.desktop-commander*.
- Guardarlo en: disco del operador + Google Drive (privado). NUNCA en el repositorio.

## Límites de GitHub (por eso los datos NO van ahí)
Archivo individual máx. 100 MB · repo recomendado <1 GB · máx. 5 GB.
GitHub guarda el CEREBRO (código, memoria, manuales); los DATOS van al .tar.gz.

## Estrategia de respaldo en 3 capas (acordada)
| Capa | Qué | Dónde | Protege de |
|---|---|---|---|
| Cerebro | Código, memoria, planes, tutoriales | GitHub (ya activo) | Perder el conocimiento del proyecto |
| Datos + entorno | .tar.gz v2 | PC del operador + Drive | Perder acceso a la cuenta de Google |
| Máquina viva | Imagen de máquina GCP | Dentro de Google (~US$5-10/mes) | Que la VM se rompa o se borre |

## Pendiente de ejecución (tras el veredicto del gate 3, con la máquina en reposo)
1. Actualizar `puente_github/scripts/respaldo_total.sh` a la estructura v2.
2. Ejecutarlo vía puente (ejecutar_script_repo) — tiene guarda anti-captura-activa.
3. Entregar al operador la vía de descarga (botón Descargar del SSH web o WinSCP; alternativa:
   subir a Drive/Cloud Storage si el archivo supera lo cómodo para descarga directa).
4. Opcional (recomendado): crear también la imagen de máquina como tercera capa.

## Sobre migrar a otra cuenta de Google (consultado por el operador)
- La imagen de máquina SE COMPARTE entre proyectos/cuentas con permisos (no se descarga):
  la VM nueva nace idéntica en minutos. Es el método probado hoy (Singapur → Tokio).
- Descargar la imagen a la PC es posible pero inútil en la práctica (formato propietario,
  decenas de GB, solo sirve para volver a subirla a Google).
- LECCIÓN DE HOY, obligatoria antes de clonar: neutralizar las identidades de agentes
  (desktop-commander, puente) ANTES de crear la imagen, o el clon y el original se pelean
  por las mismas credenciales y ambos caen.
