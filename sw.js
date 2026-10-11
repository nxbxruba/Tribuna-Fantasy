'use strict';

/* =========================================================
   SERVICE WORKER
   Guarda los archivos de la web para que abra al instante
   y funcione como app instalada. Siempre intenta primero
   internet (para tener lo último) y, sin conexión, usa la copia.
   Si cambias algún archivo, sube el número de VERSION.
   ========================================================= */
const VERSION = 'tribuna-fantasy-v4';
const ARCHIVOS = [
  './',
  'index.html',
  'estilos.css',
  'manifest.webmanifest',
  'datos/fantasy.js',
  'datos/alineaciones.js',
  'datos/fichajes.js',
  'js/nucleo.js',
  'js/partidos.js',
  'js/posible-once.js',
  'js/ligas.js',
  'js/fantasy.js',
  'js/fichajes.js',
  'js/buscar.js',
  'js/menu.js',
  'js/app.js',
  'iconos/logo.svg',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
];

self.addEventListener('install', (e) => {
  // Si falta algún archivo (p. ej. aún no hay datos), se instala igualmente
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.allSettled(ARCHIVOS.map((a) => c.add(a))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
