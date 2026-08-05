(function () {
  var tabs = document.querySelectorAll(".menu-tab, .category-tile");
  var sections = document.querySelectorAll(".menu-category");
  if (!tabs.length || !sections.length) return;

  function setActive(id) {
    tabs.forEach(function (tab) {
      var isMatch = tab.dataset.target === id;
      if (tab.classList.contains("menu-tab")) {
        tab.setAttribute("aria-selected", isMatch ? "true" : "false");
      } else {
        tab.classList.toggle("is-active", isMatch);
      }
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = document.getElementById(tab.dataset.target);
      if (!target) return;
      setActive(tab.dataset.target);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 }
    );
    sections.forEach(function (section) {
      observer.observe(section);
    });
  }
})();
