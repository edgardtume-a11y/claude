# DECISIÓN — La Fase 2 corre en un VPS Linux

**Fecha:** 20 de agosto de 2026.
**[DECISIÓN DEL PROYECTO]** Jean eligió la opción VPS (servidor Linux alquilado en la nube) para
ejecutar Linux en la Fase 2, entre las tres opciones que el plan rector dejaba en sus manos.
La laptop no se toca: ni USB, ni arranque dual, ni particiones.

---

## 1. Qué gana y qué no gana esta opción, sin adornos

**Lo que gana:**

- **Riesgo cero para la única máquina de Jean.** No hay BitLocker que arriesgar, no hay firmware
  que tocar. La laptop sigue con Windows y con la GPU para la fase de ML.
- **Reloj de primera.** En un datacenter el tráfico NTP está abierto y los servidores de hora
  están cerca: chronyd va a disciplinar el reloj como Windows nunca pudo. La pregunta «¿la red
  bloquea NTP?» desaparece para la captura.
- **Operación 24/7.** El VPS no se suspende, no se cierra la tapa, no compite con YouTube.
- **Es el ensayo del destino real.** Si algún día la Fase 3 (operación en vivo) corre en un
  servidor, este VPS es exactamente ese entorno, medido con un año de antelación.

**Lo que NO gana, y hay que decirlo:**

- **[HECHO — plan rector, sección 7]** No mide la red de la casa de Jean. La comparación
  «misma máquina, misma red» no existirá. Lo que sí queda limpio: los gates de la Fase 2 son
  **umbrales absolutos** (p99 ≤ 5 ms, etc.), así que el VPS se juzga contra los números
  vigentes, no contra la laptop.
- **Un VPS es una máquina virtual.** El plan rector veta WSL2/Docker/VM *sobre el Windows de
  Jean* porque el sustrato seguiría siendo Windows; un VPS de datacenter es Linux sobre KVM,
  otra cosa — pero el vecino ruidoso existe. **Mitigación obligatoria:** contratar plan de
  **CPU dedicada** (no «compartida/burstable»), y las corridas de 10/30/120 min dirán la verdad:
  si el robo de CPU contamina los p99, los gates lo van a cazar, y eso también es un resultado.
- **Sin GPU.** La captura no la necesita. El entrenamiento (LightGBM + RTX 3050) sigue viviendo
  en la laptop de Jean; los datos certificados viajan del VPS a la laptop como zips sellados.
  (El plan rector ya dejaba anotada esta separación en su sección 9.)

---

## 2. Qué VPS comprar — lista de compra concreta

| Qué | Pedir exactamente | Por qué |
|---|---|---|
| Sistema | **Ubuntu 24.04 LTS** (o Debian 12), 64 bits | Estables, con Python 3.12 y chrony en los repos oficiales |
| CPU | **2–4 vCPU DEDICADAS** | Los gates p99 no perdonan vecinos ruidosos |
| RAM | 8 GB | El motor usa colas acotadas; 8 GB sobran y dan margen |
| Disco | **NVMe/SSD de 100 GB o más** | Una corrida de 10 min pesó 452 MB; la escalera completa con repeticiones son decenas de GB |
| Región | **Tokio** si el precio alcanza; si no, la más barata sirve para la Fase 2 | Binance vive en AWS Tokio (~1–3 ms). Para CAPTURAR da casi igual la distancia (los gates son locales); para la Fase 3 en vivo, Tokio importa |
| Precio orientativo | **10–30 USD/mes** en Vultr, DigitalOcean, Linode/Akamai (planes «dedicated CPU») | [ESTIMACIÓN] Se puede contratar por un mes, correr la Fase 2 y decidir |

**Reglas al contratarlo:** usuario normal con llave SSH (el motor jamás corre como root — regla
del protocolo), y nada más instalado en esa máquina: el VPS es del proyecto, no un servidor de
usos varios.

---

## 3. El orden de los pasos cuando el VPS exista

1. **Sistema base:** `sudo apt update && sudo apt install -y python3.12 python3.12-venv chrony unzip`
2. **Reloj primero:** aplicar el `chrony.conf` del paquete de transición, reiniciar chronyd y
   comprobar con `chronyc tracking` que el offset queda en microsegundos. El `lector_chrony.py`
   del paquete emite el JSON con la banda honesta.
3. **Medir la red del VPS:** retardo mínimo a los servidores NTP y a los endpoints de Binance
   (esto es la columna «tráfico de reloj» de la tabla de la Fase 2).
4. **Instalar el motor:** subir el paquete sellado v2.4.1 + el wheelhouse Linux del paquete de
   transición; venv offline con `--require-hashes`; batería de pruebas (se esperan 263/2, igual
   que aquí); verificación de los 144 sellos.
5. **Escalera de la Fase 2:** corridas de 10, 30 y 120 minutos con los umbrales vigentes sin
   relajar ninguno, intercaladas con corridas equivalentes en la laptop Windows en franjas
   horarias comparables. Evidencia completa de cada corrida, se recoge sellada.
6. **Veredicto y registro:** contra la tabla de criterios de la Fase 2 del plan rector. Si algo
   falla, entra al registro de bloqueos con su clasificación; no se disimula.

**Importante:** los pasos 4 y 5 usan el motor v2.4.1 **tal cual** con su auditor por CLI (como
hizo la Fase 1). El launcher completo aún exige Windows por diseño; quitar ese gate es Fase 3 y
solo se hace si la Fase 2 aprueba.

---

## 4. Lo que esta decisión deja pendiente

- **Fase 0 sigue en pie:** el zip de `RECOGER_EVIDENCIA_TODO.cmd` de la última sesión que
  realmente falló. Es en Windows, cuesta una tarde, y no depende del VPS.
- La caducidad de esta decisión: si más adelante Jean prefiere mini-PC o USB, el plan rector
  conserva las tres opciones descritas; nada de lo preparado se pierde (el wheelhouse, los
  borradores y el runbook sirven igual en cualquier Linux x86_64).
