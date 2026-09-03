# PROMPT PARA CLAUDE CODE — Plataforma de Ciberseguridad para Dispositivos Médicos (IoMT)

> Cómo usarlo: crea una carpeta vacía (`mkdir iomt-guard && cd iomt-guard`), abre `claude`, pega TODO lo que hay debajo de la línea y envíalo. Claude Code arrancará en modo plan y te pedirá aprobación antes de escribir código. Después avanza fase a fase diciéndole "continúa con la fase N".

---

## 1. Rol y contexto

Eres un ingeniero senior de software y ciberseguridad especializado en entornos sanitarios y dispositivos médicos conectados (IoMT). Vas a construir desde cero, en esta carpeta vacía, una plataforma llamada provisionalmente **IoMT-Guard**.

Yo soy tu cliente y product owner. Trabajo en el ámbito de la ingeniería biomédica universitaria. La plataforma debe servir tanto para un hospital real como para docencia e investigación en una facultad de Ingeniería Biomédica.

Idioma: la interfaz de usuario, la documentación y los mensajes al usuario van en **español**. El código (identificadores, nombres de archivos, mensajes de commit) va en **inglés**. Los comentarios pueden ir en español.

## 2. Objetivo del producto

Dar a un responsable de seguridad o ingeniero clínico una única herramienta para responder a estas preguntas sobre su parque de dispositivos médicos conectados:

1. ¿Qué dispositivos tengo, de qué fabricante, con qué software y en qué red están?
2. ¿Cuáles tienen vulnerabilidades conocidas, cuáles se están explotando activamente, y cuáles importan de verdad por su impacto en la seguridad del paciente?
3. ¿Cuál es el riesgo de cada dispositivo según una metodología reconocida (ISO 14971 + IEC 81001-5-1), y qué evidencia tengo para una auditoría?
4. ¿Está mi red segmentada correctamente, y hay tráfico clínico (DICOM, HL7) circulando sin cifrar o hacia destinos desconocidos?
5. ¿Qué debo arreglar primero esta semana?

## 3. Usuarios

- **Ingeniero clínico / responsable de electromedicina**: mantiene el inventario, consulta riesgos por dispositivo, genera informes.
- **Responsable de seguridad (CISO / analista)**: gestiona vulnerabilidades, revisa alertas de red, prioriza remediación.
- **Auditor / dirección**: solo lectura; paneles y reportes exportables.
- **Docente / estudiante** (modo laboratorio): usa datos de demostración para aprender la metodología.

## 4. Alcance funcional (módulos)

### Módulo A — Inventario de dispositivos
- Alta manual, importación desde CSV/Excel y edición.
- Campos mínimos: identificador interno, tipo de dispositivo, fabricante, modelo, número de serie, versión de firmware/software, sistema operativo, ubicación (edificio/planta/servicio), IP, MAC, VLAN/zona de red, criticidad clínica (soporte vital / terapéutico / diagnóstico / monitorización / administrativo), estado (activo, en mantenimiento, retirado), fecha de fin de soporte del fabricante.
- Campos de seguridad basados en el formulario **MDS2** (Manufacturer Disclosure Statement for Medical Device Security, ANSI/NEMA HN 1-2019): almacena PHI, transmite PHI, cifrado en reposo, cifrado en tránsito, autenticación de usuarios, gestión de parches por el fabricante, capacidad de antimalware, puertos/servicios abiertos, acceso remoto del fabricante. Modela los apartados relevantes del MDS2 como campos estructurados con valor Sí/No/N-A/Desconocido y campo de notas.
- Adjuntar documentos por dispositivo (MDS2 en PDF, manuales, evidencias).

### Módulo B — SBOM y correlación de vulnerabilidades
- Importar SBOM en formato **CycloneDX** y **SPDX** (JSON) y asociarlo a un dispositivo.
- Correlación de componentes con vulnerabilidades usando fuentes oficiales (ver sección 6): NVD para CPE/producto, OSV.dev para paquetes de software, CISA KEV para explotación activa, EPSS para probabilidad de explotación.
- Correlación también por fabricante+modelo+versión cuando no hay SBOM (búsqueda por CPE y por palabras clave en NVD, con revisión humana de coincidencias dudosas).
- Sincronización programada de fuentes con caché local; las llamadas a APIs externas deben respetar límites de tasa y funcionar sin clave (con clave opcional en variables de entorno).
- Cada vulnerabilidad asociada a un dispositivo tiene un estado de tratamiento: nueva, en análisis, mitigada, aceptada, falso positivo, corregida; con responsable, fecha y justificación.

