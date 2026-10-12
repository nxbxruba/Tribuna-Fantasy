'use strict';

/* =========================================================
   NAVEGACIÓN con direcciones de verdad: /fantasy, /liga/esp.1/clasificacion...
   (en inglés llevan delante /en). Los enlaces internos se abren sin recargar.
   Cada vista devuelve { html, vivo, alMontar, titulo, descripcion }:
   - vivo: true si hay partidos en juego (se actualiza sola)
   - alMontar: función que se ejecuta tras pintar (botones, campos...)
   - titulo / descripcion: para Google en páginas sin entrada en seo.json
   ========================================================= */
const RUTAS = {
  '': (p, q) => vistaInicio(q),
  ligas: () => vistaLigas(),
  liga: ([id, pestana], q) => vistaLiga(id, pestana || 'partidos', q),
  partido: ([liga, id, pestana]) => (liga && id ? vistaPartido(liga, id, pestana || 'resumen') : vistaNoEncontrada()),
  equipo: ([liga, id, pestana]) => (liga && id ? vistaEquipo(liga, id, pestana || 'resultados') : vistaNoEncontrada()),
  jugador: ([id]) => (id ? vistaJugador(id) : vistaNoEncontrada()),
  noticias: () => vistaNoticias(),
  buscar: (p, q) => vistaBuscar(q),
  favoritos: () => vistaFavoritos(),
  fantasy: ([pestana, id], q) => (pestana === 'jugador' ? vistaFantasyJugador(id) : vistaFantasy(pestana || 'mercado', q)),
  fichajes: ([pestana], q) => vistaFichajes(pestana || 'ultima-hora', q),
  ajustes: () => vistaAjustes(),
};

let temporizadorDirecto = null;
let turnoActual = 0;

function leerRuta() {
  const partes = rutaActual().split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { partes, params: new URLSearchParams(location.search) };
}

// Ir a otra sección sin recargar la página
function irA(destino) {
  history.pushState(null, '', enIdioma(destino));
  navegar();
}

function marcarMenu(partes) {
  const seccion = partes[0] || 'inicio';
  document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('activo', a.dataset.seccion === seccion));
  marcarCajon();
}

/* ----- Títulos y descripciones para Google (seo.json, el mismo que usa generar-paginas.ps1) ----- */
const DOMINIO = 'https://infofut-fantasy.pages.dev';
let seoDatos = null;
const seoListo = fetch('/seo.json').then((r) => (r.ok ? r.json() : null)).then((d) => { seoDatos = d; }).catch(() => {});

function rellenarPlantilla(texto, liga) {
  return String(texto || '').replace(/\{liga\}/g, liga?.nombre || '').replace(/\{pais\}/g, liga?.pais || '');
}

function datosSeo(partes, vista) {
  if (!seoDatos) return null;
  const idioma = EN ? 'en' : 'es';
  const [seccion, a, b] = partes;
  // Ruta "normalizada" tal como aparece en seo.json
  let clave = '/' + partes.join('/');
  if (seccion === 'fantasy' && (!a || a === 'mercado')) clave = '/fantasy';
  if (seccion === 'fichajes' && (!a || a === 'ultima-hora')) clave = '/fichajes';
  const fija = seoDatos.rutas.find((r) => r.ruta === clave);
  if (fija) return { ...fija[idioma], ruta: fija.ruta, final: fija.ruta === '/' };
  if (seccion === 'liga' && buscarLiga(a)) {
    const pestana = b || 'partidos';
    const plantilla = seoDatos.plantillasLiga[pestana];
    if (plantilla) {
      const liga = buscarLiga(a);
      return {
        titulo: rellenarPlantilla(plantilla[idioma].titulo, liga),
        descripcion: rellenarPlantilla(plantilla[idioma].descripcion, liga),
        ruta: `/liga/${a}/${pestana}`,
      };
    }
  }
  if (vista?.titulo) return { titulo: vista.titulo, descripcion: vista.descripcion, ruta: rutaActual() };
  return null;
}

function ponerMeta(selector, atributo, valor) {
  const el = document.querySelector(selector);
  if (el && valor != null) el.setAttribute(atributo, valor);
}

