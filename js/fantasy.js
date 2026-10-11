'use strict';

/* =========================================================
   FANTASY LALIGA (datos oficiales de LaLiga Fantasy)
   Guardados en datos/fantasy.js por actualizar-datos.ps1
   ========================================================= */
const POS_FANTASY = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL', 5: 'ENT' };
const NOMBRE_POS_FANTASY = { 1: 'Portero', 2: 'Defensa', 3: 'Centrocampista', 4: 'Delantero', 5: 'Entrenador' };
const ESTADOS_FANTASY = { injured: 'Lesionado', doubtful: 'Duda', suspended: 'Sancionado' };

const datosFantasyDisponibles = () => !!window.DATOS_FANTASY?.jugadores?.length;
const equipoFantasy = (id) => window.DATOS_FANTASY?.equipos?.[id] || {};
const nombreEquipoFantasy = (id) => equipoFantasy(id).nombre || '';

function htmlEstadoFantasy(estado) {
  const t = ESTADOS_FANTASY[estado];
  return t ? `<span class="estado-jugador estado-${esc(estado)}">${esc(t)}</span>` : '';
}

function fotoFantasy(j, clase = 'foto-jugador') {
  const src = urlSegura(j.foto);
  return src ? `<img class="${clase}" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${clase}"></span>`;
}

// Cambio de valor en los últimos N días, a partir del historial diario (en miles de euros)
function cambioFantasy(j, dias) {
  const h = (j.h || []).filter((x) => x != null);
  if (h.length < 2) return 0;
  const antes = h[Math.max(0, h.length - 1 - dias)];
  return (h[h.length - 1] - antes) * 1000;
}

// Tendencia: cuántos de los últimos 3 cambios diarios han sido subidas o bajadas
function tendenciaFantasy(j) {
  const h = (j.h || []).filter((x) => x != null).slice(-4);
  if (h.length < 4) return { texto: 'Sin datos', clase: 'igual' };
  const cambios = h.slice(1).map((v, i) => v - h[i]);
  const suben = cambios.filter((c) => c > 0).length;
  const bajan = cambios.filter((c) => c < 0).length;
  if (suben === 3) return { texto: '📈 Subiendo fuerte', clase: 'sube' };
  if (suben >= 2) return { texto: '↗ Al alza', clase: 'sube' };
  if (bajan === 3) return { texto: '📉 Bajando fuerte', clase: 'baja' };
  if (bajan >= 2) return { texto: '↘ A la baja', clase: 'baja' };
  return { texto: '→ Estable', clase: 'igual' };
}

const puntosPorMillon = (j) => (j.precio ? j.puntos / (j.precio / 1e6) : 0);

// Puntos de las últimas N jornadas (null si no jugó)
function ultimasJornadas(j, n = 5) {
  const actual = window.DATOS_FANTASY?.jornada || Math.max(0, ...(j.jornadas || []).map((x) => x[0]));
  const mapa = new Map((j.jornadas || []).map(([s, p]) => [s, p]));
  const res = [];
  for (let s = Math.max(1, actual - n + 1); s <= actual; s++) res.push([s, mapa.has(s) ? mapa.get(s) : null]);
  return res;
}
const sumaForma = (j) => ultimasJornadas(j, 3).reduce((s, [, p]) => s + (p || 0), 0);

const textoBusquedaFantasy = (j) => normalizar(`${j.nombre} ${j.completo || ''}`);

/* ----- Relación con las otras fuentes ----- */
function jugadoresFantasyDeEquipo(nombreEquipo) {
  if (!datosFantasyDisponibles()) return [];
  const clave = claveEquipo(nombreEquipo);
  const id = Object.keys(window.DATOS_FANTASY.equipos).find((k) => claveEquipo(window.DATOS_FANTASY.equipos[k].nombre) === clave);
  return id ? window.DATOS_FANTASY.jugadores.filter((j) => j.equipo === id) : [];
}

const buscarJugadorFantasy = (lista, nombre) => buscarPorNombre(lista, nombre, (j) => [j.completo, j.nombre]);

// Probabilidad de ser titular en el próximo partido según Futbol Fantasy (o null)
function probabilidadTitularFF(j) {
  const equipo = alineacionFF(nombreEquipoFantasy(j.equipo));
  if (!equipo) return null;
  const encontrado = buscarPorNombre(equipo.jugadores, j.completo || j.nombre, (x) => [x[0]]);
  return encontrado ? { prob: encontrado[1] / 100, partido: equipo.partido, url: equipo.url } : null;
}

