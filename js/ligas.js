'use strict';

/* =========================================================
   VISTA: TODAS LAS LIGAS (agrupadas)
   ========================================================= */
async function vistaLigas() {
  return {
    html: `<h1 class="titulo-seccion">Ligas y competiciones</h1>
      ${GRUPOS_LIGAS.map((g) => `<section class="grupo-ligas">
        <h2 class="titulo-seccion" style="font-size:15px">${esc(g.nombre)}</h2>
        <div class="rejilla">${g.ligas.map((l) =>
          `<a class="casilla" href="#/liga/${l.id}/partidos"><span class="icono-grande">🏆</span>${esc(l.nombre)}<small>${esc(l.pais)}</small></a>`).join('')}
        </div>
      </section>`).join('')}`,
  };
}

/* =========================================================
   VISTA: NOTICIAS
   ========================================================= */
async function vistaNoticias() {
  const noticias = await cargarNoticias(LIGAS_NOTICIAS, 10);
  return {
    html: `<h1 class="titulo-seccion">Noticias</h1>
      ${noticias.length
        ? `<div class="noticias-rejilla">${noticias.slice(0, 36).map((a) => tarjetaNoticia(a)).join('')}</div>`
        : vacio('No hay noticias ahora mismo.', '📰')}`,
  };
}

/* =========================================================
   VISTA: LIGA (partidos, clasificación, goleadores, equipos, noticias)
   ========================================================= */
const PESTANAS_LIGA = [
  ['partidos', 'Partidos'],
  ['clasificacion', 'Clasificación'],
  ['goleadores', 'Goleadores'],
  ['equipos', 'Equipos'],
  ['noticias', 'Noticias'],
];