function aplicarSeo(partes, vista) {
  const s = datosSeo(partes, vista);
  const titulo = s ? (s.final ? s.titulo : `${s.titulo} | InfoFut Fantasy`) : 'InfoFut Fantasy';
  document.title = titulo;
  const ruta = s?.ruta || rutaActual();
  const url = DOMINIO + (EN ? (ruta === '/' ? '/en/' : `/en${ruta}`) : ruta);
  ponerMeta('link[rel="canonical"]', 'href', url);
  ponerMeta('meta[property="og:url"]', 'content', url);
  ponerMeta('meta[property="og:title"]', 'content', titulo);
  if (s?.descripcion) {
    ponerMeta('meta[name="description"]', 'content', s.descripcion);
    ponerMeta('meta[property="og:description"]', 'content', s.descripcion);
  }
  ponerMeta('link[rel="alternate"][hreflang="es"]', 'href', DOMINIO + ruta);
  ponerMeta('link[rel="alternate"][hreflang="en"]', 'href', DOMINIO + (ruta === '/' ? '/en/' : `/en${ruta}`));
}

/* ----- Pintar una vista ----- */
async function pintar(vista, turno, partes) {
  const resultado = await vista();
  const { html, vivo, alMontar } = resultado;
  if (turno !== turnoActual) return; // el usuario ya cambió de página
  // No repintar mientras se escribe en un campo
  if (temporizadorDirecto && app.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')) return;
  app.innerHTML = html;
  ajustarEnlaces(app);
  alMontar?.();
  seoListo.then(() => { if (turno === turnoActual) aplicarSeo(partes, resultado); });
  if (vivo && !temporizadorDirecto) {
    // Actualiza sola la página mientras haya partidos en juego
    temporizadorDirecto = setInterval(() => {
      pintar(vista, turno, partes).catch(() => {});
    }, SEGUNDOS_ACTUALIZAR_DIRECTO * 1000);
  }
}

async function navegar() {
  clearInterval(temporizadorDirecto);
  temporizadorDirecto = null;
  const turno = ++turnoActual;
  const { partes, params } = leerRuta();
  marcarMenu(partes);
  window.scrollTo(0, 0);
  app.innerHTML = cargando();
  const ruta = RUTAS[partes[0] || ''] || (() => vistaNoEncontrada());
  try {
    await pintar(() => ruta(partes.slice(1), params), turno, partes);
  } catch (err) {
    console.error(err);
    if (turno === turnoActual) app.innerHTML = vistaError();
  }
}

/* =========================================================
   ARRANQUE
   ========================================================= */
// La app instalada abre en el idioma que eligió la persona
const esAppInstalada = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
if (esAppInstalada && !EN && location.pathname === '/' && almacen.leer('idioma', 'es') === 'en') {
  location.replace('/en/' + location.search);
}

// Enlaces antiguos con "#/" (p. ej. compartidos antes del cambio): se pasan a la dirección nueva
if (location.hash.startsWith('#/')) {
  history.replaceState(null, '', enIdioma(location.hash.slice(1) || '/'));
}

// Textos fijos de la página (cabecera, pie...) en inglés
if (EN) {
  document.querySelectorAll('[data-en]').forEach((el) => { el.textContent = el.dataset.en; });
  document.querySelectorAll('[data-en-aria]').forEach((el) => {
    el.setAttribute('aria-label', el.dataset.enAria);
    if (el.title) el.title = el.dataset.enAria;
  });
}
ajustarEnlaces(document.querySelector('.cabecera'));

iniciarMenu();

// Los enlaces internos cambian de sección sin recargar la página
document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.idioma) return;
  const href = a.getAttribute('href');
  if (!esRutaInterna(href)) return;
  if (tienePrefijoEn(href) !== EN) return; // cambio de idioma: recarga normal
  e.preventDefault();
  if (href !== location.pathname + location.search) history.pushState(null, '', href);
  navegar();
});

app.addEventListener('click', (e) => {
  if (e.target.closest('[data-accion="reintentar"]')) {
    cache.clear();
    navegar();
  }
});

window.addEventListener('popstate', navegar);
navegar();

/* =========================================================
   ACTUALIZAR (importante cuando está instalada como app:
   no hay barra del navegador para recargar)
   ========================================================= */
async function refrescarApp() {
  document.getElementById('refrescar')?.classList.add('girando');
  cache.clear();
  // Si hay una versión nueva de la web, se descarga antes de recargar
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    await registro?.update();
  } catch { /* sin service worker */ }
  location.reload();
}

document.getElementById('refrescar').addEventListener('click', refrescarApp);

// Al volver a la app tras más de 5 minutos en segundo plano, se recarga sola
const MINUTOS_PARA_RECARGAR = 5;
let ocultaDesde = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    ocultaDesde = Date.now();
  } else if (ocultaDesde && Date.now() - ocultaDesde > MINUTOS_PARA_RECARGAR * 60000) {
    refrescarApp();
  }
});

// Funcionamiento sin conexión e instalación (solo cuando la web está publicada)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}
