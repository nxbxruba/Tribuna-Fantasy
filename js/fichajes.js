'use strict';

/* =========================================================
   MERCADO DE FICHAJES
   - Últimos fichajes por liga y rumores: Transfermarkt
     (datos/fichajes.js, se actualiza con actualizar-datos.ps1).
   - Si no hay datos de Transfermarkt: traspasos de ESPN.
   - Noticias: noticias de fichajes de ESPN.
   ========================================================= */
const LIGAS_FICHAJES = ['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1', 'esp.2', 'por.1', 'ned.1', 'eng.2', 'tur.1', 'bel.1', 'sco.1', 'mex.1', 'arg.1', 'bra.1', 'usa.1', 'ksa.1'];
const FILTROS_COSTE = [['', 'Todos'], ['traspaso', 'Traspasos'], ['cesion', 'Cesiones'], ['libre', 'Libres']];
const PESTANAS_FICHAJES = [['ultima-hora', 'Última hora LaLiga'], ['ultimos', 'Últimos fichajes'], ['rumores', 'Rumores'], ['noticias', 'Noticias']];
// Tipos de movimiento de Futbol Fantasy, del más seguro al menos, con su color
const TIPOS_MOVIMIENTO = [
  ['Oficial', 'sube'], ['Cerrado', 'sube'], ['Acuerdo', 'aviso'], ['Negociación', 'aviso'],
  ['Interés', 'igual'], ['Rumor', 'igual'], ['Cedible', 'igual'], ['Cancelado', 'baja'],
];

const datosFichajes = () => window.DATOS_FICHAJES || null;

function tipoCoste(coste) {
  const c = normalizar(coste);
  if (/cesion|prestamo/.test(c)) return 'cesion';
  if (/libre|fin de contrato/.test(c)) return 'libre';
  if (/€/.test(coste)) return 'traspaso';
  return 'otro';
}

function avisoFuenteFichajes() {
  const d = datosFichajes();
  if (!d) return '';
  const viejo = (Date.now() - new Date(d.actualizado)) / 36e5 > 30;
  return `<p class="nota">${viejo ? '⚠️ ' : ''}Datos de <b>Transfermarkt</b> · actualizados ${esc(haceTiempo(d.actualizado).toLowerCase())}${viejo ? ' · Ejecuta <b>Actualizar datos.bat</b> para lo último.' : ''}</p>`;
}

const clubHtml = (c) => `<span class="celda-equipo" style="font-weight:500;gap:4px">${urlSegura(c?.escudo) ? `<img src="${urlSegura(c.escudo)}" alt="" loading="lazy">` : ''}${esc(c?.nombre || '—')}</span>`;

