'use strict';

/* =========================================================
   IDIOMA
   Español en "/", inglés en "/en/...". Cada texto de la web se
   escribe como L('texto en español', 'text in English').
   ========================================================= */
const EN = /^\/en(\/|$)/.test(location.pathname);
const L = (es, en) => (EN ? en : es);
const LOCALE = EN ? 'en-GB' : 'es-ES';
document.documentElement.lang = EN ? 'en' : 'es';

/* =========================================================
   CONFIGURACIÓN
   Para añadir o quitar ligas, edita GRUPOS_LIGAS.
   El "id" es el código de ESPN de cada competición.
   (generar-paginas.ps1 lee esta lista para crear las páginas de Google:
   mantén el mismo formato en una línea por liga, con id, nombre, pais y paisEn)
   ========================================================= */
const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const API_CLASIFICACION = 'https://site.api.espn.com/apis/v2/sports/soccer';
const API_WEB = 'https://site.web.api.espn.com/apis';
const IDIOMA = EN ? 'lang=en&region=us' : 'lang=es&region=es';
// Los datos en directo se piden sin idioma: la versión en español de ESPN llega con minutos de retraso
const DIRECTO = 'region=us';
const SEGUNDOS_ACTUALIZAR_DIRECTO = 30;

const GRUPOS_LIGAS = [
  { nombre: 'España', nombreEn: 'Spain', ligas: [
    { id: 'esp.1', nombre: 'LaLiga', pais: 'España', paisEn: 'Spain' },
    { id: 'esp.2', nombre: 'Segunda División', pais: 'España', paisEn: 'Spain' },
    { id: 'esp.copa_del_rey', nombre: 'Copa del Rey', pais: 'España', paisEn: 'Spain' },
  ] },
  { nombre: 'Grandes ligas', nombreEn: 'Top leagues', ligas: [
    { id: 'eng.1', nombre: 'Premier League', pais: 'Inglaterra', paisEn: 'England' },
    { id: 'ita.1', nombre: 'Serie A', pais: 'Italia', paisEn: 'Italy' },
    { id: 'ger.1', nombre: 'Bundesliga', pais: 'Alemania', paisEn: 'Germany' },
    { id: 'fra.1', nombre: 'Ligue 1', pais: 'Francia', paisEn: 'France' },
  ] },
  { nombre: 'Competiciones europeas', nombreEn: 'European competitions', ligas: [
    { id: 'uefa.champions', nombre: 'Champions League', pais: 'Europa', paisEn: 'Europe' },
    { id: 'uefa.europa', nombre: 'Europa League', pais: 'Europa', paisEn: 'Europe' },
    { id: 'uefa.europa.conf', nombre: 'Conference League', pais: 'Europa', paisEn: 'Europe' },
  ] },
  { nombre: 'Más ligas de Europa', nombreEn: 'More European leagues', ligas: [
    { id: 'por.1', nombre: 'Liga Portugal', pais: 'Portugal', paisEn: 'Portugal' },
    { id: 'ned.1', nombre: 'Eredivisie', pais: 'Países Bajos', paisEn: 'Netherlands' },
    { id: 'eng.2', nombre: 'Championship', pais: 'Inglaterra', paisEn: 'England' },
    { id: 'tur.1', nombre: 'Superliga', pais: 'Turquía', paisEn: 'Turkey' },
    { id: 'bel.1', nombre: 'Pro League', pais: 'Bélgica', paisEn: 'Belgium' },
    { id: 'sco.1', nombre: 'Premiership', pais: 'Escocia', paisEn: 'Scotland' },
  ] },
  { nombre: 'América', nombreEn: 'Americas', america: true, ligas: [
    { id: 'conmebol.libertadores', nombre: 'Copa Libertadores', pais: 'Sudamérica', paisEn: 'South America' },
    { id: 'mex.1', nombre: 'Liga MX', pais: 'México', paisEn: 'Mexico' },
    { id: 'arg.1', nombre: 'Liga Profesional', pais: 'Argentina', paisEn: 'Argentina' },
    { id: 'bra.1', nombre: 'Brasileirão', pais: 'Brasil', paisEn: 'Brazil' },
    { id: 'col.1', nombre: 'Primera A', pais: 'Colombia', paisEn: 'Colombia' },
    { id: 'chi.1', nombre: 'Primera División', pais: 'Chile', paisEn: 'Chile' },
    { id: 'usa.1', nombre: 'MLS', pais: 'Estados Unidos', paisEn: 'United States' },
  ] },
  { nombre: 'Selecciones y otras', nombreEn: 'National teams and others', ligas: [
    { id: 'uefa.nations', nombre: 'Nations League', pais: 'Selecciones', paisEn: 'National teams' },
    { id: 'fifa.worldq.uefa', nombre: 'Clasificación Mundial', pais: 'Selecciones UEFA', paisEn: 'UEFA national teams' },
    { id: 'ksa.1', nombre: 'Saudi Pro League', pais: 'Arabia Saudí', paisEn: 'Saudi Arabia' },
  ] },
];

