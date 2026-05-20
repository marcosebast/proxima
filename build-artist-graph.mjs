// build-artist-graph.mjs
// Genera artist-graph.json con:
// - level1: núcleos editoriales por curador
// - level2: similares via Last.fm por cada artista de la batea
// Uso: node build-artist-graph.mjs (o via GitHub Actions)

import { readFileSync, writeFileSync } from 'fs';

const LASTFM_KEY = process.env.LASTFM_API_KEY || '06804cc802d1190bcaea93f260a45c14';

// Artistas núcleo por curador (nivel 1 — editorial)
const NUCLEOS = {
  peggy:     ['Peggy Gou', 'DJ Koze', 'Roman Flügel', 'Prins Thomas', 'Antal'],
  jamie:     ['Jamie xx', 'Gil Scott-Heron', 'Four Tet', 'Caribou', 'Actress'],
  solange:   ['Solange', 'Frank Ocean', 'Blood Orange', 'Kelela', 'Sampha'],
  floating:  ['Floating Points', 'Four Tet', 'Caribou', 'Burial', 'Jon Hopkins'],
  stvincent: ['St. Vincent', 'David Bowie', 'Talking Heads', 'Tune-Yards', 'Sufjan Stevens'],
  boniver:   ['Bon Iver', 'Sufjan Stevens', 'Fleet Foxes', 'Iron & Wine', 'The National'],
  miranda:   ['Miranda!', 'Juliana Gattas', 'ABBA', 'Virus', 'Lali'],
};

async function getSimilar(artistName) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(artistName)}&limit=5&autocorrect=1&api_key=${LASTFM_KEY}&format=json`;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return (data.similarartists?.artist || []).map(a => a.name);
  } catch {
    return [];
  }
}

async function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const db      = JSON.parse(readFileSync('./database.json', 'utf-8'));
  const artists = [...new Set(db.map(t => t.a).filter(Boolean))];
  console.log(`🎵 Artistas únicos en batea: ${artists.length}`);

  // Parte 1: similares de todos los artistas de la batea
  const similarMap = {}; // artistName → [similares]
  let procesados = 0;

  for (const artist of artists) {
    const similares = await getSimilar(artist);
    if (similares.length) similarMap[artist] = similares;
    procesados++;
    if (procesados % 100 === 0) console.log(`🔄 ${procesados}/${artists.length}...`);
    await pause(120);
  }

  console.log(`✅ Similares obtenidos para ${Object.keys(similarMap).length} artistas`);

  // Parte 2: construir grafo por curador
  const graph = {};
  for (const [curador, nucleos] of Object.entries(NUCLEOS)) {
    // level2 = similares Last.fm de los artistas núcleo
    const level2 = new Set();
    for (const n of nucleos) {
      const sims = await getSimilar(n);
      sims.forEach(s => { if (!nucleos.includes(s)) level2.add(s); });
      await pause(120);
    }

    graph[curador] = {
      level1: nucleos,
      level2: [...level2],
    };

    console.log(`🎛️  ${curador}: L1=${nucleos.length} L2=${level2.size}`);
  }

  // Output final
  const output = {
    updatedAt:  new Date().toISOString(),
    curadores:  graph,
    similarMap, // artista → similares (para expansión en el motor)
  };

  writeFileSync('./artist-graph.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Guardado: artist-graph.json');
}

main().catch(console.error);
