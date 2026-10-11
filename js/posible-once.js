'use strict';

/* =========================================================
   POSIBLE 11 TITULAR: varias fuentes comparadas
   1. ESPN: si ya se ha publicado la alineación oficial, se muestra esa.
   2. Mi cálculo: alineaciones de los últimos 5 partidos oficiales
      (los más recientes pesan más).
   3. Futbol Fantasy (solo LaLiga): su % de titularidad, que tiene en
      cuenta entrenamientos, ruedas de prensa y prensa local.
   4. LaLiga Fantasy (solo LaLiga): lesionados, dudas y sancionados oficiales.
   El porcentaje final combina las fuentes disponibles.
   ========================================================= */
const PESOS_RECIENTES = [0.32, 0.24, 0.18, 0.14, 0.12];
const PESO_FUTBOL_FANTASY = 0.65; // el resto es mi cálculo
const GRUPOS_CAMPO = ['DEL', 'MED', 'DEF', 'POR']; // de arriba a abajo en el dibujo
const POSICION_ESPN_A_GRUPO = { Goalkeeper: 'POR', Defender: 'DEF', Midfielder: 'MED', Forward: 'DEL' };
const POSICION_FANTASY_A_GRUPO = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };

function grupoPosicion(abreviatura) {
  const a = String(abreviatura || '').toUpperCase();
  if (!a || a === 'SUB') return null;
  if (a === 'G' || a === 'GK') return 'POR';
  if (/^(CD|LB|RB|LWB|RWB|D|SW|CB)/.test(a)) return 'DEF';
  if (/^(DM|CM|AM|LM|RM|M)/.test(a)) return 'MED';
  if (/^(F|CF|LW|RW|ST|S|LF|RF)/.test(a)) return 'DEL';
  return null;
}

// Para colocar a los jugadores de izquierda a derecha
function ordenLateral(abreviatura) {
  const a = String(abreviatura || '').toUpperCase();
  if (/^L/.test(a)) return 0;
  if (/-L$/.test(a)) return 1;
  if (/-R$/.test(a)) return 3;
  if (/^R/.test(a)) return 4;
  return 2;
}

function leerFormacion(texto) {
  const n = String(texto || '').split('-').map((x) => parseInt(x, 10)).filter((x) => x > 0);
  if (n.length < 2 || n.reduce((a, b) => a + b, 0) !== 10) return { POR: 1, DEF: 4, MED: 3, DEL: 3 };
  return { POR: 1, DEF: n[0], MED: n.slice(1, -1).reduce((a, b) => a + b, 0), DEL: n[n.length - 1] };
}

const esAmistoso = (slug) => /friendly|gamper|trofeo/i.test(slug || '');

// "lamine-yamal" -> "Lamine Yamal"
const nombreDeSlug = (slug) => String(slug || '').replace(/-\d+$/, '').split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/* ----- Futbol Fantasy ----- */
function alineacionFF(nombreEquipo) {
  const equipos = window.DATOS_ALINEACIONES?.equipos;
  if (!equipos) return null;
  const clave = claveEquipo(nombreEquipo);
  const slug = Object.keys(equipos).find((k) => claveEquipo(k) === clave);
  return slug ? equipos[slug] : null;
}

// Comprueba que la alineación de Futbol Fantasy es de este partido y no de otro.
// Si Futbol Fantasy no indica el rival, se acepta solo si es el próximo partido de liga del equipo.
function esDeEstePartido(equipoFF, p, idProximoLiga) {
  if (!equipoFF) return false;
  if (!equipoFF.partido) return String(p.id) === String(idProximoLiga);
  const lados = equipoFF.partido.split(/\s+-\s+/).map(claveEquipo);
  const esperados = [claveEquipo(p.local.nombreLargo || p.local.nombre), claveEquipo(p.visitante.nombreLargo || p.visitante.nombre)];
  return lados.length === 2 && esperados.every((c) => lados.includes(c));
}

