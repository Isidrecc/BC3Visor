# BC3visor

Visor de presupuestos BC3 (FIEBDC-3) que se abre en el navegador y no toca el
archivo. Un solo HTML, sin instalación, sin servidor y sin subir nada a ningún
sitio: el `.bc3` se lee en tu máquina y se queda ahí.

## Uso

Abre `bc3visor.html` con doble clic en cualquier navegador y arrastra encima el
archivo `.bc3` (o usa «Abrir BC3»). No necesita internet.

## Qué hace hoy

Enseña el presupuesto tal como lo dejó su autor: árbol de capítulos y partidas,
descripciones, descomposiciones y mediciones, con los números **exactamente como
los declara el archivo**. Cada valor se conserva como la cadena original y solo
se le cambia la puntuación al mostrarlo (`1234.56` → `1.234,56`); el valor crudo
está siempre en el tooltip.

Lee `~V` (versión y programa emisor) · `~K` (coeficientes) · `~C` (conceptos y
precio) · `~D` (descomposición: factor y rendimiento) · `~T` (descripciones) ·
`~M` (mediciones). El resto de registros se ignora.

Del `~C` se toma el primer precio; los demás rótulos del `~V` son bancos de
referencia del autor y se ignoran a propósito (la barra superior avisa de cuántos
hay).

## Y además lo recalcula, para delatar descuadres

Junto a **Precio archivo** —lo que pone el `~C`, sin tocar— hay dos columnas
calculadas, y lo calculado sale en verde si cuadra con lo declarado y en rojo si
no:

- **Precio calculado**, solo en las partidas: el coste directo que sale de sumar
  su descomposición, que es lo que el `~C` declara ahí. Un capítulo no tiene
  precio unitario, así que la deja en blanco.
- **Medición calculada**: la suma de las líneas de medición, con sus fórmulas,
  contrastada contra la cantidad que declara el archivo.
- **Importe calculado (con CI)**: en una partida, precio con costes indirectos ×
  la cantidad declarada; en un capítulo, la suma de los importes de sus partidas,
  contrastada contra el total que el capítulo declara.
- Arriba, el **PEM calculado** contra el declarado en la raíz.

En el panel de detalle de cada partida, la cadena completa como en el informe de
Presto: suma la partida, costes indirectos, redondeo y total de partida.

El cálculo replica el de Presto con los decimales y coeficientes que declara el
propio `~K` del archivo, redondeando en la misma cadena y el mismo orden — si no,
cualquier presupuesto descuadraría por céntimos de redondeo y el aviso no
significaría nada. No hay tolerancia: o cuadra al último decimal o sale en rojo.
La única excepción es el redondeo de las líneas de medición, que cada programa
hace a su manera sin dejarlo escrito en el archivo: la medición cuadra si la
reproduce cualquiera de las reglas conocidas (Presto 8.8, Presto 21, Menfis).

Lo declarado y lo calculado nunca se mezclan, y el visor no arregla nada. Si algo
no cuadra, lo dice y ahí lo deja.

## En qué está trabajando

Que el descuadre no solo se vea, sino que se pueda seguir: localizar de un
vistazo qué partidas lo provocan dentro de un capítulo que no cuadra.

## Lo que no va a hacer

Escribir. Ni editar, ni guardar, ni exportar. El archivo entra y sale intacto —
por eso puedes abrir con él un presupuesto que no es tuyo.

## Archivos reales

El parser trata las mismas rarezas que aparecen en los BC3 que emiten los
programas de verdad: codificación cp1252/cp850 autodetectada del `~V`, alias `#`
omitido en las referencias de `~D` y `~M` (Presto), raíz sintética cuando no hay
concepto `##` (Presto 8.8), y clasificación capítulo/partida por tipo FIEBDC y,
en su defecto, por estructura.

Se prueba contra 29 presupuestos reales de Presto (de la 8.8 a la 25), TCQ,
Arquímedes, Menfis e Istram, con un banco de pruebas que compara cada cambio con
el resultado anterior: ver [`PROTOCOLO-PRUEBAS.md`](PROTOCOLO-PRUEBAS.md). Esos
presupuestos son de clientes y no están en el repositorio. En `FIEBDC/` está la especificación oficial (2016, 2020 y 2024) con
sus anexos.

## Abrir un BC3 sin arrastrarlo (para desarrollar)

Tocando el código se recarga la página cien veces en una tarde, y arrastrar el
archivo en cada recarga cansa. Se puede indicar el BC3 en la propia dirección
para que se abra solo, pero hace falta servir la carpeta desde el ordenador: en
una terminal, dentro de la carpeta del proyecto,

```bash
python3 -m http.server 8741 --bind 127.0.0.1
```

y en el navegador, `http://127.0.0.1:8741/bc3visor.html?file=PRESUPUESTOS-PRUEBA/prueba.bc3`.
La terminal se queda abierta mientras trabajas; **Ctrl+C** para parar.

Tres detalles que ahorran un rato de desconcierto:

- **Con doble clic no funciona.** Una página abierta desde el disco no puede
  leer otros archivos del disco: es una protección del navegador, y por eso hace
  falta el servidor.
- **`--bind 127.0.0.1` no es decorativo.** Sin él, la carpeta entera queda a la
  vista de cualquiera que esté en la misma red local, presupuestos incluidos.
- **Los espacios del nombre van como `%20`**, así que para probar sale a cuenta
  una copia con nombre corto y sin espacios.

## Relación con BC3Manager

[BC3Manager](https://github.com/Isidrecc/BC3manager) es el proyecto hermano: ese
sí edita, recalcula, valida y genera informes, en Python y con interfaz web
local. BC3visor es la otra mitad — abrir un archivo y mirarlo, ligero y sin
riesgo de tocar nada.

## Licencia

MIT.
