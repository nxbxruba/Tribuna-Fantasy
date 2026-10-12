'use strict';

/* =========================================================
   MENÚ LATERAL (botón de tres líneas ☰)
   ========================================================= */
const cajon = document.getElementById('cajon');
const botonMenu = document.getElementById('abrir-menu');
const CORREO_CONTACTO = 'rubenitus3021@gmail.com';

// Enlace para cambiar de idioma (recarga la página en el otro idioma)
const htmlCambioIdioma = (clase = '') =>
  `<a class="${clase}" href="${esc(urlOtroIdioma())}" data-idioma="${EN ? 'es' : 'en'}" hreflang="${EN ? 'es' : 'en'}" lang="${EN ? 'es' : 'en'}">🌐 ${EN ? 'Español' : 'English'}</a>`;

function htmlCajon() {
  const item = (href, icono, texto) => `<a href="${href}"><span class="icono-item">${icono}</span>${esc(texto)}</a>`;
  return `<div class="cajon-cab">
      <span class="marca"><img class="logo" src="/iconos/logo.svg" alt="" width="30" height="30">InfoFut <span>Fantasy</span></span>
      <button class="boton-icono" type="button" id="cerrar-menu" aria-label="${L('Cerrar menú', 'Close menu')}">✕</button>
    </div>
    <div class="cajon-seccion cajon-idioma">${htmlCambioIdioma()}</div>
    <div class="cajon-seccion">
      ${item('/', '🏠', L('Inicio', 'Home'))}
      ${item('/buscar', '🔍', L('Buscar', 'Search'))}
      ${item('/favoritos', '⭐', L('Mis equipos', 'My teams'))}
      ${item('/noticias', '📰', L('Noticias', 'News'))}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">${L('Ligas', 'Leagues')}</div>
      ${item('/ligas', '🏆', L('Todas las ligas', 'All leagues'))}
      ${GRUPOS_LIGAS.map((g, i) => `<details ${i === 0 ? 'open' : ''}>
        <summary><span class="icono-item">${['🏟️', '⭐', '🏆', '🌍', '🌎', '🌐'][i] || '🏆'}</span>${esc(nombreGrupo(g))}</summary>
        ${g.ligas.map((l) => buscarLiga(l.id)).map((l) => `<a href="/liga/${l.id}/partidos">${esc(l.nombre)}<small>${esc(l.pais)}</small></a>`).join('')}
      </details>`).join('')}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">${L('Mercado de fichajes', 'Transfer market')}</div>
      ${item('/fichajes/ultima-hora', '⚡', L('Última hora LaLiga', 'LaLiga latest'))}
      ${item('/fichajes/ultimos', '🔄', L('Últimos fichajes', 'Latest transfers'))}
      ${item('/fichajes/rumores', '🗣️', L('Rumores', 'Rumours'))}
      ${item('/fichajes/noticias', '🗞️', L('Noticias de fichajes', 'Transfer news'))}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">Fantasy LaLiga</div>
      ${item('/fantasy/mercado', '📈', L('Subidas y bajadas', 'Risers and fallers'))}
      ${item('/fantasy/jugadores', '💰', L('Precios de jugadores', 'Player prices'))}
      ${item('/fantasy/once', '⭐', L('Once ideal y chollos', 'Best XI and bargains'))}
      ${item('/fantasy/lesionados', '🏥', L('Parte médico', 'Injuries'))}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">${L('Más', 'More')}</div>
      ${item('/ajustes', '⚙️', L('Ajustes', 'Settings'))}
      ${item(`mailto:${CORREO_CONTACTO}`, '✉️', L('Contacto', 'Contact'))}
      <button class="cajon-boton oculto" type="button" data-accion="instalar"><span class="icono-item">📲</span>${L('Instalar app', 'Install app')}</button>
    </div>`;
}

function abrirMenu() {
  document.body.classList.add('cajon-abierto');
  botonMenu.setAttribute('aria-expanded', 'true');
  document.getElementById('cerrar-menu')?.focus();
}

