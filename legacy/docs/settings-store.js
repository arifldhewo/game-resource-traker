(function(){
  "use strict";

  var KEY = "fv3.settings";
  var VERSION = 1;

  function buildDefaults(){
    var products = {};
    (window.PRTS_CATALOG || []).forEach(function(p){
      // Starter packs are always opt-in.
      products[p.id] = p.category === "starter" ? false : !!p.defaultEnabled;
    });
    return { version: VERSION, products: products };
  }

  var DEFAULTS = buildDefaults();
  var EVENT = "prts:settings";

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  function load(){
    var out = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return out;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return out;
      var saved = parsed.products || {};
      Object.keys(out.products).forEach(function(id){
        if (typeof saved[id] === "boolean") out.products[id] = saved[id];
      });
    } catch(e){}
    return out;
  }

  var current = load();

  function emit(){
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: clone(current) })); } catch(e){}
  }

  function persist(){
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch(e){}
  }

  function save(next){
    if (!next || typeof next.products !== "object") return current;
    Object.keys(DEFAULTS.products).forEach(function(id){
      current.products[id] = next.products[id] === true;
    });
    persist();
    emit();
    return current;
  }

  function setProduct(id, enabled){
    if (!(id in DEFAULTS.products)) return current;
    current.products[id] = !!enabled;
    persist();
    emit();
    return current;
  }

  function reset(){
    current = clone(DEFAULTS);
    persist();
    emit();
    return current;
  }

  function isEnabled(id){
    return current.products[id] === true;
  }

  function subscribe(fn){
    if (typeof fn !== "function") return function(){};
    window.addEventListener(EVENT, fn);
    return function(){ window.removeEventListener(EVENT, fn); };
  }

  window.addEventListener("storage", function(e){
    if (e.key === KEY){
      current = load();
      emit();
    }
  });

  window.PRTS_SETTINGS = {
    KEY: KEY,
    VERSION: VERSION,
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    reset: reset,
    setProduct: setProduct,
    isEnabled: isEnabled,
    subscribe: subscribe,
    getAll: function(){ return clone(current); }
  };
})();
