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
presupuestos de prueba originales (todos de Presto). Nada de constantes en el código — los decimales y los
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
- **DN y DD** (decimales de las unidades y de las dimensiones de una línea de
  medición) se leen de los dos sitios: las dos primeras casillas del campo 1,
  en el orden de la norma (pendiente 4), y las posiciones 9 y 10 del campo 3.
  Vacío o negativo, ese factor no se redondea; si los dos campos se
  contradicen, tampoco. Es el caso de Presto, que deja DN vacío en el campo 1 y
  escribe 2 en el campo 3, y no redondea las unidades: Alqueria `332.0040` mide
  con `-3.1415` (π) y Portocolom `004333` con `-0.006`, y el total que escribe
  Presto solo sale así.

Cadena de redondeo de la descomposición: precio básico a DES → subtotal a DI →
precio de partida a DUO → CI encima → importe = precio × **cantidad declarada** →
capítulos = suma de sus hijos. La medición recalculada desde las líneas no entra
en el importe: es una comprobación (ver «Cantidad, importe y medición»).

Tres cosas que cuestan caro descubrir solas:

- **El `~C` de una partida declara el COSTE DIRECTO, sin CI**, y a menudo con más
  decimales que DecPar (Alqueria declara `8,8638` donde Presto trabaja con
  `8,86`, y muestra `9,39` con el 6% de CI encima). Por eso «Precio calculado»
  enseña el CD en las partidas: es lo único comparable con lo que hay en el `~C`.
  El total con CI va en el desglose del panel de detalle.
  Contrastado sobre las 681 partidas con descomposición de los cinco presupuestos
  de prueba originales, todos de Presto: **ni una sola trae el CI en el `~C`**.
  Ojo: **TCQ sí parece traerlo** (ver pendiente 6). Lo mismo dice BC3manager, que compara el `~C`
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
volviendo a abrir en Presto — el BC3 de Costitx y su `v2` (que ya no está en el juego de pruebas) tienen
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
| `PRESUPUESTOS-PRUEBA/` | los 29 presupuestos reales con que se prueba el visor, y `codificacion-precios-SOLID.md` con el sistema de codificación de la base de precios propia. **Fuera de git: son de clientes** |
| `pruebas/comprobar.mjs` | banco de pruebas: ejecuta el código del visor sobre todos los presupuestos y lo compara con la línea base |
| `PROTOCOLO-PRUEBAS.md` | cómo se comprueba un cambio antes de subirlo, y catálogo de qué cubre cada presupuesto |
| `VISORES DE INTERNET/` | páginas guardadas de ILoveBC3, OpenBC3, BuildGets y un comparador. Investigación: cómo resuelven la lectura y la interfaz |

## Probar

**Antes de subir cualquier cambio de `bc3visor.html`, seguir
[`PROTOCOLO-PRUEBAS.md`](PROTOCOLO-PRUEBAS.md).** `node pruebas/comprobar.mjs`
ejecuta el visor sobre los 29 presupuestos de `PRESUPUESTOS-PRUEBA/` y lo compara
con la línea base: nada que salga `PEOR` se sube sin entender por qué. El mismo
documento tiene el catálogo de qué caso cubre cada presupuesto.

Para mirar un presupuesto en el navegador, servir la carpeta del proyecto admite
`?file=...`, que evita arrastrar el archivo en cada recarga:

```bash
python3 -m http.server 8741 --bind 127.0.0.1
```

Y abrir, por ejemplo,
`http://127.0.0.1:8741/bc3visor.html?file=PRESUPUESTOS-PRUEBA/Presto20%20-%20251101%20-%20Variant%20Alqueria%20Blanca%20-%20CONSELL.bc3`.

**Siempre con `--bind 127.0.0.1`**: sin él, `http.server` sirve la carpeta a toda
la red local, y aquí hay presupuestos reales de clientes.

Verificar siempre contra el archivo crudo con grep. Un valor declarado tiene que
verse letra a letra como está en el `.bc3`. Un valor calculado se comprueba contra
lo que el propio archivo declara para ese concepto — y cuando no cuadre, mirar
primero el redondeo antes de culpar al archivo.

## Rarezas del formato