function filaTraspaso(t, derecha) {
  const enlace = urlSegura(t.url);
  const etiqueta = enlace ? 'a' : 'div';
  return `<${etiqueta} class="traspaso" ${enlace ? `href="${enlace}" target="_blank" rel="noopener noreferrer"` : ''}>
    ${urlSegura(t.foto) ? `<img class="foto-jugador" src="${urlSegura(t.foto)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="foto-jugador"></span>'}
    <div style="min-width:0">
      <b>${esc(t.jugador)}</b> <small>${esc([t.posicion, t.edad ? `${t.edad} años` : '', t.nacionalidad].filter(Boolean).join(' · '))}</small>
      <div class="clubes">${clubHtml(t.desde || t.actual)}<span class="texto-suave">→</span>${clubHtml(t.hacia || t.interesado)}</div>
    </div>
    <div class="coste">${derecha}</div>
  </${etiqueta}>`;
}

async function vistaFichajes(pestana, params) {
  if (pestana === 'traspasos') pestana = 'ultimos'; // enlaces antiguos
  const contenido = {
    'ultima-hora': fichajesUltimaHora, ultimos: fichajesUltimos, rumores: fichajesRumores, noticias: fichajesNoticias,
  }[pestana];
  if (!contenido) return vistaNoEncontrada();
  const r = await contenido(params);
  return {
    html: `<header class="cab-pagina"><div><p class="cab-sub">Altas, bajas y rumores</p><h1>🔄 Mercado de fichajes</h1></div></header>
      ${pestanas(PESTANAS_FICHAJES, pestana, '#/fichajes/')}${r.html}`,
  };
}

/* ----- Última hora del mercado de LaLiga (Futbol Fantasy) ----- */
function colorTipo(tipo) {
  return (TIPOS_MOVIMIENTO.find(([t]) => normalizar(t) === normalizar(tipo)) || [, 'igual'])[1];
}

async function fichajesUltimaHora(params) {
  const d = datosFichajes();
  const lista = d?.ultimaHora || [];
  if (!lista.length) {
    return { html: vacio('Todavía no hay movimientos. Ejecuta "Actualizar datos.bat" para descargarlos.', '🔄') };
  }
  const presentes = TIPOS_MOVIMIENTO.map(([t]) => t).filter((t) => lista.some((x) => x.tipo === t));
  const filtro = presentes.includes(params.get('tipo')) ? params.get('tipo') : '';
  const filtrados = lista.filter((x) => !filtro || x.tipo === filtro);

  const porDia = new Map();
  for (const x of filtrados) {
    const clave = (x.fecha || '').slice(0, 10) || 'sin-fecha';
    if (!porDia.has(clave)) porDia.set(clave, []);
    porDia.get(clave).push(x);
  }

  const viejo = d.ultimaHoraAct && (Date.now() - new Date(d.ultimaHoraAct)) / 36e5 > 30;
  const chips = `<div class="chips">
    <a class="chip ${filtro ? '' : 'activo'}" href="#/fichajes/ultima-hora">Todos</a>
    ${presentes.map((t) => `<a class="chip ${t === filtro ? 'activo' : ''}" href="#/fichajes/ultima-hora?tipo=${enc(t)}">${esc(t)}</a>`).join('')}
  </div>`;

  const tarjeta = (x) => {
    const enlace = urlSegura(x.noticia) || urlSegura(d.ultimaHoraWeb);
    const hora = (x.fecha || '').slice(11, 16);
    return `<a class="traspaso" href="${enlace}" target="_blank" rel="noopener noreferrer">
      ${urlSegura(x.foto) ? `<img class="foto-jugador" src="${urlSegura(x.foto)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="foto-jugador"></span>'}
      <div style="min-width:0">
        <b>${esc(x.jugador)}</b> <span class="cambio ${colorTipo(x.tipo)}">● ${esc(x.tipo)}</span>
        <div>${esc(x.titular)}${x.medio ? ` <small>(${esc(x.medio)})</small>` : ''}</div>
        ${x.equipos?.length ? `<div class="clubes">${x.equipos.map(clubHtml).join('<span class="texto-suave">→</span>')}</div>` : ''}
        ${x.resumen ? `<small>${esc(x.resumen)}</small>` : ''}
      </div>
      <div class="coste"><small>${esc(hora)}</small></div>
    </a>`;
  };

  return {
    html: `<p class="nota">${viejo ? '⚠️ ' : ''}Movimientos del mercado de LaLiga según <a href="${urlSegura(d.ultimaHoraWeb)}" target="_blank" rel="noopener noreferrer" style="color:var(--acento)">Futbol Fantasy</a>${d.ultimaHoraAct ? ` · actualizados ${esc(haceTiempo(d.ultimaHoraAct).toLowerCase())}` : ''}. Pulsa uno para leer la noticia.</p>
      ${chips}
      ${[...porDia].map(([dia, items]) => `<section class="tarjeta">
        <h2 class="cab-dia capital">${dia === 'sin-fecha' ? 'Sin fecha' : esc(fmtDiaLargo(new Date(dia + 'T12:00:00')))}</h2>
        ${items.map(tarjeta).join('')}
      </section>`).join('') || vacio('No hay movimientos de este tipo.', '🔄')}`,
  };
}

async function fichajesUltimos(params) {
  const d = datosFichajes();
  if (!d?.ligas || !Object.keys(d.ligas).length) return fichajesTraspasos(params); // respaldo: ESPN

  const disponibles = LIGAS_FICHAJES.filter((id) => d.ligas[id]?.length);
  const liga = disponibles.includes(params.get('liga')) ? params.get('liga') : disponibles[0];
  const tipo = params.get('tipo') || '';
  const chipsLiga = `<div class="chips">${disponibles.map((id) =>
    `<a class="chip ${id === liga ? 'activo' : ''}" href="#/fichajes/ultimos?liga=${id}${tipo ? `&tipo=${tipo}` : ''}">${esc(buscarLiga(id)?.nombre || id)}</a>`).join('')}</div>`;
  const chipsTipo = `<div class="chips">${FILTROS_COSTE.map(([k, t]) =>
    `<a class="chip ${k === tipo ? 'activo' : ''}" href="#/fichajes/ultimos?liga=${liga}${k ? `&tipo=${k}` : ''}">${t}</a>`).join('')}</div>`;

  const lista = (d.ligas[liga] || []).filter((t) => !tipo || tipoCoste(t.coste) === tipo);
  return {
    html: `${avisoFuenteFichajes()}${chipsLiga}${chipsTipo}
      <p class="nota">Los últimos movimientos de los equipos de ${esc(buscarLiga(liga)?.nombre || '')}, del más reciente al más antiguo. Pulsa uno para verlo en Transfermarkt.</p>
      ${lista.length ? `<section class="tarjeta">${lista.map((t) => filaTraspaso(t, esc(t.coste || ''))).join('')}</section>`
        : vacio('No hay fichajes de este tipo.', '🔄')}`,
  };
}