// Nombres de competiciones que cambian en inglés
const NOMBRES_LIGA_EN = { 'esp.2': 'LaLiga 2', 'esp.copa_del_rey': 'Copa del Rey', 'fifa.worldq.uefa': 'World Cup Qualifying' };

// Lista plana de ligas, ya con los textos en el idioma de la página
const LIGAS = GRUPOS_LIGAS.flatMap((g) => g.ligas.map((l) => ({
  ...l,
  nombre: EN ? NOMBRES_LIGA_EN[l.id] || l.nombre : l.nombre,
  pais: EN ? l.paisEn : l.pais,
  grupo: EN ? g.nombreEn : g.nombre,
  america: !!g.america,
})));
const nombreGrupo = (g) => (EN ? g.nombreEn : g.nombre);

// Ligas de las que se sacan las noticias generales
const LIGAS_NOTICIAS = ['esp.1', 'eng.1', 'uefa.champions', 'ita.1', 'ger.1', 'fra.1', 'mex.1', 'arg.1'];

const app = document.getElementById('app');

/* =========================================================
   DIRECCIONES (rutas sin "#": /fantasy, /liga/esp.1/clasificacion...)
   En las plantillas los enlaces se escriben en español ("/fantasy");
   ajustarEnlaces() les añade "/en" cuando la página está en inglés.
   ========================================================= */
const esRutaInterna = (h) => typeof h === 'string' && h.startsWith('/') && !h.startsWith('//')
  && !/^\/(iconos|datos|js)\//.test(h) && !/\.(png|svg|jpg|json|xml|js|css|txt|webmanifest)(\?|$)/.test(h);
const tienePrefijoEn = (h) => /^\/en(\/|\?|$)/.test(h);

// Dirección en el idioma actual: enIdioma('/fantasy') -> '/en/fantasy' si la página está en inglés
function enIdioma(h) {
  if (!EN || !esRutaInterna(h) || tienePrefijoEn(h)) return h;
  return h === '/' ? '/en/' : `/en${h}`;
}

function ajustarEnlaces(raiz) {
  if (!EN || !raiz) return;
  raiz.querySelectorAll('a[href^="/"]').forEach((a) => {
    if (a.dataset.idioma) return; // botón de cambiar idioma: no se toca
    a.setAttribute('href', enIdioma(a.getAttribute('href')));
  });
}

// Ruta actual sin el prefijo de idioma: "/en/fantasy" -> "/fantasy"
function rutaActual() {
  const p = EN ? location.pathname.replace(/^\/en/, '') : location.pathname;
  return p || '/';
}

// Misma página en el otro idioma
function urlOtroIdioma() {
  const camino = rutaActual();
  const destino = EN ? camino : (camino === '/' ? '/en/' : `/en${camino}`);
  return destino + location.search;
}

