# Cómo se calcula el desglose de una partida

Una partida tiene un precio, y ese precio sale de una lista de líneas: mano de
obra, materiales, maquinaria. Esa lista es el desglose. Aquí está cómo se llega
del desglose al precio, y dónde están las trampas.

Todo el documento usa la misma partida, la `542.0001` de
`EJEMPLOS/260714 - Cami de Santa Rita Costitx - SOLID.bc3`:

```
~C|542.0001|t|MBC tipus AC16 surf o bin D (D-12), àrid calcari|90.69|281019|0|
~D|542.0001|541.0001CIM\1\0\MO00000002\1\0.05\MO00000003\1\0.05\
            MO00000006\1\0.05\D5420001\1\1\Q060201A02\1\0.077\
            Q090401A02\1\0.011\Q050205B02\1\0.011\Q050102A06\1\0.011\%0700\1\0.07\|
```

El `~C` declara el precio: **90,69 €/t**. Ese número es el que calculó el último
programa que abrió y guardó el archivo.

El `~D` es el desglose de esa partida. Calculándolo deberíamos llegar a ese mismo
90,69. Si no llegamos, solo hay dos explicaciones: o el archivo original se
calculó mal, o lo estamos calculando mal nosotros. En los dos casos el visor lo
enseña — no corrige el archivo, lo delata.

---

## 1. Los decimales los pone el archivo

Cada número del cálculo se redondea, y **con cuántos decimales lo decide el
propio archivo**, en una línea llamada `~K`. Aquí no hay nada fijo en el código:
si el archivo dice tres decimales, son tres.

La `~K` de Santa Rita es esta:

```
~K|\2\2\3\2\2\2\2\EUR\|6|
```

Tiene tres partes separadas por `|`. La primera es la lista de decimales, la
segunda son los porcentajes económicos, y la tercera —que este archivo no trae—
es una lista de decimales más larga y más moderna.

### La lista corta de decimales

