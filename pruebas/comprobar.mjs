#!/usr/bin/env node
// ============================================================================
// comprobar.mjs — banco de pruebas de BC3visor
//
// Ejecuta el código REAL de bc3visor.html (el mismo que corre en el navegador)
// sobre cada presupuesto de PRESUPUESTOS-PRUEBA/ y hace dos cosas:
//
//   1. INFORME: escribe PRESUPUESTOS-PRUEBA/_informe.html, una tabla con un
//      ✓ verde o una ✗ roja por presupuesto y columna. Clic en una fila para
//      ver qué no cuadra. Se abre con doble clic en el navegador.
//   2. COMPARACIÓN: compara el resultado con la línea base (la foto que se
//      guardó la última vez que se dio por bueno) y dice qué ha cambiado.
//
// Sin dependencias: solo Node 18 o superior.
//
//   node pruebas/comprobar.mjs                    todo
//   node pruebas/comprobar.mjs Costitx TCQ        solo los archivos cuyo nombre contenga esos textos
//   node pruebas/comprobar.mjs --guardar          guardar el resultado actual como línea base
//   node pruebas/comprobar.mjs --visor=otra.html  probar otra versión del visor sin tocar la buena
//
// El procedimiento completo está en PROTOCOLO-PRUEBAS.md.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import vm from 'node:vm';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = join(RAIZ, 'PRESUPUESTOS-PRUEBA');
const BASE = join(DATOS, '_linea-base.json');   // dentro de la carpeta ignorada por git
const INFORME = join(DATOS, '_informe.html');   // ídem: lleva importes de clientes

const args = process.argv.slice(2);
const GUARDAR = args.includes('--guardar');
const otroVisor = args.find(a => a.startsWith('--visor='));
const VISOR = otroVisor ? otroVisor.slice('--visor='.length) : join(RAIZ, 'bc3visor.html');
const filtros = args.filter(a => !a.startsWith('--')).map(a => a.toLowerCase());
const MAX_FILAS = 100;   // por tabla del detalle; el resto se cuenta pero no se lista

if (!existsSync(DATOS)) { console.error(`No existe ${DATOS}`); process.exit(2); }

// ---- El código del visor ---------------------------------------------------
const html = readFileSync(VISOR, 'utf8');
const bloque = html.match(/<script>([\s\S]*?)<\/script>/);
if (!bloque) { console.error('No encuentro el <script> de ' + VISOR); process.exit(2); }
const CODIGO = new vm.Script(bloque[1], { filename: 'bc3visor.html' });

// Lo mínimo del navegador para que el script arranque. Nada de esto interviene
// en el cálculo: solo evita que fallen las líneas que tocan la página.
function navegadorFalso() {
  const elemento = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {} },
    textContent: '', innerHTML: '', appendChild() {}, onclick: null });
  return {
    TextDecoder, URLSearchParams, console,
    location: { search: '' },
    localStorage: { getItem: () => null, setItem() {} },
    alert: m => { throw new Error('alert: ' + m); },
    fetch: () => { throw new Error('fetch no disponible en las pruebas'); },
    document: { documentElement: { dataset: {} }, getElementById: elemento, createElement: elemento },
  };
}

