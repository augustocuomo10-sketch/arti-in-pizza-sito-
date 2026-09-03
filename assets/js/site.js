(function () {
  // Ombra sull'header quando si scorre la pagina
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Menu di navigazione su telefono: apre/chiude il pannello a tendina
  var siteHeader = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  if (siteHeader && navToggle) {
    var setNav = function (open) {
      siteHeader.setAttribute("data-nav-open", open ? "true" : "false");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    setNav(false);
    navToggle.addEventListener("click", function () {
      setNav(siteHeader.getAttribute("data-nav-open") !== "true");
    });
    // toccando una voce il pannello si chiude
    siteHeader.querySelectorAll(".main-nav a").forEach(function (link) {
      link.addEventListener("click", function () { setNav(false); });
    });
    // Esc chiude e riporta il fuoco sul pulsante
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && siteHeader.getAttribute("data-nav-open") === "true") {
        setNav(false);
        navToggle.focus();
      }
    });
    // tornando a schermo largo lo stato si azzera
    window.addEventListener("resize", function () {
      if (window.innerWidth > 820) setNav(false);
    });
  }

  // Mappa storia: legenda e pin si evidenziano a vicenda al passaggio del mouse
  document.querySelectorAll(".italy-map-legend .leg").forEach(function (leg) {
    var pin = document.querySelector('.map-pin[data-stop="' + leg.dataset.stop + '"]');
    if (!pin) return;
    leg.addEventListener("mouseenter", function () { pin.classList.add("is-highlighted"); });
    leg.addEventListener("mouseleave", function () { pin.classList.remove("is-highlighted"); });
    pin.addEventListener("mouseenter", function () { leg.classList.add("is-highlighted-from-pin"); });
    pin.addEventListener("mouseleave", function () { leg.classList.remove("is-highlighted-from-pin"); });
  });

  // Ticker recensioni: rotazione automatica delle frasi
  var reduceMotionTicker = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".review-ticker").forEach(function (ticker) {
    var ticks = ticker.querySelectorAll(".tick");
    if (!ticks.length) return;
    var current = 0;
    ticks[0].classList.add("is-active");
    if (reduceMotionTicker || ticks.length < 2) return;
    setInterval(function () {
      ticks[current].classList.remove("is-active");
      current = (current + 1) % ticks.length;
      ticks[current].classList.add("is-active");
    }, 3800);
  });

  // Badge "prezzo migliore garantito": click per aprire il dettaglio
  document.querySelectorAll(".guarantee").forEach(function (badge) {
    var btn = badge.querySelector(".guarantee-more");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var isOpen = badge.getAttribute("data-open") === "true";
      badge.setAttribute("data-open", isOpen ? "false" : "true");
      btn.textContent = isOpen ? "Come funziona?" : "Nascondi";
    });
  });

  // Conteggio animato: elementi con [data-count-to] (es. "302", "4.7").
  // Regola: il valore finale è già a schermo (HTML statico + questa riga),
  // così Google indicizza il numero giusto e chi scorre veloce non legge "3 anni".
  // L'animazione da 0 parte solo dopo che l'IntersectionObserver conferma
  // che si può animare — mai come stato iniziale visibile.
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var countEls = document.querySelectorAll("[data-count-to]");

  // Anni di attività calcolati da un'unica costante: il numero non invecchia.
  var ANNO_APERTURA = 1997;
  var anniAttivita = new Date().getFullYear() - ANNO_APERTURA;

  function formatta(value, decimals, suffix) {
    return value.toFixed(decimals).replace(".", ",") + suffix;
  }
  function leggiTarget(el) {
    // Se l'elemento è il contatore degli anni, riallinea al valore corrente.
    if (el.dataset.contatore === "anni") {
      el.setAttribute("data-count-to", String(anniAttivita));
    }
    return parseFloat(el.getAttribute("data-count-to"));
  }
  function runCount(el, target, decimals, suffix) {
    var duration = 1400;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatta(target * eased, decimals, suffix);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = formatta(target, decimals, suffix);
    }
    requestAnimationFrame(step);
  }
  countEls.forEach(function (el) {
    var target = leggiTarget(el);
    var decimals = el.getAttribute("data-decimals") ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (isNaN(target)) return;
    // Prima cosa: valore corretto già a schermo. Nessuno vede lo zero.
    el.textContent = formatta(target, decimals, suffix);
    if (reduceMotion) return;
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCount(el, target, decimals, suffix);
          obs.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
  });

  // Reveal on scroll (include anche le griglie a cascata .reveal-stagger)
  var revealEls = document.querySelectorAll(".reveal-on-scroll, .reveal-stagger");
  if (revealEls.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      revealEls.forEach(function (el) {
        io.observe(el);
      });
    } else {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }
})();