Ocho cifras y la moneda, separadas por `\`. Si una está vacía, vale el valor por
defecto que dice la norma. En Santa Rita la primera está vacía, por eso la línea
empieza con una barra suelta.

| # | Qué redondea | Aquí |
|:-:|---|:-:|
| 1 | El número de partes iguales de una línea de medición | vacía → 2 |
| 2 | Las tres dimensiones (largo, ancho, alto) de una línea de medición | 2 |
| 3 | El subtotal y el total de una medición | 2 |
| 4 | **El rendimiento y el factor de una línea del desglose** | **3** |
| 5 | **El importe de una línea del desglose** (rendimiento × precio) | **2** |
| 6 | La suma de los costes directos de un concepto | 2 |
| 7 | El precio total de un concepto, ya con costes indirectos | 2 |
| 8 | El importe de una partida (medición total × precio) | 2 |
| 9 | La moneda | EUR |

En negrita las dos que gobiernan el desglose. Aquí las cantidades van a 3
decimales y los importes a 2, y de ahí sale todo lo que viene después.

### Los porcentajes

Cinco cifras: costes indirectos, gastos generales, beneficio industrial, baja de
adjudicación e IVA. Santa Rita solo declara la primera, `6`, o sea un 6% de
costes indirectos. Del precio de una partida solo se ocupan los indirectos; los
demás van por encima del presupuesto y no entran aquí.

### La lista larga

Los archivos modernos traen una tercera parte con catorce cifras. **Manda esta
sobre la corta**, porque distingue cosas que la corta mezcla y porque la norma lo
dice expresamente. Este es el orden, con dos huecos vacíos en medio (el 3 y el 6)
que hay que respetar al contar:

| # | Qué redondea |
|:-:|---|
| 1 | Rendimiento y factor de una línea de capítulo, y su producto |
| 2 | Importe del presupuesto, de los capítulos y de los subcapítulos |
| 3 | *(vacío)* |
| 4 | Factor de una línea del desglose |
| 5 | **Rendimiento de una línea del desglose, y factor × rendimiento** |
| 6 | *(vacío)* |
| 7 | **Precio total de una partida** |
| 8 | **Importe de cada línea del desglose, suma de costes directos, costes indirectos, y las sumas sobre las que se aplica un porcentaje** |
| 9 | Precio de un elemento simple: un material, una hora de oficial |
| 10 | Número de partes iguales de una línea de medición |
| 11 | Dimensiones de una línea de medición |
| 12 | Total de una medición |
| 13 | Subtotal de una medición |
| 14 | Precio de un elemento compuesto |
| 15 | La moneda |

Fíjate en la cifra 8: la norma dice explícitamente que también fija los decimales
de **las sumas sobre las que se aplica un porcentaje**. Eso es exactamente el
acumulado del apartado 5, y no hay que buscarlo en ningún otro sitio.

Un último aviso: si un archivo no trae `~K`, no se redondea nada. Se calcula a
precisión alta y se enseña lo que salga.

---

## 2. La cantidad de cada línea del desglose

Cada línea del desglose es un recurso que hace falta para producir **una unidad**
de la partida. La `542.0001` se mide en toneladas, así que su desglose dice qué
se necesita para fabricar y poner en obra **una tonelada** de mezcla bituminosa:
tres cuartos de hora de personal entre los tres oficios, una tonelada de árido,
0,077 horas de camión, y así.

Ese es el motivo de que las cantidades sean números tan pequeños: no son las
cantidades de la obra, son las de una unidad. Multiplicarlas por la obra entera
viene después, cuando el precio ya está cerrado.

Cada línea son tres datos: **código**, **factor** y **rendimiento**. El código
dice qué recurso es; el rendimiento, cuánto hace falta; y el factor es un
multiplicador para mayorarlo o minorarlo sin tocar el rendimiento (por mermas,
por rendimiento real de obra). La cantidad es el producto de los dos:

```
MO00000003 \ 1 \ 0.05        →   cantidad = 1 × 0,05 = 0,05 h de Oficial 1ª
```

Dos reglas que hay que saber:

- **Un hueco vacío vale 1.** `B0652080\\1.1` es factor vacío y rendimiento 1,1:
  la cantidad es 1,1, no 0.
- **Un cero escrito vale 0.** `541.0001CIM\1\0` es cantidad 0, y esa línea no
  suma nada. No es lo mismo un hueco que un cero.

Y la regla que importa de verdad: **la cantidad se redondea antes de multiplicar
por el precio.** No se multiplica y luego se redondea el resultado; se redondea
primero la cantidad, y la cantidad ya redondeada es la que se multiplica.

Esto no es una interpretación nuestra: está escrito en el presupuesto de ejemplo
oficial de FIEBDC, en `FIEBDC/2024/Documentos-complementarios/RegistroK_ejemplo/`
— dos PDF con el mismo presupuesto, uno en crudo y otro calculado paso a paso,
con cada número anotado con los decimales que le tocan. Es la mejor referencia
que hay del cálculo y conviene abrirla antes de tocar nada.

En Santa Rita todas las cantidades caben ya en 3 decimales (0,05 · 0,077 · 0,011)
y el redondeo no cambia nada. Pero en el apartado 5 hay un caso donde sí, y ahí
se ve por qué el orden importa.

---

## 3. El importe de cada línea, redondeado antes de sumar

Importe de la línea = cantidad redondeada × precio, **redondeado también**, a los
decimales de importe (aquí, 2).

Los subtotales no se arrastran con todos sus decimales para redondear solo al
final. Se redondea línea a línea, y lo que se suma son importes ya limpios:

| código | descripción | cantidad | precio | importe |
|---|---|---:|---:|---:|
| 541.0001CIM | MBC amb limitació | 0,000 | 33,50 | 0,00 |
| MO00000002 | Cap de colla | 0,050 | 40,00 | 2,00 |
| MO00000003 | Oficial 1a | 0,050 | 34,00 | 1,70 |
| MO00000006 | Manobre especialista | 0,050 | 23,00 | 1,15 |
| D5420001 | AC16 surf/bin S àrid calcari | 1,000 | 70,00 | 70,00 |
| Q060201A02 | Camió caixa basculant 24 t | 0,077 | 80,00 | 6,16 |
| Q090401A02 | Estenedora d'asfalt | 0,011 | 180,00 | 1,98 |
| Q050205B02 | Piconadora 14-16 t | 0,011 | 80,00 | 0,88 |
| Q050102A06 | Corró vibratori pneumàtic | 0,011 | 80,00 | 0,88 |
| | | | **suma** | **84,75** |

En esta partida todos los productos salen exactos y no se aprecia el redondeo.
Se ve mejor en la `GEVC150PN10` de Nova EBAR Peguera:

```
Oficial 1a montador    2,11 h × 20,92 €/h  =  44,1412  →  44,14
Ayudante montador      2,11 h × 18,14 €/h  =  38,2754  →  38,28
```

Ahí se descartan 12 y se añaden 46 diezmilésimas. Lo que se suma es 44,14 y
38,28, no 44,1412 y 38,2754. Guardar los decimales de sobra y redondear solo al
final daría un precio distinto.

Falta la décima línea, el `%0700` de medios auxiliares, que va en el apartado 5.

---

## 4. Sumar los importes sin que el binario lo estropee

Aquí está el problema más difícil de ver de todo el cálculo.

Los nueve importes de arriba suman **84,75** exactos. Sumados con el `+` normal
de JavaScript dan **84,74999999999999**.

### Por qué

Un ordenador guarda los números en binario, y en binario muchos decimales
normales no existen. Lo que hay guardado de verdad es esto:

```
1,70   →   1,6999999999999999555910790149937383830547332763671875
0,88   →   0,88000000000000000444089209850062616169452667236328125
6,16   →   6,160000000000000142108547152020037174224853515625
```

Es el mismo problema que tenemos en matemáticas con 1/3 si usamos la notación
decimal, que perdemos precisión.

### Por qué importa un error tan pequeño

Casi nunca importa. Importa en un caso, pero es un caso que sale mucho: cuando el
número que hay que redondear cae **justo en la mitad**.

Redondear 0,8475 a tres decimales es una decisión: puede bajar a 0,847 o subir a
0,848. La regla del FIEBDC dice que en la mitad se sube, así que 0,848. Pero si
el número que nos llega es 0,8474999999999999, ya no está en la mitad: está por
debajo, y baja a 0,847. La regla se aplica bien, sobre un número equivocado.

### Cómo se arregla

No guardando decimales. Guardando enteros.

En vez de «0,88 euros», se guarda «88 céntimos». Ya no hay fracción, y los
enteros se suman perfectos:

```
0 + 200 + 170 + 115 + 7000 + 616 + 198 + 88 + 88 = 8475 céntimos = 84,75 €
```

`bc3visor.html` ya guarda así los números: cada decimal es una pareja de un
entero y un exponente (`{m, e}` significa `m · 10⁻ᵉ`), o sea que 84,75 es
`{8475, 2}`. El entero es un `BigInt`, que no tiene límite de dígitos, así que la
suma no puede perder nada nunca — ni con diez mil partidas ni con cifras de
millones.

La división del apartado 5 tiene que salir del binario igual que la suma. Ahí no
hay resultado exacto siempre (84,75 ÷ 7 no se acaba), así que se calcula con
ocho dígitos de guarda por encima de los que se van a conservar y se redondea
después.

### Dónde esto no puede pasar

El peligro es uno solo: que el número a redondear caiga justo en la mitad. Y hay
sumas donde eso es **imposible**.

El importe de un capítulo, por ejemplo, es la suma de los importes de sus
partidas:

```
12,34 + 5,60 + 108,07  =  126,01
```

Los sumandos llevan dos decimales y el resultado se redondea también a dos
decimales. Para que hubiera empate, la suma tendría que caer en 126,**015** — y
una suma de números de dos decimales nunca produce un tercer decimal. El empate
es inalcanzable.

El ruido binario está ahí igual: esa suma da 126,00999999999999. Pero al
redondear a dos decimales vuelve a ser 126,01, porque para cambiar el resultado
el ruido tendría que mover el número medio céntimo, y lo mueve una
diezmilbillonésima. **El redondeo borra el ruido.**

En el desglose pasa justo lo contrario. El acumulado son 84,75, dos decimales,
pero no se redondea a dos decimales: primero se multiplica por 0,07 y se divide
entre 7, y eso lo convierte en 0,8475 — cuatro decimales — que se redondea a
tres. Ahí la mitad exacta sí se alcanza, y ahí decide el ruido.

La regla, entonces:

> Se puede sumar con el `+` normal cuando el resultado se redondea a los mismos
> decimales que ya traen los sumandos. En cuanto el resultado se transforma antes
> de redondearlo, hay que sumar en enteros.

Por eso los importes de los capítulos y el total del presupuesto están a salvo, y
el acumulado de un desglose no.

---

## 5. Los medios auxiliares

La décima línea del desglose es distinta a las otras nueve:

```
%0700 \ 1 \ 0.07
~C|%0700|%|Mitjans auxiliars 7%|7|281019|0|
```

Un código que lleva un `%` no es precio × cantidad: es un **porcentaje sobre las
líneas anteriores** del desglose. Por eso el desglose se recorre en orden, con
una suma corriente: cuando aparece un porcentaje, hay que saber cuánto llevas
acumulado.

El código de un porcentaje tiene tres partes: un **prefijo**, el carácter `%`, y
un texto para diferenciarlo de otros. El prefijo dice **sobre qué líneas** se
aplica: `%0700` no tiene prefijo, así que va sobre todas las anteriores;
`A%AUX00250` solo va sobre las líneas cuyo código empieza por `A`, la mano de
obra.

La máscara importa mucho: hay 36 líneas con prefijo en `EJEMPLOS/`, todas con
prefijo `A`, y aplicarlas sobre todo el acumulado en vez de solo sobre la mano de
obra descuadraba 37 partidas de Nova EBAR y Bulevar.

### Dónde está la trampa

El 7% de 84,75 son 5,9325 €. Eso no se discute. Lo que se discute es **cómo se
escribe esa línea** en el cuadro, porque para Presto tiene que parecer una línea
normal, con su cantidad y su precio. Y hay dos formas de repartirlo:

**A) Como dice la norma:** la cantidad es el porcentaje, el precio es lo
acumulado.

```
cantidad = 0,07              → redondeada a 3 decimales → 0,070   (no cambia)
precio   = 84,75
importe  = 0,070 × 84,75 = 5,9325   → redondeado a 2 → 5,93
```

**B) Como lo hace Presto:** el precio es el 7,00 que declara el archivo para el
concepto `%0700`, y la cantidad se deduce.

```
cantidad = 84,75 × 0,07 ÷ 7 = 0,8475  → redondeada a 3 decimales → 0,848   (sube)
precio   = 7,00
importe  = 0,848 × 7 = 5,936        → redondeado a 2 → 5,94
```

| | cantidad | precio | importe | precio de la partida |
|---|---:|---:|---:|---:|
| A — la norma | 0,070 | 84,75 | 5,93 | 90,68 |
| B — Presto | **0,848** | 7,00 | 5,94 | **90,69** |

Multiplicar 0,07 × 84,75 o 0,8475 × 7 da lo mismo: 5,9325. La multiplicación es
conmutativa. **El redondeo no**, porque solo cae sobre uno de los dos números: la
cantidad se redondea, el precio no.

Por el camino A la cantidad ya cabe en tres decimales y no se recorta nada. Por
el B sobra un dígito, hay que recortar cinco diezmilésimas, y ese recorte **se
multiplica por 7** antes de llegar al importe. Ahí está la regla general:

> El error de redondear la cantidad se amplifica por el precio. Cuanto más caro
> el precio unitario, más pesa recortar la cantidad.

### Cuál usamos, y por qué

El `~C` de la partida dice **90,69**. Gana Presto.

Y no es un caso suelto. Sobre las 451 partidas con medios auxiliares de los cinco
archivos: el criterio de Presto acierta **las 451**, y el de la norma **410**.

Así que el visor reproduce lo que hace Presto, no lo que dice el formato. Es lo
que toca en un visor de archivos escritos por Presto, pero es una decisión
tomada, no un descubrimiento. Y tiene una pega: por este camino el importe
depende del precio que el archivo le ponga al concepto `%0700`. Si en vez de 7
pusiera 1, el mismo 7% daría 5,93. Ese precio es decorativo — solo está para que
la línea tenga aspecto de línea normal — y que el resultado dependa de él es feo.

### Esto puede cambiar

Hoy cuadra en las tres versiones de Presto que tenemos, y en las tres al 100%:

| Versión | Archivos | Partidas con medios auxiliares |
|---|---|:-:|
| Presto 8.8 | Cami de Santa Rita · Depósito Porreres | 74 de 74 |
| Presto 20.01 | Variant Alqueria Blanca | 12 de 12 |
| Presto 21 | Nova EBAR Peguera · Bulevar Peguera | 355 de 355 |

Pero cuadrar con lo que hay no es lo mismo que estar en la norma, y aquí estamos
fuera a propósito. Si algún día aparece un archivo cuyas partidas con medios
auxiliares descuadran —otra versión de Presto, o un programa que no sea Presto y
que sí siga el formato— **lo primero que hay que probar es el criterio A**, antes
de tocar nada más. El experimento es cambiar el reparto entre cantidad y precio y
volver a contar cuántas partidas coinciden con su `~C`.