// ---- La medición -----------------------------------------------------------
// Corre DENTRO del visor, con sus funciones. Los veredictos son la clase CSS que
// pone celdaCalc(): exactamente el verde/rojo que ve el usuario en pantalla.
const MEDIR = new vm.Script(String.raw`(function (buf) {
  const t0 = Date.now();
  const texto = decodificar(buf);
  parsearBC3(texto);

  const registros = {};
  for (const r of separarRegistros(texto)) {
    const t = r.length > 1 ? r[1].toUpperCase() : '?';
    registros[t] = (registros[t] || 0) + 1;
  }

  // Caracteres que delatan una codificación mal elegida: controles C1,
  // dibujo de cajas de MS-DOS y el carácter de sustitución.
  const RARO = /[\u0080-\u009F─-▟�]/g;
  const tipos = { capitulo: 0, partida: 0, unitario: 0 };
  let raros = 0;
  const ejemplosRaros = [];
  for (const c of P.conceptos.values()) {
    tipos[c.tipo] = (tipos[c.tipo] || 0) + 1;
    const n = ((c.resumen + c.texto).match(RARO) || []).length;
    if (n) { raros += n; if (ejemplosRaros.length < 10) ejemplosRaros.push({ cod: c.codigo, resumen: c.resumen }); }
  }

  const veredicto = h => { const m = /calc-(ok|mal|solo)/.exec(h || ''); return m ? m[1] : 'vacio'; };
  const precio = { ok: 0, mal: 0, solo: 0, vacio: 0 };
  const importe = { ok: 0, mal: 0, solo: 0, vacio: 0 };
  const det = { precio: [], importe: [], medicion: [], ocultos: [], raros: ejemplosRaros };
  let filas = 0, ocultos = 0, partidasSinDesc = 0;
  const vistos = new Set(), vistas = new Set();

  // El mismo recorrido que renderTree()/filaNodo(), con todo desplegado.
  function recorrer(cod, padre, prof) {
    const c = get(cod);
    if (!c) return;
    if (c.tipo !== 'capitulo' && c.tipo !== 'partida') {
      ocultos++; det.ocultos.push({ cod, padre, resumen: c.resumen, tipo: c.tipo, tipoF: c.tipoF });
      return;
    }
    const clave = padre + '>' + cod;
    if (vistos.has(clave) || prof > 500) return;
    vistos.add(clave); filas++;
    if (c.tipo === 'partida') {
      // El precio no depende del capítulo: cada partida cuenta una sola vez.
      if (vistas.has(cod)) return;
      vistas.add(cod);
      if (!c.hijos.length) { partidasSinDesc++; return; }
      const v = veredicto(calcDeFila(cod, padre, c)); precio[v]++;
      if (v === 'mal') det.precio.push({ cod, resumen: c.resumen, unidad: c.unidad,
                                         archivo: toNum(c.precioRaw), calc: c.precioCalc });
      return;
    }
    const v = veredicto(importeDeFila(cod, padre, c)); importe[v]++;
    if (v === 'mal') det.importe.push({ cod, padre, resumen: c.resumen,
                                        archivo: toNum(c.precioRaw), calc: importeCalculado(cod, padre) });
    for (const h of c.hijos) recorrer(h.codigo, cod, prof + 1);
  }
  const raiz = get(P.raiz);
  if (raiz) for (const h of raiz.hijos) recorrer(h.codigo, P.raiz, 0);

  // PEM: como renderStats(), suma de los capítulos de primer nivel.
  let pem = { calculado: null, archivo: raiz ? raiz.precioRaw : '', veredicto: 'vacio' };
  if (raiz && raiz.hijos.length) {
    const dec = K.activo ? K.decImporte : 2;
    let s = 0;
    for (const h of raiz.hijos) s += importeCalculado(h.codigo, P.raiz);
    const v = redondea(s, dec);
    pem = { calculado: v.toFixed(dec), archivo: raiz.precioRaw,
            veredicto: veredicto(celdaCalc(v, raiz.precioRaw, dec, 'PEM')) };
  }

  // Mediciones: total de las líneas (totalMedicion) contra el total del ~M.
  // El visor todavía no lo enseña en pantalla (pendiente 2): se mide igual.
  // Con el mismo criterio que la pantalla (comprobarMedicion): cuadra si alguna
  // regla de redondeo conocida reproduce el total declarado de la ~M.
  const medicion = { ok: 0, mal: 0, alzada: 0 };
  for (const c of P.conceptos.values())
    for (const [padre, med] of c.mediciones) {
      if (!med.lineas.length) { medicion.alzada++; continue; }
      if (String(med.totalRaw).trim() === '') continue;
      const r = comprobarMedicion(med, med.totalRaw);
      if (r.cuadra) medicion.ok++;
      else { medicion.mal++; det.medicion.push({ cod: c.codigo, padre, resumen: c.resumen, unidad: c.unidad,
                                                  archivo: toNum(med.totalRaw), calc: r.valor, lineas: med.lineas.length }); }
    }

  return {
    programa: P.programa, formato: P.version, obra: raiz ? String(raiz.resumen).slice(0, 100) : '',
    raiz: P.raiz, raizSintetica: P.raiz === 'OBRA##', kActivo: K.activo, ci: P.ciRaw,
    conceptos: P.conceptos.size, capitulo: tipos.capitulo, partida: tipos.partida, unitario: tipos.unitario,
    registros, filas, ocultos, partidasSinDesc, raros, precio, importe, pem, medicion,
    msTotal: Date.now() - t0, detalle: det,
  };
})`);

