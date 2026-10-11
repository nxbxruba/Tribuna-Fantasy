'use strict';

/* =========================================================
   MENÚ LATERAL (botón de tres líneas ☰)
   ========================================================= */
const cajon = document.getElementById('cajon');
const botonMenu = document.getElementById('abrir-menu');

function htmlCajon() {
  const item = (href, icono, texto) => `<a href="${href}"><span class="icono-item">${icono}</span>${esc(texto)}</a>`;
  return `<div class="cajon-cab">
      <span class="marca"><img class="logo" src="iconos/logo.svg" alt="" width="30" height="30">Tribuna <span>Fantasy</span></span>
      <button class="boton-icono" type="button" id="cerrar-menu" aria-label="Cerrar menú">✕</button>
    </div>
    <div class="cajon-seccion">
      ${item('#/', '🏠', 'Inicio')}
      ${item('#/buscar', '🔍', 'Buscar')}
      ${item('#/favoritos', '⭐', 'Mis equipos')}
      ${item('#/noticias', '📰', 'Noticias')}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">Ligas</div>
      ${item('#/ligas', '🏆', 'Todas las ligas')}
      ${GRUPOS_LIGAS.map((g, i) => `<details ${i === 0 ? 'open' : ''}>
        <summary><span class="icono-item">${['🏟️', '⭐', '🏆', '🌍', '🌎', '🌐'][i] || '🏆'}</span>${esc(g.nombre)}</summary>
        ${g.ligas.map((l) => `<a href="#/liga/${l.id}/partidos">${esc(l.nombre)}<small>${esc(l.pais)}</small></a>`).join('')}
      </details>`).join('')}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">Mercado de fichajes</div>
      ${item('#/fichajes/ultimos', '🔄', 'Últimos fichajes')}
      ${item('#/fichajes/rumores', '🗣️', 'Rumores')}
      ${item('#/fichajes/noticias', '🗞️', 'Noticias de fichajes')}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">Fantasy LaLiga</div>
      ${item('#/fantasy/mercado', '📈', 'Subidas y bajadas')}
      ${item('#/fantasy/jugadores', '💰', 'Precios de jugadores')}
      ${item('#/fantasy/once', '⭐', 'Once ideal y chollos')}
      ${item('#/fantasy/lesionados', '🏥', 'Parte médico')}
    </div>
    <div class="cajon-seccion">
      <div class="cajon-titulo">Más</div>
      ${item('#/ajustes', '⚙️', 'Ajustes')}
      <button class="cajon-boton oculto" type="button" data-accion="instalar"><span class="icono-item">📲</span>Instalar app</button>
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

function marcarCajon() {
  const actual = location.hash || '#/';
  cajon.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href');
    const activo = href === '#/' ? actual === '#/' || actual.startsWith('#/?') : actual.startsWith(href);
    a.classList.toggle('activo', activo);
  });
}

function iniciarMenu() {
  cajon.innerHTML = htmlCajon();
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
  avisar('¡App instalada!');
});

async function instalarApp() {
  if (!avisoInstalacion) {
    location.hash = '#/ajustes';
    return;
  }
  avisoInstalacion.prompt();
  await avisoInstalacion.userChoice.catch(() => null);
  avisoInstalacion = null;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-accion="instalar"]')) instalarApp();
});

/* =========================================================
   VISTA: AJUSTES
   ========================================================= */
async function vistaAjustes() {
  const tema = almacen.leer('tema', 'auto');
  const seleccion = new Set(ligasInicio().map((l) => l.id));
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return {
    html: `<h1 class="titulo-seccion">⚙️ Ajustes</h1>
      <h2 class="titulo-seccion" style="font-size:15px">Apariencia</h2>
      <section class="tarjeta">
        ${[['auto', 'Automático (como el móvil)'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) =>
          `<label class="opcion"><input type="radio" name="tema" value="${v}" ${tema === v ? 'checked' : ''}>${t}</label>`).join('')}
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">Ligas que salen en el inicio</h2>
      <p class="nota">Menos ligas = el inicio carga más rápido.</p>
      <div class="fila-botones" style="margin-bottom:12px">
        <button class="boton" type="button" id="ligas-todas">Marcar todas</button>
        <button class="boton" type="button" id="ligas-ninguna">Quitar todas</button>
      </div>
      <section class="tarjeta">
        ${LIGAS.map((l) => `<label class="opcion"><input type="checkbox" value="${l.id}" data-liga ${seleccion.has(l.id) ? 'checked' : ''}>${esc(l.nombre)} <small class="texto-suave">${esc(l.pais)}</small></label>`).join('')}
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">Instalar en el móvil</h2>
      <section class="tarjeta relleno">
        <p style="margin-top:0">Instala Tribuna Fantasy en tu pantalla de inicio para abrirla como una app.</p>
        <button class="boton principal ${avisoInstalacion ? '' : 'oculto'}" type="button" data-accion="instalar">📲 Instalar app</button>
        <p class="nota" style="margin:12px 0 0">${esIOS
          ? 'En iPhone: abre la web en Safari, pulsa el botón Compartir (cuadrado con flecha) y elige «Añadir a pantalla de inicio».'
          : 'En Android: abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».'}
          La instalación solo funciona cuando la web está publicada en internet.</p>
      </section>

      <h2 class="titulo-seccion" style="font-size:15px">Mis datos</h2>
      <section class="tarjeta relleno">
        <p style="margin-top:0" class="nota">Tus equipos favoritos y ajustes se guardan solo en este dispositivo.</p>
        <button class="boton peligro" type="button" id="borrar-datos">🗑️ Borrar mis datos</button>
      </section>`,
    alMontar() {
      app.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
        aplicarTema(r.value);
        avisar('Tema cambiado');
      }));
      const casillas = [...app.querySelectorAll('[data-liga]')];
      const guardarLigas = () => {
        almacen.guardar('ligasInicio', casillas.filter((c) => c.checked).map((c) => c.value));
        avisar('Ligas del inicio guardadas');
      };
      casillas.forEach((c) => c.addEventListener('change', guardarLigas));
      document.getElementById('ligas-todas').addEventListener('click', () => { casillas.forEach((c) => { c.checked = true; }); guardarLigas(); });
      document.getElementById('ligas-ninguna').addEventListener('click', () => { casillas.forEach((c) => { c.checked = false; }); guardarLigas(); });
      document.getElementById('borrar-datos').addEventListener('click', () => {
        if (!confirm('¿Seguro? Se borrarán tus equipos favoritos y ajustes de este dispositivo.')) return;
        ['favoritos', 'ligasInicio', 'tema'].forEach((k) => almacen.borrar(k));
        aplicarTema('auto');
        avisar('Datos borrados');
        navegar();
      });
    },
  };
}
