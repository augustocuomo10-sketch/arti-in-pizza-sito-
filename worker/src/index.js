// API ordini Arti in Pizza — Cloudflare Worker
//
// Endpoint:
//   POST /crea-checkout   verifica l'ordine e apre il pagamento SumUp
//   GET  /stato?ref=...   stato reale del pagamento, chiesto a SumUp
//   POST /webhook         notifica SumUp (fonte di verita' sullo stato)
//
// Segreti (wrangler secret put): SUMUP_API_KEY, SUMUP_MERCHANT_CODE
// KV binding: ORDINI

import { verificaOrdine, ErroreVerifica } from "./verifiche.js";
import { verificaZonaConsegna } from "./zona.js";
import { avvisaPizzeria } from "./avvisi.js";
import { avvisaPush, registraDispositivo } from "./push.js";

const ORIGINI_AMMESSE = [
  "https://artiinpizza.com",
  "https://www.artiinpizza.com",
  "https://augustocuomo10-sketch.github.io"
];

// Stati di lavorazione. L'ordine di questa lista e' anche l'ordine di
// avanzamento mostrato al cliente: serve a non inventare passaggi a caso.
const STATI = {
  ricevuto:        { etichetta: "Ricevuto",        cliente: "Abbiamo ricevuto il tuo ordine." },
  in_preparazione: { etichetta: "In preparazione", cliente: "Lo stiamo preparando." },
  pronto:          { etichetta: "Pronto",          cliente: "È pronto: puoi venire a ritirarlo." },
  in_consegna:     { etichetta: "In consegna",     cliente: "È partito: arriva a momenti." },
  completato:      { etichetta: "Completato",      cliente: "Consegnato. Grazie!" },
  annullato:       { etichetta: "Annullato",       cliente: "L'ordine è stato annullato. Ti abbiamo contattato." }
};

const MAX_CORPO = 16 * 1024;      // 16 KB: un ordine legittimo sta in molto meno
const LIMITE_RICHIESTE = 12;      // per IP
const FINESTRA_SECONDI = 300;     // in 5 minuti

function cors(origine) {
  const ok = ORIGINI_AMMESSE.includes(origine);
  return {
    "Access-Control-Allow-Origin": ok ? origine : ORIGINI_AMMESSE[0],
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function json(dati, stato, origine) {
  return new Response(JSON.stringify(dati), {
    status: stato,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origine) }
  });
}

// ------------------------------------------------------- limite richieste
async function superaLimite(env, ip) {
  if (!env.ORDINI) return false;
  const chiave = `rate:${ip}`;
  const attuale = parseInt((await env.ORDINI.get(chiave)) || "0", 10);
  if (attuale >= LIMITE_RICHIESTE) return true;
  await env.ORDINI.put(chiave, String(attuale + 1), { expirationTtl: FINESTRA_SECONDI });
  return false;
}

// --------------------------------------------------------------- SumUp
async function creaCheckoutSumUp(env, ordine, riferimento, urlRitorno) {
  const risposta = await fetch("https://api.sumup.com/v0.1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUMUP_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      checkout_reference: riferimento,
      amount: ordine.totali.totale,
      currency: "EUR",
      merchant_code: env.SUMUP_MERCHANT_CODE,
      description: `Ordine Arti in Pizza — ${ordine.righe.length} voci`,
      hosted_checkout: { enabled: true },
      redirect_url: urlRitorno
    })
  });

  const dati = await risposta.json().catch(() => ({}));
  if (!risposta.ok || !dati.hosted_checkout_url) {
    throw new Error(`SumUp ha rifiutato la creazione del pagamento (${risposta.status})`);
  }
  return dati;
}

async function leggiCheckoutSumUp(env, idCheckout) {
  const r = await fetch(`https://api.sumup.com/v0.1/checkouts/${idCheckout}`, {
    headers: { Authorization: `Bearer ${env.SUMUP_API_KEY}` }
  });
  if (!r.ok) throw new Error(`stato non leggibile (${r.status})`);
  return r.json();
}