/* ----- Piezas de HTML ----- */
function filaJugadorFantasy(j, dias = 1, extra = '') {
  return `<a href="#/fantasy/jugador/${enc(j.id)}">
    ${fotoFantasy(j)}
    <span class="nombre"><b>${esc(j.nombre)}</b> ${htmlEstadoFantasy(j.estado)}<br>
      <small>${esc(equipoFantasy(j.equipo).corto || nombreEquipoFantasy(j.equipo))} · ${esc(POS_FANTASY[j.pos] || '')}${extra ? ' · ' + extra : ''}</small></span>
    <span style="text-align:right"><span class="precio">${esc(fmtMillones(j.precio))}</span><br>${htmlCambio(cambioFantasy(j, dias), dias > 1)}</span>
  </a>`;
}

function htmlFormaFantasy(j) {
  return `<span class="forma">${ultimasJornadas(j).map(([s, p]) => (p == null
    ? `<b title="Jornada ${s}: no jugó">–</b>`
    : `<b class="${p >= 6 ? 'G' : p < 2 ? 'P' : ''}" title="Jornada ${s}: ${p} puntos">${p}</b>`)).join('')}</span>`;
}

function avisoActualizacion() {
  const d = window.DATOS_FANTASY;
  const horas = (Date.now() - new Date(d.actualizado)) / 36e5;
  const viejo = horas > 30;
  return `<p class="nota">${viejo ? '⚠️ ' : ''}Valores oficiales de <b>LaLiga Fantasy</b>${d.jornada ? ` · jornada ${esc(d.jornada)}` : ''} · actualizados ${esc(haceTiempo(d.actualizado).toLowerCase())}
    ${viejo ? '· Ejecuta <b>Actualizar datos.bat</b> para tener los valores de hoy.' : ''}</p>`;
}

/* =========================================================
   VISTA: FANTASY
   ========================================================= */
const PESTANAS_FANTASY = [
  ['mercado', 'Subidas y bajadas'],
  ['jugadores', 'Buscar jugadores'],
  ['once', 'Once ideal y chollos'],
  ['lesionados', 'Parte médico'],
];

async function vistaFantasy(pestana, params) {
  const cabecera = `<header class="cab-pagina"><div><p class="cab-sub">LaLiga</p><h1>💰 Fantasy</h1></div></header>`;
  if (!datosFantasyDisponibles()) {
    return {
      html: `${cabecera}${vacio('Todavía no hay datos Fantasy. En la carpeta de la web, haz doble clic en "Actualizar datos.bat" y recarga la página.', '💰')}`,
    };
  }
  const contenido = {
    mercado: fantasyMercado,
    jugadores: fantasyJugadores,
    once: fantasyOnce,
    lesionados: fantasyLesionados,
  }[pestana];
  if (!contenido) return vistaNoEncontrada();
  const r = contenido(params);
  return {
    html: cabecera + pestanas(PESTANAS_FANTASY, pestana, '#/fantasy/') + avisoActualizacion() + r.html,
    alMontar: r.alMontar,
  };
}

const jugadoresDeCampo = () => window.DATOS_FANTASY.jugadores.filter((j) => j.pos !== 5);

function fantasyMercado(params) {
  const dias = [1, 3, 7, 30].includes(+params.get('periodo')) ? +params.get('periodo') : 1;
  const jugadores = window.DATOS_FANTASY.jugadores.map((j) => ({ j, c: cambioFantasy(j, dias) }));
  const suben = jugadores.filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 20);
  const bajan = jugadores.filter((x) => x.c < 0).sort((a, b) => a.c - b.c).slice(0, 20);
  const periodos = [[1, 'Hoy'], [3, '3 días'], [7, '7 días'], [30, '30 días']];

  const lista = (titulo, items) => `<section class="tarjeta">
    <div class="bloque-cab"><span>${titulo}</span></div>
    <div class="lista-jugadores">${items.map(({ j }) => filaJugadorFantasy(j, dias)).join('') || '<p class="vacio">Sin cambios en este periodo (falta historial).</p>'}</div>
  </section>`;

  return {
    html: `<div class="chips">${periodos.map(([d, t]) =>
        `<a class="chip ${d === dias ? 'activo' : ''}" href="#/fantasy/mercado?periodo=${d}">${t}</a>`).join('')}</div>
      <div class="dos-columnas">${lista('📈 Los que más suben', suben)}${lista('📉 Los que más bajan', bajan)}</div>`,
  };
}

