# Protocolo de pruebas

Cada cambio en `bc3visor.html` puede arreglar un presupuesto y romper otro sin
que se note. Y cada `git push` se publica en GitHub Pages en unos 30 segundos.
Este protocolo dice cómo comprobar un cambio contra todos los presupuestos de
prueba **antes** de subirlo, y qué hacer con lo que salga.

En una frase: **se ejecuta el script, se lee el informe, y nada que empeore
respecto a la última vez se sube sin entender por qué.**

---

## 1. El juego de pruebas

### Dónde está

En `PRESUPUESTOS-PRUEBA/`. Son presupuestos reales de clientes, así que la
carpeta **no está en git** (el `.gitignore` la excluye entera) y vive solo en
Dropbox. Nunca se sube al repo, que es público.

### Cómo se nombran los archivos

`Programa+versión - nombre original`, por ejemplo `Presto21 - …` o `TCQ6 - …`.
La versión es solo la mayor, salvo Presto 8.8, que se conoce así. El programa se
lee del registro `~V` del propio archivo, no se supone.

### Qué cubre

Cada archivo está porque cubre algo que los demás no. Si dos cubren lo mismo,
sobra uno.

| Archivo (prefijo · obra) | Qué cubre |
|---|---|
| **Presto** | |
| Presto8.8 · Depósito Porreres | FIEBDC-2002, `~K` sin campo 3, alias `#` omitido en `~D`/`~M`, capítulos con precio precalculado |
| Presto8.8 · Camí de Santa Rita (Costitx) | Lo mismo, más tres casos documentados en el CLAUDE.md: capítulos afectados por `CalcIndAlz`, la medición `211.0020` y la partida `999.0016C`, que no se pinta |
| Presto8.8 · Impulsión París-Palmanova | **Robustez**: lleva datos binarios incrustados, con trozos que empiezan por `~` |
| Presto11 · Lote 0 Rafal Vell | Presto 11, la versión más frecuente en el archivo general |
| Presto11 · Anexo 66.03.01 | **Volumen de mediciones**: 50.523 |
| Presto14 · Porto Pi | FIEBDC-2012 |
| Presto18 · Paisajismo 2017 | **Banco de precios paramétrico** (3.592 registros `~P`), 12.517 conceptos |
| Presto20 · Variant Alqueria Blanca | FIEBDC-2016, `~K` con campo 3 completo, precios de partida a 4 decimales |
| Presto21 · Nova EBAR Peguera | Volumen; medición con dimensiones de 3 decimales |
| Presto21 · Bulevar Peguera | CI 5 %; partidas con mediciones dentro de su propia descomposición |
| Presto22 · Torrent Gros | FIEBDC-2020, con registros `~F`, `~G` y `~X` |
| Presto24 · Portocolom | Código raíz con alias (`0##\0`) |
| Presto24 · Portocristo | Varios precios alternativos en el `~C` |
| Presto24 · Nuevo Acceso TACC | Presto 24 |
| Presto25 · Andratx v4 | La versión de Presto más nueva |
| **Otros programas** | |
| Arquimedes · EDAR Es Mercadal | Arquímedes (CYPE), presupuesto, FIEBDC-2016 |
| Arquimedes · Metro UIB Parcbit | Arquímedes, presupuesto, FIEBDC-2004 |
| Arquimedes · Palma47 2025 | **Banco de precios** discreto: libro de precios del Colegio de Aparejadores de Mallorca |
| ARQ+CC · Palma29 | **Robustez**: 16.606 registros `~$`, que no existen en la norma |
| Istram10 · istram | Programa de otro tipo (diseño de carreteras); archivo mínimo |
| Menfis5 · Moll Vell | Codificación **cp850 (MS-DOS)** y formato **FIEBDC-3/95**, el más antiguo |
| Menfis6 · Presupuesto T3 | **Volumen de conceptos**: el más pesado, 6,6 MB |
| Menfis8 · Puerto de Castellón | Menfis reciente, FIEBDC-2007 |
| TCQ5 · PE_ND_SAN | TCQ 5.2, FIEBDC-2012 |
| TCQ5 · Llar d'infants | TCQ 5.5, edificación, CI 10 % |
| TCQ6 · Av. Tarragona | **CI 0 %** |
| TCQ6 · C. Parlament | TCQ 6.1 |
| TCQ6 · Pere Alegret (URB) | CI 6 %, muchos registros `~X` |
| TCQ6 · 48 viviendas Girona | **TCQ 6.2, la versión actual**; el TCQ más grande, CI 10 % |

