'use strict';

/* =========================================================
   BUSCADOR: equipos, jugadores, ligas, Fantasy y noticias
   ========================================================= */
const idDeUid = (uid, letra) => (String(uid || '').match(new RegExp(`${letra}:(\\d+)`)) || [])[1];

async function vistaBuscar(params) {
  const q = (params.get('q') || '').trim();
  const formulario = `<form class="busqueda" id="form-buscar" role="search">
      <input class="campo" id="texto-buscar" type="search" placeholder="Busca un equipo, jugador o liga..." value="${esc(q)}" autocomplete="off" enterkeyhint="search">
      <button class="boton principal" type="submit">Buscar</button>
    </form>`;
  const alMontar = () => {
    const campo = document.getElementById('texto-buscar');
    if (!q) campo.focus();
    document.getElementById('form-buscar').addEventListener('submit', (e) => {
      e.preventDefault();
      const texto = campo.value.trim();
      if (texto) location.hash = `#/buscar?q=${enc(texto)}`;
    });
  };

  if (q.length < 2) {
    return {
      html: `<h1 class="titulo-seccion">🔍 Buscar</h1>${formulario}
        <p class="nota">Ejemplos: <a href="#/buscar?q=Barcelona" style="color:var(--acento)">Barcelona</a>,
        <a href="#/buscar?q=Mbapp%C3%A9" style="color:var(--acento)">Mbappé</a>,
        <a href="#/buscar?q=Premier" style="color:var(--acento)">Premier</a>.</p>`,
      alMontar,
    };
  }

  const d = await pedir(`${API_WEB}/search/v2?query=${enc(q)}&limit=12&${IDIOMA}`, 300000).catch(() => ({ results: [] }));
  const de = (tipo) => (d.results || []).filter((r) => r.type === tipo).flatMap((r) => r.contents || [])
    .filter((c) => !c.sport || c.sport === 'soccer');

  const equipos = de('team').map((c) => ({ ...c, id: idDeUid(c.uid, 't') })).filter((c) => c.id);
  const jugadores = de('player').map((c) => ({ ...c, id: idDeUid(c.uid, 'a') })).filter((c) => c.id);
  const articulos = de('article').slice(0, 6);
  const nq = normalizar(q);
  const ligas = LIGAS.filter((l) => normalizar(`${l.nombre} ${l.pais}`).includes(nq));
  const fantasy = datosFantasyDisponibles()
    ? window.DATOS_FANTASY.jugadores.filter((j) => textoBusquedaFantasy(j).includes(nq)).sort((a, b) => b.precio - a.precio).slice(0, 8)
    : [];

  const bloque = (titulo, contenido) => (contenido ? `<section class="tarjeta"><div class="bloque-cab"><span>${titulo}</span></div><div class="lista-jugadores">${contenido}</div></section>` : '');

  const html = [
    bloque('🏆 Ligas', ligas.map((l) => `<a href="#/liga/${l.id}/partidos"><span class="nombre"><b>${esc(l.nombre)}</b><br><small>${esc(l.pais)}</small></span></a>`).join('')),
    bloque('🛡️ Equipos', equipos.map((c) => `<a href="#/equipo/${enc(c.defaultLeagueSlug || 'esp.1')}/${enc(c.id)}">
        ${escudo(`https://a.espncdn.com/i/teamlogos/soccer/500/${enc(c.id)}.png`)}
        <span class="nombre"><b>${esc(c.displayName)}</b>${c.subtitle ? `<br><small>${esc(c.subtitle)}</small>` : ''}</span></a>`).join('')),
    bloque('👤 Jugadores', jugadores.map((c) => `<a href="#/jugador/${enc(c.id)}">
        <img class="foto-jugador" src="https://a.espncdn.com/i/headshots/soccer/players/full/${enc(c.id)}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <span class="nombre"><b>${esc(c.displayName)}</b>${c.subtitle ? `<br><small>${esc(c.subtitle)}</small>` : ''}</span></a>`).join('')),
    bloque('💰 Fantasy LaLiga', fantasy.map((j) => filaJugadorFantasy(j)).join('')),
    bloque('📰 Noticias', articulos.map((c) => urlSegura(c.link?.web)
      ? `<a href="${urlSegura(c.link.web)}" target="_blank" rel="noopener noreferrer"><span class="nombre">${esc(c.displayName)}</span></a>` : '').join('')),
  ].join('');

  return {
    html: `<h1 class="titulo-seccion">🔍 Buscar</h1>${formulario}${html || vacio(`No hay resultados para "${q}".`, '🔍')}`,
    alMontar,
  };
}

/* =========================================================
   VISTA: JUGADOR (ficha de ESPN)
   ========================================================= */
async function vistaJugador(id) {
  const d = await pedir(`${API_WEB}/common/v3/sports/soccer/athletes/${enc(id)}?${IDIOMA}`, 600000);
  const a = d.athlete;
  if (!a) return vistaNoEncontrada();
  const equipo = a.team || {};
  const ligaSlug = d.league?.slug || a.league?.slug || 'esp.1';

  const datos = [
    ['Posición', a.position?.displayName],
    ['Edad', a.age ? `${a.age} años` : ''],
    ['Nacimiento', a.displayDOB],
    ['Nacionalidad', a.citizenship],
    ['Altura', a.displayHeight],
    ['Peso', a.displayWeight],
    ['Dorsal', a.jersey],
  ].filter(([, v]) => v);

  const estadisticas = (a.statsSummary?.statistics || []).map((s) => [s.abbreviation === 'TIT (SUP)' ? 'Titular (suplente)' : s.displayName, s.displayValue]);

  // Si juega en LaLiga, enlace a su ficha Fantasy
  let fantasy = null;
  if (ligaSlug === 'esp.1' && datosFantasyDisponibles()) {
    fantasy = buscarJugadorFantasy(jugadoresFantasyDeEquipo(equipo.displayName), a.displayName, a.jersey);
  }

  return {
    html: `<header class="cab-pagina">
        <img class="foto-grande" src="${urlSegura(a.headshot?.href) || `https://a.espncdn.com/i/headshots/soccer/players/full/${enc(id)}.png`}" alt="" onerror="this.remove()">
        <div>
          <p class="cab-sub">${esc(a.position?.displayName || '')}</p>
          <h1>${esc(a.displayName)}</h1>
          ${equipo.id ? `<a class="celda-equipo" style="margin-top:6px" href="#/equipo/${enc(ligaSlug)}/${enc(equipo.id)}">${escudo(equipo.logos?.[0]?.href)}${esc(equipo.displayName)}</a>` : ''}
        </div>
      </header>
      ${datos.length ? `<section class="tarjeta"><div class="datos-clave">${datos.map(([t, v]) => `<div class="dato"><small>${esc(t)}</small><b>${esc(v)}</b></div>`).join('')}</div></section>` : ''}
      ${estadisticas.length ? `<h2 class="titulo-seccion">${esc(a.statsSummary?.displayName || 'Estadísticas de la temporada')}</h2>
        <section class="tarjeta"><div class="datos-clave">${estadisticas.map(([t, v]) => `<div class="dato"><small>${esc(t)}</small><b>${esc(v)}</b></div>`).join('')}</div></section>` : ''}
      ${fantasy ? `<section class="tarjeta"><div class="bloque-cab"><span>💰 Fantasy LaLiga</span></div><div class="lista-jugadores">${filaJugadorFantasy(fantasy)}</div></section>` : ''}`,
  };
}