function fantasyJugadores(params) {
  const equipos = Object.entries(window.DATOS_FANTASY.equipos).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'));
  const html = `<div class="filtros">
      <input class="campo" id="f-texto" type="search" placeholder="Buscar jugador..." value="${esc(params.get('q') || '')}" autocomplete="off">
      <select class="campo" id="f-pos"><option value="">Todas las posiciones</option>
        ${Object.entries(NOMBRE_POS_FANTASY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <select class="campo" id="f-equipo"><option value="">Todos los equipos</option>
        ${equipos.map(([id, e]) => `<option value="${esc(id)}">${esc(e.nombre)}</option>`).join('')}</select>
      <select class="campo" id="f-orden">
        <option value="precio">Más caros</option>
        <option value="puntos">Más puntos</option>
        <option value="media">Mejor media</option>
        <option value="rentable">Más puntos por millón</option>
        <option value="sube">Más suben hoy</option>
        <option value="sube7">Más suben (7 días)</option>
        <option value="baja">Más bajan hoy</option>
        <option value="titular">Más probable que jueguen</option>
        <option value="barato">Más baratos</option>
      </select>
    </div>
    <p class="nota" id="f-cuenta"></p>
    <section class="tarjeta"><div class="lista-jugadores" id="f-lista"></div></section>`;

  function pintarLista() {
    const texto = normalizar(document.getElementById('f-texto').value);
    const pos = document.getElementById('f-pos').value;
    const equipo = document.getElementById('f-equipo').value;
    const orden = document.getElementById('f-orden').value;
    const probTitular = new Map();
    const prob = (j) => {
      if (!probTitular.has(j.id)) probTitular.set(j.id, probabilidadTitularFF(j)?.prob ?? -1);
      return probTitular.get(j.id);
    };
    const ordenes = {
      precio: (a, b) => b.precio - a.precio,
      puntos: (a, b) => b.puntos - a.puntos,
      media: (a, b) => b.media - a.media,
      rentable: (a, b) => puntosPorMillon(b) - puntosPorMillon(a),
      sube: (a, b) => cambioFantasy(b, 1) - cambioFantasy(a, 1),
      sube7: (a, b) => cambioFantasy(b, 7) - cambioFantasy(a, 7),
      baja: (a, b) => cambioFantasy(a, 1) - cambioFantasy(b, 1),
      titular: (a, b) => prob(b) - prob(a) || b.puntos - a.puntos,
      barato: (a, b) => a.precio - b.precio,
    };
    const filtrados = window.DATOS_FANTASY.jugadores
      .filter((j) => (!texto || textoBusquedaFantasy(j).includes(texto) || normalizar(nombreEquipoFantasy(j.equipo)).includes(texto))
        && (!pos || String(j.pos) === pos)
        && (!equipo || j.equipo === equipo))
      .sort(ordenes[orden]);
    document.getElementById('f-cuenta').textContent =
      `${filtrados.length} ${filtrados.length === 1 ? 'jugador' : 'jugadores'}${filtrados.length > 100 ? ' (se muestran los 100 primeros)' : ''}`;
    document.getElementById('f-lista').innerHTML = filtrados.slice(0, 100).map((j) => {
      const p = orden === 'titular' ? prob(j) : null;
      const extra = p != null && p >= 0 ? `<span class="pct ${claseProbabilidad(p)}">${pct(p)} titular</span>` : `${j.puntos} pts`;
      return filaJugadorFantasy(j, orden === 'sube7' ? 7 : 1, extra);
    }).join('') || '<p class="vacio">No hay jugadores con esos filtros.</p>';
  }

  return {
    html,
    alMontar() {
      ['f-texto', 'f-pos', 'f-equipo', 'f-orden'].forEach((id) =>
        document.getElementById(id).addEventListener('input', pintarLista));
      pintarLista();
    },
  };
}

