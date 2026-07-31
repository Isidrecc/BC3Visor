# CLAUDE.md

## Qué es

BC3visor: visor de **solo lectura** de presupuestos BC3 (FIEBDC-3). Un único
archivo, `bc3visor.html` (HTML + CSS + JS vanilla, sin dependencias, sin CDN,
sin servidor). Se abre con doble clic; el `.bc3` se carga con FileReader.

## La regla de oro (invariante nº 1)

**Enseñar los números que el archivo declara. Nunca recalcularlos.**
Cero aritmética sobre datos del presupuesto: ni sumas, ni multiplicaciones, ni
redondeos. Los valores numéricos viven como cadenas crudas del archivo (campos
`*Raw`); `fmtNum()` solo cambia la puntuación a formato español. Si una feature
nueva necesita calcular algo, es que sobra — preguntar al usuario antes.

Consecuencias que son a propósito (no bugs): no hay columna Importe; el total de
medición es el declarado en el `~M` (no la suma de líneas); solo se muestra el
primer precio del `~C`; los coeficientes del `~K` se enseñan pero no se aplican.

## Qué NO hacer

- No editar, no guardar, no exportar, no informes, no undo. El programa jamás escribe.
- No añadir dependencias, npm ni frameworks. Un solo archivo HTML.
- `../BC3manager` es **SOLO LECTURA**: sirve para aprender el formato y copiar
  su estética, nunca para importar código ni modificarlo.

## Formato y rarezas

La referencia del formato está en `../BC3manager/docs/formato-bc3.md` y la spec
oficial en `../BC3manager/FIEBDC/`. El parser replica las mismas rarezas que
BC3Manager: codificación cp1252/cp850 detectada del `~V` (cp850 con tabla
manual, el navegador no la trae), alias `#` omitido en `~D`/`~M` de Presto,
raíz sintética `OBRA##` si no hay `##` (Presto 8.8), clasificación
capítulo/partida (tipo FIEBDC declarado primero, heurísticas después).

## Probar

Servir por http admite `?file=x.bc3`:
`python3 -m http.server 8741` en una carpeta con `bc3visor.html` + BC3 de prueba
(copiar los de `../BC3manager/tests/`, p. ej. `Test_Alqueria.bc3` Presto 20 con
`~K` completo, `Test_SONFONT.bc3` Presto 8.8 sin raíz). Verificar contra el
archivo crudo con grep: lo que se ve debe ser el valor declarado, letra a letra.
