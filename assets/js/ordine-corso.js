/* Ordine in corso — Arti in Pizza
 *
 * Chi ha appena ordinato dal telefono chiude il browser, apparecchia, e
 * quando riapre il sito si ritrova il menù come se non fosse successo
 * niente: il link per seguire l'ordine e' finito in una scheda che non
 * trova piu'. Qui teniamo il riferimento nel browser e lo riproponiamo su
 * ogni pagina finche' l'ordine e' vivo.
 *
 * Nel browser finisce solo il codice dell'ordine. Nome, telefono e
 * indirizzo restano sul server: chi prende in mano il telefono non li vede.
 */
(function () {
  "use strict";

  var CHIAVE = "aip_ordine_corso";
  var API = "https://bitter-firefly-4508.augusto-cuomo10.workers.dev";
  // Oltre mezza giornata un ordine e' concluso comunque: tenerlo li' sarebbe
  // solo un cartello che non se ne va piu'.
  var DURATA = 12 * 60 * 60 * 1000;

  var EN = location.pathname.indexOf("/en/") === 0;
  var RADICE = EN ? "../" : "";
  var T = EN
    ? { corso: "Order in progress", vedi: "See where it is", chiudi: "Dismiss" }
    : { corso: "Ordine in corso", vedi: "Vedi a che punto è", chiudi: "Nascondi" };

  function letto() {
    try {
      var g = JSON.parse(localStorage.getItem(CHIAVE) || "null");
      if (!g || !g.rif) return null;
      if (Date.now() - (g.quando || 0) > DURATA) { scorda(); return null; }
      return g;
    } catch (e) { return null; }
  }
  function scorda() { try { localStorage.removeItem(CHIAVE); } catch (e) {} }
  window.scordaOrdineCorso = scorda;

  var g = letto();
  if (!g) return;
  // sulla pagina dell'ordine la barra sarebbe un doppione
  if (/segui-ordine|ordine-ricevuto/.test(location.pathname)) return;

  function disegna(etichetta) {
    if (document.getElementById("ordine-corso")) return;
    var b = document.createElement("aside");
    b.id = "ordine-corso";
    b.className = "ordine-corso";
    b.innerHTML =
      '<a class="oc-vai" href="' + RADICE + "segui-ordine.html?ref=" + encodeURIComponent(g.rif) + '">' +
      '<span class="oc-punto" aria-hidden="true"></span>' +
      '<span class="oc-testo"><strong>' + T.corso + "</strong>" +
      (etichetta ? "<span>" + etichetta + "</span>" : "<span>" + T.vedi + "</span>") +
      '</span><span class="oc-freccia" aria-hidden="true">›</span></a>' +
      '<button type="button" class="oc-chiudi" aria-label="' + T.chiudi + '">✕</button>';
    document.body.appendChild(b);
    b.querySelector(".oc-chiudi").addEventListener("click", function () {
      b.remove();
      document.body.classList.remove("con-ordine-corso");
    });
    document.body.classList.add("con-ordine-corso");
  }

  // Chiediamo al server a che punto e': se e' finito, la barra non serve piu'.
  fetch(API + "/avanzamento?ref=" + encodeURIComponent(g.rif))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) { disegna(""); return; }
      if (d.lavorazione === "completato" || d.lavorazione === "annullato") { scorda(); return; }
      disegna(d.etichetta || T.vedi);
    })
    .catch(function () { disegna(""); });   // rete giu': meglio mostrarla comunque
})();