function fantasyOnce() {
  const todos = jugadoresDeCampo();
  const mejores = (pos, n) => todos.filter((j) => j.pos === pos).sort((a, b) => b.puntos - a.puntos).slice(0, n);
  const once = [...mejores(4, 3), ...mejores(3, 3), ...mejores(2, 4), ...mejores(1, 1)];
  const valorOnce = once.reduce((s, j) => s + j.precio, 0);

  const campo = `<div class="campo-futbol">${[4, 3, 2, 1].map((pos) => `<div class="linea-campo">${once.filter((j) => j.pos === pos).map((j) =>
    `<a class="ficha prob-alta" href="#/fantasy/jugador/${enc(j.id)}" title="${esc(j.nombre)}">
      <span class="circulo">${esc(j.puntos)}</span>
      <span class="nombre-ficha">${esc(j.nombre)}</span>
    </a>`).join('')}</div>`).join('')}</div>`;

  const jugadas = (j) => (j.jornadas || []).filter(([, p]) => p != null).length;
  const chollos = todos.filter((j) => jugadas(j) >= 3 && j.precio > 0 && j.estado === 'ok')
    .sort((a, b) => puntosPorMillon(b) - puntosPorMillon(a)).slice(0, 12);
  const enForma = todos.filter((j) => j.estado === 'ok').sort((a, b) => sumaForma(b) - sumaForma(a)).slice(0, 12);
  const titularesBaratos = todos.filter((j) => j.estado === 'ok' && j.precio < 10e6)
    .map((j) => ({ j, p: probabilidadTitularFF(j)?.prob ?? 0 }))
    .filter((x) => x.p >= 0.7)
    .sort((a, b) => b.p - a.p || a.j.precio - b.j.precio).slice(0, 12);

  return {
    html: `<div class="dos-columnas">
      <section class="tarjeta">
        <div class="bloque-cab"><span>⭐ Once ideal por puntos (4-3-3)</span><small>${esc(fmtMillones(valorOnce))}</small></div>
        ${campo}
        <p class="nota relleno" style="margin:0">Los números son los puntos totales de la temporada.</p>
      </section>
      <div>
        <section class="tarjeta">
          <div class="bloque-cab"><span>💎 Chollos</span><small>puntos por millón</small></div>
          <div class="lista-jugadores">${chollos.map((j) => filaJugadorFantasy(j, 1, `${puntosPorMillon(j).toLocaleString('es-ES', { maximumFractionDigits: 1 })} pts/M€`)).join('')}</div>
        </section>
        <section class="tarjeta">
          <div class="bloque-cab"><span>🔥 En forma</span><small>puntos en las 3 últimas jornadas</small></div>
          <div class="lista-jugadores">${enForma.map((j) => filaJugadorFantasy(j, 1, `${sumaForma(j)} pts`)).join('')}</div>
        </section>
        ${titularesBaratos.length ? `<section class="tarjeta">
          <div class="bloque-cab"><span>🎯 Titulares por menos de 10 M€</span><small>según Futbol Fantasy</small></div>
          <div class="lista-jugadores">${titularesBaratos.map(({ j, p }) => filaJugadorFantasy(j, 1, `<span class="pct ${claseProbabilidad(p)}">${pct(p)} titular</span>`)).join('')}</div>
        </section>` : ''}
      </div>
    </div>`,
  };
}

function fantasyLesionados() {
  const afectados = window.DATOS_FANTASY.jugadores.filter((j) => ESTADOS_FANTASY[j.estado]);
  const porEquipo = new Map();
  for (const j of afectados) {
    if (!porEquipo.has(j.equipo)) porEquipo.set(j.equipo, []);
    porEquipo.get(j.equipo).push(j);
  }
  const equipos = [...porEquipo].sort((a, b) => nombreEquipoFantasy(a[0]).localeCompare(nombreEquipoFantasy(b[0]), 'es'));
  const resumen = Object.entries(ESTADOS_FANTASY).map(([k]) =>
    `<span>${htmlEstadoFantasy(k)} ${afectados.filter((j) => j.estado === k).length}</span>`).join('');
  return {
    html: `<div class="leyenda" style="padding:0 0 12px">${resumen}</div>
      <div class="dos-columnas">${equipos.map(([id, lista]) => `<section class="tarjeta">
        <div class="bloque-cab"><span class="celda-equipo">${escudo(equipoFantasy(id).escudo)}${esc(nombreEquipoFantasy(id))}</span><small>${lista.length}</small></div>
        <div class="lista-jugadores">${lista.map((j) => filaJugadorFantasy(j)).join('')}</div>
      </section>`).join('')}</div>`,
  };
}

/* =========================================================
   VISTA: JUGADOR FANTASY (ficha de apoyo para decidir)
   ========================================================= */
