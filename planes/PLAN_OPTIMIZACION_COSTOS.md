# PLAN DE OPTIMIZACIÓN DE COSTOS — Correr JEAN FLOW con presupuesto real
Contexto: consumo medido S/ 116 en 4 días (~US$ 8/día ≈ US$ 240-285/mes) con dos VMs
parte del tiempo. Objetivo: sostener 5 meses de proyecto con recursos limitados y
100% dentro de los términos de servicio.

## Regla de oro
**Solo se paga por lo que está ENCENDIDO.** Una VM apagada cuesta únicamente su disco
(~US$ 10/mes por 200 GB). Los datos y la configuración quedan intactos.

## Palancas ordenadas por ahorro
### 1. Encender solo para grabar (ahorro hasta 70%)
Los gates no son continuos: un gate de 6 h son 6 h de VM, no 24. Entre gates, apagar.
- VM encendida 24/7: ~US$ 260/mes
- VM encendida ~8 h/día: ~US$ 87/mes
- VM encendida solo durante gates (~40 h/mes): ~US$ 22/mes + discos
Comandos (Cloud Shell):
`gcloud compute instances stop jean-flow-02-tokyo --zone=asia-northeast1-a`
`gcloud compute instances start jean-flow-02-tokyo --zone=asia-northeast1-a`
Nota: el puente GitHub, el router y el túnel arrancan solos al encender (son servicios systemd).

### 2. Máquina pequeña entre gates (ahorro ~50% en horas encendidas)
Para trabajo de desarrollo/revisión no hace falta n2-standard-8. Se puede bajar a
e2-standard-2 y volver a subir para certificar (mismo disco, 3 comandos, 5 minutos).

### 3. Activar Parquet (ahorro en disco y en futuro almacenamiento)
54 GB/día → ~750 MB/día. Evita tener que ampliar disco (cada 100 GB extra ≈ US$ 5/mes)
y hace viables los respaldos.

### 4. Borrar la VM de Singapur cuando ya no sea red de seguridad (ahorro US$ 10/mes)
Requisito previo: respaldo .tar.gz descargado y verificado + varios días estables en Tokio.
Solo con orden expresa del operador.

### 5. Compromiso de uso (ahorro 20-40%) — solo si el proyecto se vuelve permanente
Google ofrece descuentos por compromiso de 1 año. NO recomendado mientras el proyecto
sea experimental: ata el gasto aunque se apague la máquina.

## Escenario recomendado para los 5 meses
| Modo | Uso | Costo aprox. |
|---|---|---|
| Certificación (gates puntuales) | VM n2-8 encendida solo durante gates + discos | **US$ 40-70/mes** |
| Captura continua de 7 días | 7 días seguidos encendida (una vez) | ~US$ 60 ese mes |
| Fase 2 (entrenar) | CPU de la misma VM; GPU alquilada por horas si hace falta | US$ 5-40 por entrenamiento |
Total estimado de los 5 meses con disciplina de encendido: **US$ 250-400**, no US$ 1.400.

## Fuentes legítimas de crédito (a postular)
1. **Google for Startups Cloud Program** — créditos de US$ 2.000 a 25.000 para proyectos
   tecnológicos en fase temprana. El sistema actual (colector certificado con auditoría de
   integridad) es un caso presentable.
2. **GitHub Student Developer Pack** — si el operador tiene correo universitario vigente:
   incluye créditos de nube y herramientas gratis.
3. **Free Tier permanente de GCP** — recursos gratuitos mensuales (útiles para el puente y
   servicios auxiliares, no para la captura).
4. **Primer cliente del servicio de datos** — un solo cliente pagando US$ 100-300/mes
   cubriría toda la infraestructura. La idea de negocio ya está registrada en los pendientes.

## Prohibido (por términos de servicio y por riesgo real)
Crear múltiples cuentas para reclamar créditos de prueba repetidos. Google detecta el patrón
(tarjetas, dispositivos, patrones de uso) y la consecuencia típica es la SUSPENSIÓN de todas
las cuentas vinculadas — incluida la principal, con pérdida de máquinas y datos.
Decisión del operador (27/08/2026): descartado, se opta por la vía legítima.