// ------------------------------------------------- pagamenti in sospeso
// Oltre questa eta' non ha senso ricontrollare: il checkout SumUp e' scaduto
// e l'ordine non verra' piu' pagato.
const RICONCILIA_ORE = 8;
// Tetto alle chiamate verso SumUp per ogni giro, per non allungare la
// risposta del pannello quando ci sono molti ordini in sospeso.
const RICONCILIA_MAX = 10;

// Prende gli ordini gia' letti dall'archivio, individua quelli con carta
// rimasti in sospeso e chiede a SumUp se nel frattempo sono stati pagati.
// Quelli che risultano pagati vengono aggiornati e annunciati in pizzeria,
// esattamente come se il cliente fosse tornato sul sito.
// Modifica gli oggetti sul posto, cosi' la risposta al pannello e' gia'
// quella aggiornata e non serve una seconda lettura.
async function riconciliaPagamenti(env, caricati) {
  if (!env.SUMUP_API_KEY) return 0;
  const limite = Date.now() - RICONCILIA_ORE * 60 * 60 * 1000;

  const sospesi = caricati.filter(([, d]) =>
    (d.pagamento || "carta") === "carta" &&
    d.stato !== "pagato" && d.stato !== "importo_discordante" &&
    d.idCheckout &&
    Date.parse(d.creato) >= limite
  ).slice(0, RICONCILIA_MAX);

  if (!sospesi.length) return 0;

  const esiti = await Promise.all(sospesi.map(([chiave, d]) => segnaSePagato(env, chiave, d)));
  return esiti.filter(Boolean).length;
}

async function segnaSePagato(env, chiave, d) {
  try {
    const check = await leggiCheckoutSumUp(env, d.idCheckout);
    if (check.status !== "PAID") return false;

    // Stessa prudenza di /stato: pagato ma con l'importo sbagliato non e'
    // pagato, e' un caso da guardare in faccia prima di preparare qualcosa.
    d.stato = Math.abs(Number(check.amount) - d.attesoEuro) < 0.005
      ? "pagato" : "importo_discordante";
    d.pagatoIl = d.pagatoIl || new Date().toISOString();
    d.verificato = new Date().toISOString();
    d.riconciliato = true;          // non e' arrivato dal ritorno del cliente

    if (d.stato === "pagato" && !d.avvisato) {
      const [e1, e2] = await Promise.all([avvisaPizzeria(env, d), avvisaPush(env, d)]);
      if (e1.inviato || e2.inviato) d.avvisato = new Date().toISOString();
    }
    await env.ORDINI.put(chiave, JSON.stringify(d), { expirationTtl: 60 * 60 * 24 * 30 });
    return true;
  } catch {
    // SumUp irraggiungibile: si riprova al giro dopo, fra venti secondi.
    return false;
  }
}