El parser ya trata las mismas que BC3manager, y conviene no desmontarlas:
codificación cp1252/cp850 detectada del `~V` (cp850 con tabla manual, el
navegador no la trae), alias `#` omitido en las referencias de `~D` y `~M` de
Presto, raíz sintética `OBRA##` cuando no hay `##` (Presto 8.8), clasificación
capítulo/partida (ver «Clasificación», abajo). A tener en cuenta al calcular: una
`~M` sin líneas de detalle es partida alzada y vale su total declarado; y en una
línea de medición los factores a 0 cuentan como 1 (una línea «5 / 0 / 0 / 0» mide
5, no 0).

## Clasificación: capítulo, partida o elemento simple

Muchos archivos no dicen qué es cada concepto (TIPO 0 o vacío), así que
`clasificarTipos()` lo decide en este orden: primero lo que el archivo
**declara**; solo si no declara nada, se **deduce** de la estructura.

**1. El TIPO del `~C`** (FIEBDC-3/2024, pág. 8). 1 mano de obra, 2 maquinaria,
3 material y 4 componente adicional de residuo → elemento simple; 5
clasificación de residuo → agrupa, como un capítulo. El 6 («partida alzada») no
está en la norma: viene de BC3manager, que además llamaba al 4 «resto de costes»
y al 5 «subcapítulo», al revés que la norma de 2016 y la de 2024. Ninguno de los
29 presupuestos usa el 6. Los valores que no son de la norma (en los ejemplos
salen `EU`, `EC`, `EA`, `PA`, `IN` y `%`) se ignoran y se pasa al paso 2.

**2. La marca del código** (pág. 7): `##` raíz, `#` capítulo, **con o sin
unidad**. La norma la hace obligatoria en el `~C` y opcional en el resto de
registros; por eso Presto escribe `~C|I.ALP#|` pero `~M|I.ALP\VIO.2D160|`. En 27
de los 29 presupuestos todos los capítulos la llevan; en los otros dos, los
nodos sin `#` ni siquiera tienen `~C` (árbol de clasificación del banco ARQ+CC y
clasificaciones de residuos de TCQ, ver pendiente 9).

**3. Archivo que marca sus capítulos con `#`** (los 29 de prueba lo hacen):
**sin `#` no hay capítulo**, como en Presto 8.8, que exporta sin `#` y con TIPO 0
lo que no la lleva. Lo que cuelga de un capítulo, se mide o tiene descomposición
es **partida**, incluida una alzada sin descomposición ni medición (`999.0016C`
de Costitx); lo demás, elemento simple.

**4. Archivo que no marca ningún capítulo:** se deduce de la estructura.
*Medido*: aparece detrás de la barra en una `~M` (`~M|DÓNDE\QUÉ|`). *Agrega*:
alguno de sus hijos se mide dentro de él.

| | Medido | Agrega | Resultado |
|---|---|---|---|
| a | sí | sí | con unidad, **partida**; sin unidad, **capítulo** |
| b | sí | no | **partida** |
| c | no | sí | **capítulo** |
| d | no | no, pero tiene `~D` | con unidad, **partida**; sin unidad, **capítulo** |
| e | no | no, sin `~D` | **elemento simple** |

En el caso a decide la unidad porque una partida puede medir un componente
dentro (`~M|VIO.2D160\placa|`) y tiene unidad, mientras que un capítulo de Presto
antiguo con una `~M` falsa (medición 1, avisa BC3manager) no la tiene.

**En el árbol** se pinta todo lo que cuelga de un capítulo, sea cual sea su
tipo, y lleva CI: Presto 8.8 exporta como TIPO 3 (material) partidas sin
descomposición, como las tasas de Andratx, y sigue aplicándoles el CI.

**Lo que puede hacer que falle:**

- **Un archivo que use la `#` solo en algunos capítulos**: los que no la lleven
  saldrían como partidas. Ninguno de los 29 lo hace.
- **Un TIPO mal puesto** por el programa manda sobre todo lo demás para el
  cálculo (un material se redondea a DES), aunque si cuelga de un capítulo se
  pinta y lleva CI igual.
- **Un programa que use la `#` final para algo que no sea un capítulo.** La `#`
  intercalada (`ENTIDAD#CONCEPTO`, pág. 7) no cuenta: solo la final.
