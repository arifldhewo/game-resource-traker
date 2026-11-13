/*
 * PRTS Forecast — browser QA
 *
 * How to run:
 *   1. Open forecast.html in the browser (ideally a fresh profile).
 *   2. Open DevTools → Console.
 *   3. Paste this whole file and press Enter.
 *
 * The script prints a PASS/FAIL table and returns the results array.
 * It does not change saved settings or forecast inputs.
 */
(function(){
  "use strict";

  var results = [];

  function check(name, condition, actual, expected){
    results.push({
      name: name,
      pass: !!condition,
      actual: actual,
      expected: expected
    });
  }

  function near(a, b){
    return Math.abs(a - b) < 0.01;
  }

  var P = window.__PRTS__;
  if (!P){
    console.error("PRTS QA: open forecast.html first.");
    return results;
  }

  var cat = P.catalog || [];
  var byId = function(id){
    return cat.filter(function(p){ return p.id === id; })[0];
  };
  var ids = cat.map(function(p){ return p.id; });

  // 1. Catalog and settings defaults
  check("catalog has 12 pull-relevant items", cat.length === 12, cat.length, 12);
  check(
    "non-pull packs are absent",
    !ids.some(function(id){ return /chip|funding|battle|training|special/.test(id); }),
    ids.join(","),
    "no non-pull ids"
  );
  check(
    "starter products default to false",
    cat.filter(function(p){ return p.category === "starter"; }).every(function(p){ return p.defaultEnabled === false; }),
    "catalog defaultEnabled",
    "all false"
  );

  var S = window.PRTS_SETTINGS;
  check("settings store is loaded", !!S, !!S, true);
  check(
    "store defaults starter_monthly = false",
    S && S.DEFAULTS && S.DEFAULTS.products.starter_monthly === false,
    S && S.DEFAULTS && S.DEFAULTS.products.starter_monthly,
    false
  );

  // 2. Starter Monthly + Monthly Card must not create an extra card month
  var card = byId("monthly_card");
  var starter = byId("starter_monthly");
  function windowFor(items, days){
    return P.computeBasketWindow({ items: items, spend: 0, spendCents: 0 }, days, 100);
  }

  var card180 = windowFor([{ prod: card, qty: 1 }], 180);
  check("180d card only → 6 cycles", card180.cardCycles === 6, card180.cardCycles, 6);
  check("180d card only → 70.8 pulls", near(card180.totalPulls, 70.8), card180.totalPulls, 70.8);

  var both180 = windowFor([{ prod: card, qty: 1 }, { prod: starter, qty: 1 }], 180);
  check("180d card + starter → 5 recurring cycles", both180.cardCycles === 5, both180.cardCycles, 5);
  check("180d card + starter → 150 card days", both180.cardDays === 150, both180.cardDays, 150);
  check("180d card + starter → 30 card OP", both180.cardOP === 30, both180.cardOP, 30);
  check("180d card + starter → 73.8 total pulls", near(both180.totalPulls, 73.8), both180.totalPulls, 73.8);

  var both30 = windowFor([{ prod: card, qty: 1 }, { prod: starter, qty: 1 }], 30);
  check("30d card + starter → 0 recurring card cycles", both30.cardCycles === 0, both30.cardCycles, 0);
  check("30d card + starter → 14.8 total pulls", near(both30.totalPulls, 14.8), both30.totalPulls, 14.8);

  // 3. Starter HH replaces up to 2 Monthly HH Pack cycles
  var hh = byId("hh_pack");
  var starterHH = byId("starter_hh");
  var hh180 = windowFor([{ prod: hh, qty: 1 }], 180);
  check("180d HH only → 6 cycles", hh180.hhCycles === 6, hh180.hhCycles, 6);
  check("180d HH only → 135.6 pulls", near(hh180.totalPulls, 135.6), hh180.totalPulls, 135.6);

  var hhStarter180 = windowFor([{ prod: hh, qty: 1 }, { prod: starterHH, qty: 1 }], 180);
  check("180d HH + Starter HH → 4 recurring cycles", hhStarter180.hhCycles === 4, hhStarter180.hhCycles, 4);
  check("180d HH + Starter HH → 90.4 recurring pulls", near(hhStarter180.hhPulls, 90.4), hhStarter180.hhPulls, 90.4);
  check("180d HH + Starter HH → 110.4 total pulls", near(hhStarter180.totalPulls, 110.4), hhStarter180.totalPulls, 110.4);

  var hhStarter30 = windowFor([{ prod: hh, qty: 1 }, { prod: starterHH, qty: 1 }], 30);
  check("30d HH + Starter HH → 0 recurring cycles", hhStarter30.hhCycles === 0, hhStarter30.hhCycles, 0);
  check("30d HH + Starter HH → 20 total pulls", near(hhStarter30.totalPulls, 20), hhStarter30.totalPulls, 20);

  // 4. UI wiring
  check(
    "archetype info trigger exists",
    !!document.querySelector('[data-info="archetype"]'),
    false,
    true
  );
  check(
    "income info trigger exists",
    !!document.querySelector('[data-info="income"]'),
    false,
    true
  );
  check(
    "leviathan info trigger exists",
    !!document.querySelector('[data-info="leviathan"]'),
    false,
    true
  );
  check(
    "outlook delta box is rendered",
    !!document.querySelector("#bdBody .bd-delta-box"),
    false,
    true
  );
  check(
    "settings nav link exists",
    !!document.querySelector('.nav a[href="settings.html"]'),
    false,
    true
  );

  var pass = results.filter(function(r){ return r.pass; }).length;
  var table = results.map(function(r){
    return {
      test: r.name,
      result: r.pass ? "PASS" : "FAIL",
      actual: r.actual,
      expected: r.expected
    };
  });

  if (console.table) console.table(table);
  console.log("PRTS QA: " + pass + "/" + results.length + " passed");
  return results;
})();
