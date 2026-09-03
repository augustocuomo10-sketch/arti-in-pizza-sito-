/* Configurazione — Arti in Pizza
 * Unico posto in cui vive un indirizzo di servizio. Se cambia il Worker,
 * il numero WhatsApp o il provider degli indirizzi, si tocca solo questo
 * file (piu' il ?v= per invalidare la cache).
 *
 * Va caricato PRIMA di carrello.js, ordine-corso.js e degli script inline
 * di segui-ordine / pannello / ordine-ricevuto: tutti leggono AIP_CONFIG.
 *
 * Nota sul Worker: il nome workers.dev contiene l'account personale
 * dello sviluppatore. Il piano e' spostare il servizio su
 * ordini.artiinpizza.com (Custom Domain di Cloudflare). Finche' il DNS
 * del custom domain non e' attivo, si tiene l'host workers.dev qui sotto
 * e il codice del sito continua a funzionare.
 */
(function () {
  "use strict";

  window.AIP_CONFIG = {
    // Endpoint del Worker Cloudflare (verifica ordine, SumUp, stato).
    // Da migrare a "https://ordini.artiinpizza.com" quando il Custom Domain
    // e' collegato — vedi worker/ e le impostazioni Cloudflare.
    endpointOrdini: "https://bitter-firefly-4508.augusto-cuomo10.workers.dev",

    // Autocompletamento indirizzi (servizio pubblico, senza SLA).
    // Se cambia provider, la logica di parsing in carrello.js va rivista.
    endpointIndirizzi: "https://photon.komoot.io/api/",

    // Cellulare della pizzeria per il fallback via WhatsApp, in formato
    // internazionale senza + e senza spazi. Il fisso 031 300809 non riceve.
    numeroWhatsApp: "393290664551"
  };
})();
