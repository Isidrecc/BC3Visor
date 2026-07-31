# CLAUDE.md

## Qué es

BC3visor: visor de presupuestos BC3 (FIEBDC-3) que se abre en el navegador y no
toca el archivo. Un único archivo, `bc3visor.html` (HTML + CSS + JS vanilla, sin
dependencias, sin CDN, sin servidor). Se abre con doble clic; el `.bc3` se carga
con FileReader. La intención es publicarlo online: tiene que seguir siendo un
archivo ligero que se sirva tal cual.

## Lo que no se negocia

**El programa jamás escribe.** Ni al `.bc3`, ni a disco, ni a un servidor. No hay
edición, ni guardado, ni exportación, ni undo. El archivo del usuario entra y
sale intacto — es lo único que separa a este visor de BC3manager, y lo que
permite abrir un presupuesto ajeno sin miedo.

Eso es distinto de no calcular. Calcular sí, y hace falta (ver abajo).

## Declarado y calculado no se mezclan

Cada número en pantalla es una de dos cosas:

- **Declarado**: viene del archivo. Se guarda como cadena cruda (campos `*Raw`) y
  solo se le cambia la puntuación al mostrarlo (`fmtNum()`: `1234.56` →
  `1.234,56`). Nunca se reformatea, ni se rellenan decimales, ni pasa por float
  antes de enseñarse. El crudo va siempre en el tooltip.
- **Calculado**: lo obtiene el visor. Tiene que verse que lo es.

Los dos pueden convivir en la misma tabla, pero el usuario debe saber siempre
cuál está mirando. De ahí sale el valor de todo lo demás: si un importe declarado
y su calculado no cuadran, eso es información sobre el archivo, y se enseña como
aviso — no se corrige por lo bajo. **El visor no arregla presupuestos, los
delata.**

## El cálculo replica a Presto, vía `~K`

Nada de constantes en el código: los decimales y los coeficientes salen del
registro `~K` del propio archivo. Calcular "a lo bruto" con floats de JS daría
descuadres de céntimos en casi todas las partidas, y entonces el aviso no vale
nada.

- **Campo 2** del `~K`: coeficientes `CI \ GG \ BI \ BAJA \ IVA` en %. Al PEM solo
  le afecta el CI, y se aplica por partida: `precio = redondear(CD × (1+CI), DUO)`.
- **Campo 3**: los decimales de cada paso, en el orden
  `DRC DC DFS DRS DUO DI DES DN DD DS DSP DEC` — **con dos huecos vacíos en el
  patrón**. FIEBDC-2016 obliga a leer el campo 3 y caer al 1/2 solo si falta.
  Hoy `regK()` solo lee el campo 2 y la moneda; habrá que ampliarlo.
- **Sin `~K` no se redondea**: se calcula a precisión alta y punto.

Cadena de redondeo (la misma que BC3manager tiene verificada contra informes
reales de Presto): en cada línea de medición se redondea **cada factor antes de
multiplicar** (uds → DN, dimensiones → DD), el parcial a DSP y el total a DS. En
la descomposición: precio básico a DES → subtotal a DI → precio de partida a DUO
→ CI encima → importe = precio × medición → capítulos = suma de sus hijos.

Dos trampas que ya están documentadas y que cuestan caro descubrir solo:

- **Redondeo mitad-arriba y exacto.** `Math.round()` sobre floats binarios se
  equivoca justo donde importa (`0,015 × 27,49 = 0,41234999…` daría `0,4123` en
  vez de `0,4124`). Como aquí no se pueden meter dependencias, hay que resolverlo
  a mano, con enteros escalados o aritmética decimal propia. **Decidirlo antes de
  escribir la primera multiplicación**, no después.
- **Los hijos cuyo código empieza por `%`** no son precio × rendimiento: se
  aplican sobre el acumulado de las líneas anteriores de esa misma
  descomposición, así que hay que recorrerla en orden con una suma corriente. Y un
  `%` dentro del desglose es un coste directo más — el CI global del `~K` se
  aplica igual por encima.

Antes de implementar nada de esto, leer `../BC3manager/docs/formato-bc3.md`
(sección «La cadena de redondeo») y contrastar el mapeo real de siglas a
posiciones del campo 3 con `../BC3manager/bc3manager/io/lector.py::_reg_K` y con
la spec en `FIEBDC/`.

## Qué NO hacer

- No escribir nada, nunca. Ni exportar, ni informes, ni «guardar una copia».
- No añadir dependencias, npm ni frameworks. Un solo archivo HTML que se sirva
  estático.
- No hardcodear decimales, coeficientes ni redondeos: salen del `~K`.
- No silenciar un descuadre ni «ajustarlo». Se enseña.
- `../BC3manager` es **SOLO LECTURA**: sirve para aprender el formato y el
  cálculo, nunca para importar código ni para modificarlo.

## El repo

| | |
|---|---|
| `bc3visor.html` | el programa entero |
| `FIEBDC/` | spec oficial 2016 / 2020 / 2024 + anexos (lector de referencia en C, ejemplo del `~K`). Fuente de verdad del formato |
| `EJEMPLOS/` | BC3 reales para probar, y `codificacion-precios-SOLID.md` con el sistema de codificación de la base de precios propia |
| `VISORES DE INTERNET/` | páginas guardadas de ILoveBC3, OpenBC3, BuildGets y un comparador. Investigación: cómo resuelven la lectura y la interfaz |

## Probar

Servir la carpeta del proyecto admite `?file=...`, que evita arrastrar el archivo
en cada recarga:

```bash
python3 -m http.server 8741 --bind 127.0.0.1
```

Y abrir, por ejemplo,
`http://127.0.0.1:8741/bc3visor.html?file=EJEMPLOS/251101%20-%20Variant%20Alqueria%20Blanca%20-%20CONSELL.bc3`.

**Siempre con `--bind 127.0.0.1`**: sin él, `http.server` sirve la carpeta a toda
la red local, y aquí hay presupuestos reales de clientes.

Los cinco ejemplos cubren a propósito casos distintos:

| Archivo | Qué caso cubre |
|---|---|
| Variant Alqueria Blanca | Presto 20.01 / FIEBDC-2016, `~K` completo |
| Nova EBAR Peguera · Bulevar Peguera | Presto 21, `~K` con decimales ampliados |
| Deposito Porreres · Cami de Santa Rita | Presto 8.8 / FIEBDC-2002: **sin raíz `##`**, sin CI, capítulos con precio precalculado |

Verificar siempre contra el archivo crudo con grep. Un valor declarado tiene que
verse letra a letra como está en el `.bc3`. Un valor calculado se comprueba contra
lo que el propio archivo declara para ese concepto — y cuando no cuadre, mirar
primero el redondeo antes de culpar al archivo.

## Rarezas del formato

El parser ya trata las mismas que BC3manager, y conviene no desmontarlas:
codificación cp1252/cp850 detectada del `~V` (cp850 con tabla manual, el
navegador no la trae), alias `#` omitido en las referencias de `~D` y `~M` de
Presto, raíz sintética `OBRA##` cuando no hay `##` (Presto 8.8), clasificación
capítulo/partida (tipo FIEBDC declarado primero, heurísticas después). A tener en
cuenta al calcular: un concepto con `~M` propia es partida antes que nada; una
`~M` sin líneas de detalle es partida alzada y vale su total declarado; y en una
línea de medición los factores a 0 cuentan como 1 (una línea «5 / 0 / 0 / 0» mide
5, no 0).