**Huecos conocidos:** ningún archivo usa el formato FIEBDC-3/2024. Ni Presto 25
ni TCQ 6.2 lo exportan todavía.

### Reglas para tocar el juego

- **Añadir** un archivo solo cuando cubre algo que falta: un programa, una
  versión, un formato, una codificación o un caso raro. No por tener más.
  Antes, leer su `~V` para el prefijo y comprobar que no está repetido. Después,
  guardar su línea base: `node pruebas/comprobar.mjs --guardar <parte del nombre>`.
- **Quitar** un archivo solo apuntando por qué en esta tabla. Si lo cita el
  CLAUDE.md, actualizar también la cita.

---

## 2. Qué se mide

El script `pruebas/comprobar.mjs` carga **el código real de `bc3visor.html`**,
sin copias ni reescrituras, y lo ejecuta sobre cada presupuesto. Los veredictos
son los del propio visor: el mismo verde o rojo que vería el usuario. Lo que se
prueba es exactamente lo que se publica.

### Las dos preguntas que contesta

| Pregunta | Dónde está la respuesta |
|---|---|
| **¿Qué falla ahora?** | En el **informe**, `PRESUPUESTOS-PRUEBA/_informe.html`, que se reescribe en cada ejecución y se abre con doble clic en el navegador. Es una fila por presupuesto con un ✓ verde o una ✗ roja en cada columna (lectura, precios, capítulos, PEM, mediciones, árbol). Pasando el ratón por un icono se ven las cifras. Con un clic en la fila se despliega qué falla: el PEM y las tablas de precios de partida, capítulos y mediciones que no cuadran, con código, descripción, valor del archivo, valor calculado y diferencia, de mayor a menor, y los conceptos que no se pintan |
| **¿Qué ha cambiado desde la última vez?** | En la **comparación con la línea base**, al final de la pantalla y en el informe. La línea base es una **foto** de los resultados que se guardó la última vez que se dio un cambio por bueno. No dice qué está bien: dice qué es distinto de entonces. Así se ve si un cambio arregla o rompe algo |

### Las columnas

En pantalla, cada presupuesto sale en una línea:

| Columna | Qué es | Cuándo es mejor |
|---|---|---|
| `precios` | Partidas con descomposición cuyo precio calculado cuadra con el `~C` (cuadran / total). Cada partida cuenta una vez | Más alto |
| `capítulos` | Capítulos cuyo importe calculado cuadra con el `~C` | Más alto |
| `PEM` | Veredicto del PEM: `ok`, `mal`, o `solo` si el archivo no declara con qué compararlo | `ok` |
| `medición` | Mediciones con líneas cuyo total recalculado cuadra con el total del `~M`. El visor aún no lo enseña en pantalla (pendiente 2), pero se mide | Más alto |
| `ocultos` | Conceptos que cuelgan del árbol y el visor no pinta (pendiente 1) | Más bajo |
| `raros` | Caracteres que delatan una codificación mal elegida | 0 |
| `ms` | Lo que tarda en leer y calcular | Orientativo |

**«Cuadra» no quiere decir «está bien».** Un rojo puede ser culpa del archivo
(lo que el visor tiene que delatar) o culpa nuestra (un cálculo que no replica a
Presto). La línea base no dice qué es correcto: dice **cómo estaba**. Sirve para
saber qué ha cambiado.

---

## 3. El procedimiento

**1. Antes de tocar nada**, ejecutar:

```
node pruebas/comprobar.mjs
```

