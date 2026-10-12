'use strict';

/* =========================================================
   FANTASY LALIGA (datos oficiales de LaLiga Fantasy)
   Guardados en datos/fantasy.js por actualizar-datos.ps1
   ========================================================= */
const POS_FANTASY = EN
  ? { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD', 5: 'MGR' }
  : { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL', 5: 'ENT' };
const NOMBRE_POS_FANTASY = {
  1: L('Portero', 'Goalkeeper'),
  2: L('Defensa', 'Defender'),
  3: L('Centrocampista', 'Midfielder'),
  4: L('Delantero', 'Forward'),
  5: L('Entrenador', 'Manager'),
};
const ESTADOS_FANTASY = {
  injured: L('Lesionado', 'Injured'),
  doubtful: L('Duda', 'Doubtful'),
  suspended: L('Sancionado', 'Suspended'),
};

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
  if (h.length < 4) return { texto: L('Sin datos', 'No data'), clase: 'igual' };
  const cambios = h.slice(1).map((v, i) => v - h[i]);
  const suben = cambios.filter((c) => c > 0).length;
  const bajan = cambios.filter((c) => c < 0).length;
  if (suben === 3) return { texto: L('📈 Subiendo fuerte', '📈 Rising fast'), clase: 'sube' };
  if (suben >= 2) return { texto: L('↗ Al alza', '↗ Rising'), clase: 'sube' };
  if (bajan === 3) return { texto: L('📉 Bajando fuerte', '📉 Falling fast'), clase: 'baja' };
  if (bajan >= 2) return { texto: L('↘ A la baja', '↘ Falling'), clase: 'baja' };
  return { texto: L('→ Estable', '→ Stable'), clase: 'igual' };
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
  return `<a href="/fantasy/jugador/${enc(j.id)}">
    ${fotoFantasy(j)}
    <span class="nombre"><b>${esc(j.nombre)}</b> ${htmlEstadoFantasy(j.estado)}<br>
      <small>${esc(equipoFantasy(j.equipo).corto || nombreEquipoFantasy(j.equipo))} · ${esc(POS_FANTASY[j.pos] || '')}${extra ? ' · ' + extra : ''}</small></span>
    <span style="text-align:right"><span class="precio">${esc(fmtMillones(j.precio))}</span><br>${htmlCambio(cambioFantasy(j, dias), dias > 1)}</span>
  </a>`;
}

function htmlFormaFantasy(j) {
  return `<span class="forma">${ultimasJornadas(j).map(([s, p]) => (p == null
    ? `<b title="${L(`Jornada ${s}: no jugó`, `Matchday ${s}: did not play`)}">–</b>`
    : `<b class="${p >= 6 ? 'G' : p < 2 ? 'P' : ''}" title="${L(`Jornada ${s}: ${p} puntos`, `Matchday ${s}: ${p} points`)}">${p}</b>`)).join('')}</span>`;
}

function avisoActualizacion() {
  const d = window.DATOS_FANTASY;
  const horas = (Date.now() - new Date(d.actualizado)) / 36e5;
  const viejo = horas > 30;
  return `<p class="nota">${viejo ? '⚠️ ' : ''}${L('Valores oficiales de', 'Official values from')} <b>LaLiga Fantasy</b>${d.jornada ? ` · ${L('jornada', 'matchday')} ${esc(d.jornada)}` : ''} · ${L('actualizados', 'updated')} ${esc(haceTiempo(d.actualizado).toLowerCase())}
    ${viejo ? L('· Ejecuta <b>Actualizar datos.bat</b> para tener los valores de hoy.', '· Data may be out of date.') : ''}</p>`;
}

/* =========================================================
   VISTA: FANTASY
   ========================================================= */
const PESTANAS_FANTASY = [
  ['mercado', L('Subidas y bajadas', 'Risers and fallers')],
  ['jugadores', L('Buscar jugadores', 'Player prices')],
  ['once', L('Once ideal y chollos', 'Best XI and bargains')],
  ['lesionados', L('Parte médico', 'Injuries')],
];

async function vistaFantasy(pestana, params) {
  const cabecera = `<header class="cab-pagina"><div><p class="cab-sub">LaLiga</p><h1>💰 Fantasy</h1></div></header>`;
  if (!datosFantasyDisponibles()) {
    return {
      html: `${cabecera}${vacio(L('Todavía no hay datos Fantasy. En la carpeta de la web, haz doble clic en "Actualizar datos.bat" y recarga la página.', 'No Fantasy data yet.'), '💰')}`,
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
    html: cabecera + pestanas(PESTANAS_FANTASY, pestana, '/fantasy/') + avisoActualizacion() + r.html,
    alMontar: r.alMontar,
  };
}

const jugadoresDeCampo = () => window.DATOS_FANTASY.jugadores.filter((j) => j.pos !== 5);

function fantasyMercado(params) {
  const dias = [1, 3, 7, 30].includes(+params.get('periodo')) ? +params.get('periodo') : 1;
  const jugadores = window.DATOS_FANTASY.jugadores.map((j) => ({ j, c: cambioFantasy(j, dias) }));
  const suben = jugadores.filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 20);
  const bajan = jugadores.filter((x) => x.c < 0).sort((a, b) => a.c - b.c).slice(0, 20);
  const periodos = [[1, L('Hoy', 'Today')], [3, L('3 días', '3 days')], [7, L('7 días', '7 days')], [30, L('30 días', '30 days')]];

  const lista = (titulo, items) => `<section class="tarjeta">
    <div class="bloque-cab"><span>${titulo}</span></div>
    <div class="lista-jugadores">${items.map(({ j }) => filaJugadorFantasy(j, dias)).join('') || `<p class="vacio">${L('Sin cambios en este periodo (falta historial).', 'No changes in this period (not enough history).')}</p>`}</div>
  </section>`;

  return {
    html: `<div class="chips">${periodos.map(([d, t]) =>
        `<a class="chip ${d === dias ? 'activo' : ''}" href="/fantasy/mercado?periodo=${d}">${t}</a>`).join('')}</div>
      <div class="dos-columnas">${lista(`📈 ${L('Los que más suben', 'Biggest risers')}`, suben)}${lista(`📉 ${L('Los que más bajan', 'Biggest fallers')}`, bajan)}</div>`,
  };
}

function fantasyJugadores(params) {
  const equipos = Object.entries(window.DATOS_FANTASY.equipos).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, LOCALE));
  const html = `<div class="filtros">
      <input class="campo" id="f-texto" type="search" placeholder="${L('Buscar jugador...', 'Search player...')}" value="${esc(params.get('q') || '')}" autocomplete="off">
      <select class="campo" id="f-pos"><option value="">${L('Todas las posiciones', 'All positions')}</option>
        ${Object.entries(NOMBRE_POS_FANTASY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <select class="campo" id="f-equipo"><option value="">${L('Todos los equipos', 'All teams')}</option>
        ${equipos.map(([id, e]) => `<option value="${esc(id)}">${esc(e.nombre)}</option>`).join('')}</select>
      <select class="campo" id="f-orden">
        <option value="precio">${L('Más caros', 'Most expensive')}</option>
        <option value="puntos">${L('Más puntos', 'Most points')}</option>
        <option value="media">${L('Mejor media', 'Best average')}</option>
        <option value="rentable">${L('Más puntos por millón', 'Most points per million')}</option>
        <option value="sube">${L('Más suben hoy', 'Biggest risers today')}</option>
        <option value="sube7">${L('Más suben (7 días)', 'Biggest risers (7 days)')}</option>
        <option value="baja">${L('Más bajan hoy', 'Biggest fallers today')}</option>
        <option value="titular">${L('Más probable que jueguen', 'Most likely to start')}</option>
        <option value="barato">${L('Más baratos', 'Cheapest')}</option>
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
    const n = filtrados.length;
    document.getElementById('f-cuenta').textContent = L(
      `${n} ${n === 1 ? 'jugador' : 'jugadores'}${n > 100 ? ' (se muestran los 100 primeros)' : ''}`,
      `${n} ${n === 1 ? 'player' : 'players'}${n > 100 ? ' (showing the first 100)' : ''}`);
    const lista = document.getElementById('f-lista');
    lista.innerHTML = filtrados.slice(0, 100).map((j) => {
      const p = orden === 'titular' ? prob(j) : null;
      const extra = p != null && p >= 0 ? `<span class="pct ${claseProbabilidad(p)}">${pct(p)} ${L('titular', 'to start')}</span>` : `${j.puntos} pts`;
      return filaJugadorFantasy(j, orden === 'sube7' ? 7 : 1, extra);
    }).join('') || `<p class="vacio">${L('No hay jugadores con esos filtros.', 'No players match these filters.')}</p>`;
    ajustarEnlaces(lista);
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
    `<a class="ficha prob-alta" href="/fantasy/jugador/${enc(j.id)}" title="${esc(j.nombre)}">
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
        <div class="bloque-cab"><span>⭐ ${L('Once ideal por puntos (4-3-3)', 'Best XI by points (4-3-3)')}</span><small>${esc(fmtMillones(valorOnce))}</small></div>
        ${campo}
        <p class="nota relleno" style="margin:0">${L('Los números son los puntos totales de la temporada.', 'Numbers are total season points.')}</p>
      </section>
      <div>
        <section class="tarjeta">
          <div class="bloque-cab"><span>💎 ${L('Chollos', 'Bargains')}</span><small>${L('puntos por millón', 'points per million')}</small></div>
          <div class="lista-jugadores">${chollos.map((j) => filaJugadorFantasy(j, 1, `${fmtNumero(puntosPorMillon(j))} pts/M€`)).join('')}</div>
        </section>
        <section class="tarjeta">
          <div class="bloque-cab"><span>🔥 ${L('En forma', 'In form')}</span><small>${L('puntos en las 3 últimas jornadas', 'points in the last 3 matchdays')}</small></div>
          <div class="lista-jugadores">${enForma.map((j) => filaJugadorFantasy(j, 1, `${sumaForma(j)} pts`)).join('')}</div>
        </section>
        ${titularesBaratos.length ? `<section class="tarjeta">
          <div class="bloque-cab"><span>🎯 ${L('Titulares por menos de 10 M€', 'Starters under 10 M€')}</span><small>${L('según Futbol Fantasy', 'per Futbol Fantasy')}</small></div>
          <div class="lista-jugadores">${titularesBaratos.map(({ j, p }) => filaJugadorFantasy(j, 1, `<span class="pct ${claseProbabilidad(p)}">${pct(p)} ${L('titular', 'to start')}</span>`)).join('')}</div>
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
  const equipos = [...porEquipo].sort((a, b) => nombreEquipoFantasy(a[0]).localeCompare(nombreEquipoFantasy(b[0]), LOCALE));
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
    [L('Valor de mercado', 'Market value'), esc(fmtMillones(j.precio))],
    [L('Cambio hoy', 'Change today'), htmlCambio(cambioFantasy(j, 1))],
    [L('Cambio 7 días', 'Change 7 days'), htmlCambio(cambioFantasy(j, 7), true)],
    [L('Cambio 30 días', 'Change 30 days'), htmlCambio(cambioFantasy(j, 30), true)],
    [L('Tendencia', 'Trend'), `<span class="cambio ${tendencia.clase}">${esc(tendencia.texto)}</span>`],
    [L('Puntos', 'Points'), esc(j.puntos)],
    [L('Media por partido', 'Average per match'), esc(fmtNumero(j.media, 2))],
    [L('Puntos por millón', 'Points per million'), esc(fmtNumero(puntosPorMillon(j)))],
    [L('Temporada pasada', 'Last season'), j.anterior ? `${esc(j.anterior)} pts` : '—'],
  ];

  return {
    html: `<a class="boton" href="/fantasy/jugadores" style="margin-bottom:14px">‹ Fantasy</a>
      <header class="cab-pagina">
        ${fotoFantasy(j, 'foto-grande')}
        <div>
          <p class="cab-sub">${esc(NOMBRE_POS_FANTASY[j.pos] || '')}${j.completo ? ` · ${esc(j.completo)}` : ''}</p>
          <h1>${esc(j.nombre)}</h1>
          <p class="celda-equipo" style="margin:6px 0 0">${escudo(equipoFantasy(j.equipo).escudo)}${esc(nombreEquipoFantasy(j.equipo))} ${htmlEstadoFantasy(j.estado)}</p>
        </div>
      </header>
      ${titular ? `<section class="tarjeta relleno">
          <b>${L('Próximo partido', 'Next match')}${titular.partido ? ` (${esc(titular.partido)})` : ''}:</b>
          <span class="pct ${claseProbabilidad(titular.prob)}">${pct(titular.prob)}</span> ${L('de probabilidad de ser titular', 'chance of starting')}
          <br><small class="texto-suave">${L('Según', 'Per')} <a href="${urlSegura(titular.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--acento)">Futbol Fantasy</a></small>
        </section>` : ''}
      <section class="tarjeta">
        <div class="datos-clave">${datos.map(([t, v]) => `<div class="dato"><small>${esc(t)}</small><b>${v}</b></div>`).join('')}</div>
      </section>
      <section class="tarjeta">
        <div class="bloque-cab"><span>${L('Últimas 5 jornadas', 'Last 5 matchdays')}</span>${htmlFormaFantasy(j)}</div>
      </section>
      <section class="tarjeta">
        <div class="bloque-cab"><span>${L('Evolución del valor', 'Value history')}</span><small>${L(`últimos ${puntos.length} días`, `last ${puntos.length} days`)}</small></div>
        ${grafico.html}
      </section>
      <p class="fila-botones"><a class="boton" href="/buscar?q=${enc(j.completo || j.nombre)}">🔍 ${L('Buscar estadísticas en ESPN', 'Search stats on ESPN')}</a></p>`,
    titulo: L(`${j.nombre}: valor en LaLiga Fantasy y evolución`, `${j.nombre}: LaLiga Fantasy value and trend`),
    descripcion: L(`Valor de mercado de ${j.nombre} en LaLiga Fantasy (${fmtMillones(j.precio)}), cambios, puntos y probabilidad de ser titular.`,
      `${j.nombre} LaLiga Fantasy market value (${fmtMillones(j.precio)}), changes, points and chance of starting.`),
    alMontar: grafico.alMontar,
  };
}

/* ----- Gráfico de línea del valor (SVG) con guía y tooltip al pasar el dedo/ratón ----- */
function crearGraficoPrecio(puntos) {
  if (puntos.length < 2) return { html: `<p class="vacio">${L('Todavía no hay historial suficiente.', 'Not enough history yet.')}</p>` };
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
  const fmtFecha = (f) => new Date(f + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  const desde = `${fmtMillones(valores[0])} (${fmtFecha(puntos[0].fecha)})`;
  const hasta = `${fmtMillones(valores[valores.length - 1])} (${fmtFecha(puntos[puntos.length - 1].fecha)})`;
  const resumen = L(`Evolución del valor de mercado: de ${desde} a ${hasta}`, `Market value history: from ${desde} to ${hasta}`);

  // Tabla con los datos, para quien no pueda ver el gráfico
  const tabla = `<details class="relleno" style="border-top:1px solid var(--borde)">
    <summary style="cursor:pointer;font-weight:600">${L('Ver tabla de valores', 'Show value table')}</summary>
    <div class="tabla-scroll" style="max-height:260px;margin-top:8px"><table>
      <thead><tr><th class="izq">${L('Fecha', 'Date')}</th><th class="der">${L('Valor', 'Value')}</th><th class="der">${L('Cambio', 'Change')}</th></tr></thead>
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
