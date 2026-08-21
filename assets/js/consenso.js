/* Consenso ai cookie pubblicitari — Arti in Pizza
 *
 * Il sito non usa cookie propri. L'unico che ne mette e' il tag di Google
 * Ads, che serve a capire quali annunci portano telefonate. Non e' un cookie
 * necessario al funzionamento: per legge deve partire SOLO dopo un consenso
 * esplicito, e deve essere altrettanto facile rifiutarlo.
 *
 * Per questo il tag non viene caricato qui: assets/js/tracking.js aspetta
 * il via da questo file. Finche' non si sceglie, verso Google non parte nulla.
 */
(function () {
  "use strict";

  var CHIAVE = "aip_consenso_v1";
  var EN = location.pathname.indexOf("/en/") === 0;
  var RADICE = EN ? "../" : "";

  var T = EN ? {
    testo: "Cookies only for advertising, only if you accept.",
    link: "Details",
    si: "Accept",
    no: "Decline"
  } : {
    testo: "Cookie solo per la pubblicità, e solo se accetti.",
    link: "Dettagli",
    si: "Accetta",
    no: "Rifiuta"
  };

  function letto() {
    try { return localStorage.getItem(CHIAVE); } catch (e) { return null; }
  }
  function scrivi(v) {
    try { localStorage.setItem(CHIAVE, v); } catch (e) { /* navigazione privata */ }
  }

  // Lo stato serve a tracking.js, che si carica subito dopo questo file.
  window.consensoMarketing = letto() === "si";

  // Ritirare il consenso deve valere anche per i cookie gia' installati,
  // altrimenti il rifiuto e' solo una promessa per il futuro. Google li
  // mette sul nostro dominio, quindi possiamo cancellarli noi.
  function ripulisciCookieGoogle() {
    var suoi = ["_gcl_au", "_gcl_aw", "_gcl_dc", "_gac_gb_", "_ga"];
    var domini = [location.hostname, "." + location.hostname];
    var punti = location.hostname.split(".");
    if (punti.length > 2) domini.push("." + punti.slice(-2).join("."));

    document.cookie.split(";").forEach(function (voce) {
      var nome = voce.split("=")[0].trim();
      var nostro = suoi.some(function (s) { return nome.indexOf(s) === 0; });
      if (!nostro) return;
      domini.forEach(function (d) {
        document.cookie = nome + "=; Max-Age=0; path=/; domain=" + d;
      });
      document.cookie = nome + "=; Max-Age=0; path=/";
    });
  }

  function decidi(valore) {
    scrivi(valore);
    if (valore !== "si") ripulisciCookieGoogle();
    window.consensoMarketing = valore === "si";
    var b = document.getElementById("consenso");
    if (b) b.hidden = true;
    liberaIngombro();
    // avvisa tracking.js, che puo' accendersi senza ricaricare la pagina
    document.dispatchEvent(new CustomEvent("consenso-deciso", {
      detail: { marketing: window.consensoMarketing }
    }));
  }
  // serve alla pagina dell'informativa per far cambiare idea
  window.cambiaConsenso = decidi;

  // Il banner sta in fondo allo schermo, dove sul telefono c'e' anche il
  // pulsante del carrello. Pubblichiamo la sua altezza reale come variabile
  // CSS, cosi' il carrello puo' spostarsi sopra invece di finirci sotto.
  function segnalaIngombro(b) {
    function aggiorna() {
      if (!b || b.hidden) return;
      var h = Math.ceil(b.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--altezza-consenso", h + "px");
    }
    document.body.classList.add("consenso-aperto");
    aggiorna();
    // il testo va a capo diversamente se si ruota il telefono
    window.addEventListener("resize", aggiorna);
    window.addEventListener("orientationchange", aggiorna);
    if (window.ResizeObserver) new ResizeObserver(aggiorna).observe(b);
  }

  function liberaIngombro() {
    document.body.classList.remove("consenso-aperto");
    document.documentElement.style.removeProperty("--altezza-consenso");
  }

  function mostra() {
    if (letto()) return;                       // ha gia' scelto
    if (document.getElementById("consenso")) return;

    var b = document.createElement("aside");
    b.id = "consenso";
    b.className = "consenso";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-labelledby", "consenso-titolo");
    b.innerHTML =
      '<p id="consenso-titolo">' + T.testo +
      ' <a href="' + RADICE + 'cookie.html">' + T.link + "</a></p>" +
      '<div class="tasti">' +
      '<button type="button" data-consenso="no">' + T.no + "</button>" +
      '<button type="button" class="si" data-consenso="si">' + T.si + "</button>" +
      "</div>";
    document.body.appendChild(b);
    segnalaIngombro(b);

    b.addEventListener("click", function (e) {
      var t = e.target.closest("[data-consenso]");
      if (t) decidi(t.getAttribute("data-consenso"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mostra);
  } else {
    mostra();
  }
})();
