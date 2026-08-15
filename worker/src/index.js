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

const ORIGINI_AMMESSE = [
  "https://artiinpizza.com",
  "https://www.artiinpizza.com",
  "https://augustocuomo10-sketch.github.io"
];

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

        // *** qui avviene la verifica: prezzi, quantita', orari, dati cliente ***
        const ordine = verificaOrdine(corpo, new Date());

        const riferimento = `AIP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const ritorno = `${ORIGINI_AMMESSE[0]}/ordine-ricevuto.html?ref=${encodeURIComponent(riferimento)}`;
        const checkout = await creaCheckoutSumUp(env, ordine, riferimento, ritorno);

        // L'importo verificato resta sul server: e' il metro di paragone
        // quando piu' tardi controlleremo quanto e' stato davvero pagato.
        if (env.ORDINI) {
          await env.ORDINI.put(`ordine:${riferimento}`, JSON.stringify({
            riferimento,
            idCheckout: checkout.id,
            attesoEuro: ordine.totali.totale,
            ordine,
            stato: "in_attesa",
            creato: new Date().toISOString()
          }), { expirationTtl: 60 * 60 * 24 * 30 });
        }

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
            await env.ORDINI.put(`ordine:${rif}`, JSON.stringify(dati), { expirationTtl: 60 * 60 * 24 * 30 });
          }
        }
        return new Response("ok", { status: 200 });
      } catch {
        // A SumUp si risponde 200 comunque: un errore qui farebbe ritentare all'infinito.
        return new Response("ok", { status: 200 });
      }
    }

    return json({ errore: "Endpoint inesistente." }, 404, origine);
  }
};
