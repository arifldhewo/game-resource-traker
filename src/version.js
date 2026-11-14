(function(){
  var v = "0.4.3";
  window.PRTS_VERSION = v;
  function paint(){
    var nodes = document.querySelectorAll("[data-app-version]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = "v" + v;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
})();
