import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/lib/data";
import { defaultSettings } from "@/lib/store/settings-store";

describe("default settings", () => {
  it("covers every catalog product", () => {
    const { products } = defaultSettings();
    expect(Object.keys(products).sort()).toEqual(
      PRODUCTS.map((p) => p.id).sort(),
    );
  });

  it("disables every starter pack", () => {
    const { products } = defaultSettings();
    const starters = PRODUCTS.filter((p) => p.category === "starter");
    expect(starters.length).toBeGreaterThan(0);
    expect(starters.every((p) => products[p.id] === false)).toBe(true);
  });

  it("keeps catalog defaults for non-starter products", () => {
    const { products } = defaultSettings();
    PRODUCTS.filter((p) => p.category !== "starter").forEach((p) => {
      expect(products[p.id]).toBe(p.defaultEnabled);
    });
  });

  it("versions the stored payload", () => {
    expect(defaultSettings().version).toBe(1);
  });
});