/* =========================================================
   UTILIDADES
   ========================================================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const enc = encodeURIComponent;
const urlSegura = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? esc(u) : '');
const buscarLiga = (id) => LIGAS.find((l) => l.id === id);

function colorSeguro(c) {
  const m = String(c || '').replace('#', '').match(/^[0-9a-f]{6}$/i);
  return m ? '#' + m[0] : '';
}

// Quita tildes y pasa a minúsculas, para comparar nombres
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* ----- Relacionar equipos y jugadores entre fuentes (ESPN, LaLiga Fantasy, Futbol Fantasy) ----- */
// Cada web escribe los equipos distinto ("Real Betis", "betis", "RC Deportivo"...): se reducen a una clave común.
// El orden importa: "Deportivo Alavés" debe dar "alaves" y no "deportivo".
const CLAVES_EQUIPOS = [
  ['alaves', /alaves/], ['athletic', /athletic/], ['atletico', /atletico/], ['barcelona', /barcelona|barca/],
  ['betis', /betis/], ['celta', /celta/], ['deportivo', /deportivo|coruna/], ['elche', /elche/],
  ['espanyol', /espanyol/], ['getafe', /getafe/], ['levante', /levante/], ['malaga', /malaga/],
  ['osasuna', /osasuna/], ['racing', /racing/], ['rayo', /rayo/], ['real-sociedad', /sociedad/],
  ['real-madrid', /real madrid|^madrid/], ['sevilla', /sevilla/], ['valencia', /valencia/], ['villarreal', /villarreal/],
  ['mallorca', /mallorca/], ['girona', /girona/], ['las-palmas', /palmas/], ['leganes', /leganes/],
  ['valladolid', /valladolid/], ['almeria', /almeria/], ['cadiz', /cadiz/], ['granada', /granada/],
  ['oviedo', /oviedo/], ['sporting', /sporting/], ['zaragoza', /zaragoza/], ['eibar', /eibar/], ['huesca', /huesca/],
];
function claveEquipo(nombre) {
  const n = normalizar(nombre).replace(/-/g, ' ');
  const encontrada = CLAVES_EQUIPOS.find(([, patron]) => patron.test(n));
  return encontrada ? encontrada[0] : n;
}

// Palabras significativas de un nombre de jugador ("A. Batalla" -> ["batalla"]; "lamine-gueye-1" -> ["lamine","gueye"])
const palabrasNombre = (s) => normalizar(s).replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 1);

// Busca en una lista el jugador cuyo nombre más se parece. campos: función que da los nombres de cada elemento.
function buscarPorNombre(lista, nombre, campos) {
  const objetivo = palabrasNombre(nombre);
  if (!objetivo.length) return null;
  let mejor = null;
  let mejorPuntos = 0;
  let empate = false;
  for (const x of lista) {
    let puntos = 0;
    for (const texto of campos(x)) {
      const p = palabrasNombre(texto);
      if (!p.length) continue;
      const comunes = p.filter((w) => objetivo.includes(w)).length;
      const mismoApellido = p[p.length - 1] === objetivo[objetivo.length - 1] ? 1 : 0;
      puntos = Math.max(puntos, comunes * 2 + mismoApellido);
    }
    if (puntos > mejorPuntos) { mejor = x; mejorPuntos = puntos; empate = false; }
    else if (puntos === mejorPuntos && puntos > 0) empate = true;
  }
  return mejorPuntos >= 2 && !empate ? mejor : null;
}

// Pequeña caché para no pedir los mismos datos una y otra vez
const cache = new Map();
async function pedir(url, msVida = 25000) {
  const guardado = cache.get(url);
  if (guardado && Date.now() - guardado.t < msVida) return guardado.datos;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const datos = await res.json();
  cache.set(url, { t: Date.now(), datos });
  return datos;
}

/* ----- Almacenamiento en el propio móvil/navegador ----- */
const almacen = {
  leer(clave, defecto) {
    try {
      const v = localStorage.getItem('ft.' + clave);
      return v == null ? defecto : JSON.parse(v);
    } catch { return defecto; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem('ft.' + clave, JSON.stringify(valor)); } catch { /* sin espacio o bloqueado */ }
  },
  borrar(clave) {
    try { localStorage.removeItem('ft.' + clave); } catch { /* nada */ }
  },
};

/* ----- Equipos favoritos ----- */
const favoritos = {
  lista: () => almacen.leer('favoritos', []),
  es: (id) => favoritos.lista().some((f) => f.id === String(id)),
  alternar(equipo) {
    const lista = favoritos.lista();
    const i = lista.findIndex((f) => f.id === String(equipo.id));
    if (i >= 0) lista.splice(i, 1);
    else lista.push({ ...equipo, id: String(equipo.id) });
    almacen.guardar('favoritos', lista);
    return i < 0;
  },
};

/* ----- Ligas que se muestran en el inicio (Ajustes) ----- */
const ligasInicio = () => {
  const ids = almacen.leer('ligasInicio', null);
  return ids ? LIGAS.filter((l) => ids.includes(l.id)) : LIGAS;
};

/* ----- Aviso flotante ----- */
let temporizadorToast = null;
function avisar(texto) {
  const t = document.getElementById('toast');
  t.textContent = texto;
  t.classList.add('visible');
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => t.classList.remove('visible'), 2200);
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

/* ----- Fechas ----- */
const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hoy = () => inicioDia(new Date());
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mismoDia = (a, b) => inicioDia(a).getTime() === inicioDia(b).getTime();
const diferenciaDias = (a, b) => Math.round((inicioDia(a) - inicioDia(b)) / 864e5);
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

