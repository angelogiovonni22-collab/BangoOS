export type JurisdictionPackStatus = "active" | "superseded" | "draft";

export type JurisdictionPack = {
  packId: string;
  jurisdiction: string;
  rulesetId: string;
  rulesetVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: JurisdictionPackStatus;
  statutoryReferences: readonly string[];
};

export const OHIO_RESIDENTIAL_HOME_CONSTRUCTION_PACK: JurisdictionPack = {
  packId: "US-OH-RESIDENTIAL-HOME-CONSTRUCTION",
  jurisdiction: "OH",
  rulesetId: "OH_RESIDENTIAL_HOME_CONSTRUCTION",
  rulesetVersion: "2026-08-14.1",
  effectiveFrom: "2026-08-14",
  effectiveTo: null,
  status: "active",
  statutoryReferences: ["ORC 4722.01", "ORC 4722.02", "ORC 4722.04"],
};

const JURISDICTION_PACKS: readonly JurisdictionPack[] = [OHIO_RESIDENTIAL_HOME_CONSTRUCTION_PACK];

export type SupportedJurisdictionPack = JurisdictionPack;

export function listJurisdictionPacks(): readonly SupportedJurisdictionPack[] {
  return JURISDICTION_PACKS;
}

export function getJurisdictionPackByRuleset(rulesetId: string, rulesetVersion?: string | null) {
  return JURISDICTION_PACKS.find((pack) =>
    pack.rulesetId === rulesetId && (!rulesetVersion || pack.rulesetVersion === rulesetVersion),
  ) ?? null;
}

export function getActiveJurisdictionPack(jurisdiction: string, onDate = new Date()) {
  const isoDate = onDate.toISOString().slice(0, 10);
  const normalized = jurisdiction.trim().toUpperCase();

  return JURISDICTION_PACKS.find((pack) =>
    pack.jurisdiction === normalized
    && pack.status === "active"
    && pack.effectiveFrom <= isoDate
    && (!pack.effectiveTo || pack.effectiveTo >= isoDate),
  ) ?? null;
}
