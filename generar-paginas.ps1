# =========================================================
#  GENERAR PAGINAS PARA GOOGLE
#  Crea una copia de index.html para cada seccion e idioma
#  (/fantasy, /en/fantasy, /liga/esp.1/clasificacion...) con su
#  propio titulo, descripcion y texto, y el sitemap.xml completo.
#  Lo ejecuta GitHub Actions al publicar:  .\generar-paginas.ps1 -Dist dist
#  Los textos salen de seo.json y las ligas de js/nucleo.js.
# =========================================================
param([string]$Dist = 'dist')

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$seo = [IO.File]::ReadAllText((Join-Path $raiz 'seo.json'), $utf8) | ConvertFrom-Json
$base = [IO.File]::ReadAllText((Join-Path $Dist 'index.html'), $utf8)
$dominio = $seo.dominio

# ----- Ligas (de js/nucleo.js) -----
$nucleo = [IO.File]::ReadAllText((Join-Path $raiz 'js\nucleo.js'), $utf8)
$nombresEn = @{}
$bloqueEn = [regex]::Match($nucleo, 'const NOMBRES_LIGA_EN = \{([^}]*)\}').Groups[1].Value
foreach ($m in [regex]::Matches($bloqueEn, "'([^']+)': '([^']+)'")) { $nombresEn[$m.Groups[1].Value] = $m.Groups[2].Value }
$ligas = @(foreach ($m in [regex]::Matches($nucleo, "\{ id: '([a-z0-9._]+)', nombre: '([^']+)', pais: '([^']+)', paisEn: '([^']+)' \}")) {
  $id = $m.Groups[1].Value
  [pscustomobject]@{
    id       = $id
    nombreEs = $m.Groups[2].Value
    nombreEn = if ($nombresEn.ContainsKey($id)) { $nombresEn[$id] } else { $m.Groups[2].Value }
    paisEs   = $m.Groups[3].Value
    paisEn   = $m.Groups[4].Value
  }
})
if (-not $ligas.Count) { throw 'No se encontraron ligas en js/nucleo.js' }

