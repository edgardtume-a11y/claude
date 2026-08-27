# FICHA TÉCNICA — jean-flow-02-tokyo (verificada en vivo 27/08/2026 17:45 UTC)

## Identidad
| Campo | Valor |
|---|---|
| Nombre | jean-flow-02-tokyo |
| Proyecto GCP | jean-flow-01 |
| Zona | asia-northeast1-a (Tokio, Japón) |
| Tipo de máquina | **n2-standard-8** (familia dedicada, no compartida) |
| IP externa fija | 34.180.96.105 (reservada, se conserva entre reinicios) |
| IP interna | 10.146.0.2 |
| Dominio del túnel | jean-flow-gcp.lorvellancapital.com (Cloudflare) |

## Hardware (leído del propio sistema)
| Componente | Valor |
|---|---|
| CPU | **Intel Xeon @ 2.80 GHz — 8 vCPU dedicados** |
| RAM | 31 GB (≈32 GB nominales) |
| Disco | 193 GB total, 127 GB libres (35% usado) — persistente estándar |
| Kernel | 6.17.0-1022-gcp |
| Sistema operativo | Ubuntu 24.04.4 LTS |
| Python del colector | 3.12.3 (venv del binance_phase1_collector) |

## Servicios permanentes (todos `active`, arrancan solos tras reinicio)
| Servicio | Función |
|---|---|
| jean-flow-router | Router idempotente hacia Gemini (timeout 900 s, primario 3.7-flash / fallback 3.6-flash) |
| jean-flow-gemini | Ejecutor de trabajos de Gemini |
| jean-flow-bridge | Puerta HTTPS universal (Bearer token rotativo) |
| cloudflared | Túnel que publica la puerta al mundo |
| puente-github | Guardián del puente GitHub (v3) |
| desktop-commander-remote | Conector RDC (vía de emergencia, identidad propia) |

## Costos mensuales aproximados (Tokio, precios de lista con descuento por uso sostenido)
| Concepto | USD/mes |
|---|---|
| VM n2-standard-8 (con ~30% de descuento por uso sostenido) | ~260 |
| Disco 200 GB | ~10 |
| IP fija en uso | ~4 |
| Disco de jean-flow-01 (Singapur, apagada) | ~10 |
| **Total** | **~285** |
Nota: la e2-custom-12 previa costaba ~420/mes (la familia e2 NO tiene descuento por uso
sostenido). El cambio a n2 mejoró el rendimiento Y redujo el gasto.

## Historial de configuraciones (mismo disco, mismos datos)
| Hora UTC 27/08 | Configuración | Motivo |
|---|---|---|
| 07:10 | e2-standard-4 (4 vCPU) | Creación: cuota compartida con Singapur (12 vCPU totales) |
| 12:29 | e2-standard-8 | Singapur apagada, cuota liberada |
| 12:35 | e2-custom-12-49152 (12 vCPU/48 GB) | Orden del operador: usar toda la cuota |
| **14:22** | **n2-standard-8 (dedicada)** | **Diagnóstico: los picos de las métricas venían de CPU compartida (e2), no de falta de núcleos** |

## Máquina hermana
- **jean-flow-01** (asia-southeast1-a, Singapur): APAGADA desde 12:29 UTC por orden expresa.
  No borrada — su disco conserva todos los datos históricos. Reversible en 1 comando.
