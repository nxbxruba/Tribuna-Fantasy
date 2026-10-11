'use strict';

/* =========================================================
   PARTIDOS: formato común
   ========================================================= */
// Convierte un partido de ESPN a un formato más sencillo
function normalizarPartido(ev, ligaId) {
  const comp = ev.competitions?.[0] || {};
  const st = comp.status || ev.status || {};
  const tipo = st.type || {};
  const equipos = (comp.competitors || []).map((c) => ({
    id: c.team?.id,
    nombre: c.team?.shortDisplayName || c.team?.displayName || '',
    nombreLargo: c.team?.displayName || '',
    logo: c.team?.logo || c.team?.logos?.[0]?.href,
    goles: typeof c.score === 'object' ? c.score?.displayValue : c.score,
    local: c.homeAway === 'home',
    ganador: c.winner === true || c.score?.winner === true,
    penaltis: c.shootoutScore,
  }));
  return {
    id: ev.id,
    liga: ligaId,
    fecha: new Date(ev.date || comp.date),
    estado: tipo.state,            // 'pre' | 'in' | 'post'
    tipoNombre: tipo.name || '',   // p. ej. STATUS_HALFTIME
    reloj: st.displayClock,
    local: equipos.find((e) => e.local) || equipos[0] || {},
    visitante: equipos.find((e) => !e.local) || equipos[1] || {},
  };
}

const porFecha = (a, b) => a.fecha - b.fecha;

// ESPN solo admite un día por petición, así que se pide cada día por separado
async function partidosDeDias(ligaId, dias) {
  const res = await Promise.allSettled(
    dias.map((d) => pedir(`${API}/${ligaId}/scoreboard?${DIRECTO}&dates=${ymd(d)}`)));
  if (res.every((r) => r.status === 'rejected')) throw new Error('sin datos');
  const vistos = new Set();
  const partidos = [];
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value.events || []) {
      if (vistos.has(ev.id)) continue;
      vistos.add(ev.id);
      partidos.push(normalizarPartido(ev, ligaId));
    }
  }
  return partidos;
}

// Las ligas americanas se juegan de madrugada en Europa: se pide también el día de al lado
const desfaseHoras = -new Date().getTimezoneOffset() / 60;
function diasAPedir(liga, dia) {
  if (!liga.america) return [dia];
  return desfaseHoras > -4 ? [sumarDias(dia, -1), dia] : [dia, sumarDias(dia, 1)];
}

function estadoPartido(p) {
  const n = p.tipoNombre;
  if (/POSTPONED/.test(n)) return { texto: 'Aplazado', clase: 'off' };
  if (/CANCEL/.test(n)) return { texto: 'Cancelado', clase: 'off' };
  if (/SUSPENDED|ABANDONED/.test(n)) return { texto: 'Suspendido', clase: 'off' };
  if (p.estado === 'in') {
    if (/HALFTIME/.test(n)) return { texto: 'Descanso', clase: 'vivo' };
    return { texto: p.reloj && p.reloj !== "0'" ? p.reloj : 'En juego', clase: 'vivo' };
  }
  if (p.estado === 'post') {
    if (/PEN|SHOOTOUT/.test(n)) return { texto: 'Final (pen.)', clase: 'fin' };
    if (/AET|EXTRA/.test(n)) return { texto: 'Final (prór.)', clase: 'fin' };
    return { texto: 'Final', clase: 'fin' };
  }
  return { texto: fmtHora(p.fecha), clase: 'pre' };
}

function filaPartido(p, conFecha = false) {
  const e = estadoPartido(p);
  const mostrarGoles = p.estado !== 'pre' && e.clase !== 'off';
  const lineaEquipo = (eq, rival) => {
    const clase = p.estado === 'post' ? (eq.ganador ? 'gana' : rival.ganador ? 'pierde' : '') : '';
    const pen = eq.penaltis != null ? `<small>(${esc(eq.penaltis)})</small>` : '';
    const fav = eq.id && favoritos.es(eq.id) ? ' <span class="fav-marca" title="Favorito">★</span>' : '';
    return `<div class="eq ${clase}">${escudo(eq.logo)}<span class="eq-nombre">${esc(eq.nombre)}${fav}</span>` +
      `<span class="eq-goles">${mostrarGoles ? esc(eq.goles ?? '') + pen : ''}</span></div>`;
  };
  return `<a class="partido ${e.clase}" href="#/partido/${enc(p.liga)}/${enc(p.id)}">
    <div class="p-estado">${conFecha ? `<span class="p-dia">${esc(fmtDiaCorto(p.fecha))}</span>` : ''}
      <span class="estado-${e.clase}">${esc(e.texto)}</span></div>
    <div class="p-equipos">${lineaEquipo(p.local, p.visitante)}${lineaEquipo(p.visitante, p.local)}</div>
  </a>`;
}

