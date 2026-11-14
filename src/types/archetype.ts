export type ArchetypeKey =
  | "LIMITED"
  | "EVENT"
  | "STANDARD"
  | "CROSSOVER"
  | "KERNEL";

export interface Archetype {
  name: string;
  rateUp: number;
  isolated: boolean;
  spark: number | null;
  guaranteeAt: number | null;
  freePulls: number;
  freePullsLabel: string | null;
  desc: string;
}

export type ArchetypeMap = Record<ArchetypeKey, Archetype>;
