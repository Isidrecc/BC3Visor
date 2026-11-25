# Casos límite: clasificación y medición

`casos-clasificacion-v2.bc3` es un BC3 **sintético** (sin datos de clientes) con
un capítulo por cada caso difícil. Sirve para ver qué hace Presto con cada uno:
se importa, se mira, se exporta otra vez a BC3 y se compara con el original.

Todos los importes se pueden comprobar de cabeza: CI 0 %, materiales a 10 € y
2 €, oficial a 20 €/h, y casi todas las partidas valen 20,00 € (1 m de material
+ 0,5 h de oficial). Cada capítulo lleva un texto (`~T`) que explica qué mirar.

**Lección de la v1:** ningún texto puede llevar `~`, `|` ni `\`. La norma dice
que un registro empieza en cada `~`, y Presto corta ahí: la v1 tenía `~D`, `~K`…
dentro de algunas descripciones y Presto perdió el resto del registro (el precio
de `P07B`, por ejemplo). El generador de la v2 se niega a escribir esos
caracteres en un texto.

## Cómo hacer la prueba en Presto

1. **Importar** el archivo en una obra nueva (normalmente *Archivo → Importar →
   FIEBDC*).
2. **Mirar** lo que dice la columna «Qué mirar en Presto», sobre todo la
   **naturaleza** de cada concepto (columna Nat) y las cantidades (CanPres).
3. **Exportar** la obra a BC3 (*Archivo → Exportar → FIEBDC*) y guardarla aquí
   como `casos-clasificacion-v2-presto.bc3`.
4. Comparar los dos archivos.

Antes de subir el archivo exportado por Presto, comprobar que el registro `~V`
no lleva nada personal (nombre de la licencia, rutas).

## Los casos

PEM declarado: **3.355,25 €**. BC3visor (versión `2a3e112`) calcula 2.968,75 €.

| Caso | Qué contiene | Debería salir | BC3visor hoy | Presto (v1, 26-11-2026) | Qué mirar en Presto (v2) |
|---|---|---|---|---|---|
| 1 | Capítulo normal (control) | 200,00 | ✓ | ✓ 200,00 | — |
| 2 | Capítulo con `#` **y con unidad** (`ud`) | 100,00 | ✓ | ✓ capítulo, conserva `ud` | Qué escribe al exportar |
| 3 | Subcapítulo `S03` **sin `#`** | 80,00 | capítulo, 80,00 | **no es capítulo** (icono de tres puntos), 1 × 80 = 80,00 | Su naturaleza (Nat) y si le pone `#` al exportar |
| 4 | Subcapítulo `S04` **sin `#`** con **medición falsa de 1** | 60,00 | capítulo, 60,00 | **no es capítulo**, 1 × 60 = 60,00 | Su naturaleza y si exporta la medición de 1 |
| 5 | Partida `P05` **con unidad** que mide un componente dentro | 276,25 | ✓ partida | ✓ partida, 276,25 | Si exporta la medición de la placa |
| 6 | Lo mismo, `P06` **sin unidad** | 44,20 | ✗ capítulo, 2,10 | ✓ **partida**, 44,20 | — |
| 7 | `P07A`: alzada, rendimiento 0, sin descomposición ni medición. `P07B`: cantidad 3 **solo en el `~D`** | 150,00 | ✗ no las pinta, 0,00 (pendientes 1 y 10) | las dos son **partidas**; `P07B` con **cantidad 3** (precio perdido por el `~` de la v1) | Que `P07B` valga 3 × 50 = 150 |
| 8 y 9 | `P08` en dos capítulos (10 y 20); dentro, la placa medida distinta según la rama (2 y 3), rendimiento 2 | 240,00 y 480,00 | ✓ (usa el rendimiento del `~D`) | ✓ 24,00 en las dos ramas | **Dentro de `P08`**: rendimiento de la placa (2 o 3) y qué líneas conserva |
| 10 | Medición con **fórmulas** (tipo 3) | 19 → 380,00 | ✗ mide 11 (pendiente 7) | ✓ **19,00** | — |
| 11 | 0,045 × 405,12 y altura 0,0475 × 100; líneas, `~M` y `~D` dicen 18,23 y 4,75 | 459,60 | ✗ 20,26 y 5,00 (pendiente 2) | 18,23 y 4,75 — **no decide nada**: los tres números coinciden | Ver casos 13 a 15 |
| 12 | El `~C` dice `C12#`, el `~D` y la `~M` dicen `C12` | 40,00 | ✗ 0,00 (pendiente 9) | ✓ **los une**, 40,00 | Qué escribe al exportar |
| 13 | Línea 0,045 × 405,12 (18,23 sin redondear); `~M` y `~D` declaran **20,26** | — | 20,26 | — | **18,23** = recalcula sin redondear; **20,26** = respeta lo declarado |
| 14 | Una línea de 10; `~M` y `~D` declaran **12** | — | 10 (declarado 12, en rojo) | — | **10** = recalcula desde las líneas; **12** = respeta lo declarado |
| 15 | Líneas y `~M` dan **10**; el `~D` dice **7** | — | 10 | — | ¿Cuál usa: la medición (10) o la descomposición (7)? |