- **En archivos sin ninguna `#`**: un capítulo con unidad y `~M` falsa saldría
  partida, y una partida sin unidad que mide algo dentro, capítulo.

### Lo que dicen la norma y Presto (investigado el 26-11-2026)

- **Medir dentro de una partida es normal.** La `~M` recoge las cantidades en que
  interviene un concepto en la descomposición de otro de mayor rango
  (FIEBDC-3/2024, pág. 21). El manual de Presto lo confirma: las líneas de
  medición son de la relación capítulo → partida, pero las relaciones de otros
  tipos pueden llevarlas «para crear presupuestos parciales o desglosar un
  rendimiento», sin planificar ni certificar.
- **Las mediciones son de la relación, no del concepto.** En Presto cada pareja
  superior–inferior es una relación única, un concepto no puede tener dos veces
  el mismo inferior, y los capítulos no pueden estar en dos sitios. Así que en un
  archivo de Presto las `~M` repetidas de una misma relación (pendiente 8) valen
  siempre lo mismo.
- **Presto asigna la naturaleza por el código** («máscaras» configurables por
  obra) y la guarda con números propios (0 raíz, 4 capítulo, 5 partida, 6 mano de
  obra, 7 material, 8 maquinaria, 9 otros), distintos del TIPO de FIEBDC.
- **Un concepto puede cambiar de naturaleza y conservar sus líneas de
  medición**, que entonces dejan de contar en el cálculo (manual de Presto): de
  ahí salen los capítulos con medición falsa que avisaba BC3manager.
- **El total de la `~M` tiene que coincidir con el rendimiento del `~D`**, y
  según la norma al leer se recalcula desde las líneas (pág. 21). La cantidad de
  una partida está en el `~D` de su capítulo; la `~M` es su desglose. En los 29
  presupuestos coinciden en 59.247 relaciones de 59.248.
- **Presto 8.8 al importar toma la cantidad del `~D` y no recalcula**: exportó
  tal cual los totales que no cuadraban con sus líneas, y en el caso 15 (`~M` 10,
  `~D` 7) usó el 7. Solo recalculó la medición que se abrió en pantalla.
- **Al recalcular, Presto 8.8 redondea las dimensiones pero no las unidades**, y
  al importar reescribe la dimensión ya redondeada (0,0475 → 0,05). Es lo que
  dice su `~K`: DN vacío en el campo 1, DD = 2. Al importar no adopta el `~K` del
  archivo: exportó el caso 11 con su propia configuración (DN vacío), aunque el
  BC3 de prueba declaraba DN = 2. Menfis 8 y TCQ declaran DN y redondean también
  las unidades. La única medición de los 29 presupuestos que no reproduce su
  propio `~K` es `GMTGRF02` de Nova EBAR (y de Andratx, que es el mismo
  proyecto): dimensiones de 3 decimales con DD = 2, declara 333,14, sin
  redondear, y Presto 8.8 la recalcula a 335,26. Sale en rojo, y hace bien.
- **Las fórmulas** (líneas de tipo 3) valen hasta la siguiente línea que defina
  otra, y no se multiplican por las unidades (pág. 21). TCQ lo hace así (Girona,
  9 de 10 al milésimo); Presto 8.8 aplica cada fórmula solo a su línea.
- **Una relación tiene una sola medición.** Con dos `~M` de la misma relación
  (casos 8 y 9), Presto 8.8 se queda con la última, igual que el visor.

`pruebas/casos/casos-clasificacion-v2.bc3` reúne todos estos casos en un BC3
sintético para pasarlo por Presto (guía en `pruebas/casos/LEEME.md`).

## Cantidad, importe y medición

**Importe** de lo que cuelga de un capítulo = precio con CI × **cantidad
declarada** (`cantidadImporte()`): el rendimiento del `~D` del capítulo (factor ×
rendimiento) o, si el capítulo no lo lista, el total de su `~M`. Es lo que toma
Presto al importar, y la norma exige que `~D` y `~M` coincidan. Una partida sin
`~M` tiene su cantidad igual: la del `~D` (las tasas de Andratx, 117 partidas en
los presupuestos de prueba).

**Medición recalculada** (`totalMedicion()`, columna «Medición calculada» y
panel de detalle): la suma de las líneas de la `~M`, contra la cantidad
declarada. Es solo una comprobación, en verde o en rojo; no entra en el importe.