async function vistaFantasyJugador(id) {
  if (!datosFantasyDisponibles()) return vistaFantasy('mercado', new URLSearchParams());
  const j = window.DATOS_FANTASY.jugadores.find((x) => x.id === String(id));
  if (!j) return vistaNoEncontrada();

  const fechas = window.DATOS_FANTASY.fechas || [];
  const puntos = (j.h || []).map((v, i) => (v == null ? null : { fecha: fechas[i], valor: v * 1000 })).filter(Boolean);
  const grafico = crearGraficoPrecio(puntos);
  const tendencia = tendenciaFantasy(j);
  const titular = probabilidadTitularFF(j);

  const datos = [
    ['Valor de mercado', esc(fmtMillones(j.precio))],
    ['Cambio hoy', htmlCambio(cambioFantasy(j, 1))],
    ['Cambio 7 días', htmlCambio(cambioFantasy(j, 7), true)],
    ['Cambio 30 días', htmlCambio(cambioFantasy(j, 30), true)],
    ['Tendencia', `<span class="cambio ${tendencia.clase}">${esc(tendencia.texto)}</span>`],
    ['Puntos', esc(j.puntos)],
    ['Media por partido', esc(Number(j.media || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 }))],
    ['Puntos por millón', esc(puntosPorMillon(j).toLocaleString('es-ES', { maximumFractionDigits: 1 }))],
    ['Temporada pasada', j.anterior ? `${esc(j.anterior)} pts` : '—'],
  ];

  return {
    html: `<a class="boton" href="#/fantasy/jugadores" style="margin-bottom:14px">‹ Fantasy</a>
      <header class="cab-pagina">
        ${fotoFantasy(j, 'foto-grande')}
        <div>
          <p class="cab-sub">${esc(NOMBRE_POS_FANTASY[j.pos] || '')}${j.completo ? ` · ${esc(j.completo)}` : ''}</p>
          <h1>${esc(j.nombre)}</h1>
          <p class="celda-equipo" style="margin:6px 0 0">${escudo(equipoFantasy(j.equipo).escudo)}${esc(nombreEquipoFantasy(j.equipo))} ${htmlEstadoFantasy(j.estado)}</p>
        </div>
      </header>
      ${titular ? `<section class="tarjeta relleno">
          <b>Próximo partido${titular.partido ? ` (${esc(titular.partido)})` : ''}:</b>
          <span class="pct ${claseProbabilidad(titular.prob)}">${pct(titular.prob)}</span> de probabilidad de ser titular
          <br><small class="texto-suave">Según <a href="${urlSegura(titular.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--acento)">Futbol Fantasy</a></small>
        </section>` : ''}
      <section class="tarjeta">
        <div class="datos-clave">${datos.map(([t, v]) => `<div class="dato"><small>${esc(t)}</small><b>${v}</b></div>`).join('')}</div>
      </section>
      <section class="tarjeta">
        <div class="bloque-cab"><span>Últimas 5 jornadas</span>${htmlFormaFantasy(j)}</div>
      </section>
      <section class="tarjeta">
        <div class="bloque-cab"><span>Evolución del valor</span><small>últimos ${puntos.length} días</small></div>
        ${grafico.html}
      </section>
      <p class="fila-botones"><a class="boton" href="#/buscar?q=${enc(j.completo || j.nombre)}">🔍 Buscar estadísticas en ESPN</a></p>`,
    alMontar: grafico.alMontar,
  };
}