// "11.10.2026 - 17:38" -> Date
function leerFechaTransfermarkt(texto) {
  const m = String(texto || '').match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
}

async function fichajesRumores(params) {
  const d = datosFichajes();
  if (!d?.rumores?.length) {
    return { html: vacio('Todavía no hay rumores. Ejecuta "Actualizar datos.bat" para descargarlos.', '🗣️') };
  }
  // Filtro por la liga del club interesado (las más repetidas)
  const conteo = new Map();
  d.rumores.forEach((r) => r.liga && conteo.set(r.liga, (conteo.get(r.liga) || 0) + 1));
  const ligas = [...conteo].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l);
  const filtro = ligas.includes(params.get('liga')) ? params.get('liga') : '';
  const lista = d.rumores.filter((r) => !filtro || r.liga === filtro);

  const chips = `<div class="chips">
    <a class="chip ${filtro ? '' : 'activo'}" href="#/fichajes/rumores">Todos</a>
    ${ligas.map((l) => `<a class="chip ${l === filtro ? 'activo' : ''}" href="#/fichajes/rumores?liga=${enc(l)}">${esc(l)}</a>`).join('')}
  </div>`;

  return {
    html: `${avisoFuenteFichajes()}${chips}
      <p class="nota">Rumores más recientes: club actual → club interesado. La probabilidad la votan los usuarios de Transfermarkt.</p>
      <section class="tarjeta">${lista.map((r) => {
        const fecha = leerFechaTransfermarkt(r.fecha);
        const prob = /\d/.test(r.probabilidad || '') ? `${esc(r.probabilidad)}<small>probabilidad</small>` : '';
        return filaTraspaso(r, `${prob}<small>${fecha ? esc(haceTiempo(fecha)) : ''}</small>${r.liga ? `<small>${esc(r.liga)}</small>` : ''}`);
      }).join('')}</section>`,
  };
}

/* ----- Respaldo: traspasos de ESPN (si no hay datos de Transfermarkt) ----- */
const TIPOS_TRASPASO = {
  Fee: 'Traspaso',
  Loan: 'Cesión',
  Free: 'Libre',
  Undisclosed: 'Cantidad no revelada',
  'Return from loan': 'Vuelta de cesión',
};
const FILTROS_TIPO = [['', 'Todos'], ['Fee', 'Traspasos'], ['Loan', 'Cesiones'], ['Free', 'Libres']];
// Palabras que indican que una noticia trata de fichajes (sin palabras de crónica como "salida" o "firma")
const PALABRAS_FICHAJES = /fichaj|ficha por|traspas|cesi[oó]n|cedid[oa]|renueva|renovaci[oó]n|cl[aá]usula|mercado de (fichajes|invierno|verano)|transfer|nuevo club|nuevo equipo|refuerzo|negociaci[oó]n|agente libre/i;

// Prueba el año actual y, si ESPN aún no tiene datos, los anteriores
async function cargarTraspasos(ligaId) {
  const anio = new Date().getFullYear();
  for (const a of [anio, anio - 1, anio - 2]) {
    try {
      const d = await pedir(`${API}/${enc(ligaId)}/transactions?season=${a}&limit=1000`, 3600000);
      if (d.transactions?.length) return { anio: a, lista: d.transactions };
    } catch { /* se prueba el año anterior */ }
  }
  return { anio: null, lista: [] };
}

function cantidadTraspaso(t) {
  const n = Number(t.amount);
  if (!n) return '';
  return `${(n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M`;
}

