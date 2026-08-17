// Notifiche push: il server sveglia i telefoni della pizzeria anche a
// pannello chiuso. Nessun intermediario da configurare — si parla
// direttamente con i servizi push di Google e Apple.
//
// Come funziona la firma: ogni richiesta porta un gettone JWT firmato con
// la chiave privata VAPID. Il servizio push verifica la firma con la chiave
// pubblica e cosi' sa che la spinta viene davvero dal nostro server.
//
// Segreto atteso: VAPID_PRIVATE (la meta' privata, generata nel pannello)

// Meta' pubblica: non e' segreta, sta anche nella pagina del pannello.
export const VAPID_PUBLIC =
  "BFN2dLG3qNrP6tnLBwFDrdTQnD6e-zn3U9_4goIKYkxgBzJzJ7UoFxJVUoYbAyH_e0pYmSBOPRDnhmAgSdd3cf4";

const CONTATTO = "mailto:info@artiinpizza.com";

function b64urlDaBuffer(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bufferDaB64url(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const b64urlDaTesto = (t) =>
  btoa(unescape(encodeURIComponent(t))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// La chiave privata da sola non basta a WebCrypto: vuole anche le coordinate
// pubbliche. Si ricavano dalla chiave pubblica, che e' il punto non compresso
// 0x04 || x(32 byte) || y(32 byte).
async function importaChiave(privataB64) {
  const pub = bufferDaB64url(VAPID_PUBLIC);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("chiave pubblica malformata");

  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privataB64,
    x: b64urlDaBuffer(pub.slice(1, 33)),
    y: b64urlDaBuffer(pub.slice(33, 65)),
    ext: true
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function gettoneVapid(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const intestazione = b64urlDaTesto(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const corpo = b64urlDaTesto(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,   // massimo ammesso: 24 ore
    sub: CONTATTO
  }));
  const daFirmare = `${intestazione}.${corpo}`;

  const chiave = await importaChiave(env.VAPID_PRIVATE);
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    chiave,
    new TextEncoder().encode(daFirmare)
  );
  return `${daFirmare}.${b64urlDaBuffer(firma)}`;
}

// Spinta senza contenuto: la notifica non trasporta i dati dell'ordine.
// Non e' una semplificazione, e' una scelta — cosi' nome, telefono e
// indirizzo del cliente non transitano dai server di Google e Apple.
async function spingi(env, iscrizione) {
  const gettone = await gettoneVapid(env, iscrizione.endpoint);
  const r = await fetch(iscrizione.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${gettone}, k=${VAPID_PUBLIC}`,
      TTL: "3600",
      "Content-Length": "0"
    }
  });
  return r.status;
}

// Non lancia mai: come per Telegram, un avviso che fallisce non deve
// far perdere l'ordine.
export async function avvisaPush(env, dati) {
  if (!env.VAPID_PRIVATE || !env.ORDINI) {
    return { inviato: false, motivo: "notifiche push non configurate" };
  }

  const elenco = await env.ORDINI.list({ prefix: "push:", limit: 50 });
  if (!elenco.keys.length) return { inviato: false, motivo: "nessun dispositivo registrato" };

  let riusciti = 0;
  const scaduti = [];

  for (const k of elenco.keys) {
    const grezzo = await env.ORDINI.get(k.name);
    if (!grezzo) continue;
    try {
      const stato = await spingi(env, JSON.parse(grezzo));
      if (stato >= 200 && stato < 300) riusciti++;
      // 404 e 410: il dispositivo non esiste piu' (app disinstallata,
      // permesso revocato). Si toglie, altrimenti si accumula spazzatura
      // e ogni ordine spreca una chiamata destinata a fallire.
      else if (stato === 404 || stato === 410) scaduti.push(k.name);
    } catch (e) { /* un dispositivo rotto non ferma gli altri */ }
  }

  for (const nome of scaduti) await env.ORDINI.delete(nome);

  return {
    inviato: riusciti > 0,
    consegnatiA: riusciti,
    totale: elenco.keys.length,
    rimossi: scaduti.length || undefined
  };
}

// Registrazione di un dispositivo. L'endpoint dell'iscrizione e' lungo e
// contiene caratteri non adatti a una chiave: se ne usa l'impronta.
export async function registraDispositivo(env, iscrizione) {
  if (!iscrizione || typeof iscrizione.endpoint !== "string") {
    throw new Error("iscrizione non valida");
  }
  if (!/^https:\/\//.test(iscrizione.endpoint)) {
    throw new Error("endpoint non valido");
  }
  const impronta = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(iscrizione.endpoint));
  const chiave = "push:" + b64urlDaBuffer(impronta).slice(0, 22);

  await env.ORDINI.put(chiave, JSON.stringify({ endpoint: iscrizione.endpoint }));
  return chiave;
}