function evaluar(archivo) {
  const buf = readFileSync(join(DATOS, archivo));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const ctx = vm.createContext(navegadorFalso());   // contexto limpio por archivo
  let r;
  try {
    CODIGO.runInContext(ctx);
    r = MEDIR.runInContext(ctx)(ab);
  } catch (e) {
    r = { error: String((e && e.message) || e).slice(0, 300) };
  }
  r.kb = Math.round(buf.length / 1024);
  return r;
}

// ---- Comparación con la línea base ------------------------------------------
// [nombre, valor, sentido]: +1 más es mejor, -1 menos es mejor, 0 hay que mirarlo.
// 'cuadran': que suban es mejor, pero que bajen NO es peor por sí solo: si no
// sube a la vez lo que no cuadra, es que se comparan menos (p. ej. una partida
// que pasa a estar dentro de otra deja de ser fila del árbol). Eso es REVISAR.
const METRICAS = [
  ['partidas cuyo precio cuadra', r => r.precio?.ok, 'cuadran'],
  ['partidas cuyo precio NO cuadra', r => r.precio?.mal, -1],
  ['capítulos cuyo importe cuadra', r => r.importe?.ok, 'cuadran'],
  ['capítulos cuyo importe NO cuadra', r => r.importe?.mal, -1],
  ['mediciones que cuadran', r => r.medicion?.ok, 'cuadran'],
  ['mediciones que NO cuadran', r => r.medicion?.mal, -1],
  ['conceptos que no se pintan', r => r.ocultos, -1],
  ['caracteres raros', r => r.raros, -1],
  ['conceptos leídos', r => r.conceptos, 0],
  ['capítulos', r => r.capitulo, 0],
  ['partidas', r => r.partida, 0],
  ['PEM calculado', r => r.pem?.calculado, 0],
];
const RANGO_PEM = { ok: 2, solo: 1, vacio: 1, mal: 0 };

function comparar(antes, ahora) {
  const c = [];
  const nota = (txt, sentido) => c.push({ txt, sentido });   // 1 mejora, -1 empeora, 0 revisar
  if (!antes.error && ahora.error) nota(`ERROR nuevo: ${ahora.error}`, -1);
  else if (antes.error && !ahora.error) nota(`ya no da error (antes: ${antes.error})`, 1);
  else if (antes.error && ahora.error && antes.error !== ahora.error) nota(`error distinto: ${ahora.error}`, 0);
  if (antes.error || ahora.error) return c;
  for (const [nombre, f, s] of METRICAS) {
    const x = f(antes), y = f(ahora);
    if (x === y) continue;
    const sentido = s === 0 ? 0
      : s === 'cuadran' ? (Number(y) > Number(x) ? 1 : 0)
      : (Number(y) - Number(x)) * s > 0 ? 1 : -1;
    nota(`${nombre}: ${x} → ${y}`, sentido);
  }
  const pa = antes.pem?.veredicto, pb = ahora.pem?.veredicto;
  if (pa !== pb) nota(`PEM: ${pa} → ${pb}`, Math.sign(RANGO_PEM[pb] - RANGO_PEM[pa]));
  if (ahora.msTotal > 500 && ahora.msTotal > 2 * antes.msTotal)
    nota(`más lento: ${antes.msTotal} → ${ahora.msTotal} ms`, 0);
  return c;
}

function estado(cambios, antes, ahora) {
  if (!antes) return ahora.error ? 'ERROR' : 'NUEVO';
  if (cambios.some(x => x.sentido < 0)) return 'PEOR';
  if (cambios.some(x => x.sentido > 0)) return 'MEJORA';
  if (cambios.length) return 'REVISAR';
  return ahora.error ? 'ERROR' : 'igual';
}

function commitActual() {
  try {
    const h = execSync('git rev-parse --short HEAD', { cwd: RAIZ }).toString().trim();
    const sucio = execSync('git status --porcelain -- bc3visor.html', { cwd: RAIZ }).toString().trim();
    return h + (sucio ? ' + cambios sin commitear en bc3visor.html' : '');
  } catch { return '?'; }
}