### Módulo C — Motor de evaluación de riesgo
- Implementar una metodología documentada, reproducible y explicable que combine:
  - Gravedad técnica (CVSS v3.1/v4 base).
  - Probabilidad de explotación (EPSS; presencia en KEV eleva a máximo).
  - Exposición (zona de red, servicios expuestos, acceso remoto habilitado, cifrado en tránsito según MDS2).
  - **Impacto en la seguridad del paciente** derivado de la criticidad clínica del dispositivo (un monitor de soporte vital pesa más que una impresora de etiquetas).
  - Controles compensatorios registrados (segmentación, listas blancas, monitorización).
- Salida: puntuación de prioridad 0-100 con nivel (crítico/alto/medio/bajo), y una explicación textual de por qué se ha obtenido esa puntuación (cada factor y su contribución).
- Vista **ISO 14971**: para cada dispositivo permitir registrar peligros, situaciones peligrosas, daños, severidad y probabilidad, con matriz de riesgo configurable y estado de aceptabilidad; las vulnerabilidades técnicas se pueden enlazar como causas de un peligro.
- Vista **IEC 81001-5-1 / modelado de amenazas simplificado**: por dispositivo, listar superficies de ataque (red, USB, acceso físico, mantenimiento remoto, integración con HIS/PACS) y amenazas asociadas con controles esperados. Usar STRIDE como taxonomía.
- Todos los parámetros del motor (pesos, matriz) configurables desde la interfaz y versionados: un cambio de pesos no debe reescribir el historial de evaluaciones anteriores.

### Módulo D — Red: segmentación y análisis pasivo de tráfico clínico
- Modelo de **zonas y conductos** inspirado en IEC 62443: definir zonas (p. ej. red clínica, red de imagen, red de gestión, invitados, Internet), asignar dispositivos a zonas y declarar conductos permitidos entre zonas. Detectar y listar dispositivos en zona incorrecta según su criticidad y comunicaciones observadas.
- **Analizador pasivo de capturas de tráfico** (archivos `.pcap`/`.pcapng` subidos por el usuario; captura en vivo solo como opción explícita y documentada, nunca por defecto). Reglas iniciales de detección:
  - DICOM en claro (puerto 104 o 11112 sin TLS) y asociaciones DICOM hacia AE Titles o IPs que no están en el inventario.
  - HL7 v2 sobre MLLP (habitualmente puerto 2575) sin cifrar.
  - Dispositivos que aparecen en el tráfico y no existen en el inventario ("dispositivos fantasma").
  - Protocolos inseguros o heredados en dispositivos médicos: Telnet, FTP, SMBv1, HTTP sin TLS en interfaces de administración, SNMP v1/v2c.
  - Comunicaciones entre zonas no autorizadas por ningún conducto declarado.
  - Volúmenes o destinos anómalos respecto a lo aprendido en capturas anteriores (línea base sencilla, sin modelos complejos).
- El analizador **no debe almacenar contenido clínico**: si detecta posibles datos de pacientes en claro, registra solo el hecho (protocolo, origen, destino, hora) y nunca el contenido.
- Cada hallazgo se convierte en una alerta enlazada al dispositivo y alimenta el factor de exposición del motor de riesgo.

### Módulo E — Panel, informes y alertas
- Panel principal: número de dispositivos por criticidad, distribución de riesgo, top 10 de dispositivos a atender, vulnerabilidades en KEV presentes en el parque, dispositivos fuera de soporte, alertas de red recientes, evolución del riesgo en el tiempo.
- Informes exportables en **PDF** y **Excel**: informe ejecutivo, informe por dispositivo (incluye evaluación ISO 14971 y evidencias), informe de vulnerabilidades por estado, informe de segmentación de red. Los informes deben servir como evidencia de auditoría.
- Alertas por correo (SMTP configurable) para: nueva vulnerabilidad KEV en un dispositivo crítico, dispositivo fantasma detectado, tráfico clínico en claro.

### Módulo F — Plataforma: usuarios, roles, auditoría y seguridad propia
- Autenticación con contraseña robusta (argon2), sesiones seguras, bloqueo por intentos, y opción de 2FA TOTP.
- Roles: administrador, analista de seguridad, ingeniero clínico, lectura.
- Registro de auditoría inmutable de acciones relevantes (quién, qué, cuándo, desde dónde).
- La plataforma debe predicar con el ejemplo: cabeceras de seguridad, validación estricta de entradas, protección CSRF, límites de tamaño en subidas, escaneo de dependencias en CI, secretos solo en variables de entorno, copias de seguridad cifradas con script de restauración probado.
- **Modo laboratorio**: un comando que carga un hospital ficticio de demostración (dispositivos, SBOMs, capturas de tráfico sintéticas, evaluaciones de ejemplo) para docencia. Fabricantes y modelos de la demo deben ser ficticios y claramente marcados como tales.

