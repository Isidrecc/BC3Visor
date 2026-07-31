# BC3visor

Visor de solo lectura de presupuestos BC3 (FIEBDC-3): abre un `.bc3` y enseña el
presupuesto **tal como lo veía su autor al guardarlo**.

## Uso

Abre `bc3visor.html` con doble clic en cualquier navegador y arrastra encima el
archivo `.bc3` (o usa «Abrir BC3»). No necesita servidor, ni internet, ni
instalación. El archivo nunca se modifica.

Para desarrollo, sirviendo la carpeta por http admite `?file=archivo.bc3`.

## La regla de oro

> **Enseña los números que el archivo declara. No los recalcula.**

Todo valor numérico se conserva como **cadena tal cual viene en el archivo**; la
única transformación es de puntuación (`1234.56` → `1.234,56`). El valor crudo
está siempre en el tooltip de cada número. Consecuencias deliberadas:

- **No hay columna Importe** (sería precio × cantidad).
- El total de cada medición es el **declarado en el `~M`**, no la suma de sus líneas.
- El precio de cada concepto es el **primero del `~C`** (los demás rótulos del
  `~V` son bancos de referencia y se ignoran; la barra superior avisa de cuántos).
- Los coeficientes del `~K` (CI, GG, BI, baja, IVA) **se enseñan, no se aplican**.

## Qué lee

`~V` (versión, programa, rótulos) · `~K` (coeficientes) · `~C` (conceptos, primer
precio) · `~D` (descomposición: factor y rendimiento) · `~T` (descripciones) ·
`~M` (total declarado y líneas). El resto de registros se ignora.

Rarezas de archivos reales que trata igual que BC3Manager: codificación
cp1252/cp850 autodetectada del `~V`, alias `#` omitido en `~D`/`~M` (Presto),
raíz sintética cuando no hay concepto `##` (Presto 8.8), clasificación
capítulo/partida por tipo FIEBDC y heurísticas de estructura.

## Relación con BC3Manager

Proyecto hermano (`../BC3manager`) que sí calcula, edita y guarda. BC3visor
existe precisamente para ver lo que dice el archivo sin que ningún cálculo se
interponga, p. ej. al depurar diferencias de totales. Comparte su estructura
visual (árbol + panel de detalle) pero ni una línea de su aritmética.
