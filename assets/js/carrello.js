/* Carrello e ordine — Arti in Pizza
 * Il menu resta HTML statico (indicizzabile): qui lo arricchiamo con i pulsanti.
 * Pagamento: alla consegna (ordine via WhatsApp) oppure online con SumUp.
 * I prezzi qui servono solo a mostrare il totale: quello valido lo ricalcola il server.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- config
  var CFG = {
    // Cellulare della pizzeria, formato internazionale senza + e senza spazi.
    // Il fisso 031 300809 non puo' ricevere WhatsApp.
    // Quando l'ordine passera' al telefono dedicato, basta cambiare questa riga.
    whatsapp: "393290664551",
    // Endpoint del Worker Cloudflare che verifica l'ordine e apre il checkout SumUp.
    // Es. "https://arti-in-pizza-ordini.<sottodominio>.workers.dev"
    // Finche' e' vuoto, il pagamento online resta disattivato e si ordina
    // solo con pagamento alla consegna: nessun rischio di incassi a vuoto.
    apiPagamenti: "https://bitter-firefly-4508.augusto-cuomo10.workers.dev",
    // percorso relativo: funziona sia da /menu.html sia da /en/menu.html
    pdfAllergeni: location.pathname.indexOf("/en/") === 0 ? "../assets/doc/allergeni.pdf" : "assets/doc/allergeni.pdf",
    consegnaSupplemento: 2.0,
    integraleSupplemento: 1.0,
    ordineMinimoDomicilio: 0,
    // Chiusura straordinaria: data ISO fino a cui non si accettano ordini.
    // Vuota = nessuna chiusura. Deve combaciare con la variabile
    // CHIUSURA_FINO del Worker, che e' quella che decide davvero.
    chiusuraFino: "",
    orari: {
      pranzo: { apre: "11:30", chiude: "15:00", giorni: [1, 2, 3, 4, 5, 6] },
      cena: { apre: "18:30", chiude: "22:00", giorni: [0, 1, 2, 3, 4, 5, 6] }
    }
  };


  // ------------------------------------------------------------- lingua
  // Le pagine inglesi stanno sotto /en/: il carrello e' lo stesso codice,
  // cambiano solo i testi. Gli identificativi dei piatti restano quelli
  // italiani, cosi' il server riconosce l'ordine da qualunque lingua arrivi.
  var EN = location.pathname.indexOf("/en/") === 0;

  var T = EN ? {
    apri: "Order", piatti1: " item", piattiN: " items",
    aggiungi: "Add", titolo: "Your order",
    vuoto: "Your basket is empty. Pick from the menu — prices are the same as in the restaurant.",
    ritiro: "Pick up in store", domicilio: "Home delivery (+",
    piattiRiga: "Items", consegna: "Delivery", totale: "Total",
    nome: "Full name", telefono: "Phone", indirizzo: "Delivery address",
    orario: "What time", orarioSegno: "e.g. 8:00 pm, or «as soon as possible»",
    note: "Notes", notePlaceholder: "Allergies, doorbell, dough preferences…",
    pagamento: "How would you like to pay",
    pagIntro: "Finish here: pay now by card, or on delivery.",
    contanti: "On delivery or pickup", online: "Card online",
    allergeni: "For allergies and intolerances see the ",
    allergeniLink: "allergen table (PDF)", allergeniFine: ", and tell us in the notes.",
    concludi: "Place the order", concludiPaga: "Pay ",
    sospesi: "Orders paused",
    notaContanti: "We send the order to the pizzeria and confirm the timing. You pay on delivery or pickup.",
    notaCarta: "We'll take you to the secure payment page. Once paid, your order is confirmed.",
    chiudi: "Close", togli: "Remove one", metti: "Add one",
    errNome: "We need a name to confirm your order.",
    errTelefono: "That phone number doesn't look right: we need it to confirm.",
    errTelefonoVuoto: "We need your phone: without it we can't confirm the order.",
    errIndirizzo: "We need a full address for delivery.",
    errOrario: "Write a time like 8:00 pm, or «as soon as possible».",
    errChiusi: "We're closed at that time. Lunch 11:30am–3pm (Mon–Sat), dinner 6:30–10pm.",
    errCampi: "Please check the highlighted fields.",
    invio: "Sending…",
    chiuso: "We're closed right now. Lunch 11:30am–3pm (Mon–Sat), dinner 6:30–10pm (every day). You can still build your order and send it when we open.",
    integrale: "wholemeal"
  } : {
    apri: "Ordina", piatti1: " piatto", piattiN: " piatti",
    aggiungi: "Aggiungi", titolo: "Il tuo ordine",
    vuoto: "Il carrello è vuoto. Scegli dal menù qui accanto — i prezzi sono quelli del locale.",
    ritiro: "Ritiro in pizzeria", domicilio: "Consegna a domicilio (+",
    piattiRiga: "Piatti", consegna: "Consegna", totale: "Totale",
    nome: "Nome e cognome", telefono: "Telefono", indirizzo: "Indirizzo di consegna",
    orario: "A che ora", orarioSegno: "es. 20:00, oppure «prima possibile»",
    note: "Note", notePlaceholder: "Allergie, citofono, preferenze sull'impasto…",
    pagamento: "Come vuoi pagare",
    pagIntro: "' + T.pagIntro + '",
    contanti: "Alla consegna o al ritiro", online: "Online con carta",
    allergeni: "Per allergie e intolleranze consulta la ",
    allergeniLink: "tabella allergeni (PDF)", allergeniFine: ", e scrivilo nelle note.",
    concludi: "Concludi l'ordine", concludiPaga: "Concludi e paga ",
    sospesi: "Ordini sospesi",
    notaContanti: "Inviamo l'ordine in pizzeria e ti confermiamo noi i tempi. Paghi alla consegna o al ritiro.",
    notaCarta: "Ti portiamo sulla pagina di pagamento sicura. A pagamento riuscito l'ordine è confermato.",
    chiudi: "Chiudi", togli: "Togli uno", metti: "Aggiungi uno",
    errNome: "Serve un nome per confermare l'ordine.",
    errTelefono: "Il numero non sembra valido: serve per confermarti l'ordine.",
    errTelefonoVuoto: "Serve il telefono: senza non possiamo confermarti l'ordine.",
    errIndirizzo: "Per la consegna a domicilio serve l'indirizzo.",
    errOrario: "Scrivi un orario tipo 20:00, oppure «prima possibile».",
    errChiusi: "A quell'ora siamo chiusi. Pranzo 11:30–15:00 (lun–sab), cena 18:30–22:00.",
    errCampi: "Controlla i campi segnalati qui sopra.",
    invio: "Invio in corso…",
    chiuso: "Ora siamo chiusi. Pranzo 11:30–15:00 (lun–sab), cena 18:30–22:00 (tutti i giorni). Puoi comunque preparare l'ordine e inviarlo all'apertura.",
    integrale: "integrale"
  };

  var FORMATI_EN = { Classica: "Classic", Ruota: "Ruota", unico: "" };
  function mostraFormato(f) { return EN ? (FORMATI_EN[f] !== undefined ? FORMATI_EN[f] : f) : f; }

  var CHIAVE = "aip_carrello_v1";
  var carrello = [];

  // ------------------------------------------------------------- apertura
  function minuti(hhmm) {
    var p = hhmm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function statoApertura(ora) {
    var d = ora || new Date();
    var riapertura = CFG.chiusuraFino ? new Date(CFG.chiusuraFino + "T00:00:00") : null;
    if (riapertura && d < riapertura) {
      return {
        aperto: false,
        chiusuraFerie: true,
        messaggio: "Siamo chiusi per ferie. Riapriamo lunedì 18 agosto: puoi comporre l'ordine, ma potrai inviarlo da lunedì."
      };
    }
    var g = d.getDay();
    var m = d.getHours() * 60 + d.getMinutes();
    var fasce = [CFG.orari.pranzo, CFG.orari.cena];
    for (var i = 0; i < fasce.length; i++) {
      var f = fasce[i];
      if (f.giorni.indexOf(g) !== -1 && m >= minuti(f.apre) && m < minuti(f.chiude)) {
        return { aperto: true, messaggio: "" };
      }
    }
    return {
      aperto: false,
      chiusuraFerie: false,
      messaggio: T.chiuso
    };
  }

  // -------------------------------------------------------------- persistenza
  function carica() {
    try {
      var g = localStorage.getItem(CHIAVE);
      carrello = g ? JSON.parse(g) : [];
      if (!Array.isArray(carrello)) carrello = [];
    } catch (e) { carrello = []; }
  }
  function salva() {
    try { localStorage.setItem(CHIAVE, JSON.stringify(carrello)); } catch (e) {}
  }

  function euro(n) { return n.toFixed(2).replace(".", ",") + " €"; }

  function rigaChiave(r) { return r.id + "|" + r.formato + "|" + (r.integrale ? "int" : "no"); }

  function totaleRighe() {
    return carrello.reduce(function (s, r) {
      return s + (r.prezzo + (r.integrale ? CFG.integraleSupplemento : 0)) * r.qta;
    }, 0);
  }
  function numeroPezzi() {
    return carrello.reduce(function (s, r) { return s + r.qta; }, 0);
  }

  function aggiungi(riga) {
    var k = rigaChiave(riga);
    var esistente = null;
    for (var i = 0; i < carrello.length; i++) {
      if (rigaChiave(carrello[i]) === k) { esistente = carrello[i]; break; }
    }
    if (esistente) esistente.qta += riga.qta;
    else carrello.push(riga);
    salva(); render();
  }

  function cambiaQta(k, delta) {
    for (var i = 0; i < carrello.length; i++) {
      if (rigaChiave(carrello[i]) === k) {
        carrello[i].qta += delta;
        if (carrello[i].qta <= 0) carrello.splice(i, 1);
        break;
      }
    }
    salva(); render();
  }

  // ------------------------------------------------- pulsanti dentro al menu
  function creaPulsanti() {
    var piatti = document.querySelectorAll("[data-piatto]");
    if (!piatti.length) return false;
    piatti.forEach(function (el) {
      var id = el.getAttribute("data-piatto");
      var nome = el.querySelector(".name") ? el.querySelector(".name").textContent.trim() : id;
      var prezzi;
      try { prezzi = JSON.parse(el.getAttribute("data-prezzi")); } catch (e) { return; }
      if (!prezzi || !prezzi.length) return;

      var box = document.createElement("div");
      box.className = "aggiungi-riga";

      prezzi.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn-aggiungi";
        b.setAttribute("aria-label",
          T.aggiungi + " " + nome + (p.formato !== "unico" ? " formato " + p.formato : "") + " al carrello");
        b.innerHTML = '<span aria-hidden="true">+</span> ' +
          (p.formato === "unico" ? T.aggiungi : mostraFormato(p.formato));
        b.addEventListener("click", function () {
          aggiungi({
            id: id, nome: nome, formato: p.formato, prezzo: p.prezzo, qta: 1,
            integrale: false, categoria: el.closest(".menu-category") ? el.closest(".menu-category").id : ""
          });
          b.classList.add("fatto");
          setTimeout(function () { b.classList.remove("fatto"); }, 700);
        });
        box.appendChild(b);
      });
      el.appendChild(box);
    });
    return true;
  }

  // ------------------------------------------------------------- interfaccia
  var pannello, bottoneFlottante;

  function creaInterfaccia() {
    bottoneFlottante = document.createElement("button");
    bottoneFlottante.type = "button";
    bottoneFlottante.className = "carrello-fab";
    bottoneFlottante.setAttribute("aria-controls", "pannello-carrello");
    bottoneFlottante.addEventListener("click", function () { apri(true); });
    document.body.appendChild(bottoneFlottante);

    pannello = document.createElement("div");
    pannello.id = "pannello-carrello";
    pannello.className = "carrello-pannello";
    pannello.setAttribute("role", "dialog");
    pannello.setAttribute("aria-modal", "true");
    pannello.setAttribute("aria-label", "Il tuo ordine");
    pannello.hidden = true;
    document.body.appendChild(pannello);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pannello.hidden) apri(false);
    });
  }

  function apri(si) {
    pannello.hidden = !si;
    document.body.classList.toggle("carrello-aperto", si);
    if (si) {
      render();
      var primo = pannello.querySelector("button, input, select, textarea");
      if (primo) primo.focus();
    } else {
      bottoneFlottante.focus();
    }
  }

  function render() {
    var pezzi = numeroPezzi();
    var tot = totaleRighe();

    bottoneFlottante.innerHTML =
      '<span class="fab-icona" aria-hidden="true">🛒</span>' +
      '<span class="fab-testo">' + (pezzi ? pezzi + (pezzi === 1 ? T.piatti1 : T.piattiN) : T.apri) + '</span>' +
      (pezzi ? '<span class="fab-tot">' + euro(tot) + "</span>" : "");
    bottoneFlottante.setAttribute("aria-label",
      pezzi ? "Apri l'ordine: " + pezzi + " piatti, totale " + euro(tot) : "Apri il carrello, vuoto");
    bottoneFlottante.classList.toggle("ha-roba", pezzi > 0);

    if (pannello.hidden) return;

    var stato = statoApertura();
    var h = '<div class="carrello-testa">' +
      "<h2>" + T.titolo + "</h2>" +
      '<button type="button" class="carrello-chiudi" aria-label="Chiudi">✕</button></div>';

    if (!stato.aperto) {
      h += '<p class="carrello-avviso' + (stato.chiusuraFerie ? " ferie" : "") + '">' + stato.messaggio + "</p>";
    }

    if (!carrello.length) {
      h += '<p class="carrello-vuoto">' + T.vuoto + '</p>';
      pannello.innerHTML = h;
      agganciaChiusura();
      return;
    }

    h += '<ul class="carrello-righe">';
    carrello.forEach(function (r) {
      var unit = r.prezzo + (r.integrale ? CFG.integraleSupplemento : 0);
      var k = rigaChiave(r);
      h += '<li class="carrello-riga">' +
        '<div class="riga-testo"><span class="riga-nome">' + r.nome + "</span>" +
        (r.formato !== "unico" ? '<span class="riga-formato">' + mostraFormato(r.formato) + "</span>" : "") +
        (r.integrale ? '<span class="riga-formato">' + T.integrale + '</span>' : "") +
        '<span class="riga-prezzo">' + euro(unit) + " × " + r.qta + "</span></div>" +
        '<div class="riga-qta">' +
        '<button type="button" data-meno="' + k + '" aria-label="Togli uno">−</button>' +
        "<span>" + r.qta + "</span>" +
        '<button type="button" data-piu="' + k + '" aria-label="Aggiungi uno">+</button>' +
        "</div></li>";
    });
    h += "</ul>";

    h += '<div class="carrello-modalita" role="radiogroup" aria-label="Come vuoi ricevere l\'ordine">' +
      '<label><input type="radio" name="modalita" value="asporto" checked> ' + T.ritiro + '</label>' +
      '<label><input type="radio" name="modalita" value="domicilio"> ' + T.domicilio +
      euro(CFG.consegnaSupplemento) + ")</label></div>";

    h += '<div class="carrello-totali">' +
      '<div class="tot-riga"><span>' + T.piattiRiga + '</span><span id="tot-piatti">' + euro(tot) + "</span></div>" +
      '<div class="tot-riga" id="riga-consegna" hidden><span>' + T.consegna + '</span><span>' + euro(CFG.consegnaSupplemento) + "</span></div>" +
      '<div class="tot-riga tot-finale"><span>' + T.totale + '</span><span id="tot-finale">' + euro(tot) + "</span></div></div>";

    h += '<form class="carrello-form" novalidate>' +
      '<label>' + T.nome + '<input type="text" name="nome" required autocomplete="name"></label>' +
      '<label>' + T.telefono + '<input type="tel" name="telefono" required autocomplete="tel" inputmode="tel"></label>' +
      '<label class="campo-indirizzo" hidden>' + T.indirizzo + '<input type="text" name="indirizzo" autocomplete="street-address"></label>' +
      '<label>' + T.orario + '<input type="text" name="orario" placeholder="' + T.orarioSegno + '"></label>' +
      '<label>' + T.note + '<textarea name="note" rows="2" placeholder="' + T.notePlaceholder + '"></textarea></label>' +
      '<fieldset class="carrello-pagamento"><legend>' + T.pagamento + '</legend>' +
      '<p class="pag-intro">' + T.pagIntro + '</p>' +
      '<label><input type="radio" name="pagamento" value="contanti" checked> ' + T.contanti + '</label>' +
      '<label class="pag-online"><input type="radio" name="pagamento" value="online"' +
      (CFG.apiPagamenti ? "" : " disabled") + '> ' + T.online + '' +
      (CFG.apiPagamenti ? "" : ' <span class="presto">— attivo a breve</span>') + "</label></fieldset>" +
      '<p class="carrello-allergeni">Allergie o intolleranze? Consulta la <a href="' + CFG.pdfAllergeni + '" target="_blank" rel="noopener">tabella allergeni</a> e scrivicelo nelle note: prima di confermare ti richiamiamo.</p>' +
      '<button type="submit" class="btn btn-primary btn-block btn-invia"' + (stato.aperto ? "" : " disabled") + ">" +
      (stato.aperto ? T.concludi : T.sospesi) + "</button>" +
      '<p class="carrello-nota"></p>' +
      "</form>";

    pannello.innerHTML = h;
    agganciaChiusura();
    agganciaEventi();
  }

  function agganciaChiusura() {
    var c = pannello.querySelector(".carrello-chiudi");
    if (c) c.addEventListener("click", function () { apri(false); });
  }

  function agganciaEventi() {
    pannello.querySelectorAll("[data-meno]").forEach(function (b) {
      b.addEventListener("click", function () { cambiaQta(b.getAttribute("data-meno"), -1); });
    });
    pannello.querySelectorAll("[data-piu]").forEach(function (b) {
      b.addEventListener("click", function () { cambiaQta(b.getAttribute("data-piu"), 1); });
    });

    var radios = pannello.querySelectorAll('input[name="modalita"]');
    var rigaConsegna = pannello.querySelector("#riga-consegna");
    var campoInd = pannello.querySelector(".campo-indirizzo");
    var totFinale = pannello.querySelector("#tot-finale");

    function aggiornaTotale() {
      var domicilio = pannello.querySelector('input[name="modalita"]:checked').value === "domicilio";
      rigaConsegna.hidden = !domicilio;
      campoInd.hidden = !domicilio;
      campoInd.querySelector("input").required = domicilio;
      totFinale.textContent = euro(totaleRighe() + (domicilio ? CFG.consegnaSupplemento : 0));
    }
    radios.forEach(function (r) { r.addEventListener("change", aggiornaTotale); });
    aggiornaTotale();

    agganciaSuggerimenti(campoInd.querySelector("input"));
    agganciaVerificheCampi();

    // il pulsante deve dire cosa succede davvero premendolo
    var radioPag = pannello.querySelectorAll('input[name="pagamento"]');
    function aggiornaEtichettaInvio() {
      var btn = pannello.querySelector(".btn-invia");
      var nota = pannello.querySelector(".carrello-nota");
      if (!btn || btn.disabled) return;
      var online = pannello.querySelector('input[name="pagamento"]:checked').value === "online";
      if (online) {
        btn.textContent = T.concludiPaga + euro(totaleRighe() +
          (pannello.querySelector('input[name="modalita"]:checked').value === "domicilio" ? CFG.consegnaSupplemento : 0));
        nota.textContent = T.notaCarta;
      } else {
        btn.textContent = T.concludi;
        nota.textContent = T.notaContanti;
      }
    }
    radioPag.forEach(function (r) { r.addEventListener("change", aggiornaEtichettaInvio); });
    radios.forEach(function (r) { r.addEventListener("change", aggiornaEtichettaInvio); });
    aggiornaEtichettaInvio();

    pannello.querySelector(".carrello-form").addEventListener("submit", function (e) {
      e.preventDefault();
      inviaOrdine(e.target);
    });
  }

  // ----------------------------------------------------------------- invio
  function componiTesto(d) {
    var righe = ["*Nuovo ordine — artiinpizza.com*", ""];
    carrello.forEach(function (r) {
      var unit = r.prezzo + (r.integrale ? CFG.integraleSupplemento : 0);
      righe.push("• " + r.qta + "× " + r.nome +
        (r.formato !== "unico" ? " (" + r.formato + ")" : "") +
        (r.integrale ? " [integrale]" : "") + " — " + euro(unit * r.qta));
    });
    righe.push("");
    righe.push(d.modalita === "domicilio" ? "Consegna a domicilio" : "Ritiro in pizzeria");
    if (d.modalita === "domicilio") righe.push("Indirizzo: " + d.indirizzo);
    righe.push("Totale: " + euro(totaleRighe() + (d.modalita === "domicilio" ? CFG.consegnaSupplemento : 0)));
    righe.push("Pagamento: " + (d.pagamento === "online" ? "online con carta" : "alla consegna/ritiro"));
    righe.push("");
    righe.push("Nome: " + d.nome);
    righe.push("Telefono: " + d.telefono);
    if (d.orario) righe.push("Orario: " + d.orario);
    if (d.note) righe.push("Note: " + d.note);
    return righe.join("\n");
  }

  function inviaOrdine(form) {
    var f = new FormData(form);
    var d = {
      nome: (f.get("nome") || "").trim(),
      telefono: (f.get("telefono") || "").trim(),
      indirizzo: (f.get("indirizzo") || "").trim(),
      orario: (f.get("orario") || "").trim(),
      note: (f.get("note") || "").trim(),
      modalita: f.get("modalita"),
      pagamento: f.get("pagamento")
    };
    var problemi = [
      [form.querySelector('[name="nome"]'), erroreNome(d.nome)],
      [form.querySelector('[name="telefono"]'), erroreTelefono(d.telefono)],
      [form.querySelector('[name="orario"]'), erroreOrario(d.orario)]
    ].filter(function (x) { return x[1]; });
    if (problemi.length) {
      problemi.forEach(function (x) { mostraErroreCampo(x[0], x[1]); });
      problemi[0][0].focus();
      mostraErrore(T.errCampi);
      return;
    }
    if (d.modalita === "domicilio" && !d.indirizzo) {
      mostraErrore(T.errIndirizzo);
      return;
    }

    if (d.pagamento === "online" && CFG.apiPagamenti) {
      pagaOnline(d);
      return;
    }
    inviaContante(d);
  }

  // Ordine da pagare alla consegna: passa dal server come quello con carta,
  // cosi' subisce le stesse verifiche e finisce nello stesso posto.
  function inviaContante(d) {
    if (!CFG.apiPagamenti) {                      // rete di sicurezza
      window.open("https://wa.me/" + CFG.whatsapp + "?text=" +
        encodeURIComponent(componiTesto(d)), "_blank", "noopener");
      return;
    }
    var btn = pannello.querySelector(".btn-invia");
    var testoPrima = btn.textContent;
    btn.disabled = true;
    btn.textContent = T.invio;

    fetch(CFG.apiPagamenti + "/ordine-contante", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ righe: carrello, cliente: d })
    })
      .then(function (r) { return r.json().then(function (b) { return { stato: r.status, corpo: b }; }); })
      .then(function (res) {
        if (res.stato !== 200 || !res.corpo.riferimento) {
          throw new Error((res.corpo && res.corpo.errore) || "risposta non valida");
        }
        svuota();
        location.href = "ordine-ricevuto.html?ref=" +
          encodeURIComponent(res.corpo.riferimento) + "&modo=contanti";
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = testoPrima;
        mostraErrore(err.message);
      });
  }

  function svuota() {
    carrello = [];
    try { localStorage.removeItem(CHIAVE); } catch (e) {}
  }

  // Il checkout lo crea il server: qui non passano ne' chiavi ne' prezzi attendibili.
  // Il server ricalcola tutto dal proprio catalogo e puo' rifiutare l'ordine.
  function pagaOnline(d) {
    var btn = pannello.querySelector(".btn-invia");
    btn.disabled = true;
    btn.textContent = "Apertura pagamento…";
    fetch(CFG.apiPagamenti + "/crea-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ righe: carrello, cliente: d, origine: location.origin })
    })
      .then(function (r) { return r.json().then(function (b) { return { stato: r.status, corpo: b }; }); })
      .then(function (res) {
        if (res.stato === 200 && res.corpo && res.corpo.url) { svuota(); location.href = res.corpo.url; return; }
        // 422 = l'ordine non ha superato le verifiche del server: il messaggio
        // e' scritto per il cliente, quindi si mostra cosi' com'e'.
        throw new Error((res.corpo && res.corpo.errore) || "risposta non valida");
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Invia l'ordine su WhatsApp";
        mostraErrore(err.message);
      });
  }



  // ------------------------------------------------------ verifiche campi
  // Controlli immediati mentre si compila. Il server rifa' comunque tutto:
  // questi servono a far correggere l'errore subito, non a fidarsi.

  function normalizzaTelefono(v) {
    return String(v).replace(/[\s.\-()\/]/g, "").replace(/^\+39/, "").replace(/^0039/, "");
  }

  function erroreTelefono(v) {
    var t = normalizzaTelefono(v);
    if (!t) return T.errTelefonoVuoto;
    if (/[^0-9]/.test(t)) return "Il numero può contenere solo cifre (e prefisso +39).";
    if (t.length < 8 || t.length > 15) return "Il numero non sembra completo.";
    if (!/^[03]/.test(t)) return "Un numero italiano inizia con 3 (cellulare) o 0 (fisso).";
    return null;
  }

  function erroreOrario(v) {
    var t = String(v).trim();
    if (!t) return null;                                   // vuoto = prima possibile
    if (/^(prima possibile|appena pronto|subito|asap)$/i.test(t)) return null;
    var m = t.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (!m) return T.errOrario;
    var minuti = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var g = new Date().getDay();
    var fasce = [CFG.orari.pranzo, CFG.orari.cena];
    for (var i = 0; i < fasce.length; i++) {
      var f = fasce[i];
      if (f.giorni.indexOf(g) !== -1 && minuti >= minuti2(f.apre) && minuti <= minuti2(f.chiude)) return null;
    }
    return T.errChiusi;
  }

  function minuti2(hhmm) { return minuti(hhmm); }

  function erroreNome(v) {
    var t = String(v).trim();
    if (t.length < 2) return T.errNome;
    if (t.length > 80) return "Nome troppo lungo.";
    return null;
  }

  function mostraErroreCampo(input, testo) {
    var etichetta = input.closest("label");
    var vecchio = etichetta.querySelector(".campo-errore");
    if (vecchio) vecchio.remove();
    input.setAttribute("aria-invalid", testo ? "true" : "false");
    if (!testo) return;
    var s = document.createElement("span");
    s.className = "campo-errore";
    s.textContent = testo;
    etichetta.appendChild(s);
  }

  function agganciaVerificheCampi() {
    var coppie = [
      ["nome", erroreNome],
      ["telefono", erroreTelefono],
      ["orario", erroreOrario]
    ];
    coppie.forEach(function (c) {
      var el = pannello.querySelector('[name="' + c[0] + '"]');
      if (!el) return;
      el.addEventListener("blur", function () { mostraErroreCampo(el, c[1](el.value)); });
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") === "true") mostraErroreCampo(el, c[1](el.value));
      });
    });

    // contatore per le note, il cui limite lato server e' 400
    var note = pannello.querySelector('[name="note"]');
    if (note) {
      var cont = document.createElement("span");
      cont.className = "campo-contatore";
      note.closest("label").appendChild(cont);
      var agg = function () {
        var n = note.value.length;
        cont.textContent = n + "/400";
        cont.classList.toggle("al-limite", n > 400);
        if (n > 400) mostraErroreCampo(note, "Le note superano i 400 caratteri: accorciale.");
        else mostraErroreCampo(note, null);
      };
      note.addEventListener("input", agg);
      agg();
    }
  }

  // ------------------------------------------------- suggerimenti indirizzo
  // Completamento tipo navigatore: il cliente sceglie da un elenco invece di
  // digitare a mano, cosi' l'indirizzo arriva al server in forma riconoscibile.
  // Il server lo riverifica comunque: qui e' solo comodita', non un controllo.
  function agganciaSuggerimenti(input) {
    if (!input) return;
    var elenco = document.createElement("ul");
    elenco.className = "indirizzo-sugg";
    elenco.setAttribute("role", "listbox");
    elenco.hidden = true;
    input.insertAdjacentElement("afterend", elenco);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-autocomplete", "list");

    var attesa = null, voci = [], scelto = -1;

    function chiudi() {
      elenco.hidden = true; elenco.innerHTML = ""; voci = []; scelto = -1;
      input.setAttribute("aria-expanded", "false");
    }

    function etichetta(p) {
      var parti = [];
      if (p.street) parti.push(p.street + (p.housenumber ? " " + p.housenumber : ""));
      else if (p.name) parti.push(p.name);
      if (p.postcode || p.city) parti.push([p.postcode, p.city].filter(Boolean).join(" "));
      return parti.join(", ");
    }

    function disegna() {
      elenco.innerHTML = "";
      voci.forEach(function (t, i) {
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === scelto ? "true" : "false");
        li.className = i === scelto ? "attivo" : "";
        li.textContent = t;
        li.addEventListener("mousedown", function (e) {
          e.preventDefault(); input.value = t; chiudi();
        });
        elenco.appendChild(li);
      });
      elenco.hidden = !voci.length;
      input.setAttribute("aria-expanded", voci.length ? "true" : "false");
    }

    input.addEventListener("input", function () {
      var q = input.value.trim();
      clearTimeout(attesa);
      if (q.length < 4) { chiudi(); return; }
      // si aspetta la pausa di digitazione: evita una richiesta per ogni tasto
      attesa = setTimeout(function () {
        // niente lang=it: Photon accetta solo default/de/en/fr e altrimenti
        // risponde 400. Senza il parametro restituisce i nomi originali,
        // che per gli indirizzi italiani e' esattamente cio' che serve.
        var url = "https://photon.komoot.io/api/?q=" + encodeURIComponent(q) +
          "&lat=45.8044&lon=9.0929&limit=5";
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (d) {
            voci = (d.features || [])
              .filter(function (f) { return f.properties && f.properties.countrycode === "IT"; })
              .map(function (f) { return etichetta(f.properties); })
              .filter(function (t, i, a) { return t && a.indexOf(t) === i; });
            scelto = -1;
            disegna();
          })
          .catch(chiudi);
      }, 300);
    });

    input.addEventListener("keydown", function (e) {
      if (elenco.hidden || !voci.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); scelto = (scelto + 1) % voci.length; disegna(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); scelto = (scelto - 1 + voci.length) % voci.length; disegna(); }
      else if (e.key === "Enter" && scelto >= 0) { e.preventDefault(); input.value = voci[scelto]; chiudi(); }
      else if (e.key === "Escape") { chiudi(); }
    });

    input.addEventListener("blur", function () { setTimeout(chiudi, 120); });
  }

  function mostraErrore(testo) {
    var vecchio = pannello.querySelector(".carrello-errore");
    if (vecchio) vecchio.remove();
    var box = document.createElement("p");
    box.className = "carrello-errore";
    box.setAttribute("role", "alert");
    box.textContent = testo;
    var form = pannello.querySelector(".carrello-form");
    form.insertBefore(box, form.querySelector(".btn-invia"));
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ------------------------------------------------------------------ avvio
  function avvia() {
    if (!creaPulsanti()) return;
    carica();
    creaInterfaccia();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