function leerYmd(s) {
  if (!/^\d{8}$/.test(s || '')) return null;
  return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
}

const fmtHora = (d) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
const fmtDiaLargo = (d) => d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDiaCorto = (d) => d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtFechaCorta = (d) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
const fmtNumero = (n, decimales = 1) => Number(n || 0).toLocaleString(LOCALE, { maximumFractionDigits: decimales });

function haceTiempo(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!Number.isFinite(min)) return '';
  if (min < 1) return L('Ahora mismo', 'Just now');
  if (min < 60) return L(`Hace ${min} min`, `${min} min ago`);
  const h = Math.round(min / 60);
  if (h < 24) return L(`Hace ${h} h`, `${h} h ago`);
  const d = Math.round(h / 24);
  return d === 1 ? L('Hace 1 día', '1 day ago') : L(`Hace ${d} días`, `${d} days ago`);
}

/* ----- Dinero ----- */
const fmtEuros = (n) => `${new Intl.NumberFormat(LOCALE).format(Math.round(n || 0))} €`;
function fmtMillones(n) {
  const v = (n || 0) / 1e6;
  return `${v.toLocaleString(LOCALE, { maximumFractionDigits: v >= 10 ? 1 : 2 })} M€`;
}
function htmlCambio(n, conMillones = false) {
  if (!n) return '<span class="cambio igual">=</span>';
  const clase = n > 0 ? 'sube' : 'baja';
  const signo = n > 0 ? '▲ +' : '▼ −';
  const valor = conMillones ? fmtMillones(Math.abs(n)) : fmtEuros(Math.abs(n));
  return `<span class="cambio ${clase}">${signo}${esc(valor)}</span>`;
}

/* =========================================================
   PIEZAS DE HTML REUTILIZABLES
   ========================================================= */
function escudo(url, clase = '') {
  const src = urlSegura(url);
  if (!src) return `<span class="escudo ${clase}"></span>`;
  return `<img class="escudo ${clase}" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

const cargando = () => '<div class="cargando"><span></span></div>';

const vacio = (texto, icono = '⚽') =>
  `<div class="vacio tarjeta"><div class="icono">${icono}</div><p>${esc(texto)}</p></div>`;

function pestanas(lista, activa, prefijo) {
  return `<nav class="pestanas">${lista.map(([id, nombre]) =>
    `<a href="${prefijo}${id}" class="${id === activa ? 'activo' : ''}">${esc(nombre)}</a>`).join('')}</nav>`;
}

const claseProbabilidad = (p) => (p >= 0.75 ? 'prob-alta' : p >= 0.5 ? 'prob-media' : 'prob-baja');
const pct = (p) => `${Math.round(p * 100)}%`;

/* =========================================================
   NOTICIAS
   ========================================================= */
async function cargarNoticias(ligas, porLiga) {
  const res = await Promise.allSettled(
    ligas.map((id) => pedir(`${API}/${id}/news?${IDIOMA}&limit=${porLiga}`, 300000)));
  const vistas = new Set();
  const articulos = [];
  res.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    for (const a of r.value.articles || []) {
      const clave = a.id || a.headline;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      articulos.push({ ...a, liga: ligas[i] });
    }
  });
  if (!articulos.length && res.every((r) => r.status === 'rejected')) throw new Error('sin noticias');
  return articulos.sort((a, b) => new Date(b.published) - new Date(a.published));
}

function tarjetaNoticia(a, compacta = false) {
  const img = urlSegura(a.images?.[0]?.url);
  const enlace = urlSegura(a.links?.web?.href);
  const liga = buscarLiga(a.liga);
  const etiqueta = enlace ? 'a' : 'div';
  const attrs = enlace ? `href="${enlace}" target="_blank" rel="noopener noreferrer"` : '';
  return `<${etiqueta} class="noticia ${compacta ? 'compacta' : ''}" ${attrs}>
    ${img ? `<img src="${img}" alt="" loading="lazy">` : '<div class="noticia-sin-img">⚽</div>'}
    <div class="noticia-texto">
      ${!compacta && liga ? `<span class="etiqueta">${esc(liga.nombre)}</span>` : ''}
      <h3>${esc(a.headline)}</h3>
      ${!compacta && a.description ? `<p>${esc(a.description)}</p>` : ''}
      <time>${esc(haceTiempo(a.published))}</time>
    </div>
  </${etiqueta}>`;
}
