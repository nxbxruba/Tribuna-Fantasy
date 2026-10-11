# =========================================================
#  ACTUALIZAR DATOS DE TRIBUNA FANTASY
#  Descarga y guarda en la carpeta "datos":
#    1. Fantasy: precios oficiales de LaLiga Fantasy (+ historial)
#    2. Alineaciones probables de Futbol Fantasy (LaLiga)
#    3. Fichajes y rumores de Transfermarkt
#  Uso en el PC: doble clic en "Actualizar datos.bat"
#  En internet: lo ejecuta GitHub Actions cada 3 horas (ver LEEME.md)
#  Funciona en Windows PowerShell 5.1 y en PowerShell 7.
# =========================================================
param([int]$MinutosHistorial = 8)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
Add-Type -AssemblyName System.Net.Http

$raiz = $PSScriptRoot
$carpeta = Join-Path $raiz 'datos'
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path $carpeta)) { New-Item -ItemType Directory $carpeta | Out-Null }

$cliente = New-Object System.Net.Http.HttpClient
$cliente.Timeout = [TimeSpan]::FromSeconds(40)
$cliente.DefaultRequestHeaders.UserAgent.ParseAdd('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')
$cliente.DefaultRequestHeaders.AcceptLanguage.ParseAdd('es-ES,es;q=0.9')

# Descarga texto con reintentos (si el servidor pide calma o falla, espera y repite)
function Descargar-Texto([string]$url) {
  for ($intento = 1; $intento -le 3; $intento++) {
    try {
      $res = $cliente.GetAsync($url).GetAwaiter().GetResult()
      $codigo = [int]$res.StatusCode
      if ($codigo -eq 200) {
        return [Text.Encoding]::UTF8.GetString($res.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult())
      }
      if (($codigo -eq 429 -or $codigo -ge 500) -and $intento -lt 3) {
        Start-Sleep -Seconds (15 * $intento)
        continue
      }
      throw "HTTP $codigo en $url"
    } catch {
      if ($intento -ge 3) { throw }
      Start-Sleep -Seconds (5 * $intento)
    }
  }
}

function Descargar-Json([string]$url) { Descargar-Texto $url | ConvertFrom-Json }

function Guardar-Js([string]$archivo, [string]$variable, $objeto) {
  $json = $objeto | ConvertTo-Json -Depth 8 -Compress
  $contenido = "// Generado automáticamente por actualizar-datos.ps1. No editar a mano.`nwindow.$variable = $json;`n"
  [IO.File]::WriteAllText((Join-Path $carpeta $archivo), $contenido, $utf8)
}

function Limpiar([string]$html) {
  if (-not $html) { return '' }
  $sinEtiquetas = [regex]::Replace($html, '<[^>]+>', ' ')
  return ([System.Net.WebUtility]::HtmlDecode($sinEtiquetas) -replace '\s+', ' ').Trim()
}

$ahora = (Get-Date).ToString('o')
$resumen = New-Object System.Collections.ArrayList

