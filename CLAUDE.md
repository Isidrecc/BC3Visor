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

Implementado y verificado contra BC3manager: mismo PEM al céntimo en los cinco
archivos de `EJEMPLOS/`. Nada de constantes en el código — los decimales y los
coeficientes salen del `~K` del propio archivo. Si no hay `~K`, `K.activo` queda
en `false` y se calcula a precisión alta sin redondear.

- **Campo 1**: decimales, en el orden `1 DecDet · 2 DecCantMed · 3 DecCantRend ·
  4 DecImp · 5 DecNat · 6 DecPar · 7 Dec`. Ese orden no está claro en la norma;
  es el que BC3manager verificó empíricamente.
- **Campo 2**: coeficientes `CI \ GG \ BI \ BAJA \ IVA` en %. Al PEM solo le
  afecta el CI, que se aplica por partida: `redondear(CD × (1+CI), DUO)`.
- **Campo 3**: formato completo y preferente según FIEBDC-2016, en el orden
  `DRC DC _ DFS DRS _ DUO DI DES DN DD DS DSP DEC` — **con dos huecos vacíos**.
  Trae además los decimales de medición (DN, DD, DS, DSP) que el campo 1 no
  tiene. Sobrescribe al campo 1.

Cadena de redondeo: en cada línea de medición se redondea **cada factor antes de
multiplicar** (uds → DN, dimensiones → DD), el parcial a DSP y el total a DS. En
la descomposición: precio básico a DES → subtotal a DI → precio de partida a DUO
→ CI encima → importe = precio × medición → capítulos = suma de sus hijos.

Tres cosas que cuestan caro descubrir solas:

- **El `~C` de una partida declara el COSTE DIRECTO, sin CI**, y a menudo con más
  decimales que DecPar (Alqueria declara `8,8638` donde Presto trabaja con
  `8,86`, y muestra `9,39` con el 6% de CI encima). Por eso «Precio calculado»
  enseña el CD en las partidas: es lo único comparable con lo que hay en el `~C`.
  El total con CI va en el desglose del panel de detalle.
  Contrastado sobre las 681 partidas con descomposición de `EJEMPLOS/`: **ni una
  sola trae el CI en el `~C`**. Lo mismo dice BC3manager, que compara el `~C`
  contra el precio recalculado «con CI si es capítulo»
  (`docs/auditoria/spec-script-comparacion.md`).
- **El `~C` de un capítulo sí lleva el importe con CI** — es la suma de los
  importes de sus partidas, no un coste directo. Por eso el capítulo se compara
  contra esa suma y no contra `CD×(1+CI)` (`docs/auditoria/registro-bugs.md`, bug
  2: comparar por `CD×(1+CI)` «solo cuadraba por tolerancia» y se eliminó).
- **Redondeo mitad-arriba y exacto.** `Math.round()` sobre floats se equivoca
  justo donde importa (`0,015 × 27,49 = 0,41234999…` daría `0,4123` en vez de
  `0,4124`). Resuelto en `decFrom/decMul/decRound` con BigInt: un decimal es
  `{m,e} = m·10^-e` y el producto es exacto. `String(x)` de JS da la misma
  representación corta que `str(x)` en Python, que es lo que usa BC3manager con
  `Decimal` — por eso los dos coinciden.
- **Los hijos cuyo código empieza por `%`** (o con unidad `%`) no son precio ×
  rendimiento: se aplican sobre el acumulado de las líneas anteriores de esa
  descomposición, así que se recorre en orden con suma corriente. Un `%` dentro
  del desglose es un coste directo más — el CI global del `~K` va igual encima.

Referencia del formato y del cálculo: `../BC3manager/docs/formato-bc3.md`
(sección «La cadena de redondeo»), `../BC3manager/bc3manager/core/model.py`
(`recalcular`, `precio_con_ci`, `parcial_linea`) y `io/lector.py::_reg_K`.

### El CI se aplica siempre: hay archivos que no se pueden reconstruir