Todo tiene que salir `igual`. Si no, la línea base está desfasada respecto al
código: averiguar por qué **antes** de empezar, o no se sabrá qué ha cambiado el
cambio nuevo.

**2. Hacer el cambio** en `bc3visor.html`.

**3. Ejecutar otra vez** y leer la columna `estado`:

| Estado | Qué significa | Qué hacer |
|---|---|---|
| `igual` | Nada ha cambiado en ese presupuesto | Nada |
| `MEJORA` | Cuadra más, o se pintan más conceptos | Comprobar que es real: buscar en el informe uno o dos conceptos que ahora cuadran y contrastarlos con el archivo crudo |
| `PEOR` | Cuadra menos, o aparece un error | **No se sube.** Ver en el informe qué conceptos fallan, ir al archivo crudo con grep y entenderlo |
| `REVISAR` | Ha cambiado algo que no es ni mejor ni peor por sí solo: el PEM, el número de partidas, o que se comparen menos conceptos (bajan los que cuadran sin que suban los que no) | Explicarlo antes de aceptarlo |
| `NUEVO` | El archivo no estaba en la línea base | Revisarlo y guardar su línea base |
| `ERROR` | El visor revienta con ese archivo | Igual que `PEOR` |

Una señal de alarma propia: **si el cambio iba dirigido a un caso y se mueven
presupuestos que no tenían nada que ver, algo se ha tocado de más.**

Qué conceptos concretos fallan, y por cuánto, está en el informe,
`PRESUPUESTOS-PRUEBA/_informe.html`: se abre con doble clic en el navegador, y
un clic en la fila de un presupuesto despliega su detalle.

**4. Mirar en el navegador lo que el script no ve.** El script comprueba
números, no la pantalla. Si el cambio toca la interfaz (el árbol, el panel de
detalle, los colores, los textos), abrir al menos tres archivos: uno de Presto
(Alqueria), uno de TCQ (Girona) y el que motivó el cambio. Cómo abrirlos sin
arrastrarlos está en el README.

**5. Aceptar el cambio:**

```
node pruebas/comprobar.mjs --guardar
```

Y hacer el commit diciendo **qué ha cambiado en la línea base y por qué**. Por
ejemplo: «Bulevar: capítulos que cuadran 22/39 → 39/39, las partidas con
medición interna ya no se toman por capítulos».

**6. Subir.** Con el `git push` se publica. Comprobarlo en
`https://isidrecc.github.io/BC3Visor/` recargando con Ctrl+F5 (GitHub guarda la
página en caché 10 minutos).

---

## 4. Cuando el cambio toca el cálculo

La línea base dice si algo ha cambiado, no si ahora está bien. Para saberlo:

- **Contra el archivo crudo.** Un valor declarado se comprueba con grep, letra a
  letra. Un valor calculado se compara con lo que el propio archivo declara para
  ese concepto.
- **Contra BC3manager**, que está verificado contra informes reales de Presto
  (cómo, en el CLAUDE.md, «Verificar el cálculo tras tocarlo»).
- **Cuando no cuadra, mirar primero el redondeo** antes de culpar al archivo.

---

## 5. La herramienta

Solo necesita **Node 18 o superior**: sin npm y sin dependencias. No forma parte
del visor publicado ni lo modifica.

```
node pruebas/comprobar.mjs                      todos los presupuestos: informe y comparación
node pruebas/comprobar.mjs Costitx TCQ          solo los archivos cuyo nombre contenga esos textos
node pruebas/comprobar.mjs --guardar            además, guardar el resultado como nueva línea base
node pruebas/comprobar.mjs --visor=otra.html    probar otra versión del visor sin tocar la buena
```

- El informe (`_informe.html`) y la línea base (`_linea-base.json`) están dentro
  de `PRESUPUESTOS-PRUEBA/`, la carpeta privada, porque llevan importes de los
  presupuestos de clientes.
- Cuando algo empeora, el script acaba con código de salida 1. Eso permitirá, si
  algún día se quiere, que git impida subir un cambio que rompe algo.
- Tarda unos 7 segundos con los 29 presupuestos.
