# InfoFut Fantasy

Web/app de fútbol para móvil y ordenador: resultados en directo, 26 ligas, posible 11 comparando fuentes,
fichajes y rumores al día y Fantasy de LaLiga con valores oficiales. Se instala como una app y es **gratis**.

## Cómo abrirla

En **https://infofut-fantasy.pages.dev** (español) o **https://infofut-fantasy.pages.dev/en/** (inglés).

Abrir `index.html` con doble clic ya **no funciona**: la web usa direcciones de verdad
(`/fantasy`, `/liga/esp.1/clasificacion`...) y necesita estar publicada (o servida con un servidor).

## Direcciones e idiomas

- Cada sección tiene su dirección: `/fantasy`, `/fichajes`, `/liga/esp.1/clasificacion`, `/partido/...`
  Los enlaces antiguos con `#/` siguen funcionando: se convierten solos.
- **Inglés**: las mismas direcciones con `/en` delante (`/en/fantasy`). Se cambia desde el menú ☰
  (arriba del todo) o en Ajustes → Idioma. La app instalada recuerda el idioma elegido.
- Cada texto de la web está escrito como `L('español', 'English')` en los archivos de `js/`.
- **Google**: los títulos y descripciones de cada sección están en `seo.json`. Al publicar,
  `generar-paginas.ps1` crea una página por sección e idioma (282 en total) y el `sitemap.xml`.

## Qué tiene

| Sección | Dónde | Qué hace |
|---|---|---|
| Inicio | 🏠 | Partidos del día, filtro "En directo", tus equipos y últimas noticias |
| Menú ☰ | Arriba a la izquierda | Todas las secciones y las 26 ligas agrupadas |
| Ligas | ☰ → Ligas | Partidos, clasificación, goleadores, equipos y noticias |
| Partido | Pulsa un partido | Marcador, cronología, estadísticas, alineaciones y **posible 11** |
| Equipo | Pulsa un equipo | Resultados y próximos partidos (todas las competiciones), plantilla y **☆ Seguir** |
| Mis equipos | ☰ → Mis equipos | Último y próximo partido de tus favoritos |
| Fichajes | 🔄 | Últimos fichajes por liga, rumores y noticias |
| Fantasy | 💰 | Valores oficiales, subidas y bajadas, buscador, once ideal, chollos, parte médico |
| Buscar | 🔍 | Equipos, jugadores, ligas, jugadores Fantasy y noticias |
| Ajustes | ☰ → Ajustes | Tema claro/oscuro, ligas del inicio, instalar la app |

## De dónde salen los datos

| Datos | Fuente | Cómo llegan |
|---|---|---|
| Partidos, ligas, equipos, jugadores, noticias | ESPN | En directo, desde la web |
| Valores Fantasy, puntos, lesiones | **LaLiga Fantasy (oficial)** | `actualizar-datos.ps1` |
| Alineaciones probables (% titular) | **Futbol Fantasy** | `actualizar-datos.ps1` |
| Últimos fichajes y rumores | **Transfermarkt** | `actualizar-datos.ps1` |

Las tres últimas webs no dejan que una página las lea directamente, por eso hay un script que
las descarga y las guarda en la carpeta `datos/`.

- **En el PC:** doble clic en `Actualizar datos.bat`. La primera vez tarda unos 10 minutos
  (descarga el historial de valores de cada jugador); después, 1-2 minutos.
- **Publicada en GitHub:** se ejecuta sola cada 3 horas (ver más abajo).

## Posible 11

Compara varias fuentes:
1. **ESPN:** si la alineación oficial ya está publicada (≈1 hora antes), se muestra esa.
2. **Futbol Fantasy** (LaLiga): su % de titularidad, que tiene en cuenta entrenamientos y ruedas de prensa.
3. **Mi cálculo:** alineaciones de los últimos 5 partidos oficiales (los recientes pesan más).
4. **LaLiga Fantasy** (LaLiga): lesionados, dudas y sancionados oficiales.