/* ----- Mi cálculo con las alineaciones recientes de ESPN ----- */
async function calculoPropio(ligaId, equipo) {
  const [calendario, plantilla, proximos] = await Promise.all([
    pedir(`${API}/all/teams/${enc(equipo.id)}/schedule?${DIRECTO}`, 600000),
    pedir(`${API}/${enc(ligaId)}/teams/${enc(equipo.id)}/roster?${IDIOMA}`, 3600000).catch(() => null),
    pedir(`${API}/${enc(ligaId)}/teams/${enc(equipo.id)}/schedule?${DIRECTO}&fixture=true`, 600000).catch(() => null),
  ]);

  const jugados = (calendario.events || [])
    .filter((ev) => !esAmistoso(ev.league?.slug))
    .map((ev) => normalizarPartido(ev, ev.league?.slug || ligaId))
    .filter((p) => p.estado === 'post')
    .sort((a, b) => b.fecha - a.fecha)
    .slice(0, PESOS_RECIENTES.length);

  // Próximo partido de liga (para saber a qué partido se refiere Futbol Fantasy)
  const proximoLiga = (proximos?.events || [])
    .map((ev) => normalizarPartido(ev, ligaId))
    .filter((p) => p.estado === 'pre')
    .sort(porFecha)[0];

  const resumenes = await Promise.allSettled(jugados.map((p) =>
    pedir(`${API}/${enc(p.liga)}/summary?event=${enc(p.id)}&${DIRECTO}`, 3600000)));

  const jugadores = new Map();
  let pesoTotal = 0;
  let formacion = null;
  resumenes.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const roster = r.value.rosters?.find((x) => x.team?.id === String(equipo.id));
    if (!roster?.roster?.length) return;
    const peso = PESOS_RECIENTES[i];
    pesoTotal += peso;
    if (!formacion && roster.formation) formacion = roster.formation;
    for (const j of roster.roster) {
      const id = j.athlete?.id;
      if (!id) continue;
      if (!jugadores.has(id)) {
        jugadores.set(id, {
          id,
          nombre: j.athlete.displayName,
          corto: j.athlete.shortName || j.athlete.displayName,
          dorsal: j.jersey,
          titular: 0,
          entro: 0,
          abreviatura: null,
        });
      }
      const x = jugadores.get(id);
      if (j.starter) {
        x.titular += peso;
        if (!x.abreviatura) x.abreviatura = j.position?.abbreviation; // la del partido más reciente
      } else if (j.subbedIn) {
        x.entro += peso;
      }
    }
  });

  // Solo jugadores que siguen en la plantilla
  const enPlantilla = new Map((plantilla?.athletes || []).map((a) => [String(a.id), a]));
  const candidatos = [...jugadores.values()]
    .filter((x) => !enPlantilla.size || enPlantilla.has(String(x.id)))
    .map((x) => {
      let prob = pesoTotal ? x.titular / pesoTotal : 0;
      if (!prob && x.entro) prob = 0.15 * (x.entro / pesoTotal);
      return {
        ...x,
        propia: 0.03 + 0.94 * prob, // nunca 0% ni 100%: siempre hay incertidumbre
        grupo: grupoPosicion(x.abreviatura) || POSICION_ESPN_A_GRUPO[enPlantilla.get(String(x.id))?.position?.name] || 'MED',
      };
    });

  return {
    candidatos,
    formacion,
    partidosAnalizados: jugados.length,
    plantilla: [...enPlantilla.values()],
    idProximoLiga: proximoLiga?.id,
  };
}

/* ----- Combinar las fuentes ----- */
async function posibleOnceEquipo(ligaId, equipo, p) {
  const { candidatos, formacion, partidosAnalizados, plantilla, idProximoLiga } = await calculoPropio(ligaId, equipo);
  const esLaLiga = ligaId === 'esp.1';
  const nombreEquipo = equipo.nombreLargo || equipo.nombre;

  // Futbol Fantasy
  let ff = esLaLiga ? alineacionFF(nombreEquipo) : null;
  if (ff && !esDeEstePartido(ff, p, idProximoLiga)) ff = null;

  // Estados oficiales de LaLiga Fantasy
  const fantasy = esLaLiga ? jugadoresFantasyDeEquipo(nombreEquipo) : [];

  const lista = candidatos.map((c) => ({ ...c, ff: null }));
  if (ff) {
    for (const [slug, probFF, , posFF] of ff.jugadores) {
      const existente = buscarPorNombre(lista, slug, (x) => [x.nombre]);
      if (existente) {
        existente.ff = probFF / 100;
      } else {
        // Jugador que Futbol Fantasy tiene en cuenta pero que no ha jugado últimamente
        const deEspn = buscarPorNombre(plantilla, slug, (a) => [a.displayName]);
        lista.push({
          id: deEspn?.id || null,
          nombre: deEspn?.displayName || nombreDeSlug(slug),
          corto: deEspn?.shortName || nombreDeSlug(slug),
          dorsal: deEspn?.jersey,
          abreviatura: null,
          grupo: posFF || POSICION_ESPN_A_GRUPO[deEspn?.position?.name] || 'MED',
          propia: null,
          ff: probFF / 100,
        });
      }
    }
  }

  for (const x of lista) {
    const oficial = fantasy.length ? buscarJugadorFantasy(fantasy, x.nombre) : null;
    x.estado = oficial?.estado || 'ok';
    let propia = x.propia;
    if (propia != null && x.estado === 'doubtful') propia *= 0.5;
    if (x.ff != null && propia != null) x.prob = PESO_FUTBOL_FANTASY * x.ff + (1 - PESO_FUTBOL_FANTASY) * propia;
    else x.prob = x.ff ?? propia ?? 0;
    // Las bajas oficiales mandan sobre cualquier estimación
    if (x.estado === 'injured') x.prob = Math.min(x.prob, 0.03);
    if (x.estado === 'suspended') x.prob = 0.01;
    x.aviso = ESTADOS_FANTASY[x.estado] || '';
  }
  lista.sort((a, b) => b.prob - a.prob);

  // Formación: la de Futbol Fantasy si tiene un once completo; si no, la del último partido
  let cupo = leerFormacion(formacion);
  let textoFormacion = formacion || '4-3-3';
  if (ff) {
    const titularesFF = ff.jugadores.filter((x) => x[2] === 1 && x[3]);
    if (titularesFF.length === 11) {
      cupo = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
      titularesFF.forEach((x) => { cupo[x[3]]++; });
      textoFormacion = `${cupo.DEF}-${cupo.MED}-${cupo.DEL}`;
    }
  }

  const once = [];
  const elegidos = new Set();
  for (const g of ['POR', 'DEF', 'MED', 'DEL']) {
    lista.filter((c) => c.grupo === g && !elegidos.has(c)).slice(0, cupo[g]).forEach((c) => { once.push(c); elegidos.add(c); });
  }
  // Si falta gente en alguna línea, se completa con los más probables de campo
  for (const c of lista) {
    if (once.length >= 11) break;
    if (!elegidos.has(c) && c.grupo !== 'POR') { once.push(c); elegidos.add(c); }
  }

  return {
    once,
    lista,
    formacion: textoFormacion,
    partidosAnalizados,
    ff,
    conFantasy: fantasy.length > 0,
    bajas: fantasy.filter((j) => ESTADOS_FANTASY[j.estado] && j.pos !== 5),
  };
}

