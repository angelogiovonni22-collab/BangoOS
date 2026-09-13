import type { BosDimension } from "./building-graph";
import type { BosBoundaryFamilyProvenanceDiagnostic } from "./boundary-family-provenance-diagnostic";

export function diagnoseDimensionChainBoundaries(input: { dimensions: readonly BosDimension[]; provenance: readonly BosBoundaryFamilyProvenanceDiagnostic[] }) {
  const dimensions = new Map(input.dimensions.map((d) => [d.id, d]));
  const endpoints = input.provenance.flatMap((p) => [
    { p, side: "start" as const, c: p.startCoordinate, here: p.startCandidates, other: p.endCandidates },
    { p, side: "end" as const, c: p.endCoordinate, here: p.endCandidates, other: p.startCandidates },
  ]);
  const chains: Array<{ axis: "horizontal" | "vertical"; sharedEndpoint: "start" | "end"; sourceCoordinate: number; dimensionIds: string[]; candidateCoordinates: number[]; recommendedCoordinate: number | null; reason: string }> = [];
  const seen = new Set<number>();
  const unique = (items: readonly { coordinate: number; endpointDistanceMeters: number }[]) => {
    const ranked = items.filter((x) => x.endpointDistanceMeters <= 0.32).sort((a, b) => a.endpointDistanceMeters - b.endpointDistanceMeters);
    return !ranked[0] || (ranked[1] && ranked[1].endpointDistanceMeters - ranked[0].endpointDistanceMeters < 0.06) ? null : ranked[0];
  };
  endpoints.forEach((e, i) => {
    if (seen.has(i)) return;
    const group = endpoints.map((x, j) => ({ x, j })).filter(({ x }) => x.p.axis === e.p.axis && x.side === e.side && Math.abs(x.c - e.c) <= 0.08);
    const ids = [...new Set(group.map(({ x }) => x.p.dimensionId))];
    if (ids.length < 2) return;
    group.forEach(({ j }) => seen.add(j));
    const coords = [...new Set(group.flatMap(({ x }) => x.here.filter((w) => w.endpointDistanceMeters <= 0.32).map((w) => Number(w.coordinate.toFixed(3)))))];
    const valid = coords.filter((coordinate) => group.every(({ x }) => {
      const d = dimensions.get(x.p.dimensionId); const opposite = unique(x.other);
      if (!d || !opposite || !(d.value > 0)) return false;
      return Math.abs(Math.abs(coordinate - opposite.coordinate) - d.value) / d.value <= 0.08;
    }));
    chains.push({ axis: e.p.axis, sharedEndpoint: e.side, sourceCoordinate: group.reduce((s, g) => s + g.x.c, 0) / group.length, dimensionIds: ids, candidateCoordinates: coords, recommendedCoordinate: valid.length === 1 ? valid[0] : null, reason: valid.length === 1 ? "unique_chain_consistent_boundary" : valid.length > 1 ? "ambiguous_chain_boundary" : "no_chain_consistent_boundary" });
  });
  const uniqueChainBoundaryCount = chains.filter((c) => c.reason === "unique_chain_consistent_boundary").length;
  return { chains, uniqueChainBoundaryCount, diagnostics: [`Dimension-chain diagnostic found ${chains.length} shared source endpoints.`, `${uniqueChainBoundaryCount} have one chain-consistent existing boundary.`, "Read-only: no geometry movement, threshold widening, or canonical writes."] };
}