function cerrarMenu() {
  if (!document.body.classList.contains('cajon-abierto')) return;
  document.body.classList.remove('cajon-abierto');
  botonMenu.setAttribute('aria-expanded', 'false');
}

// Marca la opción del menú de la página actual y actualiza los enlaces de cambio de idioma
function marcarCajon() {
  const actual = rutaActual();
  cajon.querySelectorAll('a').forEach((a) => {
    if (a.dataset.idioma) return;
    const href = (a.getAttribute('href') || '').replace(/^\/en(?=\/|$)/, '') || '/';
    const activo = href === '/' ? actual === '/' : actual.startsWith(href);
    a.classList.toggle('activo', activo);
  });
  document.querySelectorAll('[data-idioma]').forEach((a) => a.setAttribute('href', urlOtroIdioma()));
}

function iniciarMenu() {
  cajon.innerHTML = htmlCajon();
  ajustarEnlaces(cajon);
  botonMenu.addEventListener('click', abrirMenu);
  document.getElementById('velo').addEventListener('click', cerrarMenu);
  cajon.addEventListener('click', (e) => {
    if (e.target.closest('#cerrar-menu') || e.target.closest('a')) cerrarMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(); });
}

/* =========================================================
   TEMA (claro / oscuro / automático)
   ========================================================= */
function aplicarTema(tema) {
  if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
  almacen.guardar('tema', tema);
}

/* =========================================================
   INSTALAR COMO APP (PWA)
   ========================================================= */
let avisoInstalacion = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  avisoInstalacion = e;
  document.querySelectorAll('[data-accion="instalar"]').forEach((b) => b.classList.remove('oculto'));
});
window.addEventListener('appinstalled', () => {
  avisoInstalacion = null;
  avisar(L('¡App instalada!', 'App installed!'));
});

async function instalarApp() {
  if (!avisoInstalacion) {
    irA('/ajustes');
    return;
  }
  avisoInstalacion.prompt();
  await avisoInstalacion.userChoice.catch(() => null);
  avisoInstalacion = null;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-accion="instalar"]')) instalarApp();
  // Al cambiar de idioma se recuerda, para que la app instalada abra en ese idioma
  const cambio = e.target.closest('[data-idioma]');
  if (cambio) almacen.guardar('idioma', cambio.dataset.idioma);
});

/* =========================================================
   VISTA: AJUSTES
   ========================================================= */