Presto tiene una opción, la variable `CalcIndAlz`, que no aplica CI a las
partidas sin descomponer. El propio Presto la documenta como «una anomalía» que
provoca incompatibilidades entre presupuestos; además, la normativa de
contratación pública exige el mismo porcentaje para todas las unidades de obra
sin exclusión.
[Consulta 03.01.15 de Presto](https://consultas.presto.es/PrestoWebWCF.svc/FunctionGo?cod=CONSULTAS/03/03.01/03.01.15&path=Consultas.cfg)

Al exportar el `.pzh` a `.bc3` **esa variable no queda marcada en ningún sitio**,
así que el archivo no se puede reconstruir: al abrirlo se le aplica el CI a todas
las partidas y aparece un descuadre. Comprobado exportando con la opción puesta y
volviendo a abrir en Presto — `EJEMPLOS/…Costitx - SOLID.bc3` y su `v2` tienen
los mismos 120 registros y solo difieren en tres números (los totales de dos
capítulos y el de la raíz); el presupuesto subió 571,08 € en el viaje de ida y
vuelta.

Conclusión operativa: **el CI se aplica a todas las partidas, tengan o no
descomposición** — es lo que reproduce los 98 capítulos de los cinco ejemplos, y
lo contrario no es implementable porque el archivo no dice cuándo tocaría. Y de
forma general conviene evitar el uso de esa opción de Presto al redactar, porque
produce BC3 irreproducibles. Si un capítulo descuadra por esta causa, el visor lo
marca en rojo y hace bien.

### Verificar el cálculo tras tocarlo

Contrastar contra BC3manager, que está verificado contra informes reales de
Presto. Cargar el archivo en el visor y comparar PEM, importes de capítulo y
precios de partida con lo que da BC3manager como librería:

```python
from bc3manager.io.lector import leer_bc3
p = leer_bc3(ruta); p.recalcular()
p.presupuesto_total(); p.precio_con_ci(codigo); p._importe_recursivo(cod, padre)
```

Cuidado al probar en el navegador: `http.server` sirve de caché y se queda con la
versión anterior del HTML. Recargar forzando (o añadir `?v=N`).

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
| `index.html` | solo redirige a `bc3visor.html` (para que GitHub Pages sirva la raíz); conserva `?file=` |
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

Los ejemplos cubren a propósito casos distintos. Todos traen raíz `##` y todos
declaran CI en el `~K` (6%, salvo Bulevar Peguera que lleva 5%):

| Archivo | Qué caso cubre |
|---|---|
| Variant Alqueria Blanca | Presto 20.01 / FIEBDC-2016, `~K` con campo 3 completo (precios de partida a 4 decimales) |
| Nova EBAR Peguera · Bulevar Peguera | Presto 21, el volumen grande |
| Deposito Porreres · Cami de Santa Rita | Presto 8.8 / FIEBDC-2002: `~K` sin campo 3, alias `#` omitido en `~D` y `~M`, capítulos con precio precalculado |
| Cami de Santa Rita **v2** | El mismo presupuesto tras ir y volver de Presto. **No es un duplicado: es la prueba** de que `CalcIndAlz` no viaja en el archivo (ver arriba). No borrar |

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

## Pendiente

**1. Las partidas sin `~D` ni `~M` no se pintan.** `clasificarTipos()` las manda
a `unitario`, y `filaNodo()` solo pinta capítulos y partidas, así que
desaparecen del árbol. Caso: `999.0016C` («Partida alçada a justificar gestió de
residus d'excavació») en `EJEMPLOS/…Costitx…`, que cuelga del `~D` del `04#` y
Presto sí enseña. No afecta a ningún total —rendimiento 0 y sin medición, importe
0— pero falta una línea del presupuesto. La regla que nos falta es la que usa
Presto: **lo que cuelga del `~D` de un capítulo es una partida**, tenga o no
descomposición y medición.

**2. La medición: la fila no cuadra consigo misma.** La columna «Cantidad»
enseña el total declarado en el `~M`, pero el importe se calcula con otro número
—el que sale de sumar las líneas de medición— y en ningún sitio se dice. Caso:
`211.0020`, el betún del MBC, en `EJEMPLOS/…Costitx…`.

```
~M|02#\211.0020|2\3\|18.23|\MBC tipus AC16 surf\0.045\405.12\\\|
```

El `~M` declara `18,23` y nosotros calculamos `20,26`. La fila muestra cantidad
18,23 y precio con CI 1.020,78, pero el importe no es 18.608,82 sino 20.681,00 —
2.072,18 € de más en ese capítulo, y sin ninguna pista de por qué.

**Qué hay que hacer.** Calcular la medición está bien y se mantiene, pero tiene
que verse: una columna de **medición calculada** junto a la declarada, en verde
si coinciden y en rojo si no, igual que ya se hace con el precio. Un descuadre de
medición es información sobre el archivo; hay que enseñarlo, no esconderlo dentro
del importe.

**Decisión técnica pendiente:** de dónde sale la diferencia. En `parcialLinea()`
redondeamos cada factor antes de multiplicar, así que `0,045` se convierte en
`0,05` y `0,05 × 405,12 = 20,26`. Ese redondeo usa `K.decNum = 2`, **que este
archivo no declara por ninguna parte**: su `~K` no trae campo 3, y el campo 1 no
incluye DN ni DD. Es un valor que nos hemos inventado, en contra de la regla de
no hardcodear nada. Sin redondear el factor sale `18,2304 → 18,23`, exactamente
lo declarado. Hay que decidir qué hacer cuando el `~K` no declara DN/DD.

**Y antes de tocarlo, documentarlo.** Falta explicar en este archivo, en lenguaje
llano y sin jerga de Presto, cómo se calcula el precio de una partida y cómo se
calcula una medición. Si vamos a enseñar dos cifras y marcar una en rojo, hay que
poder explicar de dónde sale cada una.

**3. ~~El céntimo de `542.0001`~~ — HECHO.** El acumulador de
`calcularPrecios()` sumaba en float y rompía los empates del redondeo. Resuelto
con `decAdd`, más `decDiv` para la división de las líneas de porcentaje, más la
máscara del prefijo del código (`A%AUX00250` va solo sobre las líneas que
empiezan por `A`, no sobre todo el acumulado) y el redondeo de la cantidad antes
de multiplicarla por el precio. Con eso, **los precios de partida de los cinco
ejemplos cuadran al 100%** con lo que declara su `~C`: Nova EBAR pasó de 99/130 a
130/130 y Bulevar de 243/249 a 249/249.

El cálculo completo, con los porqués y los casos que duelen, está en
[`calculo-desgloses.md`](calculo-desgloses.md).

Dos cosas que quedan de aquí: `totalMedicion()`, `importeCalculado()` y el PEM de
`renderStats()` siguen sumando en float **y está bien** — suman números de *d*
decimales y redondean a *d*, así que el empate es inalcanzable y el redondeo
borra el ruido. Y BC3manager acumula en float, así que ya no coincidimos con él
en estos casos; la razón es nuestra, y el `~C` de los archivos lo respalda.

**4. El orden del campo 1 del `~K` no es el que dice la norma.** Arriba está
escrito que ese orden «no está claro en la norma» y que se usa el que BC3manager
verificó empíricamente. En FIEBDC-3/2024 sí está, y explícito:
`DN \ DD \ DS \ DR \ DI \ DP \ DC \ DM \ DIVISA`, o sea partes iguales,
dimensiones, total de medición, rendimiento, importe de línea, suma de costes
directos, precio total del concepto (CD+CI) e importe de medición × precio.
`regK()` lo reparte de otra manera y no coincide en cuatro de las ocho
posiciones. En los cinco ejemplos da igual —todas las cifras valen 2 salvo la del
rendimiento, que las dos lecturas colocan en el mismo sitio— pero con un archivo
que use valores distintos por parámetro leeríamos mal. El campo 3 sí lo leemos
bien: verificado casilla por casilla contra el presupuesto oficial calculado de
`FIEBDC/2024/Documentos-complementarios/RegistroK_ejemplo/`, coincide en las once
posiciones que ese PDF anota.

Esto además desmonta el motivo escrito en el pendiente 2. El archivo de Costitx
**sí declara DN y DD**: son las dos primeras cifras del campo 1. La primera va
vacía (y entonces vale 2 por defecto) y la segunda declara 2. El redondeo de
medición que aplicamos no es inventado; lo que está mal es la explicación, no el
número.