El % final da un 65% de peso a Futbol Fantasy y un 35% a mi cálculo, y aplica las bajas oficiales.
La tabla "Comparativa de fuentes" enseña cada número por separado y marca con ⚠️ cuándo no coinciden.
Fuera de LaLiga solo hay "mi cálculo".

## Publicarla gratis como app (con datos que se actualizan solos)

Coste: **0 €**. Se publica igual que ValArsenal: GitHub (cuenta `nxbxruba`) + GitHub Desktop +
GitHub Actions + **Cloudflare Pages**. La dirección será `https://infofut-fantasy.pages.dev`.

1. **GitHub Desktop** → File → *Add local repository* → elige esta carpeta (`App Futbol`) →
   **Publish repository**, con el nombre `infofut-fantasy` y **sin** marcar "Keep this code private"
   (público = minutos de GitHub Actions ilimitados y gratis).
2. **Cloudflare** (https://dash.cloudflare.com):
   - *Account ID*: en **Workers & Pages**, columna de la derecha → copiar.
   - *API token*: tu perfil → **API Tokens** → *Create Token* → plantilla **Edit Cloudflare Workers**
     (incluye Cloudflare Pages) → *Continue to summary* → *Create Token* → copiar.
3. **GitHub** → repositorio `infofut-fantasy` → **Settings → Secrets and variables → Actions** →
   *New repository secret*, dos veces:
   - `CLOUDFLARE_API_TOKEN` = el token
   - `CLOUDFLARE_ACCOUNT_ID` = el Account ID
4. **Actions** → "Publicar web" → **Run workflow**. En unos minutos estará en
   `https://infofut-fantasy.pages.dev`.
5. Ábrela en el móvil e instálala: Android → menú ⋮ → **Instalar aplicación**;
   iPhone → Safari → Compartir → **Añadir a pantalla de inicio**.

A partir de ahí: cada vez que subas cambios con GitHub Desktop se vuelve a publicar, y cada 3 horas
GitHub actualiza solo Fantasy, alineaciones y fichajes (aunque tengas el PC apagado).

**¿Y en las tiendas de apps?** Google Play cuesta 25 $ (una vez) y la App Store de Apple 99 $/año.
No hace falta: la app instalada desde la web funciona igual. Si quieres un APK de Android para
pasarlo a amigos, se puede generar gratis en https://www.pwabuilder.com con la dirección de tu web.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `estilos.css` | La estructura y el diseño |
| `js/` | La lógica, un archivo por sección |
| `datos/` | Datos descargados por el script (no tocar a mano) |
| `actualizar-datos.ps1` + `Actualizar datos.bat` | Descargan Fantasy, alineaciones y fichajes |
| `.github/workflows/publicar.yml` | Publica la web y actualiza los datos en GitHub |
| `seo.json` + `generar-paginas.ps1` | Títulos para Google y páginas de cada sección e idioma |
| `iconos/`, `manifest.webmanifest`, `sw.js` | Para instalarla como app |

## Cambios fáciles

- **Añadir o quitar ligas:** en `js/nucleo.js`, edita `GRUPOS_LIGAS`.
- **Peso de cada fuente en el posible 11:** en `js/posible-once.js`, `PESO_FUTBOL_FANTASY`.
- **Color principal:** en `estilos.css`, `--acento`.
- Si cambias archivos y ya está publicada, sube el número de `VERSION` en `sw.js`.

## Aviso

ESPN, LaLiga Fantasy, Futbol Fantasy y Transfermarkt se usan de forma **no oficial**, para uso personal,
citando siempre la fuente y enlazando a ella. El script respeta lo que cada web permite en su `robots.txt`
(por eso no se usan Jornada Perfecta ni la API interna de Analítica Fantasy, que lo prohíben).
Estas fuentes pueden cambiar sin aviso. No la uses con fines comerciales ni con anuncios sin pedir permiso
o contratar un proveedor con licencia.