async function vistaLiga(id, pestana, params) {
  const liga = buscarLiga(id);
  const contenido = {
    partidos: ligaPartidos,
    clasificacion: ligaClasificacion,
    goleadores: ligaGoleadores,
    equipos: ligaEquipos,
    noticias: ligaNoticias,
  }[pestana];
  if (!liga || !contenido) return vistaNoEncontrada();

  const { html, vivo } = await contenido(liga, params);
  return {
    vivo,
    html: `<header class="cab-pagina"><div>
        <p class="cab-sub">${esc(liga.pais)}</p><h1>${esc(liga.nombre)}</h1>
      </div></header>
      ${pestanas(PESTANAS_LIGA, pestana, `#/liga/${liga.id}/`)}
      ${html}`,
  };
}

// Partidos de una semana concreta (desde) o de la jornada actual (sin desde)
async function cargarJornada(liga, desde) {
  let partidos;
  let inicio;
  let fin;

  if (desde) {
    inicio = desde;
    fin = sumarDias(desde, 6);
    const dias = [];
    for (let i = -1; i <= 7; i++) dias.push(sumarDias(inicio, i));
    partidos = (await partidosDeDias(liga.id, dias))
      .filter((p) => p.fecha >= inicio && p.fecha < sumarDias(fin, 1));
  } else {
    // Sin fecha: ESPN devuelve la jornada actual
    const d = await pedir(`${API}/${liga.id}/scoreboard?${DIRECTO}`);
    partidos = (d.events || []).map((ev) => normalizarPartido(ev, liga.id));
    if (partidos.length) {
      const fechas = partidos.map((p) => p.fecha.getTime());
      inicio = inicioDia(new Date(Math.min(...fechas)));
      fin = inicioDia(new Date(Math.max(...fechas)));
    } else {
      inicio = hoy();
      fin = sumarDias(inicio, 6);
    }
  }
  partidos.sort(porFecha);
  return { partidos, inicio, fin };
}

function navegacionJornada(rutaBase, inicio, fin, desde) {
  const union = rutaBase.includes('?') ? '&' : '?';
  const rangoTexto = mismoDia(inicio, fin) ? fmtDiaCorto(inicio) : `${fmtFechaCorta(inicio)} – ${fmtFechaCorta(fin)}`;
  return `<div class="nav-semana">
    <a class="boton" href="${rutaBase}${union}desde=${ymd(sumarDias(inicio, -7))}">‹ Antes</a>
    <span>${esc(rangoTexto)}${desde ? `<a href="${rutaBase}">Volver a la jornada actual</a>` : ''}</span>
    <a class="boton" href="${rutaBase}${union}desde=${ymd(sumarDias(fin, 1))}">Después ›</a>
  </div>`;
}

async function ligaPartidos(liga, params) {
  const desde = leerYmd(params.get('desde'));
  const { partidos, inicio, fin } = await cargarJornada(liga, desde);

  const porDia = new Map();
  for (const p of partidos) {
    const clave = ymd(p.fecha);
    if (!porDia.has(clave)) porDia.set(clave, []);
    porDia.get(clave).push(p);
  }

  const navegacion = navegacionJornada(`#/liga/${liga.id}/partidos`, inicio, fin, desde);

  const secciones = [...porDia.values()].map((lista) => `<section class="tarjeta">
      <h2 class="cab-dia capital">${esc(fmtDiaLargo(lista[0].fecha))}</h2>
      ${lista.map((p) => filaPartido(p)).join('')}
    </section>`).join('');

  return {
    html: navegacion + (secciones || vacio('No hay partidos en estas fechas.', '📅')),
    vivo: partidos.some((p) => p.estado === 'in'),
  };
}

async function ligaClasificacion(liga) {
  const d = await pedir(`${API_CLASIFICACION}/${liga.id}/standings?${IDIOMA}`, 120000);
  const grupos = d.children?.length ? d.children : d.standings ? [d] : [];
  if (!grupos.length) return { html: vacio('Clasificación no disponible para esta competición.', '📊') };

  const leyenda = new Map();
  const tablas = grupos.map((g) => {
    const filas = (g.standings?.entries || []).map((en, i) => {
      const s = mapaEstadisticas(en.stats);
      return { en, s, orden: parseInt(s.rank, 10) || i + 1 };
    }).sort((a, b) => a.orden - b.orden);

    const cuerpo = filas.map(({ en, s, orden }) => {
      const color = colorSeguro(en.note?.color);
      if (color && en.note?.description) leyenda.set(color, en.note.description);
      const fav = favoritos.es(en.team?.id) ? ' <span class="fav-marca">★</span>' : '';
      return `<tr>
        <td class="pos" style="${color ? `box-shadow: inset 4px 0 0 ${color}` : ''}">${orden}</td>
        <td class="izq"><a class="celda-equipo" href="#/equipo/${liga.id}/${enc(en.team?.id)}">
          ${escudo(en.team?.logos?.[0]?.href)}<span>${esc(en.team?.shortDisplayName || en.team?.displayName)}${fav}</span></a></td>
        <td>${esc(s.gamesPlayed)}</td><td>${esc(s.wins)}</td><td>${esc(s.ties)}</td><td>${esc(s.losses)}</td>
        <td class="opc">${esc(s.pointsFor)}</td><td class="opc">${esc(s.pointsAgainst)}</td>
        <td>${esc(s.pointDifferential)}</td><td class="pts">${esc(s.points)}</td>
      </tr>`;
    }).join('');

    return `<section class="tarjeta">
      ${grupos.length > 1 ? `<h2 class="cab-dia">${esc(g.name)}</h2>` : ''}
      <div class="tabla-scroll"><table>
        <thead><tr><th>#</th><th class="izq">Equipo</th><th title="Partidos jugados">PJ</th><th title="Ganados">G</th>
          <th title="Empatados">E</th><th title="Perdidos">P</th><th class="opc" title="Goles a favor">GF</th>
          <th class="opc" title="Goles en contra">GC</th><th title="Diferencia de goles">DG</th><th>Pts</th></tr></thead>
        <tbody>${cuerpo}</tbody>
      </table></div>
    </section>`;
  }).join('');

  const htmlLeyenda = leyenda.size
    ? `<div class="tarjeta leyenda">${[...leyenda].map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div>`
    : '';
  return { html: tablas + htmlLeyenda };
}

async function ligaGoleadores(liga) {
  const d = await pedir(`${API}/${liga.id}/statistics?${IDIOMA}`, 300000);
  const titulos = { goalsLeaders: ['Máximos goleadores', 'Goles'], assistsLeaders: ['Máximos asistentes', 'Asist.'] };
  const tablas = (d.stats || []).filter((c) => titulos[c.name] && c.leaders?.length).map((c) => {
    const [titulo, columna] = titulos[c.name];
    const filas = c.leaders.slice(0, 20).map((l, i) => {
      const a = l.athlete || {};
      const st = mapaEstadisticas(a.statistics);
      const partidos = st.appearances ?? (String(l.displayValue || '').match(/\d+/) || [''])[0];
      const equipo = a.team || {};
      return `<tr>
        <td class="pos">${i + 1}</td>
        <td class="izq"><a class="celda-equipo" href="#/jugador/${enc(a.id)}">
          ${escudo(equipo.logos?.[0]?.href)}<span>${esc(a.displayName)}<small>${esc(equipo.displayName || '')}</small></span></a></td>
        <td>${esc(partidos)}</td>
        <td class="pts">${esc(l.value ?? '')}</td>
      </tr>`;
    }).join('');
    return `<section class="tarjeta">
      <h2 class="cab-dia">${esc(titulo)}</h2>
      <div class="tabla-scroll"><table>
        <thead><tr><th>#</th><th class="izq">Jugador</th><th title="Partidos jugados">PJ</th><th>${esc(columna)}</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
    </section>`;
  }).join('');
  return { html: tablas || vacio('Estadísticas no disponibles para esta competición.', '📊') };
}

async function ligaEquipos(liga) {
  const d = await pedir(`${API}/${liga.id}/teams?${IDIOMA}`, 3600000);
  const equipos = (d.sports?.[0]?.leagues?.[0]?.teams || []).map((t) => t.team)
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es'));
  if (!equipos.length) return { html: vacio('No hay equipos disponibles.') };
  return {
    html: `<div class="rejilla">${equipos.map((t) =>
      `<a class="casilla" href="#/equipo/${liga.id}/${enc(t.id)}">${escudo(t.logos?.[0]?.href)}${esc(t.displayName)}${favoritos.es(t.id) ? '<small>★ Favorito</small>' : ''}</a>`).join('')}</div>`,
  };
}

async function ligaNoticias(liga) {
  const noticias = await cargarNoticias([liga.id], 24);
  return {
    html: noticias.length
      ? `<div class="noticias-rejilla">${noticias.map((a) => tarjetaNoticia(a)).join('')}</div>`
      : vacio('No hay noticias de esta competición.', '📰'),
  };
}

/* =========================================================
   VISTA: EQUIPO (resultados, próximos partidos, plantilla)
   ========================================================= */
const PESTANAS_EQUIPO = [['resultados', 'Resultados'], ['proximos', 'Próximos'], ['plantilla', 'Plantilla']];
const POSICIONES = { Goalkeeper: 'Porteros', Defender: 'Defensas', Midfielder: 'Centrocampistas', Forward: 'Delanteros' };

async function vistaEquipo(ligaId, id, pestana) {
  if (!PESTANAS_EQUIPO.some(([p]) => p === pestana)) return vistaNoEncontrada();
  const base = `${API}/${enc(ligaId)}/teams/${enc(id)}`;
  const info = await pedir(`${base}?${IDIOMA}`, 300000);
  const t = info.team;
  if (!t) return vistaNoEncontrada();

  let contenido;
  if (pestana === 'plantilla') {
    const d = await pedir(`${base}/roster?${IDIOMA}`, 3600000);
    const grupos = new Map(Object.values(POSICIONES).map((n) => [n, []]));
    for (const j of d.athletes || []) {
      const pos = POSICIONES[j.position?.name] || 'Otros';
      if (!grupos.has(pos)) grupos.set(pos, []);
      grupos.get(pos).push(j);
    }
    contenido = [...grupos].filter(([, js]) => js.length).map(([pos, js]) => `<section class="tarjeta">
      <div class="sub-cab">${esc(pos)}</div>
      <div class="lista-jugadores">${js.map((j) => `<a href="#/jugador/${enc(j.id)}">
        <span class="dorsal">${esc(j.jersey || '')}</span>
        ${urlSegura(j.flag?.href) ? `<img class="bandera" src="${urlSegura(j.flag.href)}" alt="" loading="lazy">` : ''}
        <span class="nombre">${esc(j.displayName)}<br><small>${esc([j.citizenship, j.age ? `${j.age} años` : ''].filter(Boolean).join(' · '))}</small></span>
      </a>`).join('')}</div>
    </section>`).join('') || vacio('Plantilla no disponible.');
  } else {
    // Todas las competiciones del equipo (liga, copa, Europa...), sin amistosos
    const proximos = pestana === 'proximos';
    const d = await pedir(`${API}/all/teams/${enc(id)}/schedule?${DIRECTO}${proximos ? '&fixture=true' : ''}`, 60000)
      .catch(() => pedir(`${base}/schedule?${DIRECTO}${proximos ? '&fixture=true' : ''}`, 60000));
    const partidos = (d.events || [])
      .filter((ev) => !esAmistoso(ev.league?.slug))
      .map((ev) => normalizarPartido(ev, ev.league?.slug || ligaId))
      .filter((p) => (proximos ? p.estado !== 'post' : p.estado === 'post'))
      .sort((a, b) => (proximos ? a.fecha - b.fecha : b.fecha - a.fecha));
    contenido = partidos.length
      ? `<section class="tarjeta">${partidos.map((p) => filaPartido(p, true)).join('')}</section>`
      : vacio(proximos ? 'No hay próximos partidos programados.' : 'Todavía no hay resultados esta temporada.', '📅');
  }

  const color = colorSeguro(t.color);
  const balance = t.record?.items?.[0]?.summary?.split('-'); // formato G-E-P
  const cifras = [
    t.standingSummary,
    balance?.length === 3 ? `${balance[0]} G · ${balance[1]} E · ${balance[2]} P` : '',
  ].filter(Boolean);
  const datosFavorito = { id: String(t.id), liga: ligaId, nombre: t.shortDisplayName || t.displayName, logo: t.logos?.[0]?.href };
  const esFav = favoritos.es(t.id);

  return {
    html: `<header class="cab-equipo" style="${color ? `--color-equipo:${color}` : ''}">
        <button type="button" class="boton-favorito ${esFav ? 'activo' : ''}" data-accion="favorito">${esFav ? '★ Favorito' : '☆ Seguir'}</button>
        <div class="cab-pagina" style="margin:0">
          ${escudo(t.logos?.[0]?.href, 'escudo-grande')}
          <div>
            <p class="cab-sub">${esc(buscarLiga(ligaId)?.nombre || '')}</p>
            <h1>${esc(t.displayName)}</h1>
            <div class="cifras">${cifras.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
          </div>
        </div>
      </header>
      ${pestanas(PESTANAS_EQUIPO, pestana, `#/equipo/${enc(ligaId)}/${enc(id)}/`)}
      ${contenido}`,
    alMontar() {
      const boton = app.querySelector('[data-accion="favorito"]');
      boton?.addEventListener('click', () => {
        const ahora = favoritos.alternar(datosFavorito);
        boton.classList.toggle('activo', ahora);
        boton.textContent = ahora ? '★ Favorito' : '☆ Seguir';
        avisar(ahora ? `${datosFavorito.nombre} añadido a tus equipos` : `${datosFavorito.nombre} quitado de tus equipos`);
      });
    },
  };
}

/* =========================================================
   VISTA: MIS FAVORITOS
   ========================================================= */
async function vistaFavoritos() {
  const lista = favoritos.lista();
  if (!lista.length) {
    return {
      html: `<h1 class="titulo-seccion">⭐ Mis equipos</h1>
        ${vacio('Todavía no sigues a ningún equipo. Entra en un equipo y pulsa "☆ Seguir".', '⭐')}
        <p style="text-align:center"><a class="boton principal" href="#/ligas">Explorar ligas</a></p>`,
    };
  }
  const calendarios = await Promise.allSettled(lista.map((f) =>
    pedir(`${API}/all/teams/${enc(f.id)}/schedule?${DIRECTO}&fixture=true`, 300000)));
  const resultados = await Promise.allSettled(lista.map((f) =>
    pedir(`${API}/all/teams/${enc(f.id)}/schedule?${DIRECTO}`, 300000)));

  const tarjetas = lista.map((f, i) => {
    const sacar = (r, filtro, orden) => (r.status === 'fulfilled' ? (r.value.events || []) : [])
      .filter((ev) => !esAmistoso(ev.league?.slug))
      .map((ev) => normalizarPartido(ev, ev.league?.slug || f.liga))
      .filter(filtro).sort(orden)[0];
    const proximo = sacar(calendarios[i], (p) => p.estado !== 'post', porFecha);
    const ultimo = sacar(resultados[i], (p) => p.estado === 'post', (a, b) => b.fecha - a.fecha);
    return `<section class="tarjeta">
      <a class="bloque-cab" href="#/equipo/${enc(f.liga)}/${enc(f.id)}"><span class="celda-equipo">${escudo(f.logo)}${esc(f.nombre)}</span><small>Ver equipo ›</small></a>
      ${ultimo ? `<div class="sub-cab">Último partido</div>${filaPartido(ultimo, true)}` : ''}
      ${proximo ? `<div class="sub-cab">Próximo partido</div>${filaPartido(proximo, true)}` : ''}
    </section>`;
  }).join('');

  return { html: `<h1 class="titulo-seccion">⭐ Mis equipos</h1><div class="dos-columnas">${tarjetas}</div>` };
}

/* =========================================================
   VISTAS DE ERROR
   ========================================================= */
async function vistaNoEncontrada() {
  return { html: `${vacio('Esta página no existe.', '🤷')}<p style="text-align:center"><a class="boton" href="#/">Ir al inicio</a></p>` };
}

function vistaError() {
  return `${vacio('No se pudieron cargar los datos. Revisa tu conexión a internet.', '📡')}
    <p style="text-align:center"><button class="boton" type="button" data-accion="reintentar">Reintentar</button></p>`;
}