## 5. Stack técnico (decidido; propón cambios solo con justificación)

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2, Alembic para migraciones, Pydantic v2, tareas programadas con APScheduler (o Celery + Redis si lo justificas).
- **Base de datos**: PostgreSQL 16 en Docker.
- **Frontend**: React 18 + TypeScript + Vite, enrutado con React Router, tablas con TanStack Table, gráficos con Recharts. Diseño limpio, accesible, con tema claro/oscuro. Nada de plantillas pesadas.
- **Análisis de tráfico**: `scapy` y/o `pyshark` (documenta la dependencia de `tshark` si la usas); parsers propios y mínimos para DICOM (asociación A-ASSOCIATE, AE Titles) y HL7 v2 (MSH) suficientes para las reglas de detección.
- **Informes**: PDF con WeasyPrint o ReportLab; Excel con openpyxl.
- **Infraestructura**: `docker-compose.yml` que levante todo con un solo comando; `Makefile` o `justfile` con tareas habituales (dev, test, lint, seed, backup, restore).
- **Calidad**: pytest con cobertura, ruff, mypy en modo estricto razonable, ESLint + Prettier en frontend, pre-commit. GitHub Actions con lint + tests + escaneo de dependencias (pip-audit y npm audit).
- **Documentación**: `README.md` de arranque, `docs/arquitectura.md` con diagramas en Mermaid, `docs/metodologia-riesgo.md` explicando el motor con fórmulas y ejemplos, `docs/manual-usuario.md`.

## 6. Fuentes de datos externas (usa solo fuentes oficiales; nunca inventes datos de vulnerabilidades)

- **NVD API 2.0**: `https://services.nvd.nist.gov/rest/json/cves/2.0` (clave opcional, respeta los límites de tasa y añade caché local).
- **CISA KEV**: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **EPSS (FIRST)**: `https://api.first.org/data/v1/epss`
- **OSV.dev**: `https://api.osv.dev/v1/query` para componentes de SBOM.
- **Avisos médicos de CISA (ICSMA)**: si los integras, hazlo mediante su feed RSS/HTML de forma tolerante a cambios y marcado como "experimental".
- Verifica en cada caso la documentación actual de la API antes de implementar; si un endpoint ha cambiado, adáptate y anótalo en la documentación.
- Si no hay red disponible en un momento dado, el sistema debe seguir funcionando con la caché y mostrar la fecha de la última sincronización.

## 7. Normativa y marcos de referencia (para la metodología y la documentación)

- ISO 14971:2019 — gestión de riesgos en dispositivos médicos.
- IEC 81001-5-1:2021 — ciclo de vida de seguridad del software de salud.
- AAMI TIR57 — principios de gestión de riesgos de seguridad para dispositivos médicos.
- FDA, guía de ciberseguridad en dispositivos médicos para presentaciones premercado (versión vigente; verifica la última).
- ANSI/NEMA HN 1-2019 — formulario MDS2.
- IEC 62443 — zonas, conductos y niveles de seguridad.
- NIST SP 800-30 y NIST CSF 2.0 — evaluación de riesgos y funciones de seguridad.
- Protección de datos: diseña para cumplir con principios de minimización (no almacenar PHI), y deja configurable el marco legal aplicable (RGPD u otra ley nacional de protección de datos personales).

No reproduzcas texto literal de las normas (tienen derechos de autor); explica los conceptos con tus propias palabras y cita el número de norma y cláusula cuando corresponda.

## 8. Modelo de datos mínimo (ampliable)

`organizations`, `sites`, `network_zones`, `zone_conduits`, `devices`, `device_security_profile` (MDS2), `device_documents`, `sboms`, `components`, `vulnerabilities` (caché normalizada de NVD/OSV), `device_vulnerabilities` (estado de tratamiento), `kev_entries`, `epss_scores`, `risk_policies` (pesos y matriz, versionadas), `risk_assessments` (histórico), `hazards`, `hazardous_situations`, `harms`, `threat_models`, `pcap_files`, `network_findings`, `alerts`, `reports`, `users`, `roles`, `audit_log`, `sync_runs`.

Diseña las claves, índices y relaciones con cuidado; documenta el modelo en `docs/modelo-datos.md` con un diagrama ER en Mermaid.

## 9. Fases de trabajo y criterio de "hecho"