/* =========================================================
   VISTA: INICIO (partidos del día de todas las ligas)
   ========================================================= */
function etiquetaDia(d) {
  const dif = diferenciaDias(d, hoy());
  if (dif === 0) return 'Hoy';
  if (dif === -1) return 'Ayer';
  if (dif === 1) return 'Mañana';
  return d.toLocaleDateString('es-ES', { weekday: 'short' });
}

function selectorDias(sel, soloVivo) {
  const extra = soloVivo ? '&vivo=1' : '';
  const dias = [];
  for (let i = -3; i <= 3; i++) dias.push(sumarDias(sel, i));
  return `<nav class="dias" aria-label="Elegir día">
    <a class="dia-flecha" href="#/?fecha=${ymd(sumarDias(sel, -7))}${extra}" aria-label="Semana anterior">‹</a>
    ${dias.map((d) => `<a class="dia ${mismoDia(d, sel) ? 'activo' : ''}" href="#/?fecha=${ymd(d)}${extra}">
      <span>${esc(etiquetaDia(d))}</span><small>${esc(fmtFechaCorta(d))}</small></a>`).join('')}
    <a class="dia-flecha" href="#/?fecha=${ymd(sumarDias(sel, 7))}${extra}" aria-label="Semana siguiente">›</a>
  </nav>`;
}

async function vistaInicio(params) {
  const dia = leerYmd(params.get('fecha')) || hoy();
  const soloVivo = params.get('vivo') === '1';
  const ligas = ligasInicio();
  const [marcadores, noticias] = await Promise.all([
    Promise.allSettled(ligas.map((l) => partidosDeDias(l.id, diasAPedir(l, dia)))),
    cargarNoticias(LIGAS_NOTICIAS.slice(0, 4), 6).catch(() => []),
  ]);

  if (ligas.length && marcadores.every((r) => r.status === 'rejected')) throw new Error('sin datos');

  const misFavoritos = favoritos.lista();
  const idsFavoritos = new Set(misFavoritos.map((f) => f.id));
  const deFavoritos = [];
  let enDirecto = 0;
  const bloques = [];

  marcadores.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const liga = ligas[i];
    let partidos = r.value.filter((p) => mismoDia(p.fecha, dia)).sort(porFecha);
    enDirecto += partidos.filter((p) => p.estado === 'in').length;
    deFavoritos.push(...partidos.filter((p) => idsFavoritos.has(p.local.id) || idsFavoritos.has(p.visitante.id)));
    if (soloVivo) partidos = partidos.filter((p) => p.estado === 'in');
    if (!partidos.length) return;
    bloques.push(`<section class="tarjeta">
      <a class="bloque-cab" href="#/liga/${liga.id}/partidos"><span>${esc(liga.nombre)}</span><small>${esc(liga.pais)} ›</small></a>
      ${partidos.map((p) => filaPartido(p)).join('')}
    </section>`);
  });

  const bloqueFavoritos = misFavoritos.length ? `<section class="tarjeta">
      <a class="bloque-cab" href="#/favoritos"><span>⭐ Mis equipos</span><small>Ver todos ›</small></a>
      ${deFavoritos.length
        ? deFavoritos.sort(porFecha).map((p) => filaPartido(p)).join('')
        : `<div class="mis-equipos">${misFavoritos.map((f) =>
            `<a href="#/equipo/${enc(f.liga)}/${enc(f.id)}">${escudo(f.logo)}<span>${esc(f.nombre)}</span></a>`).join('')}</div>`}
    </section>` : '';

  const filtros = `<div class="chips">
    <a class="chip ${soloVivo ? '' : 'activo'}" href="#/?fecha=${ymd(dia)}">Todos</a>
    <a class="chip ${soloVivo ? 'activo' : ''}" href="#/?fecha=${ymd(dia)}&vivo=1">🔴 En directo (${enDirecto})</a>
  </div>`;

  const sinPartidos = soloVivo
    ? vacio('No hay partidos en directo ahora mismo.', '📺')
    : vacio('No hay partidos este día en las ligas que sigues.', '📅');

  const html = `<div class="inicio">
    <div>
      ${selectorDias(dia, soloVivo)}
      ${filtros}
      ${soloVivo ? '' : bloqueFavoritos}
      ${bloques.join('') || sinPartidos}
    </div>
    <aside class="col-lateral">
      <h2 class="titulo-seccion">Últimas noticias</h2>
      <div class="tarjeta noticias-lista">
        ${noticias.slice(0, 6).map((a) => tarjetaNoticia(a, true)).join('') || '<p class="vacio">Sin noticias ahora mismo.</p>'}
        <a class="ver-mas" href="#/noticias">Ver todas las noticias →</a>
      </div>
    </aside>
  </div>`;
  return { html, vivo: enDirecto > 0 };
}