- **Redondeo de los factores**: el que pide el `~K`, sin tolerancias. Las
  dimensiones a DD y las unidades a DN; lo que el `~K` no declara, o declara de
  forma contradictoria entre el campo 1 y el 3, no se redondea (ver «El cálculo
  replica a Presto»). El tooltip dice con qué decimales se ha calculado. El
  parcial va a DSP y el total a DS. Hubo una versión que aceptaba cualquiera de
  tres «reglas por programa» (Presto 8.8, Menfis 8, Presto 21): eran el `~K` de
  cada archivo mal leído, y la de Presto 21 salía de una sola medición.
- **Factores a 0 o vacíos** son neutros: una línea «5 / 0 / 0 / 0» mide 5.
- **Fórmulas** (tipo 3): `evaluarFormula()`, un intérprete propio sin `eval` ni
  `Function`, con `a b c d` (las cuatro columnas), `p` (π), `+ - * / ^` y
  paréntesis. La fórmula vale para su línea y las siguientes hasta otra, como
  dice la norma (en el panel, `fx↓` marca las que la heredan). Una fórmula que no
  se puede evaluar deja la medición sin valor (`?`), nunca en 0.
- **Subtotales** (tipo 1 y 2): sin números no suman. Con números cuentan como una
  línea normal, aunque la norma diga que no: Presto 11 escribe líneas de tipo 1
  con unidades y las cuenta (Anexo 66.03.01, 128 mediciones).

## Pendiente

**1. ~~Las partidas sin `~D` ni `~M` no se pintan~~ — HECHO.** Lo que cuelga de
un capítulo es partida y se pinta (`999.0016C` de Costitx), ver «Clasificación».

**2. ~~La medición: la fila no cuadra consigo misma~~ — HECHO.** El importe usa
la cantidad declarada y la medición recalculada se enseña aparte, en verde o en
rojo, con las reglas de «Cantidad, importe y medición». El betún `211.0020` de
Costitx (`0,045 × 405,12`) cuadra: 18,23 sin redondear las unidades, como hace
Presto 8.8.

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
posiciones (DN y DD ya se leen en el orden de la norma; el resto, todavía no). En los cinco ejemplos da igual —todas las cifras valen 2 salvo la del
rendimiento, que las dos lecturas colocan en el mismo sitio— pero con un archivo
que use valores distintos por parámetro leeríamos mal. El campo 3 sí lo leemos
bien: verificado casilla por casilla contra el presupuesto oficial calculado de
`FIEBDC/2024/Documentos-complementarios/RegistroK_ejemplo/`, coincide en las once
posiciones que ese PDF anota.

Esto además desmonta el motivo escrito en el pendiente 2. El archivo de Costitx
**sí declara DN y DD**: son las dos primeras cifras del campo 1. La primera va
vacía (las unidades no se redondean) y la segunda declara 2. El redondeo de
medición que aplicamos sale de ahí.

**5. ~~Partidas tomadas por capítulos~~ — HECHO.** Lo destapó el banco de pruebas. En
Bulevar Peguera, `VIO.2D160`, `VIOPOS6`, `13.05` y otras son partidas —tienen
unidad y precio en su `~C`— con una medición propia de algún componente de su
descomposición:

```
~C|VIO.2D160|m|PRISMA HORMIGONADO 2D160|43.94|201106|0|
~M|VIO.2D160\placa|5\7\8\2\|1.05|...
```

`clasificarTipos()` aplica la regla heredada de BC3manager «si algún hijo tiene
una `~M` colgando de este concepto, es un capítulo», y las convierte en
capítulos. Su importe sale entonces de sumar sus componentes (3,18 € donde el
archivo declara 43,94 €), y los componentes cuentan como conceptos que no se
pintan. Descuadra 17 de los 39 capítulos de Bulevar. Pista: un concepto con
unidad no es un capítulo.

