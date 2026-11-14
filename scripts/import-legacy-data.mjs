import fs from "node:fs";
import vm from "node:vm";

function makeSandbox() {
  const sandbox = {
    window: {},
    document: {
      addEventListener() {},
      documentElement: { lang: "en", setAttribute() {} },
      querySelectorAll() { return []; },
      querySelector() { return null; },
    },
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout,
    clearTimeout,
    console,
  };
  sandbox.window = sandbox;
  return sandbox;
}

fs.mkdirSync("data/i18n", { recursive: true });

const catalogSandbox = makeSandbox();
vm.createContext(catalogSandbox);
vm.runInContext(fs.readFileSync("legacy/src/product-catalog.js", "utf8"), catalogSandbox);
fs.writeFileSync(
  "data/products.json",
  JSON.stringify(catalogSandbox.window.PRTS_CATALOG, null, 2) + "\n",
);

const i18nSandbox = makeSandbox();
vm.createContext(i18nSandbox);
vm.runInContext(fs.readFileSync("legacy/src/forecast-i18n.js", "utf8"), i18nSandbox);
const dict = i18nSandbox.window.FV3_I18N;
fs.writeFileSync("data/i18n/en.json", JSON.stringify(dict.en, null, 2) + "\n");
fs.writeFileSync("data/i18n/id.json", JSON.stringify(dict.id, null, 2) + "\n");

console.log(
  `Imported ${catalogSandbox.window.PRTS_CATALOG.length} products, ` +
    `${Object.keys(dict.en).length} EN keys, ${Object.keys(dict.id).length} ID keys.`,
);