/* =========================================================
   VISTA: PARTIDO
   Pestañas: Resumen · Alineaciones (o Posible 11) · Estadísticas
   ========================================================= */
const ESTADISTICAS_PARTIDO = [
  ['possessionPct', 'Posesión (%)'],
  ['totalShots', 'Tiros'],
  ['shotsOnTarget', 'Tiros a puerta'],
  ['wonCorners', 'Córners'],
  ['totalPasses', 'Pases'],
  ['foulsCommitted', 'Faltas'],
  ['offsides', 'Fueras de juego'],
  ['yellowCards', 'Tarjetas amarillas'],
  ['redCards', 'Tarjetas rojas'],
  ['saves', 'Paradas'],
];

const mapaEstadisticas = (stats) => Object.fromEntries((stats || []).map((s) => [s.name, s.displayValue]));

function iconoEvento(ev) {
  const t = ev.type?.type || '';
  if (ev.scoringPlay) return /own/i.test(t) ? '⚽ (p.p.)' : '⚽';
  if (/red/.test(t)) return '🟥';
  if (/yellow/.test(t)) return '🟨';
  if (/substitution/.test(t)) return '🔁';
  return '';
}

const RESULTADO_FORMA = { W: 'G', D: 'E', L: 'P' };

async function vistaPartido(ligaId, id, pestana) {
  const d = await pedir(`${API}/${enc(ligaId)}/summary?event=${enc(id)}&${DIRECTO}`, 20000);
  const comp = d.header?.competitions?.[0];
  if (!comp) return vistaNoEncontrada();

  const p = normalizarPartido({ id, date: comp.date, competitions: [comp] }, ligaId);
  const e = estadoPartido(p);
  const liga = buscarLiga(ligaId);
  const previa = p.estado === 'pre';
  const eventos = (d.keyEvents || []).filter((ev) => iconoEvento(ev));

  /* ----- Marcador ----- */
  const goleadores = (idEquipo) => eventos
    .filter((ev) => ev.scoringPlay && ev.team?.id === idEquipo)
    .map((ev) => `${ev.participants?.[0]?.athlete?.displayName || ''} ${ev.clock?.displayValue || ''}`.trim());

  const equipoMarcador = (eq) => `<a class="m-eq" href="#/equipo/${enc(ligaId)}/${enc(eq.id)}">
      ${escudo(eq.logo)}<span>${esc(eq.nombreLargo)}</span>
      <span class="m-goleadores">${goleadores(eq.id).map(esc).join('<br>')}</span>
    </a>`;

  const marcadorCentro = previa
    ? `<div class="m-goles pre">${esc(fmtHora(p.fecha))}</div><div class="m-estado">${esc(fmtDiaCorto(p.fecha))}</div>`
    : `<div class="m-goles">${esc(p.local.goles)} - ${esc(p.visitante.goles)}</div>
       <div class="m-estado estado-${e.clase}">${esc(e.texto)}</div>`;

  const estadio = d.gameInfo?.venue;
  const info = [
    estadio?.fullName,
    estadio?.address?.city,
    d.gameInfo?.attendance ? `${Number(d.gameInfo.attendance).toLocaleString('es-ES')} espectadores` : '',
  ].filter(Boolean).join(' · ');

  const marcador = `<section class="tarjeta marcador">
    <a class="volver" href="#/liga/${enc(ligaId)}/partidos">‹ ${esc(liga?.nombre || 'Volver')}</a>
    <div class="m-fila">${equipoMarcador(p.local)}<div class="m-centro">${marcadorCentro}</div>${equipoMarcador(p.visitante)}</div>
    ${info ? `<p class="m-info">${esc(info)}</p>` : ''}
  </section>`;

  const listaPestanas = [
    ['resumen', previa ? 'Previa' : 'Resumen'],
    ['alineaciones', previa ? 'Posible 11' : 'Alineaciones'],
  ];
  if (!previa) listaPestanas.push(['estadisticas', 'Estadísticas']);
  if (!listaPestanas.some(([k]) => k === pestana)) pestana = 'resumen';

  let contenido = '';
  if (pestana === 'resumen') contenido = previa ? htmlPrevia(d, p, ligaId) : htmlCronologia(eventos, p.local.id);
  else if (pestana === 'estadisticas') contenido = htmlEstadisticas(d, p);
  else contenido = previa ? await htmlPosibleOnce(ligaId, p, d) : htmlAlineaciones(d);

  return {
    html: marcador + pestanas(listaPestanas, pestana, `#/partido/${enc(ligaId)}/${enc(id)}/`) + contenido,
    vivo: p.estado === 'in',
  };
}

