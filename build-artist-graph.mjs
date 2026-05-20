// build-artist-graph.mjs
// Genera artist-graph.json con red de similares de 2 niveles por curador
// Uso: node build-artist-graph.mjs (o via GitHub Actions)
// Genera: artist-graph.json

import { writeFileSync } from 'fs';

const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID     || 'eeaf61207380435790cf779abec1b0b4';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'cdc8542a446146a78dba27b473da108f';

// Artistas núcleo por curador (nivel 1 — definidos editorialmente)
const NUCLEOS = {
  peggy:     ['Peggy Gou', 'DJ Koze', 'Roman Flügel', 'Prins Thomas', 'Antal'],
  jamie:     ['Jamie xx', 'Gil Scott-Heron', 'Four Tet', 'Caribou', 'Actress'],
  solange:   ['Solange', 'Frank Ocean', 'Blood Orange', 'Kelela', 'Sampha'],
  floating:  ['Floating Points', 'Four Tet', 'Caribou', 'Burial', 'Jon Hopkins'],
  stvincent: ['St. Vincent', 'David Bowie', 'Talking Heads', 'Tune-Yards', 'Sufjan Stevens'],
  boniver:   ['Bon Iver', 'Sufjan Stevens', 'Fleet Foxes', 'Iron & Wine', 'The National'],
  miranda:   ['Miranda!', 'Juliana Gattas', 'ABBA', 'Virus', 'Lali'],
};

async function getToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token fallido: ' + JSON.stringify(data));
  console.log('✅ Token obtenido');
  return data.access_token;
}

async function searchArtistId(token, name) {
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.artists?.items?.[0]?.id || null;
}

async function getRelated(token, artistId) {
  const res = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.artists || []).slice(0, 5).map(a => a.name);
}

async function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const token = await getToken();
  const graph = {};

  for (const [curador, nucleos] of Object.entries(NUCLEOS)) {
    console.log(`\n🎛️  Procesando: ${curador}`);
    graph[curador] = { level1: [], level2: [] };

    for (const nombre of nucleos) {
      const id = await searchArtistId(token, nombre);
      await pause(120);
      if (!id) { console.warn(`  ⚠️  Sin ID: ${nombre}`); continue; }

      graph[curador].level1.push(nombre);
      console.log(`  ✓ L1: ${nombre}`);

      const similares = await getRelated(token, id);
      await pause(120);

      for (const s of similares) {
        if (!graph[curador].level2.includes(s) && !graph[curador].level1.includes(s)) {
          graph[curador].level2.push(s);
        }
      }
    }

    console.log(`  → L1: ${graph[curador].level1.length} · L2: ${graph[curador].level2.length}`);
  }

  writeFileSync('./artist-graph.json', JSON.stringify(graph, null, 2));
  console.log('\n✅ Guardado: artist-graph.json');

  Object.entries(graph).forEach(([c, g]) => {
    console.log(`${c}: ${g.level1.length} núcleo + ${g.level2.length} similares`);
  });
}

main().catch(console.error);