async function vistaAjustes() {
  const tema = almacen.leer('tema', 'auto');
  const seleccion = new Set(ligasInicio().map((l) => l.id));
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return {
    html: `<h1 class="titulo-seccion">⚙️ ${L('Ajustes', 'Settings')}</h1>
      <h2 class="titulo-seccion" style="font-size:15px">${L('Idioma', 'Language')}</h2>
      <section class="tarjeta relleno">
        <div class="fila-botones">
          <span class="boton principal">✓ ${EN ? 'English' : 'Español'}</span>
          ${htmlCambioIdioma('boton')}
        </div>
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">${L('Apariencia', 'Appearance')}</h2>
      <section class="tarjeta">
        ${[['auto', L('Automático (como el móvil)', 'Automatic (like your device)')], ['light', L('Claro', 'Light')], ['dark', L('Oscuro', 'Dark')]].map(([v, t]) =>
          `<label class="opcion"><input type="radio" name="tema" value="${v}" ${tema === v ? 'checked' : ''}>${t}</label>`).join('')}
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">${L('Ligas que salen en el inicio', 'Leagues shown on the home page')}</h2>
      <p class="nota">${L('Menos ligas = el inicio carga más rápido.', 'Fewer leagues = faster home page.')}</p>
      <div class="fila-botones" style="margin-bottom:12px">
        <button class="boton" type="button" id="ligas-todas">${L('Marcar todas', 'Select all')}</button>
        <button class="boton" type="button" id="ligas-ninguna">${L('Quitar todas', 'Clear all')}</button>
      </div>
      <section class="tarjeta">
        ${LIGAS.map((l) => `<label class="opcion"><input type="checkbox" value="${l.id}" data-liga ${seleccion.has(l.id) ? 'checked' : ''}>${esc(l.nombre)} <small class="texto-suave">${esc(l.pais)}</small></label>`).join('')}
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">${L('Instalar en el móvil', 'Install on your phone')}</h2>
      <section class="tarjeta relleno">
        <p style="margin-top:0">${L('Instala InfoFut Fantasy en tu pantalla de inicio para abrirla como una app.', 'Add InfoFut Fantasy to your home screen to open it like an app.')}</p>
        <button class="boton principal ${avisoInstalacion ? '' : 'oculto'}" type="button" data-accion="instalar">📲 ${L('Instalar app', 'Install app')}</button>
        <p class="nota" style="margin:12px 0 0">${esIOS
          ? L('En iPhone: abre la web en Safari, pulsa el botón Compartir (cuadrado con flecha) y elige «Añadir a pantalla de inicio».',
            'On iPhone: open the site in Safari, tap the Share button (square with an arrow) and choose "Add to Home Screen".')
          : L('En Android: abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».',
            'On Android: open the browser menu (⋮) and choose "Install app" or "Add to Home screen".')}</p>
      </section>

      <h2 class="titulo-seccion" style="font-size:15px" id="contacto">${L('Contacto', 'Contact')}</h2>
      <section class="tarjeta relleno">
        <p style="margin-top:0">${L('¿Tienes una idea, has visto un error o quieres sugerir algo? Escríbeme:', 'Got an idea, found a bug or want to suggest something? Email me:')}</p>
        <div class="fila-botones">
          <a class="boton principal" href="mailto:${CORREO_CONTACTO}?subject=${enc('InfoFut Fantasy')}">✉️ ${esc(CORREO_CONTACTO)}</a>
          <button class="boton" type="button" id="copiar-correo">📋 ${L('Copiar correo', 'Copy email')}</button>
        </div>
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">${L('Mis datos', 'My data')}</h2>
      <section class="tarjeta relleno">
        <p style="margin-top:0" class="nota">${L('Tus equipos favoritos y ajustes se guardan solo en este dispositivo.', 'Your favourite teams and settings are only stored on this device.')}</p>
        <button class="boton peligro" type="button" id="borrar-datos">🗑️ ${L('Borrar mis datos', 'Delete my data')}</button>
      </section>`,
    alMontar() {
      app.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
        aplicarTema(r.value);
        avisar(L('Tema cambiado', 'Theme changed'));
      }));
      const casillas = [...app.querySelectorAll('[data-liga]')];
      const guardarLigas = () => {
        almacen.guardar('ligasInicio', casillas.filter((c) => c.checked).map((c) => c.value));
        avisar(L('Ligas del inicio guardadas', 'Home leagues saved'));
      };
      casillas.forEach((c) => c.addEventListener('change', guardarLigas));
      document.getElementById('ligas-todas').addEventListener('click', () => { casillas.forEach((c) => { c.checked = true; }); guardarLigas(); });
      document.getElementById('ligas-ninguna').addEventListener('click', () => { casillas.forEach((c) => { c.checked = false; }); guardarLigas(); });
      document.getElementById('copiar-correo').addEventListener('click', async () => {
        avisar((await copiarTexto(CORREO_CONTACTO)) ? L('Correo copiado', 'Email copied') : L('No se pudo copiar', 'Could not copy'));
      });
      document.getElementById('borrar-datos').addEventListener('click', () => {
        if (!confirm(L('¿Seguro? Se borrarán tus equipos favoritos y ajustes de este dispositivo.', 'Are you sure? Your favourite teams and settings on this device will be deleted.'))) return;
        ['favoritos', 'ligasInicio', 'tema', 'idioma'].forEach((k) => almacen.borrar(k));
        aplicarTema('auto');
        avisar(L('Datos borrados', 'Data deleted'));
        navegar();
      });
    },
  };
}
