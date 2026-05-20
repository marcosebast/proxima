// generate-upcoming.mjs
// Consulta Bandsintown por cada artista de la batea
// y genera upcoming.json con los que tocan en Buenos Aires en los próximos 30 días
// Corre automáticamente via GitHub Actions los días 1 y 15 de cada mes

import { readFileSync, writeFileSync } from 'fs';

const CITY    = 'Buenos Aires';
const COUNTRY = 'AR';
const DAYS    = 30;
const APP_ID  = 'proxima';

async function getEvents(artistName) {
  const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(artistName)}/events?app_id=${APP_ID}`;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

async function main() {
  const db      = JSON.parse(readFileSync('./database.json', 'utf-8'));
  const artists = [...new Set(db.map(t => t.a).filter(Boolean))];
  console.log(`🎵 Artistas únicos: ${artists.length}`);

  const hoy   = new Date();
  const limit = new Date(hoy.getTime() + DAYS * 24 * 60 * 60 * 1000);

  const upcoming = []; // { artist, date, venue }
  let procesados = 0;

  for (const artist of artists) {
    const events = await getEvents(artist);

    for (const ev of events) {
      const city    = ev.venue?.city    || '';
      const country = ev.venue?.country || '';
      const date    = new Date(ev.datetime || ev.start?.datetime || '');

      if (
        country === COUNTRY &&
        city.toLowerCase().includes('buenos aires') &&
        date >= hoy &&
        date <= limit
      ) {
        upcoming.push({
          artist,
          date: date.toISOString().split('T')[0],
          venue: ev.venue?.name || '',
        });
        console.log(`✅ ${artist} → ${date.toISOString().split('T')[0]} @ ${ev.venue?.name}`);
      }
    }

    procesados++;
    if (procesados % 100 === 0) console.log(`🔄 ${procesados}/${artists.length}...`);

    // Pausa para no saturar
    await new Promise(r => setTimeout(r, 120));
  }

  // Artistas únicos con shows próximos
  const artistsUpcoming = [...new Set(upcoming.map(e => e.artist))];

  const output = {
    updatedAt: hoy.toISOString(),
    city: CITY,
    events: upcoming,
    artists: artistsUpcoming,
  };

  writeFileSync('./upcoming.json', JSON.stringify(output, null, 2));
  console.log(`\n✅ ${upcoming.length} eventos encontrados — ${artistsUpcoming.length} artistas`);
  console.log('📄 Guardado: upcoming.json');
}

main().catch(console.error);
