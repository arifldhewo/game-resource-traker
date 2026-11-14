(function(){
  "use strict";

  var PULL_COST = 600;
  var OP_ORUNDUM = 180;
  var catalog = window.PRTS_CATALOG || [];
  var store = window.PRTS_SETTINGS;
  var rowsEl = document.getElementById("rows");
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  function dict(){
    return (window.FV3_I18N || {})[window.FV3_UI_LANG || "en"] || {};
  }
  function t(key, fallback){
    var d = dict();
    return d[key] != null ? d[key] : (fallback != null ? fallback : key);
  }
  function fmt1(n){
    var v = Math.round(n * 10) / 10;
    return Math.abs(v) % 1 === 0 ? String(v) : v.toFixed(1);
  }
  function pulls(p, opPct){
    var oru = (p.orundum || 0) + (p.op || 0) * OP_ORUNDUM * ((opPct || 100) / 100);
    return oru / PULL_COST + (p.hhPermits || 0) + (p.tenPermits || 0) * 10;
  }
  function limitKey(p){
    if (!p.recurring) return "settings.once";
    return p.purchaseLimit ? "settings.perMonth" : "settings.unlimited";
  }
  function limitFallback(p){
    if (!p.recurring) return "once";
    return p.purchaseLimit ? "1 / month" : "unlimited";
  }
  function sorted(){
    return catalog.slice().sort(function(a, b){
      if (a.defaultEnabled !== b.defaultEnabled) return a.defaultEnabled ? -1 : 1;
      return (pulls(b, 100) / b.price) - (pulls(a, 100) / a.price);
    });
  }

  function render(){
    rowsEl.innerHTML = sorted().map(function(p){
      var on = store ? store.isEnabled(p.id) : !!p.defaultEnabled;
      var value = pulls(p, 100);
      var perDollar = value / p.price;
      var catKey = "settings.category." + p.category;
      var tagKey = p.defaultEnabled ? "settings.core" : "settings.optional";
      var limKey = limitKey(p);
      return '<div class="prow" data-id="' + p.id + '">' +
        '<div class="pinfo">' +
          '<div class="pname">' + p.name +
            '<span class="pcat" data-i18n="' + catKey + '">' + t(catKey, p.category.toUpperCase()) + '</span>' +
            '<span class="ptag ' + (p.defaultEnabled ? "core" : "opt") + '" data-i18n="' + tagKey + '">' +
              t(tagKey, p.defaultEnabled ? "CORE" : "OPTIONAL") +
            '</span>' +
          '</div>' +
          '<div class="pmeta">$' + p.price.toFixed(2) + ' · ' + p.contents +
            ' · <span data-i18n="' + limKey + '">' + t(limKey, limitFallback(p)) + '</span></div>' +
        '</div>' +
        '<div class="pstat"><b>' + fmt1(value) + '</b>' +
          '<span data-i18n="settings.pulls">' + t("settings.pulls", "pulls") + '</span>' +
          '<i>' + perDollar.toFixed(3) + '/$</i>' +
        '</div>' +
        '<button class="tgl" type="button" role="switch" aria-checked="' + on + '" ' +
          'data-toggle="' + p.id + '" aria-label="Toggle ' + p.name + '"></button>' +
      '</div>';
    }).join("");
  }

  function sync(){
    if (!rowsEl) return;
    rowsEl.querySelectorAll("[data-toggle]").forEach(function(btn){
      var id = btn.getAttribute("data-toggle");
      btn.setAttribute("aria-checked", String(store ? store.isEnabled(id) : false));
    });
  }

  function relocalize(){
    var lang = window.FV3_UI_LANG;
    if (!lang){
      try { lang = localStorage.getItem("fv3.uiLang"); } catch(e){}
    }
    if (typeof window.applyI18n === "function") window.applyI18n(lang || "en");
  }

  function toast(msg){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove("show"); }, 2200);
  }

  if (rowsEl){
    rowsEl.addEventListener("click", function(e){
      var btn = e.target.closest("[data-toggle]");
      if (!btn || !store) return;
      var id = btn.getAttribute("data-toggle");
      var next = btn.getAttribute("aria-checked") !== "true";
      store.setProduct(id, next);
      btn.setAttribute("aria-checked", String(next));
      toast(t("settings.saved", "SETTINGS SAVED · LOCAL"));
    });
  }

  var resetBtn = document.getElementById("resetBtn");
  if (resetBtn){
    resetBtn.addEventListener("click", function(){
      if (!store) return;
      store.reset();
      sync();
      toast(t("settings.saved", "SETTINGS SAVED · LOCAL"));
    });
  }

  if (store && typeof store.subscribe === "function") store.subscribe(sync);

  document.querySelectorAll(".lang-switch button[data-lang]").forEach(function(btn){
    btn.addEventListener("click", function(){
      if (typeof window.applyI18n === "function") window.applyI18n(btn.getAttribute("data-lang"));
    });
  });

  render();
  relocalize();
})();