# Escapa solo los caracteres especiales de HTML (las tildes se dejan tal cual)
function Codificar([string]$t) { $t.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;') }

function Url([string]$ruta, [string]$idioma) {
  if ($idioma -eq 'en') { if ($ruta -eq '/') { return "$dominio/en/" } return "$dominio/en$ruta" }
  return "$dominio$ruta"
}

# Sustituye el texto entre dos marcas (sin expresiones regulares, para no tocar caracteres especiales)
function Reemplazar-Bloque([string]$html, [string]$inicio, [string]$fin, [string]$nuevo) {
  $a = $html.IndexOf($inicio)
  $b = $html.IndexOf($fin)
  if ($a -lt 0 -or $b -lt $a) { throw "No se encontraron las marcas $inicio y $fin en index.html" }
  return $html.Substring(0, $a + $inicio.Length) + $nuevo + $html.Substring($b)
}

$paginas = New-Object System.Collections.ArrayList

function Escribir-Pagina([string]$ruta, [string]$idioma, [string]$titulo, [string]$descripcion, [string]$h1, [string]$texto) {
  $tituloCompleto = if ($ruta -eq '/') { $titulo } else { "$titulo | InfoFut Fantasy" }
  $locale = if ($idioma -eq 'en') { 'en_GB' } else { 'es_ES' }
  $seoHtml = @"

  <title>$(Codificar $tituloCompleto)</title>
  <meta name="description" content="$(Codificar $descripcion)">
  <link rel="canonical" href="$(Url $ruta $idioma)">
  <link rel="alternate" hreflang="es" href="$(Url $ruta 'es')">
  <link rel="alternate" hreflang="en" href="$(Url $ruta 'en')">
  <link rel="alternate" hreflang="x-default" href="$(Url $ruta 'es')">
  <meta property="og:title" content="$(Codificar $tituloCompleto)">
  <meta property="og:description" content="$(Codificar $descripcion)">
  <meta property="og:url" content="$(Url $ruta $idioma)">
  <meta property="og:locale" content="$locale">

"@
  $introHtml = @"

    <h1 class="titulo-seccion">$(Codificar $h1)</h1>
    <p class="nota">$(Codificar $texto)</p>

"@
  $html = Reemplazar-Bloque $base '<!--seo-->' '<!--/seo-->' $seoHtml
  $html = Reemplazar-Bloque $html '<!--intro-->' '<!--/intro-->' $introHtml
  $html = $html.Replace('<html lang="es">', "<html lang=""$idioma"">")

  $carpeta = $Dist
  if ($idioma -eq 'en') { $carpeta = Join-Path $carpeta 'en' }
  foreach ($parte in ($ruta.Trim('/') -split '/' | Where-Object { $_ })) { $carpeta = Join-Path $carpeta $parte }
  New-Item -ItemType Directory -Force $carpeta | Out-Null
  [IO.File]::WriteAllText((Join-Path $carpeta 'index.html'), $html, $utf8)
}

# ----- Secciones fijas (seo.json) -----
foreach ($r in $seo.rutas) {
  foreach ($idioma in 'es', 'en') {
    $t = $r.$idioma
    $h1 = if ($t.h1) { $t.h1 } else { $t.titulo }
    $texto = if ($t.texto) { $t.texto } else { $t.descripcion }
    Escribir-Pagina $r.ruta $idioma $t.titulo $t.descripcion $h1 $texto
  }
  [void]$paginas.Add(@($r.ruta, $r.prioridad))
}

# ----- Paginas de cada liga y pestana -----
$pestanas = @($seo.plantillasLiga.PSObject.Properties | ForEach-Object { $_.Name })
foreach ($liga in $ligas) {
  foreach ($pestana in $pestanas) {
    $plantilla = $seo.plantillasLiga.$pestana
    $ruta = "/liga/$($liga.id)/$pestana"
    foreach ($idioma in 'es', 'en') {
      $nombre = if ($idioma -eq 'en') { $liga.nombreEn } else { $liga.nombreEs }
      $pais = if ($idioma -eq 'en') { $liga.paisEn } else { $liga.paisEs }
      $titulo = $plantilla.$idioma.titulo.Replace('{liga}', $nombre).Replace('{pais}', $pais)
      $descripcion = $plantilla.$idioma.descripcion.Replace('{liga}', $nombre).Replace('{pais}', $pais)
      Escribir-Pagina $ruta $idioma $titulo $descripcion $titulo $descripcion
    }
    $prioridad = if ($pestana -eq 'partidos' -or $pestana -eq 'clasificacion') { '0.6' } else { '0.5' }
    [void]$paginas.Add(@($ruta, $prioridad))
  }
}

# ----- sitemap.xml (cada pagina en los dos idiomas, enlazadas entre si) -----
$hoy = (Get-Date).ToString('yyyy-MM-dd')
$xml = New-Object System.Text.StringBuilder
[void]$xml.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$xml.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">')
foreach ($p in $paginas) {
  $ruta = $p[0]
  foreach ($idioma in 'es', 'en') {
    [void]$xml.AppendLine('  <url>')
    [void]$xml.AppendLine("    <loc>$(Url $ruta $idioma)</loc>")
    [void]$xml.AppendLine("    <xhtml:link rel=""alternate"" hreflang=""es"" href=""$(Url $ruta 'es')""/>")
    [void]$xml.AppendLine("    <xhtml:link rel=""alternate"" hreflang=""en"" href=""$(Url $ruta 'en')""/>")
    [void]$xml.AppendLine("    <xhtml:link rel=""alternate"" hreflang=""x-default"" href=""$(Url $ruta 'es')""/>")
    [void]$xml.AppendLine("    <lastmod>$hoy</lastmod>")
    [void]$xml.AppendLine("    <priority>$($p[1])</priority>")
    [void]$xml.AppendLine('  </url>')
  }
}
[void]$xml.AppendLine('</urlset>')
[IO.File]::WriteAllText((Join-Path $Dist 'sitemap.xml'), $xml.ToString(), $utf8)

Write-Host ("Paginas generadas: {0} secciones x 2 idiomas = {1} paginas. Sitemap con {1} direcciones." -f $paginas.Count, ($paginas.Count * 2))
