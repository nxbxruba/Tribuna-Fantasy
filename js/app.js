'use strict';

/* =========================================================
   NAVEGACIÓN (rutas con #)
   Cada vista devuelve { html, vivo, alMontar }:
   - vivo: true si hay partidos en juego (se actualiza sola)
   - alMontar: función que se ejecuta tras pintar (botones, campos...)
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
  fichajes: ([pestana], q) => vistaFichajes(pestana || 'ultimos', q),
  ajustes: () => vistaAjustes(),
};

let temporizadorDirecto = null;
let turnoActual = 0;

function leerRuta() {
  const [ruta, consulta = ''] = location.hash.replace(/^#/, '').split('?');
  const partes = ruta.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { partes, params: new URLSearchParams(consulta) };
}

function marcarMenu(partes) {
  const seccion = partes[0] || 'inicio';
  document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('activo', a.dataset.seccion === seccion));
  marcarCajon();
}

async function pintar(vista, turno) {
  const { html, vivo, alMontar } = await vista();
  if (turno !== turnoActual) return; // el usuario ya cambió de página
  // No repintar mientras se escribe en un campo
  if (temporizadorDirecto && app.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')) return;
  app.innerHTML = html;
  alMontar?.();
  if (vivo && !temporizadorDirecto) {
    // Actualiza sola la página mientras haya partidos en juego
    temporizadorDirecto = setInterval(() => {
      pintar(vista, turno).catch(() => {});
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
    await pintar(() => ruta(partes.slice(1), params), turno);
  } catch (err) {
    console.error(err);
    if (turno === turnoActual) app.innerHTML = vistaError();
  }
}

/* =========================================================
   ARRANQUE
   ========================================================= */
iniciarMenu();

app.addEventListener('click', (e) => {
  if (e.target.closest('[data-accion="reintentar"]')) {
    cache.clear();
    navegar();
  }
});

window.addEventListener('hashchange', navegar);
navegar();

// Funcionamiento sin conexión e instalación (solo cuando la web está publicada)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