// Verifica completa e archiviazione. Condivisa fra carta e contanti:
// le regole devono essere le stesse, altrimenti il contante diventa
// la porta di servizio da cui passa quello che la carta rifiuta.
async function verificaEArchivia(env, corpo, pagamento) {
  const ordine = verificaOrdine(corpo, new Date(), env.CHIUSURA_FINO);
  if (ordine.cliente.modalita === "domicilio") {
    ordine.zona = await verificaZonaConsegna(ordine.cliente.indirizzo, env);
  }
  const riferimento = `AIP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const dati = {
    riferimento,
    pagamento,                       // "carta" | "contanti"
    attesoEuro: ordine.totali.totale,
    ordine,
    stato: pagamento === "contanti" ? "da_incassare" : "in_attesa",
    creato: new Date().toISOString()
  };
  return { ordine, riferimento, dati };
}

async function salva(env, dati) {
  if (!env.ORDINI) return;
  await env.ORDINI.put(`ordine:${dati.riferimento}`, JSON.stringify(dati),
    { expirationTtl: 60 * 60 * 24 * 30 });
}

// ------------------------------------------------------------- handler
export default {
  async fetch(richiesta, env) {
    const url = new URL(richiesta.url);
    const origine = richiesta.headers.get("Origin") || "";
    const ip = richiesta.headers.get("CF-Connecting-IP") || "sconosciuto";

    if (richiesta.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origine) });
    }

    // ---------------------------------------------------- crea checkout
    if (url.pathname === "/crea-checkout" && richiesta.method === "POST") {
      try {
        if (origine && !ORIGINI_AMMESSE.includes(origine)) {
          return json({ errore: "Origine non autorizzata." }, 403, origine);
        }
        if (!env.SUMUP_API_KEY || !env.SUMUP_MERCHANT_CODE) {
          return json({ errore: "Pagamento online non ancora configurato." }, 503, origine);
        }
        if (await superaLimite(env, ip)) {
          return json({ errore: "Troppi tentativi ravvicinati. Riprova fra qualche minuto." }, 429, origine);
        }

        const grezzo = await richiesta.text();
        if (grezzo.length > MAX_CORPO) {
          return json({ errore: "Richiesta troppo grande." }, 413, origine);
        }

        let corpo;
        try { corpo = JSON.parse(grezzo); }
        catch { return json({ errore: "Richiesta non leggibile." }, 400, origine); }

        // *** verifica: prezzi, quantita', orari, zona, dati cliente ***
        const { ordine, riferimento, dati } = await verificaEArchivia(env, corpo, "carta");

        const ritorno = `${ORIGINI_AMMESSE[0]}/ordine-ricevuto.html?ref=${encodeURIComponent(riferimento)}`;
        const checkout = await creaCheckoutSumUp(env, ordine, riferimento, ritorno);
        dati.idCheckout = checkout.id;
        await salva(env, dati);

        return json({
          url: checkout.hosted_checkout_url,
          riferimento,
          totale: ordine.totali.totale
        }, 200, origine);

      } catch (e) {
        if (e instanceof ErroreVerifica) {
          return json({ errore: e.message, codice: e.codice }, 422, origine);
        }
        return json({ errore: "Non riusciamo ad aprire il pagamento. Riprova, oppure scegli il pagamento alla consegna." }, 502, origine);
      }
    }

    // ------------------------------------------------- ordine in contanti
    // Stesse verifiche della carta. Cambia solo che non c'e' nulla da
    // incassare adesso: l'ordine e' valido subito e la pizzeria va avvisata.
    if (url.pathname === "/ordine-contante" && richiesta.method === "POST") {
      try {
        if (origine && !ORIGINI_AMMESSE.includes(origine)) {
          return json({ errore: "Origine non autorizzata." }, 403, origine);
        }
        if (await superaLimite(env, ip)) {
          return json({ errore: "Troppi tentativi ravvicinati. Riprova fra qualche minuto." }, 429, origine);
        }
        const grezzo = await richiesta.text();
        if (grezzo.length > MAX_CORPO) return json({ errore: "Richiesta troppo grande." }, 413, origine);

        let corpo;
        try { corpo = JSON.parse(grezzo); }
        catch { return json({ errore: "Richiesta non leggibile." }, 400, origine); }

        const { riferimento, dati } = await verificaEArchivia(env, corpo, "contanti");
        await salva(env, dati);

        const [esito, esitoPush] = await Promise.all([
          avvisaPizzeria(env, dati),
          avvisaPush(env, dati)
        ]);
        if (esito.inviato || esitoPush.inviato) {
          dati.avvisato = new Date().toISOString();
          dati.canali = {
            telegram: esito.inviato ? esito.consegnatiA + "/" + esito.totale : false,
            push: esitoPush.inviato ? esitoPush.consegnatiA + "/" + esitoPush.totale : false
          };
        }
        if (esito.falliti) dati.avvisiFalliti = esito.falliti;
        await salva(env, dati);

        // L'ordine e' comunque valido e archiviato: se l'avviso non parte
        // lo diciamo al cliente, cosi' puo' chiamare invece di restare in dubbio.
        return json({
          riferimento,
          totale: dati.attesoEuro,
          avvisato: esito.inviato
        }, 200, origine);

      } catch (e) {
        if (e instanceof ErroreVerifica) {
          return json({ errore: e.message, codice: e.codice }, 422, origine);
        }
        return json({ errore: "Non riusciamo a registrare l'ordine. Chiamaci allo 031 300809." }, 502, origine);
      }
    }

    // ------------------------------------------------------------ stato
    // Non ci si fida del redirect: lo stato si chiede a SumUp e si
    // confronta con l'importo che avevamo calcolato noi.
    if (url.pathname === "/stato" && richiesta.method === "GET") {
      const rif = url.searchParams.get("ref") || "";
      if (!/^AIP-\d+-[a-f0-9]{8}$/.test(rif)) {
        return json({ errore: "Riferimento non valido." }, 400, origine);
      }
      if (!env.ORDINI) return json({ errore: "Archivio non disponibile." }, 503, origine);

      const salvato = await env.ORDINI.get(`ordine:${rif}`);
      if (!salvato) return json({ errore: "Ordine non trovato." }, 404, origine);
      const dati = JSON.parse(salvato);

      try {
        const check = await leggiCheckoutSumUp(env, dati.idCheckout);
        const pagato = check.status === "PAID";
        const importoCorretto = Math.abs(Number(check.amount) - dati.attesoEuro) < 0.005;

        if (pagato && !importoCorretto) {
          // Non deve accadere: se accade, meglio saperlo che incassare e basta.
          dati.stato = "importo_discordante";
        } else if (pagato) {
          dati.stato = "pagato";
        }
        dati.verificato = new Date().toISOString();

        // avviso alla pizzeria: solo a pagamento riuscito e una volta sola
        if (dati.stato === "pagato" && !dati.avvisato) {
          const [e1, e2] = await Promise.all([avvisaPizzeria(env, dati), avvisaPush(env, dati)]);
          if (e1.inviato || e2.inviato) dati.avvisato = new Date().toISOString();
        }
        await env.ORDINI.put(`ordine:${rif}`, JSON.stringify(dati), { expirationTtl: 60 * 60 * 24 * 30 });

        return json({
          stato: dati.stato,
          pagato: dati.stato === "pagato",
          totale: dati.attesoEuro,
          riferimento: rif
        }, 200, origine);
      } catch {
        return json({ stato: dati.stato, pagato: false, riferimento: rif }, 200, origine);
      }
    }

    // ---------------------------------------------------------- webhook
    if (url.pathname === "/webhook" && richiesta.method === "POST") {
      try {
        const evento = await richiesta.json();
        const rif = evento && (evento.checkout_reference || (evento.payload && evento.payload.checkout_reference));
        if (!rif || !env.ORDINI) return new Response("ok", { status: 200 });

        const salvato = await env.ORDINI.get(`ordine:${rif}`);
        if (!salvato) return new Response("ok", { status: 200 });
        const dati = JSON.parse(salvato);

        // Anche qui non ci si fida del contenuto della notifica:
        // si richiede lo stato a SumUp e si confronta l'importo.
        const check = await leggiCheckoutSumUp(env, dati.idCheckout);
        if (check.status === "PAID" && Math.abs(Number(check.amount) - dati.attesoEuro) < 0.005) {
          if (dati.stato !== "pagato") {          // idempotenza
            dati.stato = "pagato";
            dati.pagatoIl = new Date().toISOString();
            if (!dati.avvisato) {
              const [e1, e2] = await Promise.all([avvisaPizzeria(env, dati), avvisaPush(env, dati)]);
              if (e1.inviato || e2.inviato) dati.avvisato = new Date().toISOString();
            }
            await env.ORDINI.put(`ordine:${rif}`, JSON.stringify(dati), { expirationTtl: 60 * 60 * 24 * 30 });
          }
        }
        return new Response("ok", { status: 200 });
      } catch {
        // A SumUp si risponde 200 comunque: un errore qui farebbe ritentare all'infinito.
        return new Response("ok", { status: 200 });
      }
    }

    // --------------------------------------- registrazione di un dispositivo
    if (url.pathname === "/push/registra" && richiesta.method === "POST") {
      if (!env.PANNELLO_TOKEN) return json({ errore: "Non configurato." }, 503, origine);
      if (!env.ORDINI) return json({ errore: "Archivio non disponibile." }, 503, origine);
      try {
        const corpo = await richiesta.json();
        if (corpo.token !== env.PANNELLO_TOKEN) {
          return json({ errore: "Non autorizzato." }, 401, origine);
        }
        const chiave = await registraDispositivo(env, corpo.iscrizione);
        return json({ registrato: true, chiave }, 200, origine);
      } catch (e) {
        return json({ errore: String(e.message || e) }, 400, origine);
      }
    }

    // ------------------------------------------- avanzamento della lavorazione
    if (url.pathname === "/stato-lavorazione" && richiesta.method === "POST") {
      if (!env.PANNELLO_TOKEN) return json({ errore: "Non configurato." }, 503, origine);
      if (!env.ORDINI) return json({ errore: "Archivio non disponibile." }, 503, origine);

      let corpo;
      try { corpo = await richiesta.json(); }
      catch { return json({ errore: "Richiesta non leggibile." }, 400, origine); }

      if (corpo.token !== env.PANNELLO_TOKEN) {
        return json({ errore: "Non autorizzato." }, 401, origine);
      }
      if (!STATI[corpo.stato]) {
        return json({ errore: "Stato non previsto." }, 400, origine);
      }
      if (!/^AIP-\d+-[a-f0-9]{8}$/.test(corpo.riferimento || "")) {
        return json({ errore: "Riferimento non valido." }, 400, origine);
      }

      const salvato = await env.ORDINI.get(`ordine:${corpo.riferimento}`);
      if (!salvato) return json({ errore: "Ordine non trovato." }, 404, origine);
      const dati = JSON.parse(salvato);

      // storico: serve a sapere chi ha fatto cosa e quando, non solo l'ultimo stato
      dati.lavorazione = corpo.stato;
      dati.storico = dati.storico || [];
      dati.storico.push({ stato: corpo.stato, quando: new Date().toISOString() });
      await env.ORDINI.put(`ordine:${corpo.riferimento}`, JSON.stringify(dati),
        { expirationTtl: 60 * 60 * 24 * 30 });

      return json({ riferimento: corpo.riferimento, lavorazione: corpo.stato }, 200, origine);
    }

    // --------------------------------------- avanzamento visibile al cliente
    // Nessun token: il riferimento e' gia' impossibile da indovinare.
    // Restituisce SOLO lo stato, mai i dati personali: il link puo' essere
    // inoltrato senza esporre nome, telefono o indirizzo di nessuno.
    if (url.pathname === "/avanzamento" && richiesta.method === "GET") {
      const rif = url.searchParams.get("ref") || "";
      if (!/^AIP-\d+-[a-f0-9]{8}$/.test(rif)) {
        return json({ errore: "Riferimento non valido." }, 400, origine);
      }
      if (!env.ORDINI) return json({ errore: "Archivio non disponibile." }, 503, origine);

      const salvato = await env.ORDINI.get(`ordine:${rif}`);
      if (!salvato) return json({ errore: "Ordine non trovato." }, 404, origine);
      const d = JSON.parse(salvato);
      const lav = d.lavorazione || "ricevuto";

      // Cosa esce da qui: stato, piatti, totale. Cosa NON esce: nome,
      // telefono, indirizzo, note. Il link puo' essere inoltrato a chiunque
      // senza esporre una sola informazione personale del cliente.
      return json({
        riferimento: rif,
        lavorazione: lav,
        etichetta: STATI[lav].etichetta,
        messaggio: STATI[lav].cliente,
        modalita: d.ordine.cliente.modalita,
        pagamento: d.pagamento || "carta",
        pagato: d.stato === "pagato",
        totale: d.attesoEuro,
        piatti: d.ordine.totali.piatti,
        consegna: d.ordine.totali.consegna,
        pezzi: d.ordine.righe.reduce((s, r) => s + r.qta, 0),
        righe: d.ordine.righe.map((r) => ({
          nome: r.nome, formato: r.formato, integrale: r.integrale,
          qta: r.qta, totale: r.totale
        })),
        orarioRichiesto: d.ordine.cliente.orario || "",
        preordine: d.ordine.cliente.preordine === true,
        minutiConsegna: (d.ordine.zona && d.ordine.zona.minuti) || null,
        creato: d.creato,
        storico: d.storico || []
      }, 200, origine);
    }

    // ------------------------------------------------- elenco per il pannello
    if (url.pathname === "/ordini" && richiesta.method === "GET") {
      if (!env.PANNELLO_TOKEN || url.searchParams.get("token") !== env.PANNELLO_TOKEN) {
        return json({ errore: "Non autorizzato." }, 401, origine);
      }
      if (!env.ORDINI) return json({ errore: "Archivio non disponibile." }, 503, origine);

      const elenco = await env.ORDINI.list({ prefix: "ordine:", limit: 60 });
      const caricati = [];
      for (const k of elenco.keys) {
        const v = await env.ORDINI.get(k.name);
        if (!v) continue;
        caricati.push([k.name, JSON.parse(v)]);
      }

      // Un pagamento riuscito puo' restare invisibile: SumUp lo sa, noi no,
      // perche' l'unico momento in cui glielo chiediamo e' quando il cliente
      // torna sul sito. Se chiude la scheda, l'ordine resta marchiato "non
      // concluso" per sempre e la pizzeria non sa se preparare o incassare.
      // Qui li ricontrolliamo da soli, riusando gli ordini gia' letti sopra
      // per non raddoppiare le letture dell'archivio.
      await riconciliaPagamenti(env, caricati);

      const ordini = [];
      for (const [, d] of caricati) {
        ordini.push({
          riferimento: d.riferimento,
          creato: d.creato,
          pagamento: d.pagamento || "carta",
          stato: d.stato,
          lavorazione: d.lavorazione || "ricevuto",
          totale: d.attesoEuro,
          cliente: d.ordine.cliente,
          righe: d.ordine.righe,
          zona: d.ordine.zona || null
        });
      }
      // dal piu' recente: e' quello che serve guardare per primo
      ordini.sort((a, b) => (a.creato < b.creato ? 1 : -1));
      return json({ ordini }, 200, origine);
    }

    // ------------------------------------------------------- diagnosi
    // Dice se i canali d'avviso sono pronti, senza rivelare alcun valore:
    // solo "c'e'/non c'e'" e quanti dispositivi risultano registrati.
    // Serve a smettere di indovinare quando un avviso non arriva.
    if (url.pathname === "/diagnostica" && richiesta.method === "GET") {
      let dispositivi = 0, ultimoErrore = null;
      if (env.ORDINI) {
        const l = await env.ORDINI.list({ prefix: "push:", limit: 50 });
        dispositivi = l.keys.length;
        // recupera il motivo del fallimento dall'ultimo ordine registrato
        const ord = await env.ORDINI.list({ prefix: "ordine:", limit: 20 });
        for (const k of ord.keys) {
          const v = await env.ORDINI.get(k.name);
          if (!v) continue;
          const d = JSON.parse(v);
          if (d.avvisiFalliti && d.avvisiFalliti.length) {
            ultimoErrore = d.avvisiFalliti[0].motivo || null;
          }
        }
      }
      return json({
        archivio: !!env.ORDINI,
        telegram: {
          tokenPresente: !!env.TELEGRAM_TOKEN,
          destinatariPresenti: !!env.TELEGRAM_CHAT,
          ultimoErrore
        },
        push: {
          chiavePresente: !!env.VAPID_PRIVATE,
          dispositiviRegistrati: dispositivi
        },
        sumup: {
          chiavePresente: !!env.SUMUP_API_KEY,
          merchantPresente: !!env.SUMUP_MERCHANT_CODE
        },
        chiusuraFino: env.CHIUSURA_FINO || null
      }, 200, origine);
    }

    return json({ errore: "Endpoint inesistente." }, 404, origine);
  }
};
