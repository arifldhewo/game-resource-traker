(function(){
  "use strict";

  var nav = document.querySelector(".nav");
  if (!nav) return;

  var toggle = nav.querySelector(".nav-toggle");
  var menu = nav.querySelector(".nav-links");
  if (!toggle || !menu) return;

  function close(){
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function(e){
    e.stopPropagation();
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", function(e){
    if (nav.classList.contains("open") && !nav.contains(e.target)) close();
  });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") close();
  });

  menu.querySelectorAll("a").forEach(function(link){
    link.addEventListener("click", close);
  });

  window.addEventListener("resize", function(){
    if (window.innerWidth > 760) close();
  });
})();
