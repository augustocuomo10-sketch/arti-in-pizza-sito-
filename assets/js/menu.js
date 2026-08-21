/* Navigazione del menù — Arti in Pizza
 *
 * Il 95% di chi guarda il menù lo fa dal telefono, e li' la pagina intera
 * (sei categorie, quarantasette piatti, tutte aperte insieme) diventa un
 * muro lungo il quale si scorre senza capire che le piastrelle in cima
 * sono toccabili.
 *
 * Da telefono passiamo quindi a due livelli:
 *   1. si vedono SOLO le categorie, grandi e ovviamente premibili;
 *   2. toccandone una si apre quella e sparisce tutto il resto, con una
 *      barra in cima per tornare indietro.
 * Il tasto "indietro" del telefono fa la stessa cosa della barra, perche'
 * e' quello che la gente preme per istinto.
 *
 * Da computer non serve: lo schermo e' largo, le sezioni restano tutte
 * visibili e le piastrelle continuano a fare da scorciatoia.
 */
(function () {
  "use strict";

  var piastrelle = document.querySelectorAll(".menu-tab, .category-tile");
  var sezioni = document.querySelectorAll(".menu-category");
  if (!piastrelle.length || !sezioni.length) return;

  var griglia = document.querySelector(".category-tiles");
  var EN = location.pathname.indexOf("/en/") === 0;
  var T = EN
    ? { indietro: "All categories", scegli: "Choose a category", quanti: function (n) { return n + (n === 1 ? " dish" : " dishes"); } }
    : { indietro: "Tutte le categorie", scegli: "Scegli una categoria", quanti: function (n) { return n + (n === 1 ? " piatto" : " piatti"); } };

  var strettoQuery = window.matchMedia("(max-width: 900px)");
  var aperta = null;          // id della categoria aperta, su telefono

  // ------------------------------------------------- evidenza sulle piastrelle
  function segnaAttiva(id) {
    piastrelle.forEach(function (p) {
      var suo = p.dataset.target === id;
      if (p.classList.contains("menu-tab")) p.setAttribute("aria-selected", suo ? "true" : "false");
      else p.classList.toggle("is-active", suo);
    });
  }

  // --------------------------------------------------- barra per tornare su
  var barra = document.createElement("div");
  barra.className = "barra-categoria";
  barra.hidden = true;
  barra.innerHTML =
    '<button type="button" class="torna-categorie">' +
    '<span aria-hidden="true">←</span> ' + T.indietro + "</button>" +
    '<span class="barra-titolo"></span>';
  if (griglia && griglia.parentNode) griglia.parentNode.insertBefore(barra, griglia);
  barra.querySelector(".torna-categorie").addEventListener("click", function () {
    if (history.state && history.state.categoria) history.back();
    else mostraCategorie();
  });

  // ------------------------------------------------------------- i due livelli
  function mostraCategorie() {
    aperta = null;
    document.body.classList.remove("categoria-aperta");
    barra.hidden = true;
    // Da telefono il primo livello sono SOLO le categorie: se lasciassimo
    // aperte anche le sezioni dei piatti resterebbe il muro da scorrere che
    // volevamo togliere. Da computer restano visibili tutte.
    var stretto = strettoQuery.matches;
    sezioni.forEach(function (s) { s.hidden = stretto; });
    segnaAttiva(null);
  }

  function apriCategoria(id, spingiStoria) {
    var sezione = document.getElementById(id);
    if (!sezione) return;
    aperta = id;
    document.body.classList.add("categoria-aperta");

    sezioni.forEach(function (s) { s.hidden = s.id !== id; });

    var titolo = sezione.querySelector("h2");
    var piatti = sezione.querySelectorAll(".menu-item").length;
    barra.querySelector(".barra-titolo").textContent =
      (titolo ? titolo.textContent : "") + " · " + T.quanti(piatti);
    barra.hidden = false;
    segnaAttiva(id);

    // il tasto indietro del telefono deve riportare alle categorie
    if (spingiStoria) history.pushState({ categoria: id }, "", "#" + id);
    window.scrollTo({ top: barra.offsetTop - 70, behavior: "smooth" });
  }

  window.addEventListener("popstate", function () {
    if (!strettoQuery.matches) return;
    if (history.state && history.state.categoria) apriCategoria(history.state.categoria, false);
    else mostraCategorie();
  });

  // ------------------------------------------------------------------ click
  piastrelle.forEach(function (p) {
    p.addEventListener("click", function () {
      var id = p.dataset.target;
      var sezione = document.getElementById(id);
      if (!sezione) return;

      if (strettoQuery.matches) {
        apriCategoria(id, true);
      } else {
        segnaAttiva(id);
        sezione.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // -------------------------------------------- passaggio telefono <-> computer
  // Ruotando il telefono o allargando la finestra le regole cambiano: se
  // si torna larghi vanno rimostrate tutte le sezioni, altrimenti restano
  // nascoste senza che nulla lo spieghi.
  function adegua() {
    if (strettoQuery.matches) {
      if (!aperta) mostraCategorie();
    } else {
      document.body.classList.remove("categoria-aperta");
      barra.hidden = true;
      sezioni.forEach(function (s) { s.hidden = false; });
    }
  }
  if (strettoQuery.addEventListener) strettoQuery.addEventListener("change", adegua);
  else if (strettoQuery.addListener) strettoQuery.addListener(adegua);

  // ------------------------------------------------------------- avvio
  // Un link con l'ancora (#calzoni) deve aprire quella categoria, non
  // scaricare l'utente in mezzo a una lista senza contesto.
  var ancora = location.hash.replace("#", "");
  if (strettoQuery.matches) {
    if (ancora && document.getElementById(ancora)) apriCategoria(ancora, false);
    else mostraCategorie();
  }

  // evidenza mentre si scorre: serve solo da computer, dove si vede tutto
  if ("IntersectionObserver" in window) {
    var osservatore = new IntersectionObserver(function (voci) {
      if (strettoQuery.matches) return;
      voci.forEach(function (v) { if (v.isIntersecting) segnaAttiva(v.target.id); });
    }, { rootMargin: "-140px 0px -70% 0px", threshold: 0 });
    sezioni.forEach(function (s) { osservatore.observe(s); });
  }
})();