async function fichajesTraspasos(params) {
  const liga = buscarLiga(params.get('liga')) || buscarLiga('esp.1');
  const tipo = params.get('tipo') || '';
  const { anio, lista } = await cargarTraspasos(liga.id);

  const chipsLiga = `<div class="chips">${LIGAS_FICHAJES.map(buscarLiga).map((l) =>
    `<a class="chip ${l.id === liga.id ? 'activo' : ''}" href="#/fichajes/traspasos?liga=${l.id}${tipo ? `&tipo=${tipo}` : ''}">${esc(l.nombre)}</a>`).join('')}</div>`;
  const chipsTipo = `<div class="chips">${FILTROS_TIPO.map(([k, t]) =>
    `<a class="chip ${k === tipo ? 'activo' : ''}" href="#/fichajes/traspasos?liga=${liga.id}${k ? `&tipo=${k}` : ''}">${t}</a>`).join('')}</div>`;

  if (!lista.length) return { html: chipsLiga + vacio('No hay traspasos disponibles para esta liga.', '🔄') };

  const filtrados = lista.filter((t) => !tipo || t.type === tipo)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 150);

  const porMes = new Map();
  for (const t of filtrados) {
    const mes = new Date(t.date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(t);
  }

  const equipo = (e) => `<span class="celda-equipo" style="font-weight:500">${escudo(e?.logos?.[0]?.href)}${esc(e?.displayName || '—')}</span>`;
  const secciones = [...porMes].map(([mes, items]) => `<section class="tarjeta">
      <h2 class="cab-dia capital">${esc(mes)}</h2>
      <div class="lista-jugadores">${items.map((t) => `<a href="#/jugador/${enc(t.athlete?.id)}" style="flex-wrap:wrap">
        <span class="nombre" style="min-width:150px"><b>${esc(t.athlete?.displayName)}</b><br>
          <small>${esc(new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))} · ${esc(TIPOS_TRASPASO[t.type] || t.type || '')}</small></span>
        <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${equipo(t.from)}<span class="texto-suave">→</span>${equipo(t.to)}</span>
        ${cantidadTraspaso(t) ? `<span class="precio">${esc(cantidadTraspaso(t))}</span>` : ''}
      </a>`).join('')}</div>
    </section>`).join('');

  const anioActual = new Date().getFullYear();
  return {
    html: `${chipsLiga}${chipsTipo}
      ${anio !== anioActual ? `<p class="nota">ℹ️ ESPN todavía no ha publicado los traspasos de ${anioActual}. Se muestran los más recientes disponibles (${anio}). Para lo último, ejecuta <b>Actualizar datos.bat</b> (descarga los fichajes de Transfermarkt) o mira la pestaña <a href="#/fichajes/noticias" style="color:var(--acento)">Noticias</a>.</p>` : ''}
      <p class="nota">Las cantidades son las que publica ESPN, en millones.</p>
      ${secciones || vacio('No hay traspasos de este tipo.', '🔄')}`,
  };
}

async function fichajesNoticias() {
  const noticias = await cargarNoticias(LIGAS_NOTICIAS, 25);
  let deFichajes = noticias.filter((a) => PALABRAS_FICHAJES.test(`${a.headline} ${a.description || ''}`));

  // Se completan con el buscador de ESPN (artículos sobre fichajes y traspasos)
  const busquedas = await Promise.allSettled(['fichajes', 'traspaso'].map((q) =>
    pedir(`${API_WEB}/search/v2?query=${q}&limit=20&${IDIOMA}`, 600000)));
  const vistos = new Set(deFichajes.map((a) => a.headline));
  for (const r of busquedas) {
    if (r.status !== 'fulfilled') continue;
    const articulos = (r.value.results || []).filter((x) => x.type === 'article').flatMap((x) => x.contents || []);
    for (const c of articulos) {
      // Solo artículos de fútbol (el buscador también devuelve NFL, NBA...)
      if (!/\/(futbol|soccer)\//.test(c.link?.web || '')) continue;
      if (!c.displayName || vistos.has(c.displayName)) continue;
      vistos.add(c.displayName);
      deFichajes.push({
        headline: c.displayName,
        description: c.description,
        links: { web: { href: c.link?.web } },
        images: urlSegura(c.image?.default) ? [{ url: c.image.default }] : [],
        published: c.date || c.lastModified,
      });
    }
  }
  deFichajes = deFichajes
    .sort((a, b) => (new Date(b.published).getTime() || 0) - (new Date(a.published).getTime() || 0))
    .slice(0, 30);
  return {
    html: deFichajes.length
      ? `<div class="noticias-rejilla">${deFichajes.map((a) => tarjetaNoticia(a)).join('')}</div>`
      : vacio('No hay noticias de fichajes ahora mismo.', '📰'),
  };
}