/* ----- Dibujo ----- */
function htmlCampo(once) {
  return `<div class="campo-futbol">${GRUPOS_CAMPO.map((g) => {
    const linea = once.filter((j) => j.grupo === g).sort((a, b) => ordenLateral(a.abreviatura) - ordenLateral(b.abreviatura));
    return `<div class="linea-campo">${linea.map((j) => {
      const contenido = `<span class="circulo">${pct(j.prob)}</span>
        <span class="nombre-ficha">${esc(j.corto)}${j.aviso ? ' ⚠️' : ''}</span>`;
      const titulo = `${esc(j.nombre)}${j.aviso ? ' · ' + esc(j.aviso) : ''}`;
      return j.id
        ? `<a class="ficha ${claseProbabilidad(j.prob)}" href="#/jugador/${enc(j.id)}" title="${titulo}">${contenido}</a>`
        : `<span class="ficha ${claseProbabilidad(j.prob)}" title="${titulo}">${contenido}</span>`;
    }).join('')}</div>`;
  }).join('')}</div>`;
}

const celdaPct = (v) => (v == null ? '<td class="sin-dato">—</td>' : `<td><span class="pct ${claseProbabilidad(v)}">${pct(v)}</span></td>`);

function htmlComparativa(lista, conFF) {
  const filas = lista.filter((x) => x.prob >= 0.05 || x.aviso).slice(0, 18).map((x) => {
    const discrepa = x.ff != null && x.propia != null && Math.abs(x.ff - x.propia) >= 0.35;
    return `<tr>
      <td class="izq">${esc(x.nombre)} ${x.aviso ? htmlEstadoFantasy(x.estado) : ''}${discrepa ? ' <span class="discrepa" title="Las fuentes no coinciden">⚠️</span>' : ''}</td>
      ${conFF ? celdaPct(x.ff) : ''}${celdaPct(x.propia)}
      <td class="pts"><span class="pct ${claseProbabilidad(x.prob)}">${pct(x.prob)}</span></td>
    </tr>`;
  }).join('');
  return `<details class="tabla-fuentes" ${conFF ? 'open' : ''}>
    <summary class="sub-cab" style="cursor:pointer">Comparativa de fuentes</summary>
    <div class="tabla-scroll"><table>
      <thead><tr><th class="izq">Jugador</th>${conFF ? '<th title="Futbol Fantasy">F. Fantasy</th>' : ''}<th title="Calculado con las últimas alineaciones">Mi cálculo</th><th>Final</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  </details>`;
}

// Alineación oficial de ESPN (se publica aproximadamente una hora antes del partido)
function alineacionOficial(d) {
  const rosters = (d.rosters || []).filter((r) => (r.roster || []).filter((j) => j.starter).length >= 11);
  if (rosters.length < 2) return null;
  return rosters.map((r) => ({
    equipo: r.team,
    formacion: r.formation,
    once: r.roster.filter((j) => j.starter).map((j) => ({
      id: j.athlete?.id,
      nombre: j.athlete?.displayName,
      corto: j.athlete?.shortName || j.athlete?.displayName,
      abreviatura: j.position?.abbreviation,
      grupo: grupoPosicion(j.position?.abbreviation) || (String(j.formationPlace) === '1' ? 'POR' : 'MED'),
      prob: 1,
      aviso: '',
    })),
  }));
}