# =========================================================
#  1. FANTASY: LaLiga Fantasy oficial
# =========================================================
try {
  Write-Host 'Fantasy: descargando jugadores de LaLiga Fantasy...' -ForegroundColor Green
  $api = 'https://fantasy-api.llt-services.com/api'
  # (se guarda primero en una variable: en PowerShell 5.1 la lista llega como un solo elemento si se filtra directamente)
  $todosJugadores = Descargar-Json "$api/v1/competition/1/players"
  $jugadores = @($todosJugadores | Where-Object { $_.playerStatus -ne 'out_of_league' })
  $todosEquipos = Descargar-Json "$api/v3/teams-master"
  $equiposApi = @($todosEquipos | ForEach-Object { $_ })
  $semana = $null
  try { $semana = Descargar-Json "$api/v1/competition/1/week/current" } catch { }

  # Caché propia: nombre completo e historial de precios de cada jugador
  $archivoCache = Join-Path $carpeta 'cache-fantasy.json'
  $cache = @{}
  if (Test-Path $archivoCache) {
    $previo = [IO.File]::ReadAllText($archivoCache, $utf8) | ConvertFrom-Json
    foreach ($p in $previo.PSObject.Properties) {
      $h = @{}
      foreach ($q in $p.Value.h.PSObject.Properties) { $h[$q.Name] = [long]$q.Value }
      $cache[$p.Name] = @{ nombre = [string]$p.Value.nombre; h = $h }
    }
  }
  $hoy = (Get-Date).ToString('yyyy-MM-dd')
  foreach ($j in $jugadores) {
    $id = [string]$j.id
    if (-not $cache.ContainsKey($id)) { $cache[$id] = @{ nombre = ''; h = @{} } }
    $cache[$id].h[$hoy] = [long]$j.marketValue
  }

  # Historial completo de los jugadores que aún no lo tienen (los más caros primero)
  $pendientes = @($jugadores | Where-Object { $cache[[string]$_.id].h.Count -lt 3 -or -not $cache[[string]$_.id].nombre } |
    Sort-Object { [long]$_.marketValue } -Descending)
  if ($pendientes.Count) {
    Write-Host ("  Historial pendiente de {0} jugadores (máximo {1} min por ejecución)..." -f $pendientes.Count, $MinutosHistorial)
    $reloj = [Diagnostics.Stopwatch]::StartNew()
    $n = 0
    foreach ($j in $pendientes) {
      if ($reloj.Elapsed.TotalMinutes -ge $MinutosHistorial) {
        Write-Host ("  Faltan {0}: se completarán en la próxima ejecución." -f ($pendientes.Count - $n)) -ForegroundColor Yellow
        break
      }
      $n++
      $id = [string]$j.id
      try {
        # Se lee con expresiones regulares para que las fechas no cambien de zona horaria
        $texto = Descargar-Texto "$api/v1/competition/1/player/$id/market-value"
        foreach ($m in [regex]::Matches($texto, '"marketValue":(\d+),"date":"(\d{4}-\d{2}-\d{2})')) {
          $cache[$id].h[$m.Groups[2].Value] = [long]$m.Groups[1].Value
        }
        if (-not $cache[$id].nombre) {
          $detalle = Descargar-Json "$api/v1/competition/1/player/$id"
          $cache[$id].nombre = [string]$detalle.name
        }
      } catch { }
      Write-Progress -Activity 'Historial Fantasy' -Status "$n de $($pendientes.Count)" -PercentComplete (($n / $pendientes.Count) * 100)
      Start-Sleep -Milliseconds 300
    }
    Write-Progress -Activity 'Historial Fantasy' -Completed
  }

  # Guardar caché (solo los últimos 200 días)
  $limite = (Get-Date).AddDays(-200).ToString('yyyy-MM-dd')
  $paraGuardar = @{}
  foreach ($id in $cache.Keys) {
    $h = @{}
    foreach ($k in $cache[$id].h.Keys) { if ($k -ge $limite) { $h[$k] = $cache[$id].h[$k] } }
    $paraGuardar[$id] = @{ nombre = $cache[$id].nombre; h = $h }
  }
  [IO.File]::WriteAllText($archivoCache, ($paraGuardar | ConvertTo-Json -Depth 4 -Compress), $utf8)

  # Datos compactos para la web (historial de los últimos 90 días, en miles de euros)
  $todas = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($j in $jugadores) { foreach ($k in $cache[[string]$j.id].h.Keys) { [void]$todas.Add($k) } }
  $fechas = @($todas | Sort-Object | Select-Object -Last 90)

  $idsEquipos = @{}
  $lista = foreach ($j in $jugadores) {
    $id = [string]$j.id
    $idsEquipos[[string]$j.teamId] = 1
    $h = $cache[$id].h
    $serie = New-Object System.Collections.ArrayList
    foreach ($f in $fechas) { if ($h.ContainsKey($f)) { [void]$serie.Add([long][Math]::Round($h[$f] / 1000)) } else { [void]$serie.Add($null) } }
    $jornadas = New-Object System.Collections.ArrayList
    foreach ($w in @($j.weekPoints | Sort-Object { [int]$_.weekNumber })) { [void]$jornadas.Add(@([int]$w.weekNumber, [int]$w.points)) }
    [ordered]@{
      id       = $id
      nombre   = $j.nickname
      completo = $cache[$id].nombre
      equipo   = [string]$j.teamId
      pos      = [int]$j.positionId
      precio   = [long]$j.marketValue
      estado   = $j.playerStatus
      puntos   = [int]$j.points
      media    = [double]$j.averagePoints
      anterior = [int]$j.lastSeasonPoints
      jornadas = $jornadas.ToArray()
      foto     = $j.image
      h        = $serie.ToArray()
    }
  }
  $equipos = [ordered]@{}
  foreach ($e in $equiposApi) {
    if ($idsEquipos.ContainsKey([string]$e.id)) {
      $equipos[[string]$e.id] = [ordered]@{ nombre = $e.name; corto = $e.shortName; escudo = $e.badgeColor }
    }
  }

  Guardar-Js 'fantasy.js' 'DATOS_FANTASY' ([ordered]@{
    actualizado = $ahora
    fuente      = 'LaLiga Fantasy'
    jornada     = if ($semana) { $semana.weekNumber } else { $null }
    fechas      = $fechas
    equipos     = $equipos
    jugadores   = @($lista)
  })
  [void]$resumen.Add("Fantasy: $($jugadores.Count) jugadores, $($fechas.Count) días de historial")
} catch {
  [void]$resumen.Add("Fantasy: ERROR ($_). Se mantienen los datos anteriores.")
}