function htmlPrevia(d, p, ligaId) {
  const formas = (d.lastFiveGames || []).map((t) => {
    const resultados = (t.events || []).map((ev) => {
      const r = RESULTADO_FORMA[ev.gameResult] || '·';
      return `<b class="${r}" title="${esc(`${ev.atVs === '@' ? 'Fuera' : 'Casa'} ${ev.score || ''} vs ${ev.opponent?.displayName || ''}`)}">${r}</b>`;
    }).join('');
    return `<div class="fila-forma"><span class="celda-equipo">${escudo(t.team?.logo || t.team?.logos?.[0]?.href)}${esc(t.team?.displayName)}</span>
      <span class="forma">${resultados}</span></div>`;
  }).join('');

  return `${formas ? `<h2 class="titulo-seccion">Últimos 5 partidos</h2><section class="tarjeta">${formas}</section>` : ''}
    <section class="tarjeta relleno">
      <p style="margin:0 0 12px">¿Quién jugará? Consulta el posible once comparando varias fuentes.</p>
      <a class="boton principal" href="#/partido/${enc(ligaId)}/${enc(p.id)}/alineaciones">📋 Ver posible 11</a>
    </section>`;
}

function htmlCronologia(eventos, idLocal) {
  if (!eventos.length) return vacio('Todavía no hay goles, tarjetas ni cambios.', '⏱️');
  return `<section class="tarjeta"><ul class="cronologia">${eventos.map((ev) => {
    const [p1, p2] = (ev.participants || []).map((x) => x.athlete?.displayName);
    const esCambio = /substitution/.test(ev.type?.type || '');
    const detalle = esCambio
      ? `${esc(iconoEvento(ev))} ${esc(p1 || '')}${p2 ? `<small>Sale: ${esc(p2)}</small>` : ''}`
      : `${esc(iconoEvento(ev))} ${esc(p1 || ev.type?.text || '')}${ev.scoringPlay && p2 ? `<small>Asistencia: ${esc(p2)}</small>` : ''}`;
    const esLocal = ev.team?.id === idLocal;
    return `<li>
      <div class="lado-local">${esLocal ? detalle : ''}</div>
      <div class="minuto">${esc(ev.clock?.displayValue || '')}</div>
      <div>${esLocal ? '' : detalle}</div>
    </li>`;
  }).join('')}</ul></section>`;
}

function htmlEstadisticas(d, p) {
  const statsEquipo = (idEq) => mapaEstadisticas(d.boxscore?.teams?.find((t) => t.team?.id === idEq)?.statistics);
  const sL = statsEquipo(p.local.id);
  const sV = statsEquipo(p.visitante.id);
  const filas = ESTADISTICAS_PARTIDO.filter(([k]) => sL[k] != null && sV[k] != null).map(([k, nombre]) => {
    const a = parseFloat(sL[k]) || 0;
    const b = parseFloat(sV[k]) || 0;
    const total = a + b || 1;
    return `<div class="estadistica">
      <div class="est-cifras"><span>${esc(sL[k])}</span><span>${esc(nombre)}</span><span>${esc(sV[k])}</span></div>
      <div class="est-barras"><div class="local" style="flex:${a / total}"></div><div class="visitante" style="flex:${b / total}"></div></div>
    </div>`;
  }).join('');
  return filas ? `<section class="tarjeta">${filas}</section>` : vacio('Estadísticas no disponibles.', '📊');
}

function htmlAlineaciones(d) {
  const lista = (jugadores) => jugadores.map((j) => `<li>
      <span class="dorsal">${esc(j.jersey || '')}</span>
      <span class="nombre">${esc(j.athlete?.displayName)}${j.subbedIn ? ' <small>🔼</small>' : ''}${j.subbedOut ? ' <small>🔽</small>' : ''}</span>
      <small>${esc(j.position?.abbreviation || '')}</small>
    </li>`).join('');
  const rosters = (d.rosters || []).filter((r) => r.roster?.length);
  if (!rosters.length) return vacio('Alineaciones no disponibles.', '📋');
  return `<div class="dos-columnas">${rosters.map((r) => `<section class="tarjeta">
      <div class="bloque-cab"><span>${esc(r.team?.displayName)}</span><small>${esc(r.formation || '')}</small></div>
      <div class="sub-cab">Titulares</div>
      <ul class="lista-jugadores">${lista(r.roster.filter((j) => j.starter))}</ul>
      <div class="sub-cab">Suplentes</div>
      <ul class="lista-jugadores">${lista(r.roster.filter((j) => !j.starter))}</ul>
    </section>`).join('')}</div>`;
}