async function htmlPosibleOnce(ligaId, p, d) {
  const oficial = alineacionOficial(d);
  if (oficial) {
    return `<div class="fuentes"><span class="fuente activa">ESPN · alineación oficial</span></div>
      <div class="dos-columnas">${oficial.map((o) => `<section class="tarjeta">
        <div class="bloque-cab"><span class="celda-equipo">${escudo(o.equipo?.logo || o.equipo?.logos?.[0]?.href)}${esc(o.equipo?.displayName)}</span><small>${esc(o.formacion || '')}</small></div>
        <div class="aviso-oficial">✅ Alineación oficial confirmada</div>
        ${htmlCampo(o.once)}
      </section>`).join('')}</div>`;
  }

  const equipos = [p.local, p.visitante];
  const resultados = await Promise.allSettled(equipos.map((eq) => posibleOnceEquipo(ligaId, eq, p)));
  const esLaLiga = ligaId === 'esp.1';
  const algunoFF = resultados.some((r) => r.status === 'fulfilled' && r.value.ff);
  const algunoFantasy = resultados.some((r) => r.status === 'fulfilled' && r.value.conFantasy);
  const datosFF = window.DATOS_ALINEACIONES;

  const fuentes = `<div class="fuentes">
      <span class="fuente activa">Mi cálculo · últimos 5 partidos</span>
      ${esLaLiga ? `<span class="fuente ${algunoFF ? 'activa' : ''}">Futbol Fantasy${datosFF?.actualizado ? ` · ${esc(haceTiempo(datosFF.actualizado).toLowerCase())}` : ''}${algunoFF ? '' : ' · sin datos de este partido'}</span>
        <span class="fuente ${algunoFantasy ? 'activa' : ''}">LaLiga Fantasy · bajas oficiales</span>` : ''}
      <span class="fuente">ESPN · once oficial (≈1 h antes)</span>
    </div>`;

  const bloques = resultados.map((r, i) => {
    const eq = equipos[i];
    if (r.status !== 'fulfilled' || r.value.once.length < 11) {
      return `<section class="tarjeta"><div class="bloque-cab"><span class="celda-equipo">${escudo(eq.logo)}${esc(eq.nombreLargo)}</span></div>
        <p class="vacio">No hay suficientes datos para calcular su posible 11.</p></section>`;
    }
    const { once, lista, formacion, partidosAnalizados, ff, bajas } = r.value;
    return `<section class="tarjeta">
      <div class="bloque-cab"><span class="celda-equipo">${escudo(eq.logo)}${esc(eq.nombreLargo)}</span><small>${esc(formacion)}</small></div>
      ${htmlCampo(once)}
      ${htmlComparativa(lista, !!ff)}
      ${bajas.length ? `<div class="sub-cab">Bajas y dudas (LaLiga Fantasy)</div>
        <div class="lista-jugadores">${bajas.map((j) => filaJugadorFantasy(j)).join('')}</div>` : ''}
      <p class="nota relleno" style="margin:0">Mi cálculo usa ${partidosAnalizados} ${partidosAnalizados === 1 ? 'partido' : 'partidos'} recientes.
        ${ff ? `<a href="${urlSegura(ff.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--acento)">Ver en Futbol Fantasy ›</a>` : ''}</p>
    </section>`;
  }).join('');

  return `<p class="nota">📊 El porcentaje es la probabilidad de ser titular. ${esLaLiga
      ? `Combina el de <b>Futbol Fantasy</b> (${Math.round(PESO_FUTBOL_FANTASY * 100)}%, tiene en cuenta entrenamientos y ruedas de prensa) con <b>mi cálculo</b> a partir de las últimas alineaciones (${Math.round((1 - PESO_FUTBOL_FANTASY) * 100)}%), y aplica las bajas oficiales de LaLiga Fantasy. ⚠️ indica que las fuentes no coinciden.`
      : 'Se calcula con las alineaciones de los últimos 5 partidos oficiales (los más recientes pesan más).'}
      No es una alineación oficial.</p>
    ${fuentes}
    <div class="leyenda" style="padding:0 0 12px">
      <span><i style="background:#22c55e"></i>75% o más</span>
      <span><i style="background:#f59e0b"></i>50–74%</span>
      <span><i style="background:#ef4444"></i>Menos del 50%</span>
    </div>
    <div class="dos-columnas">${bloques}</div>`;
}
