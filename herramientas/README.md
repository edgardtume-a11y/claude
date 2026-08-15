# Herramientas de evidencia JEAN_FLOW

**Qué es esto.** Un conjunto de herramientas que se ejecutan **sobre** la evidencia ya capturada por
JEAN_FLOW. Vive **fuera** del paquete sellado y **no forma parte del producto**.

**Qué NO es.** No es una modificación del motor. No cambia ningún umbral, ningún gate, ningún esquema,
ningún certificado y ningún instalador. No se instala. No añade pasos de doble clic al flujo de Jean.

---

## Las cinco reglas que este código cumple sin excepción

1. **Solo lectura sobre `runs/`.** Ningún módulo abre un archivo de evidencia en modo escritura, ni
   renombra, ni borra. La carpeta `runs/` es evidencia intocable.
2. **Cero elevación.** Nada aquí necesita permisos de administrador. La sonda de reloj usa un puerto de
   origen efímero, que no exige privilegio.
3. **Solo biblioteca estándar.** Sin dependencias externas, sin almacén de ruedas, sin red para
   instalar nada. Funciona en Windows y en Linux con la misma línea de código.
4. **Nunca se fabrica un PASS.** Cuando algo no se puede medir o no se puede leer, el resultado es
   `UNKNOWN` con su motivo, o no se emite el artefacto. Jamás un valor por omisión.
5. **Escritura atómica de las salidas.** Todo lo que estas herramientas escriben va a un archivo
   temporal y se renombra al final, de modo que nunca exista un archivo a medias.

## Lo que estas herramientas NO tocan, por diseño

- `RESULT.json` — se lee, nunca se escribe.
- `CAPTURA_COMPLETA_AUDITADA.json` — no se lee para decidir nada ni se escribe jamás.
- Los CSV de eventos, los diarios y sus sellos.
- El manifiesto del paquete sellado.

---

## Los módulos

| Módulo | Qué hace | Etapa del plan |
|---|---|---|
| `localizar.py` | Inventaria todas las corridas de un árbol y señala cuáles fallaron, emparejando cada una con su preflight correcto | `TRANSICIÓN-T0A` |
| `detector_saltos.py` | Busca saltos del reloj de pared en los CSV ya capturados | Riesgo pendiente 1 |
| `resultado_causal.py` | Emite `RESULTADO_CAUSAL.json` con los tres veredictos separados | Sección 6.2 del informe v3 |
| `sonda_reloj.py` | Mide el desvío del reloj con muchas muestras y publica su banda demostrada | Sección 6.3 del informe v3 |
| `comun.py` | Utilidades compartidas: lectura segura, escritura atómica, sellos |  |

## Cómo se usa

Un único punto de entrada, sin archivos `.cmd`:

```
python EJECUTAR.py localizar   C:\JF
python EJECUTAR.py saltos      <carpeta_corrida>\capture
python EJECUTAR.py causal      <carpeta_corrida>
python EJECUTAR.py reloj       --limite-ms 50
```

Las pruebas se ejecutan con la biblioteca estándar, sin instalar nada:

```
python -m unittest discover -s tests -v
```

---

## Sobre el detector de saltos, y lo que no puede demostrar

El detector compara las dos marcas de tiempo que cada fila del CSV ya lleva. Si el reloj de pared se
mueve durante una captura, esa diferencia da un escalón.

**No demuestra que no hubiera saltos.** Solo puede afirmar que no encontró discontinuidades por encima
de su umbral de resolución, que en Windows está limitado por el cuanto de unos 15,6 ms del cronómetro.
En Linux ese cuanto desaparece y el detector gana sensibilidad. Esa limitación está escrita en el
propio código y en su salida, para que nadie la lea como una garantía.
