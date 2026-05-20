// generate-upcoming.mjs
// Consulta Setlist.fm por cada artista de la batea
// y genera upcoming.json con los que tocan en Buenos Aires en los próximos 30 días
// Corre automáticamente via GitHub Actions los días 1 y 15 de cada mes

import { readFileSync, writeFileSync } from 'fs';

const CITY    = 'Buenos Aires';
const COUNTRY = 'AR';
const DAYS    = 30;
const API_KEY = process.env.SETLISTFM_API_KEY || 'RTBOZfGbtIn6YUjctAkGJxCyvz3lp5OnUQ1b';

async function getEvents(artistName) {
  const url = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artistName)}&cityName=Buenos+Aires&p=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.setlist || [];
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

  const upcoming = [];
  let procesados = 0;

  for (const artist of artists) {
    const events = await getEvents(artist);

    for (const ev of events) {
      const city    = ev.venue?.city?.name    || '';
      const country = ev.venue?.city?.country?.code || '';
      // Setlist.fm devuelve fechas en formato dd-MM-yyyy
      const parts = (ev.eventDate || '').split('-');
      const date  = parts.length === 3
        ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
        : new Date('');

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

    await new Promise(r => setTimeout(r, 150));
  }

  const artistsUpcoming = [...new Set(upcoming.map(e => e.artist))];

  const output = {
    updatedAt: hoy.toISOString(),
    city: CITY,
    events: upcoming,
    artists: artistsUpcoming,
  };

  writeFileSync('./upcoming.json', JSON.stringify(output, null, 2));
  console.log(`\n✅ ${upcoming.length} eventos — ${artistsUpcoming.length} artistas`);
  console.log('📄 Guardado: upcoming.json');
}

main().catch(console.error);