Trabaja **fase a fase**. Al terminar cada fase: ejecuta lint y tests, haz commit, actualiza `PROGRESS.md` con lo hecho, lo pendiente y las decisiones tomadas, y **detente** para que yo revise y te diga "continúa con la fase N". No encadenes fases sin mi confirmación.

- **Fase 0 — Cimientos.** Modo plan: propón arquitectura, estructura de carpetas y decisiones abiertas; espera mi aprobación. Luego: repositorio Git, `CLAUDE.md` con las convenciones del proyecto, `docker-compose`, esqueleto de backend y frontend, autenticación básica, CI, `README` de arranque. Hecho cuando: `docker compose up` levanta todo y puedo iniciar sesión.
- **Fase 1 — Inventario y perfil MDS2.** Módulo A completo con importación CSV/Excel y adjuntos. Hecho cuando: puedo cargar 50 dispositivos desde un Excel y ver/editar su perfil de seguridad.
- **Fase 2 — SBOM y vulnerabilidades.** Módulo B completo con sincronización de NVD, KEV, EPSS y OSV. Hecho cuando: subo un SBOM CycloneDX real y veo sus vulnerabilidades con KEV y EPSS correctos, verificados contra la fuente.
- **Fase 3 — Motor de riesgo.** Módulo C completo, con `docs/metodologia-riesgo.md` y tests que fijen los resultados de casos de ejemplo. Hecho cuando: cambio un peso y el histórico no se altera, y cada puntuación viene con su explicación.
- **Fase 4 — Red.** Módulo D completo, con capturas de prueba sintéticas generadas por script (nunca reales con datos de pacientes). Hecho cuando: subo una captura sintética con DICOM en claro y un dispositivo fantasma, y aparecen ambas alertas enlazadas al inventario.
- **Fase 5 — Panel e informes.** Módulo E completo. Hecho cuando: genero el informe ejecutivo en PDF y Excel con datos de la demo y es presentable ante dirección.
- **Fase 6 — Endurecimiento, modo laboratorio y entrega.** Módulo F, revisión de seguridad de la propia plataforma (usa OWASP ZAP en modo pasivo contra el entorno local y corrige hallazgos), copia/restauración probada, documentación final, manual de usuario. Hecho cuando: un compañero puede clonar, levantar, cargar la demo y hacer una evaluación completa siguiendo solo el manual.

## 10. Reglas de trabajo

1. **Planifica antes de codificar.** En la Fase 0 y al inicio de cada fase, resume en pocas líneas qué vas a hacer y qué decisiones tomas; si una decisión es de producto (no técnica), pregúntame.
2. **Tests reales.** Cada módulo con tests unitarios y de integración; el motor de riesgo y los parsers de red con casos de prueba fijos y documentados. No marques una fase como terminada con tests fallando.
3. **Nunca inventes datos.** Nada de CVEs, puntuaciones EPSS o avisos ficticios presentados como reales. Los datos de demostración deben estar claramente etiquetados como ficticios.
4. **Commits pequeños y descriptivos**, en inglés, con el porqué y no solo el qué.
5. **Mantén `PROGRESS.md` y `docs/decisiones.md`** (registro de decisiones de arquitectura, formato ADR breve) al día. Si te quedas sin contexto o se reinicia la sesión, esos dos archivos y `CLAUDE.md` deben bastar para retomar.
6. **Rendimiento razonable**: un inventario de 5.000 dispositivos y 200.000 vulnerabilidades en caché no debe hacer lenta la interfaz. Pagina y crea índices.
7. **Sin dependencias innecesarias.** Antes de añadir una librería, justifícala en una línea.
8. **Si algo no lo sabes con certeza** (un endpoint de API, una cláusula de norma), verifícalo o márcalo como "por confirmar" en la documentación; no lo des por bueno.

## 11. Límites (innegociables)

- Todo el análisis de red es **pasivo**. No implementes escaneo activo intrusivo, explotación de vulnerabilidades, fuerza bruta, ni ninguna capacidad ofensiva. Si quiero integrar un escáner de vulnerabilidades externo (OpenVAS, Nuclei) en el futuro, será por importación de sus resultados, no ejecutándolos desde la plataforma sin autorización explícita.
- No almacenar información de pacientes. Si aparece en una captura, se registra el hecho, no el dato.
- No incluir capturas de tráfico reales de ningún entorno en el repositorio; solo sintéticas generadas por script.

## 12. Primer paso, ahora mismo

Entra en modo plan. Léeme:
1. La arquitectura propuesta y la estructura de carpetas.
2. Las 5 decisiones más importantes que vas a tomar y sus alternativas.
3. Las preguntas que necesitas que responda antes de empezar (máximo 5, las más importantes).

Espera mi aprobación antes de escribir código.
