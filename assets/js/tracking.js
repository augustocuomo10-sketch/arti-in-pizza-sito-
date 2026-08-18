/* ============================================================================
   Arti in Pizza — Tracciamento conversioni (GA4 + Google Ads)
   ----------------------------------------------------------------------------
   Questo file e' l'UNICO posto in cui inserire gli ID di tracciamento.
   Prima era duplicato in 5 pagine: se ne cambiavi uno solo, il resto smetteva
   di funzionare senza dare errore.

   COSA COMPILARE PRIMA DI ANDARE ONLINE
   -------------------------------------
   1. GA4_ID        -> Google Analytics > Amministrazione > Stream di dati
                       Formato: G-XXXXXXXXXX
   2. ADS_ID        -> Google Ads > Obiettivi > Conversioni > Tag Google
                       Formato: AW-000000000
   3. ADS_LABEL_*   -> Google Ads, per ogni azione di conversione creata,
                       "Configura il tag" > snippet dell'evento.
                       Nello snippet trovi send_to: 'AW-000000000/AbCdEfGh123'
                       Qui va SOLO la parte dopo la barra: 'AbCdEfGh123'

   Finche' i valori restano a "" il tracciamento resta silenziosamente inattivo:
   il sito funziona ma non registra nulla. Nessun errore in console.
   ========================================================================== */

(function () {
  "use strict";

  var CONFIG = {
    // DA COMPILARE: crea la proprieta' GA4 e incolla qui il Measurement ID.
    // Finche' resta vuoto, GA4 non riceve nulla (ma Google Ads si').
    GA4_ID: "",

    // Configurato il 6 agosto 2026 nell'account Google Ads 111-558-0274.
    ADS_ID: "AW-17357543372",

    // Azione di conversione "Click-to-call (1)" - categoria Lead da chiamata.
    ADS_LABEL_CALL: "laiLCOHk-9wcEMyv3NRA",

    // Nessuna azione dedicata creata: in account esistono gia' 3 azioni
    // "Ottieni indicazioni stradali" e crearne un'altra farebbe doppio conteggio.
    // L'evento viene comunque inviato a GA4.
    ADS_LABEL_DIRECTIONS: "",

    DEBUG: false                // true = logga gli eventi in console senza inviarli
  };

  /* -------------------------------------------------------------------------
     Bootstrap gtag
     ---------------------------------------------------------------------- */

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var tagId = CONFIG.GA4_ID || CONFIG.ADS_ID;
  var acceso = false;

  // I cookie di Google servono alla pubblicita', non al sito: per legge non
  // possono partire prima di un consenso esplicito. Il via lo da'
  // assets/js/consenso.js, che deve essere caricato PRIMA di questo file.
  // Finche' non arriva, verso Google non parte una sola richiesta.
  function accendi() {
    if (acceso || !tagId) return;
    acceso = true;

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(tagId);
    document.head.appendChild(s);

    gtag("js", new Date());
    if (CONFIG.GA4_ID) gtag("config", CONFIG.GA4_ID);
    if (CONFIG.ADS_ID) gtag("config", CONFIG.ADS_ID);
  }

  if (window.consensoMarketing) accendi();
  // chi accetta dal banner non deve ricaricare la pagina perche' valga
  document.addEventListener("consenso-deciso", function (e) {
    if (e.detail && e.detail.marketing) accendi();
  });

  /* -------------------------------------------------------------------------
     Invio eventi
     ---------------------------------------------------------------------- */

  function track(eventName, adsLabel, params) {
    params = params || {};
    params.page_title = document.title;
    params.page_language = document.documentElement.lang || "it";

    if (CONFIG.DEBUG) {
      console.log("[tracking]", eventName, params, adsLabel ? "(+Ads)" : "");
      return;
    }
    // senza consenso non si misura: meglio un dato in meno che un cookie in piu'
    if (!acceso) return;

    // GA4
    if (CONFIG.GA4_ID) gtag("event", eventName, params);

    // Google Ads
    if (CONFIG.ADS_ID && adsLabel) {
      gtag("event", "conversion", { send_to: CONFIG.ADS_ID + "/" + adsLabel });
    }
  }

  /* -------------------------------------------------------------------------
     Listener
     ---------------------------------------------------------------------- */

  function init() {
    // --- Click sul numero di telefono -------------------------------------
    // Ogni CTA del sito (asporto, domicilio, tavolo, header, footer) porta qui.
    // E' la conversione principale: e' il segnale piu' vicino a una vendita.
    document.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
      link.addEventListener("click", function () {
        track("phone_call_click", CONFIG.ADS_LABEL_CALL, {
          phone_number: link.getAttribute("href").replace("tel:", ""),
          link_context: link.closest("section") ? (link.closest("section").id || "generico") : "header_footer"
        });
      });
    });

    // --- Click su "indicazioni stradali" ----------------------------------
    // Proxy delle visite in negozio: e' un segnale reale e conteggiabile,
    // a differenza di "Visite in negozio" che Google stima per modello.
    document.querySelectorAll('a[href*="google.com/maps"]').forEach(function (link) {
      link.addEventListener("click", function () {
        track("get_directions", CONFIG.ADS_LABEL_DIRECTIONS, {
          destination: "Via Carloni 12, 22100 Como"
        });
      });
    });

    // --- Consultazione del menu (evento secondario, non conversione) ------
    // Utile come segnale di intenzione, da tenere come obiettivo SECONDARIO
    // in Google Ads: non va usato per l'offerta, solo per l'osservazione.
    document.querySelectorAll('a[href$="menu.html"]').forEach(function (link) {
      link.addEventListener("click", function () {
        track("view_menu", null, {});
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
