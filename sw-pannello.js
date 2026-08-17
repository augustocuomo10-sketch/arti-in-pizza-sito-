/* Service worker del pannello ordini.
 *
 * Vive fuori dalla pagina e resta attivo anche a pannello chiuso: e' lui
 * che riceve la spinta dal server e fa comparire la notifica sul telefono.
 *
 * Scelta deliberata: la notifica NON trasporta i dati dell'ordine.
 * Trasportarli richiederebbe di cifrare il contenuto, e soprattutto
 * significherebbe far transitare nome, telefono e indirizzo del cliente
 * attraverso i server push di Google e Apple. Meglio un avviso secco:
 * si tocca, si apre il pannello, e i dati restano dove devono stare.
 */

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (e) {
  var titolo = "Nuovo ordine";
  var corpo = "Tocca per aprire il pannello.";

  // Se un giorno il server manderà un testo, lo usiamo; altrimenti restano
  // le diciture generiche qui sopra.
  try {
    if (e.data) {
      var d = e.data.json();
      if (d.titolo) titolo = d.titolo;
      if (d.corpo) corpo = d.corpo;
    }
  } catch (err) { /* payload non leggibile: si resta sul generico */ }

  e.waitUntil(
    self.registration.showNotification(titolo, {
      body: corpo,
      icon: "/assets/img/icone/icona-192.png",
      badge: "/assets/img/icone/icona-192.png",
      tag: "ordine",              // niente valanghe: le notifiche si accorpano
      renotify: true,
      requireInteraction: true,   // resta finché non la si guarda
      vibrate: [200, 100, 200, 100, 200],
      data: { url: "/pannello.html" }
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var destinazione = (e.notification.data && e.notification.data.url) || "/pannello.html";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (finestre) {
      // se il pannello è già aperto da qualche parte, si porta in primo piano
      for (var i = 0; i < finestre.length; i++) {
        if (finestre[i].url.indexOf("/pannello.html") !== -1 && "focus" in finestre[i]) {
          return finestre[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destinazione);
    })
  );
});