/* ----- Gráfico de línea del valor (SVG) con guía y tooltip al pasar el dedo/ratón ----- */
function crearGraficoPrecio(puntos) {
  if (puntos.length < 2) return { html: '<p class="vacio">Todavía no hay historial suficiente.</p>' };
  const H = 220;
  const m = { izq: 58, der: 12, arr: 14, aba: 26 };
  const valores = puntos.map((p) => p.valor);
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) { min *= 0.95; max *= 1.05; }
  const margen = (max - min) * 0.08;
  min -= margen;
  max += margen;
  const y = (v) => m.arr + (1 - (v - min) / (max - min)) * (H - m.arr - m.aba);
  const marcas = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
  const fmtFecha = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const resumen = `Evolución del valor de mercado: de ${fmtMillones(valores[0])} el ${fmtFecha(puntos[0].fecha)} a ${fmtMillones(valores[valores.length - 1])} el ${fmtFecha(puntos[puntos.length - 1].fecha)}`;

  // Tabla con los datos, para quien no pueda ver el gráfico
  const tabla = `<details class="relleno" style="border-top:1px solid var(--borde)">
    <summary style="cursor:pointer;font-weight:600">Ver tabla de valores</summary>
    <div class="tabla-scroll" style="max-height:260px;margin-top:8px"><table>
      <thead><tr><th class="izq">Fecha</th><th class="der">Valor</th><th class="der">Cambio</th></tr></thead>
      <tbody>${puntos.map((p, i) => [p, i]).reverse().map(([p, i]) => `<tr><td class="izq">${esc(fmtFecha(p.fecha))}</td>
        <td class="der">${esc(fmtMillones(p.valor))}</td><td class="der">${i ? htmlCambio(p.valor - puntos[i - 1].valor) : ''}</td></tr>`).join('')}</tbody>
    </table></div>
  </details>`;

  // El SVG se dibuja al ancho real de la pantalla para que los textos se lean bien
  function dibujar(contenedor) {
    const W = Math.max(280, contenedor.clientWidth - 16);
    const x = (i) => m.izq + (i / (puntos.length - 1)) * (W - m.izq - m.der);
    const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
    const area = `${linea} L${x(puntos.length - 1).toFixed(1)},${H - m.aba} L${m.izq},${H - m.aba} Z`;
    const indicesX = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1];

    contenedor.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(resumen)}">
        ${marcas.map((v) => `<line class="rejilla-eje" x1="${m.izq}" x2="${W - m.der}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
          <text class="texto-eje" x="${m.izq - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmtMillones(v))}</text>`).join('')}
        ${indicesX.map((i, k) => `<text class="texto-eje" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${['start', 'middle', 'end'][k]}">${esc(fmtFecha(puntos[i].fecha))}</text>`).join('')}
        <path class="area" d="${area}"/>
        <path class="linea" d="${linea}"/>
        <line class="guia oculto" y1="${m.arr}" y2="${H - m.aba}"/>
        <circle class="marcador-punto oculto" r="5"/>
        <rect class="zona" x="${m.izq - 10}" y="0" width="${W - m.izq - m.der + 20}" height="${H}" fill="transparent"/>
      </svg>
      <div class="grafico-tooltip oculto"></div>`;

    const svg = contenedor.querySelector('svg');
    const guia = contenedor.querySelector('.guia');
    const punto = contenedor.querySelector('.marcador-punto');
    const tip = contenedor.querySelector('.grafico-tooltip');
    const mostrar = (ev) => {
      const caja = svg.getBoundingClientRect();
      const px = ev.clientX - caja.left;
      const i = Math.max(0, Math.min(puntos.length - 1, Math.round(((px - m.izq) / (W - m.izq - m.der)) * (puntos.length - 1))));
      const cx = x(i);
      const cy = y(puntos[i].valor);
      guia.setAttribute('x1', cx); guia.setAttribute('x2', cx);
      punto.setAttribute('cx', cx); punto.setAttribute('cy', cy);
      const anterior = i > 0 ? puntos[i].valor - puntos[i - 1].valor : 0;
      tip.innerHTML = `${esc(fmtFecha(puntos[i].fecha))} · <b>${esc(fmtMillones(puntos[i].valor))}</b>${anterior ? ` (${anterior > 0 ? '+' : '−'}${esc(fmtEuros(Math.abs(anterior)))})` : ''}`;
      tip.style.left = `${Math.max(90, Math.min(W - 90, cx + 8))}px`;
      [guia, punto, tip].forEach((e) => e.classList.remove('oculto'));
    };
    const ocultar = () => [guia, punto, tip].forEach((e) => e.classList.add('oculto'));
    const zona = contenedor.querySelector('.zona');
    zona.addEventListener('pointermove', mostrar);
    zona.addEventListener('pointerdown', mostrar);
    zona.addEventListener('pointerleave', ocultar);
  }

  function alMontar() {
    const contenedor = document.getElementById('grafico-precio');
    if (!contenedor) return;
    dibujar(contenedor);
    let espera = null;
    const alCambiarTamano = () => {
      if (!contenedor.isConnected) { window.removeEventListener('resize', alCambiarTamano); return; }
      clearTimeout(espera);
      espera = setTimeout(() => dibujar(contenedor), 150);
    };
    window.addEventListener('resize', alCambiarTamano);
  }

  return { html: `<div class="grafico" id="grafico-precio"></div>${tabla}`, alMontar };
}
