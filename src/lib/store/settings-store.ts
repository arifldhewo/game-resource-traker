"use client";

import { create } from "zustand";
import { PRODUCTS } from "@/lib/data";
import type { Settings } from "@/types/settings";

export const SETTINGS_KEY = "fv3.settings";

export function defaultSettings(): Settings {
  const products: Record<string, boolean> = {};
  PRODUCTS.forEach((p) => {
    products[p.id] = p.category === "starter" ? false : p.defaultEnabled;
  });
  return { version: 1, products };
}

function loadSettings(): Settings {
  const defaults = defaultSettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    if (!parsed || typeof parsed !== "object" || !parsed.products) {
      return defaults;
    }
    const products = { ...defaults.products };
    Object.keys(defaults.products).forEach((id) => {
      if (typeof parsed.products![id] === "boolean") {
        products[id] = parsed.products![id];
      }
    });
    return { version: 1, products };
  } catch {
    return defaults;
  }
}

function persist(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate: () => void;
  setProduct: (id: string, enabled: boolean) => void;
  reset: () => void;
  isEnabled: (id: string) => boolean;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...defaultSettings(),
  hydrated: false,

  hydrate: () => {
    const settings = loadSettings();
    set({ ...settings, hydrated: true });

    if (typeof window === "undefined") return;
    window.addEventListener("storage", (e) => {
      if (e.key !== SETTINGS_KEY) return;
      const next = loadSettings();
      set({ ...next });
    });
  },

  setProduct: (id, enabled) => {
    const current = get();
    const products = { ...current.products, [id]: enabled };
    const next: Settings = { version: 1, products };
    persist(next);
    set({ products });
  },

  reset: () => {
    const next = defaultSettings();
    persist(next);
    set({ ...next });
  },

  isEnabled: (id) => {
    const current = get();
    if (typeof current.products[id] === "boolean") {
      return current.products[id];
    }
    const product = PRODUCTS.find((p) => p.id === id);
    return product?.defaultEnabled ?? false;
  },
}));