// ---- Ejecución ---------------------------------------------------------------
const archivos = readdirSync(DATOS)
  .filter(f => /\.bc3$/i.test(f))
  .filter(f => !filtros.length || filtros.some(t => f.toLowerCase().includes(t)))
  .sort((a, b) => a.localeCompare(b, 'es'));
if (!archivos.length) { console.error('Ningún archivo coincide con el filtro.'); process.exit(2); }

const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : null;
const resultados = {};
const fichas = [];
for (const f of archivos) {
  const ahora = evaluar(f);
  resultados[f] = ahora;
  const antes = base?.resultados?.[f];
  const cambios = antes ? comparar(antes, ahora) : [];
  fichas.push({ f, ahora, cambios, estado: estado(cambios, antes, ahora) });
}
const codigo = otroVisor ? VISOR : commitActual();
const cuenta = k => fichas.filter(x => x.estado === k).length;
const resumenEstados = `${cuenta('igual')} iguales · ${cuenta('MEJORA')} mejoran · ${cuenta('PEOR')} empeoran · ` +
                       `${cuenta('REVISAR')} a revisar · ${cuenta('NUEVO')} nuevos · ${cuenta('ERROR')} con error`;

// ---- Pantalla: resumen corto ---------------------------------------------------
const frac = o => (o ? `${o.ok}/${o.ok + o.mal}` : '-');
const col = (s, n) => String(s ?? '').padEnd(n);
console.log(`\nBC3visor · banco de pruebas · ${archivos.length} presupuestos · código: ${codigo}`);
console.log(base ? `Comparado con la línea base del ${base.fecha} (código ${base.commit})`
                 : 'Todavía no hay línea base: revisa el informe y guárdala con --guardar.');
console.log('\n' + col('estado', 9) + col('precios', 11) + col('capítulos', 11) + col('PEM', 6) +
            col('medición', 13) + col('ocultos', 9) + col('raros', 7) + col('ms', 7) + 'archivo');
for (const { f, ahora: r, estado: e } of fichas) {
  if (r.error) { console.log(col(e, 9) + `ERROR: ${r.error}`.padEnd(64) + f); continue; }
  console.log(col(e, 9) + col(frac(r.precio), 11) + col(frac(r.importe), 11) + col(r.pem.veredicto, 6) +
              col(frac(r.medicion), 13) + col(r.ocultos, 9) + col(r.raros, 7) + col(r.msTotal, 7) + f);
}
const conCambios = fichas.filter(x => x.cambios.length);
if (conCambios.length) {
  console.log('\nCambios respecto a la línea base:');
  for (const { f, cambios } of conCambios) {
    console.log(`  ${f}`);
    for (const c of cambios) console.log(`    ${c.sentido > 0 ? '+' : c.sentido < 0 ? '-' : '?'} ${c.txt}`);
  }
}
console.log(`\nResumen: ${resumenEstados}`);

// ---- Informe HTML: un ✓ o una ✗ por columna ------------------------------------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = x => (x == null || !isFinite(x)) ? '—'
  : Number(x).toLocaleString('es-ES', { maximumFractionDigits: 4, useGrouping: true });
const dif = (a, c) => (isFinite(a) && isFinite(c)) ? c - a : NaN;
const pct = (a, c) => (a ? ((c - a) / a) * 100 : NaN);
const signo = x => (isFinite(x) ? (x > 0 ? '+' : '') + num(x) : '—');
const signoPct = x => (isFinite(x) ? (x > 0 ? '+' : '') +
  Number(x).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' %' : '—');

const SI = t => `<span class="i si" title="${esc(t)}">✓</span>`;
const NO = t => `<span class="i no" title="${esc(t)}">✗</span>`;
const NA = t => `<span class="i na" title="${esc(t)}">–</span>`;
// Para precios, capítulos y mediciones: ✓ si cuadran todos, ✗ si falla alguno
const icono = (o, que) => !o || !(o.ok + o.mal) ? NA(`No hay ${que} que comparar`)
  : o.mal ? NO(`Cuadran ${o.ok} de ${o.ok + o.mal} ${que}`) : SI(`Cuadran las ${o.ok} ${que}`);

