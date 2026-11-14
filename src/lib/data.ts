import productsJson from "../../data/products.json";
import archetypesJson from "../../data/archetypes.json";
import tiersJson from "../../data/tiers.json";
import enJson from "../../data/i18n/en.json";
import idJson from "../../data/i18n/id.json";

import type { ArchetypeMap, ArchetypeKey } from "@/types/archetype";
import type { Product } from "@/types/product";
import type { Tier } from "@/types/tier";

export const PRODUCTS = productsJson as Product[];
export const ARCHETYPES = archetypesJson as ArchetypeMap;
export const TIERS = tiersJson as Tier[];

export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES) as ArchetypeKey[];

export const DICTIONARIES = {
  en: enJson as Record<string, string>,
  id: idJson as Record<string, string>,
};

export type Lang = keyof typeof DICTIONARIES;

export const DEFAULT_ARCHETYPE: ArchetypeKey = "LIMITED";