# =========================================================
#  2. ALINEACIONES PROBABLES: Futbol Fantasy (LaLiga)
# =========================================================
try {
  Write-Host 'Alineaciones: descargando posibles onces de Futbol Fantasy...' -ForegroundColor Green
  $portada = Descargar-Texto 'https://www.futbolfantasy.com/laliga/posibles-alineaciones'
  $slugs = @([regex]::Matches($portada, 'futbolfantasy\.com/laliga/equipos/([a-z0-9-]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
  $equiposFF = [ordered]@{}
  foreach ($slug in $slugs) {
    try {
      $url = "https://www.futbolfantasy.com/laliga/equipos/$slug"
      $html = Descargar-Texto $url
      $partido = [System.Net.WebUtility]::HtmlDecode([regex]::Match($html, '(?:Posibles alineaciones|Alineaciones probables) y previa fantasy del ([^<]+)<').Groups[1].Value.Trim())
      $vistos = @{}
      $jugadoresFF = New-Object System.Collections.ArrayList
      $posiciones = @{ 'Portero' = 'POR'; 'Defensa' = 'DEF'; 'Mediocampista' = 'MED'; 'Centrocampista' = 'MED'; 'Delantero' = 'DEL' }
      foreach ($bloque in ($html -split '<div class="jugador_' | Select-Object -Skip 1)) {
        $prob = [regex]::Match($bloque, 'data-probabilidad="(\d+)%"')
        if (-not $prob.Success) { continue }
        # Solo enlaces a la ficha del jugador (no a imágenes)
        $jug = [regex]::Match($bloque, 'href="https://www\.futbolfantasy\.com/jugadores/([^/"]+)/').Groups[1].Value
        if (-not $jug -or $vistos.ContainsKey($jug)) { continue }
        $vistos[$jug] = 1
        $titular = if ([regex]::Match($bloque, '^[^>]*data-onceFF="titular"').Success) { 1 } else { 0 }
        $pos = $posiciones[[regex]::Match($bloque, 'data-posicionLaLigaFantasy="([^"]+)"').Groups[1].Value]
        [void]$jugadoresFF.Add(@([Uri]::UnescapeDataString($jug), [int]$prob.Groups[1].Value, $titular, [string]$pos))
      }
      if ($jugadoresFF.Count) {
        $equiposFF[$slug] = [ordered]@{ partido = $partido; url = $url; jugadores = $jugadoresFF.ToArray() }
      }
    } catch { Write-Host "  No se pudo leer $slug" -ForegroundColor DarkYellow }
    Start-Sleep -Seconds 2
  }
  if (-not $equiposFF.Count) { throw 'no se encontró ninguna alineación' }
  Guardar-Js 'alineaciones.js' 'DATOS_ALINEACIONES' ([ordered]@{
    actualizado = $ahora
    fuente      = 'Futbol Fantasy'
    web         = 'https://www.futbolfantasy.com/laliga/posibles-alineaciones'
    equipos     = $equiposFF
  })
  [void]$resumen.Add("Alineaciones: $($equiposFF.Count) equipos")
} catch {
  [void]$resumen.Add("Alineaciones: ERROR ($_). Se mantienen los datos anteriores.")
}

# =========================================================
#  3. FICHAJES Y RUMORES: Transfermarkt
# =========================================================
# Filas de la tabla principal ("items") de una página de Transfermarkt
function Filas-Transfermarkt([string]$html) {
  $ini = $html.IndexOf('<table class="items">')
  if ($ini -lt 0) { return @() }
  $fin = $html.IndexOf('</tbody>', $ini)
  $tabla = $html.Substring($ini, $fin - $ini)
  return @([regex]::Split($tabla, '<tr class="(?:odd|even)">') | Select-Object -Skip 1)
}

function Datos-Comunes([string]$fila) {
  $jug = [regex]::Match($fila, '<a title="([^"]+)" href="(/[^"]+/profil/spieler/\d+)"')
  $foto = [regex]::Match($fila, '(?:data-src|src)="(https://img\.a\.transfermarkt\.technology/portrait/[^"]+)"').Groups[1].Value
  $clubes = New-Object System.Collections.ArrayList
  foreach ($m in [regex]::Matches($fila, '<a title="([^"]+)" href="/[^"]+/(?:startseite|transfers)/verein/\d+[^"]*">\s*<img src="([^"]+)"')) {
    [void]$clubes.Add([ordered]@{
      # A veces Transfermarkt repite el nombre ("Sin equipoSin equipo"): se deja una vez
      nombre = (([System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) -replace '\s+', ' ').Trim() -replace '^(.+?)\s*\1$', '$1')
      escudo = ($m.Groups[2].Value -replace '/(tiny|verysmall)/', '/head/')
    })
  }
  return [ordered]@{
    jugador  = [System.Net.WebUtility]::HtmlDecode($jug.Groups[1].Value)
    url      = if ($jug.Success) { 'https://www.transfermarkt.es' + $jug.Groups[2].Value } else { '' }
    foto     = $foto
    posicion = Limpiar ([regex]::Match($fila, '<tr>\s*<td>([^<]+)</td>\s*</tr>').Groups[1].Value)
    edad     = [regex]::Match($fila, '<td class="zentriert">(\d+)</td>').Groups[1].Value
    clubes   = $clubes.ToArray()
  }
}

try {
  Write-Host 'Fichajes: descargando de Transfermarkt...' -ForegroundColor Green
  $codigos = [ordered]@{
    'esp.1' = 'ES1'; 'eng.1' = 'GB1'; 'ita.1' = 'IT1'; 'ger.1' = 'L1'; 'fra.1' = 'FR1'
    'esp.2' = 'ES2'; 'por.1' = 'PO1'; 'ned.1' = 'NL1'; 'eng.2' = 'GB2'; 'tur.1' = 'TR1'
    'bel.1' = 'BE1'; 'sco.1' = 'SC1'; 'mex.1' = 'MEXA'; 'arg.1' = 'AR1N'; 'bra.1' = 'BRA1'
    'usa.1' = 'MLS1'; 'ksa.1' = 'SA1'
  }
  $ligas = [ordered]@{}
  foreach ($liga in $codigos.Keys) {
    try {
      $html = Descargar-Texto "https://www.transfermarkt.es/x/letztetransfers/wettbewerb/$($codigos[$liga])"
      $lista = New-Object System.Collections.ArrayList
      foreach ($fila in (Filas-Transfermarkt $html)) {
        $d = Datos-Comunes $fila
        if (-not $d.jugador -or $d.clubes.Count -lt 2) { continue }
        [void]$lista.Add([ordered]@{
          jugador  = $d.jugador; url = $d.url; foto = $d.foto; posicion = $d.posicion; edad = $d.edad
          desde    = $d.clubes[0]; hacia = $d.clubes[1]
          coste    = Limpiar ([regex]::Match($fila, '<td class="rechts hauptlink">(.*?)</td>').Groups[1].Value)
        })
      }
      if ($lista.Count) { $ligas[$liga] = $lista.ToArray() }
    } catch { Write-Host "  No se pudo leer la liga $liga" -ForegroundColor DarkYellow }
    Start-Sleep -Seconds 2
  }

  $rumores = New-Object System.Collections.ArrayList
  foreach ($pagina in 1..2) {
    try {
      $url = 'https://www.transfermarkt.es/geruechte/aktuellegeruechte/statistik'
      if ($pagina -gt 1) { $url += "?page=$pagina" }
      $html = Descargar-Texto $url
      foreach ($fila in (Filas-Transfermarkt $html)) {
        $d = Datos-Comunes $fila
        if (-not $d.jugador -or $d.clubes.Count -lt 2) { continue }
        $ligaDestino = [regex]::Matches($fila, '/wettbewerb/[A-Z0-9]+">([^<]+)</a>')
        [void]$rumores.Add([ordered]@{
          jugador      = $d.jugador; url = $d.url; foto = $d.foto; posicion = $d.posicion; edad = $d.edad
          nacionalidad = [regex]::Match($fila, '<img src="[^"]+flagge[^"]+" title="([^"]+)"').Groups[1].Value
          actual       = $d.clubes[0]
          interesado   = $d.clubes[$d.clubes.Count - 1]
          liga         = if ($ligaDestino.Count) { [System.Net.WebUtility]::HtmlDecode($ligaDestino[$ligaDestino.Count - 1].Groups[1].Value) } else { '' }
          fecha        = [regex]::Match($fila, '<td class="rechts">\s*(\d{2}\.\d{2}\.\d{4}[^<]*?)\s*</td>').Groups[1].Value
          probabilidad = Limpiar ([regex]::Match($fila, '<td class="rechts hauptlink">\s*([^<]*)').Groups[1].Value)
        })
      }
    } catch { }
    Start-Sleep -Seconds 2
  }

  if (-not $ligas.Count -and -not $rumores.Count) { throw 'no se encontró ningún fichaje' }
  Guardar-Js 'fichajes.js' 'DATOS_FICHAJES' ([ordered]@{
    actualizado = $ahora
    fuente      = 'Transfermarkt'
    ligas       = $ligas
    rumores     = $rumores.ToArray()
  })
  [void]$resumen.Add("Fichajes: $($ligas.Count) ligas, $($rumores.Count) rumores")
} catch {
  [void]$resumen.Add("Fichajes: ERROR ($_). Se mantienen los datos anteriores.")
}

Write-Host ''
Write-Host 'Resumen:' -ForegroundColor Green
foreach ($linea in $resumen) { Write-Host "  - $linea" }

# Informe de la última actualización (se publica con la web para poder revisar si algo falló)
$informe = [ordered]@{ fecha = $ahora; resumen = $resumen.ToArray() }
[IO.File]::WriteAllText((Join-Path $carpeta 'estado.json'), ($informe | ConvertTo-Json -Depth 3), $utf8)