function celdas(r) {
  if (r.error) return `<td class="err" colspan="6">El visor no puede leerlo: ${esc(r.error)}</td>`;
  const p = r.pem;
  const pemIcono = p.veredicto === 'ok' ? SI(`Cuadra: ${num(Number(p.archivo))}`)
    : p.veredicto === 'mal' ? NO(`Archivo ${num(Number(p.archivo))} · calculado ${num(Number(p.calculado))} · ` +
                                 `diferencia ${signo(dif(Number(p.archivo), Number(p.calculado)))}`)
    : NA('El archivo no declara un PEM con el que comparar');
  return `<td>${r.raros ? NO(`${r.raros} caracteres raros: posible codificación equivocada`) : SI('Se lee sin errores')}</td>` +
    `<td>${icono(r.precio, 'partidas')}</td><td>${icono(r.importe, 'capítulos')}</td><td>${pemIcono}</td>` +
    `<td>${icono(r.medicion, 'mediciones')}</td>` +
    `<td>${r.ocultos ? NO(`${r.ocultos} conceptos cuelgan del árbol y no se pintan`) : SI('Se pintan todos')}</td>`;
}

function tablaDet(titulo, filas, cab, fila, ordenar = true) {
  if (!filas.length) return '';
  const orden = ordenar ? [...filas].sort((a, b) =>
    Math.abs(dif(b.archivo, b.calc) || 0) - Math.abs(dif(a.archivo, a.calc) || 0)) : filas;
  let s = `<h4>${esc(titulo)} <span class="n">${filas.length}</span></h4><table class="det"><tr>` +
          cab.map(([t, c]) => `<th class="${c || ''}">${t}</th>`).join('') + '</tr>';
  for (const x of orden.slice(0, MAX_FILAS))
    s += '<tr>' + fila(x).map((v, i) => `<td class="${cab[i][1] || ''}">${v}</td>`).join('') + '</tr>';
  if (filas.length > MAX_FILAS) s += `<tr><td colspan="${cab.length}" class="mas">…y ${filas.length - MAX_FILAS} más (se listan las ${MAX_FILAS} de mayor diferencia)</td></tr>`;
  return s + '</table>';
}
const cod = s => `<code>${esc(s)}</code>`;
const DIF = (a, c) => { const d = dif(a, c); return `<span class="${d < 0 ? 'neg' : 'pos'}">${signo(d)}</span>`; };

function detalle(r, cambios) {
  if (r.error) return `<p>El visor da error al leerlo: <code>${esc(r.error)}</code></p>`;
  let s = `<p class="ficha">${esc(r.programa || '¿programa?')} · ${esc(r.formato || '¿formato?')} · CI ${esc(r.ci || '—')} % · ` +
          `${r.conceptos} conceptos (${r.capitulo} capítulos, ${r.partida} partidas) · ${r.kb} KB · ${r.msTotal} ms` +
          (r.obra ? `<br><i>${esc(r.obra)}</i>` : '') + '</p>';
  if (cambios.length)
    s += '<h4>Cambios respecto a la línea base</h4><ul class="cambios">' + cambios.map(c =>
      `<li class="${c.sentido > 0 ? 'mejor' : c.sentido < 0 ? 'peor' : 'rev'}">${esc(c.txt)}</li>`).join('') + '</ul>';
  const p = r.pem;
  if (p.veredicto === 'mal') {
    const a = Number(p.archivo), c = Number(p.calculado);
    s += `<p><b>PEM:</b> archivo ${num(a)} · calculado ${num(c)} · diferencia ${DIF(a, c)} (${signoPct(pct(a, c))})</p>`;
  }
  const d = r.detalle;
  s += tablaDet('Precios de partida que no cuadran', d.precio,
    [['Código'], ['Descripción'], ['Ud'], ['Archivo', 'r'], ['Calculado', 'r'], ['Diferencia', 'r'], ['%', 'r']],
    x => [cod(x.cod), esc(x.resumen), esc(x.unidad), num(x.archivo), num(x.calc), DIF(x.archivo, x.calc), signoPct(pct(x.archivo, x.calc))]);
  s += tablaDet('Capítulos cuyo importe no cuadra', d.importe,
    [['Código'], ['Dentro de'], ['Descripción'], ['Archivo', 'r'], ['Calculado', 'r'], ['Diferencia', 'r'], ['%', 'r']],
    x => [cod(x.cod), cod(x.padre), esc(x.resumen), num(x.archivo), num(x.calc), DIF(x.archivo, x.calc), signoPct(pct(x.archivo, x.calc))]);
  s += tablaDet('Mediciones que no cuadran', d.medicion,
    [['Código'], ['Dentro de'], ['Descripción'], ['Ud'], ['Archivo', 'r'], ['Calculado', 'r'], ['Diferencia', 'r']],
    x => [cod(x.cod), cod(x.padre), esc(x.resumen), esc(x.unidad), num(x.archivo), num(x.calc), DIF(x.archivo, x.calc)]);
  s += tablaDet('Conceptos que no se pintan en el árbol', d.ocultos,
    [['Código'], ['Cuelga de'], ['Descripción'], ['Tipo FIEBDC']],
    x => [cod(x.cod), cod(x.padre), esc(x.resumen), esc(x.tipoF || '—')], false);
  if (d.raros.length)
    s += `<h4>Textos con caracteres raros <span class="n">${r.raros}</span></h4><ul>` +
         d.raros.map(x => `<li>${cod(x.cod)} ${esc(x.resumen)}</li>`).join('') + '</ul>';
  return s;
}