Resuelto con la regla de «Clasificación», arriba. Primero se probó poner «con
`~M` propia, partida» delante de «agrega», como decía entonces este archivo,
pero BC3manager tenía ese orden al revés a propósito (los capítulos de Presto
antiguo con una `~M` falsa). La regla final se apoya en la `#` que la norma hace
obligatoria y, cuando un concepto sin `#` está medido y a la vez agrega, decide
la unidad. Las cuatro variantes probadas (A, B, C y D) dan lo mismo en Bulevar;
D es la única que cubre a la vez el capítulo con unidad y el capítulo con `~M`
falsa. Resultado: Bulevar pasa a 31/31 capítulos y PEM al céntimo
(2.356.431,29); el Anexo 66.03.01 de Presto 11, de 4.764 capítulos en rojo a
ninguno y PEM al céntimo; Torrent Gros, de 30 capítulos en rojo a 16; PALMA29
recupera como capítulos sus 444 familias, que llevan `**` como unidad.

Después se simplificó con lo que se vio en Presto 8.8: en un archivo que marca
sus capítulos, sin `#` no hay capítulo, y la deducción por estructura (con el
desempate por la unidad) queda para archivos sin ninguna marca.

**6. Por investigar, según la línea base del 25-11-2026.** Tres grupos de
precios de partida que no cuadran, sin analizar todavía:

- **TCQ con CI.** En la llar d'infants (CI 10 %) el precio del archivo dividido
  por el calculado da casi siempre 1,10 (`CAMEXT4G01`: 510,47 frente a 464,06).
  Todo indica que **TCQ escribe el `~C` de la partida con el CI incluido**, al
  revés que Presto. Si se confirma, la comparación de precios tiene que saber
  qué programa generó el archivo.
- **TCQ sin CI.** En Av. Tarragona (CI 0 %) el calculado sale un 5-6 % por
  encima del archivo (`A1110024`: 58,59 frente a 62,11). Causa desconocida.
- **Céntimos en Presto 11 y en el banco de Arquímedes.** Diferencias de 1 a 5
  céntimos (`D02009`: 187,26 frente a 187,20). Huele a redondeo. Presto 11 no
  trae campo 3 en el `~K`, así que puede estar ligado al pendiente 4.

**7. ~~Fórmulas en las líneas de medición~~ — HECHO.** Se evalúan con
`evaluarFormula()` y la fórmula vale también para las líneas siguientes, como
dice la norma. Rafal Vell pasa a 983 de 983 mediciones y Girona a 491 de 494.

**8. Mediciones de un concepto reutilizado en varias ramas.** `regM()` guarda
las mediciones en un mapa por padre, así que si llegan varias `~M` con el mismo
`PADRE\HIJO` se queda con la última. Pasa cuando un concepto se reutiliza en
varias ramas del árbol: cada rama tiene su `~M`, y lo que las distingue es la
POSICIÓN, que es la ruta completa desde la raíz. En el Anexo 66.03.01 (Presto
11), `~M|ArbFN.12_AL\F_3.3.1.D.1_A_AL|` aparece 83 veces (`1\1\1\1\1\`,
`1\3\1\2\1\`…); en Bulevar, `VIO.2D160\placa` dos veces. En esos casos todas
valen lo mismo y ningún número cambia, pero si las ramas difieren el importe
sale mal sin avisar. Afecta a 4 presupuestos de prueba. OpenBC3 tampoco lo
resuelve: cuando el hijo aparece una sola vez en su padre, suma todas las `~M`
(daría 83). Lo correcto es indexar la medición por la ruta, y eso implica que el
importe de un concepto reutilizado dependa de la rama por la que se llega.
Presto 8.8 hace lo mismo que el visor (se queda con la última, casos 8 y 9), así
que en archivos de Presto no es un fallo; queda abierto para otros programas.

**9. ~~La `#` omitida en el padre de un `~D`~~ — HECHO.** `resolverAliasHash()`
une el padre escrito sin `#` con la ficha que la lleva, si no tiene ficha propia.
El banco PALMA29 recupera así su árbol (1.245 precios y 514 capítulos que
cuadran) y Girona sus clasificaciones de residuos.

**10. ~~Partidas sin `~M`: la cantidad está en el `~D` y el visor la ignora~~ —
HECHO.** El importe usa la cantidad declarada (`cantidadImporte()`), así que las
117 partidas con la cantidad solo en el `~D` dejan de valer 0. Con eso, el PEM
cuadra al céntimo en Alqueria, Nova EBAR, Bulevar, AENA y Andratx.