## Lo que ya sabemos por la v1

- **Capítulo es lo que lleva `#`, y solo eso.** Con unidad o sin ella (caso 2).
  Sin `#` no hay capítulo aunque agrupe partidas o tenga medición (casos 3 y 4).
  En los 29 presupuestos reales, los 4.203 capítulos del árbol llevan `#`.
- **Sin `#`, lo que tiene descomposición es partida, tenga unidad o no** (caso 6).
- **Lo que cuelga de un capítulo es partida** aunque no tenga descomposición ni
  medición (caso 7, pendiente 1), y **su cantidad sale del `~D`** (pendiente 10).
- **Las fórmulas** se evalúan como dice la norma (caso 10, pendiente 7).
- **La `#` omitida** en el `~D` y en la `~M` se une con el `~C` (caso 12,
  pendiente 9).

## Resultados de Presto con la v2 (26-11-2026)

Las cantidades en **magenta** son las que Presto calcula desde las líneas de
medición; las de color **negro** las toma del `~D`. En la v1 casi todas salían en
negro: los `~` de los textos estropearon la lectura de las mediciones, así que
**las conclusiones de la v1 sobre los casos 10 y 11 no valen**.

| Caso | Presto (v2) | Conclusión |
|---|---|---|
| 3 y 4 | `S03` y `S04` con el mismo icono que las partidas | Sin `#` no hay capítulo |
| 7 | `P07A` 0; `P07B` 3 (en negro) × 50 = 150 | Sin líneas, la cantidad sale del `~D` (pendiente 10) |
| 10 | **17**: 9 + 1×4 + 4 | Presto **no** arrastra la fórmula a la línea siguiente, aunque la norma diga que sí. TCQ sí la arrastra |
| 11 | `P11A` **18,23**; `P11B` **5,00** | Redondea las **dimensiones** a DD, **no las unidades** |
| 13 | **18,23** (declarado 20,26) | Recalcula desde las líneas e ignora el total declarado |
| 14 | **10** (declarado 12) | Ídem |
| 15 | **10** (el `~D` dice 7) | Si hay líneas, mandan sobre el `~D` |

Total de Presto: 3.239,65 €.

Contraste con los presupuestos reales: «redondear solo las dimensiones» cuadra
6 de las 8 mediciones de Presto que distinguen entre reglas (las 4 de Alqueria,
Costitx y Portocolom). Falla solo `GMTGRF02`, la misma línea en Nova EBAR y en
Andratx. Con las fórmulas evaluadas, Rafal Vell (Presto 11) cuadra sus 18
mediciones con fórmula.