const verdes = fichas.filter(({ ahora: r }) => !r.error && !r.raros && !r.ocultos && !r.precio.mal &&
  !r.importe.mal && !r.medicion.mal && r.pem.veredicto !== 'mal').length;
const BADGE = { igual: 'igual', MEJORA: 'mejora', PEOR: 'peor', REVISAR: 'revisar', NUEVO: 'nuevo', ERROR: 'peor' };

let filasHtml = '';
fichas.forEach(({ f, ahora: r, cambios, estado: e }, i) => {
  const m = f.replace(/\.bc3$/i, '').match(/^(\S+) - (.*)$/);
  const prog = m ? m[1] : '', nombre = m ? m[2] : f.replace(/\.bc3$/i, '');
  filasHtml += `<tr class="fila" data-i="${i}">` +
    `<td class="nom" title="${esc(f)}"><span class="prog">${esc(prog)}</span>${esc(nombre)}</td>${celdas(r)}` +
    `<td><span class="b ${BADGE[e]}">${esc(e.toLowerCase())}</span></td></tr>` +
    `<tr class="detalle" id="d${i}" hidden><td colspan="8">${detalle(r, cambios)}</td></tr>`;
});

const pagina = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pruebas BC3visor</title>
<style>
:root{--bg:#fff;--fg:#1f2328;--dim:#6e7781;--linea:#e6e8eb;--hover:#f6f8fa;--det:#fafbfc;
  --si:#1a7f37;--no:#cf222e;--na:#b6bcc3;--amb:#9a6700}
@media (prefers-color-scheme:dark){:root{--bg:#0f1117;--fg:#e4e6ed;--dim:#8b90a5;--linea:#2e3346;
  --hover:#1a1d27;--det:#151821;--si:#3ecf8e;--no:#ef6b6b;--na:#4a5068;--amb:#f0b429}}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:1100px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}
.meta{color:var(--dim);font-size:13px;margin-bottom:16px}
.cifras{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 16px;font-size:13px}
.cifras b{font-size:22px;display:block}
.leyenda{color:var(--dim);font-size:12px;margin:0 0 10px}
table.res{width:100%;border-collapse:collapse;table-layout:fixed}
table.res th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--dim);font-weight:600;
  text-align:center;padding:8px 4px;border-bottom:2px solid var(--linea)}
table.res th:nth-child(1){text-align:left}
table.res td{padding:7px 4px;border-bottom:1px solid var(--linea);text-align:center;vertical-align:middle}
col.c-ico{width:84px} col.c-cambio{width:96px}
tr.fila{cursor:pointer} tr.fila:hover td{background:var(--hover)}
table.res td.nom{text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prog{display:inline-block;min-width:84px;margin-right:8px;font:12px ui-monospace,Consolas,monospace;color:var(--dim)}
td.err{color:var(--no);text-align:left}
.i{font-size:18px;font-weight:700;line-height:1;cursor:help}
.si{color:var(--si)} .no{color:var(--no)} .na{color:var(--na)}
.b{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;border:1px solid var(--linea);color:var(--dim)}
.b.mejora{color:#fff;background:var(--si);border-color:var(--si)}
.b.peor{color:#fff;background:var(--no);border-color:var(--no)}
.b.revisar{color:#fff;background:var(--amb);border-color:var(--amb)}
.b.nuevo{color:var(--fg)}
tr.detalle>td{background:var(--det);text-align:left;padding:12px 16px 20px;border-bottom:2px solid var(--linea)}
.ficha{color:var(--dim);font-size:12px;margin:0 0 8px}
h4{margin:14px 0 6px;font-size:13px} h4 .n{color:var(--dim);font-weight:400}
table.det{width:100%;border-collapse:collapse;font-size:12px;table-layout:auto}
table.det th{text-align:left;color:var(--dim);font-weight:600;border-bottom:1px solid var(--linea);padding:4px 6px}
table.det td{border-bottom:1px solid var(--linea);padding:3px 6px;vertical-align:top}
table.det .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.mas{color:var(--dim);font-style:italic}
code{font:11px ui-monospace,Consolas,monospace}
.neg{color:var(--no)} .pos{color:var(--si)}
ul.cambios{margin:4px 0;padding-left:18px} .mejor{color:var(--si)} .peor{color:var(--no)} .rev{color:var(--amb)}
@media (max-width:760px){
  col.c-ico{width:30px} col.c-cambio{width:62px}
  table.res th{writing-mode:vertical-rl;transform:rotate(180deg);height:86px;padding:4px 0;text-align:left;font-size:10px}
  table.res th:nth-child(1){writing-mode:horizontal-tb;transform:none;height:auto;vertical-align:bottom}
  .prog{display:block;min-width:0;margin:0;font-size:10px}
  .i{font-size:16px} .b{padding:1px 5px;font-size:10px}
}
</style></head><body><main>
<h1>Pruebas de BC3visor</h1>
<div class="meta">${esc(new Date().toLocaleString('es-ES'))} · código ${esc(codigo)} ·
${base ? `comparado con la línea base del ${esc(base.fecha)}` : 'sin línea base'}</div>
<div class="cifras">
  <div><b>${archivos.length}</b>presupuestos</div>
  <div><b class="si">${verdes}</b>todo en verde</div>
  <div><b class="si">${cuenta('MEJORA')}</b>mejoran</div>
  <div><b class="no">${cuenta('PEOR') + cuenta('ERROR')}</b>empeoran o fallan</div>
  <div><b style="color:var(--amb)">${cuenta('REVISAR')}</b>a revisar</div>
</div>
<p class="leyenda"><span class="si">✓</span> todo cuadra · <span class="no">✗</span> algo no cuadra ·
<span class="na">–</span> nada que comparar. Pasa el ratón por un icono para ver las cifras; haz clic en una fila para ver qué falla.
«Cambio» compara con la línea base.</p>
<table class="res">
<colgroup><col><col class="c-ico"><col class="c-ico"><col class="c-ico"><col class="c-ico"><col class="c-ico"><col class="c-ico"><col class="c-cambio"></colgroup>
<tr><th>Presupuesto</th><th>Lectura</th><th>Precios</th><th>Capítulos</th><th>PEM</th><th>Mediciones</th><th>Árbol</th><th>Cambio</th></tr>
${filasHtml}
</table>
</main>
<script>
document.querySelectorAll('tr.fila').forEach(function (tr) {
  tr.addEventListener('click', function () {
    var d = document.getElementById('d' + tr.dataset.i);
    d.hidden = !d.hidden;
  });
});
</script>
</body></html>`;
writeFileSync(INFORME, pagina);
console.log(`Informe: ${INFORME}`);

// ---- Línea base ------------------------------------------------------------------
if (GUARDAR) {
  const recorta = r => (r.detalle ? { ...r, detalle: Object.fromEntries(
    Object.entries(r.detalle).map(([k, l]) => [k, l.slice(0, MAX_FILAS)])) } : r);
  const nueva = { fecha: new Date().toISOString().slice(0, 10), commit: commitActual(),
                  resultados: { ...(filtros.length ? base?.resultados : {}) } };
  for (const [f, r] of Object.entries(resultados)) nueva.resultados[f] = recorta(r);
  writeFileSync(BASE, JSON.stringify(nueva, null, 1));
  console.log(`Línea base guardada (${Object.keys(nueva.resultados).length} presupuestos).`);
} else if (cuenta('PEOR') || fichas.some(x => x.estado === 'ERROR' && x.cambios.length)) {
  process.exitCode = 1;   // algo empeora: no subir sin mirarlo
}
