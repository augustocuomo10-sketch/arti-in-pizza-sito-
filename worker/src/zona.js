// Verifica della zona di consegna: massimo 11 minuti di guida dalla pizzeria.
//
// Perche' lato server: se il controllo stesse nel browser basterebbero gli
// strumenti da sviluppatore per aggirarlo e farsi consegnare fuori zona,
// per giunta dopo aver gia' pagato.
//
// Strategia: tempo di percorrenza reale su strada (OSRM). A Como la distanza
// in linea d'aria inganna — con il lago di mezzo due punti vicini in linea
// retta possono essere lontani in auto. Se il servizio di instradamento non
// risponde si ripiega su un raggio prudenziale.
//
// Decisione concordata: se l'indirizzo non si colloca con certezza, la
// consegna si BLOCCA e si invita a chiamare. Un ordine pagato e non
// consegnabile costa piu' di una telefonata in piu'.

import { ErroreVerifica } from "./verifiche.js";

export const ZONA = {
  origine: { lat: 45.8043618, lon: 9.0929047 }, // Via Carloni 12, Como
  minutiMax: 11,
  // Usato solo se l'instradamento non risponde. Prudenziale: 11 minuti in
  // citta' valgono circa 5 km su strada, che in linea d'aria sono ~3,5 km.
  raggioFallbackKm: 3.5,
  cacheOreGeocodifica: 24 * 30
};

const UA = "arti-in-pizza-sito/1.0 (ordini; https://artiinpizza.com)";

function distanzaKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ------------------------------------------------------------ geocodifica
async function geocodifica(indirizzo, env) {
  const chiave = "geo:" + indirizzo.toLowerCase().replace(/\s+/g, " ").trim();
  if (env && env.ORDINI) {
    const salvato = await env.ORDINI.get(chiave);
    if (salvato) return JSON.parse(salvato);
  }

  // Si restringe la ricerca alla provincia di Como: evita che "Via Roma"
  // finisca dall'altra parte d'Italia.
  const q = encodeURIComponent(indirizzo + ", Como, Italia");
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=it&addressdetails=1`;

  let dati = null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "it" } });
    if (r.ok) dati = await r.json();
  } catch { /* trattato sotto come indirizzo non collocabile */ }

  if (!Array.isArray(dati) || !dati.length) return null;

  const p = {
    lat: parseFloat(dati[0].lat),
    lon: parseFloat(dati[0].lon),
    etichetta: dati[0].display_name || indirizzo
  };
  if (!isFinite(p.lat) || !isFinite(p.lon)) return null;

  if (env && env.ORDINI) {
    await env.ORDINI.put(chiave, JSON.stringify(p), { expirationTtl: ZONA.cacheOreGeocodifica * 3600 });
  }
  return p;
}

// -------------------------------------------------------- tempo di guida
async function minutiInAuto(da, a) {
  const url = `https://router.project-osrm.org/route/v1/driving/` +
    `${da.lon},${da.lat};${a.lon},${a.lat}?overview=false`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.code !== "Ok" || !d.routes || !d.routes.length) return null;
    return d.routes[0].duration / 60;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- verifica
export async function verificaZonaConsegna(indirizzo, env) {
  const punto = await geocodifica(indirizzo, env);

  if (!punto) {
    throw new ErroreVerifica("indirizzo_non_trovato",
      "Non riusciamo a individuare questo indirizzo. Controllalo (via, numero civico e comune) " +
      "oppure chiamaci allo 031 300809: verifichiamo insieme se rientri nella zona di consegna.");
  }

  const kmAria = distanzaKm(ZONA.origine, punto);

  // Scarto immediato di quanto e' palesemente lontano: evita di interrogare
  // l'instradamento per indirizzi a chilometri di distanza.
  if (kmAria > 15) {
    throw new ErroreVerifica("fuori_zona",
      `${punto.etichetta.split(",").slice(0, 3).join(",")} è fuori dalla nostra zona di consegna. ` +
      "Puoi ordinare con ritiro in pizzeria, oppure chiamaci allo 031 300809.");
  }

  const minuti = await minutiInAuto(ZONA.origine, punto);

  if (minuti === null) {
    // Instradamento non disponibile: si ripiega sul raggio, in modo prudenziale.
    if (kmAria > ZONA.raggioFallbackKm) {
      throw new ErroreVerifica("fuori_zona",
        "Questo indirizzo risulta oltre la nostra zona di consegna. " +
        "Puoi scegliere il ritiro in pizzeria, oppure chiamaci allo 031 300809 per verificare.");
    }
    return { ok: true, minuti: null, kmAria: Math.round(kmAria * 10) / 10, metodo: "raggio", etichetta: punto.etichetta };
  }

  if (minuti > ZONA.minutiMax) {
    throw new ErroreVerifica("fuori_zona",
      `Da noi a questo indirizzo ci vogliono circa ${Math.round(minuti)} minuti in auto, ` +
      `oltre gli ${ZONA.minutiMax} che copriamo con le consegne. ` +
      "Puoi ordinare con ritiro in pizzeria, oppure chiamaci allo 031 300809.");
  }

  return {
    ok: true,
    minuti: Math.round(minuti),
    kmAria: Math.round(kmAria * 10) / 10,
    metodo: "strada",
    etichetta: punto.etichetta
  };
}
