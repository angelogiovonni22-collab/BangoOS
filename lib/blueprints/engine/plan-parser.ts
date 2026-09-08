import type { BosSourceEvidence } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { detectPrintedDimensions, detectScale, type BosTextToken } from "./dimensions";

export type BosParsedPage = {
  pageNumber: number;
  width: number;
  height: number;
  text: BosTextToken[];
  vectorSegments: BosRawSegment[];
  rasterRequired: boolean;
};

export type BosParsedPlan = {
  sourceType: "pdf" | "image";
  pages: BosParsedPage[];
  selectedPage: number;
  targetScore: number;
  targetEvidence: BosSourceEvidence[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function similarity(a: string, b: string) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size);
}

export function scoreTargetPage(page: BosParsedPage, target: { sheetNumber?: string; title?: string; discipline?: string }) {
  const pageText = page.text.map((item) => item.text).join(" ");
  const normalizedPage = normalize(pageText);
  let score = 0;
  const evidence: BosSourceEvidence[] = [];

  const title = normalize(target.title || "");
  if (title) {
    const exact = normalizedPage.includes(title);
    const fuzzy = similarity(pageText, title);
    score += exact ? 0.62 : fuzzy * 0.48;
    if (exact || fuzzy >= 0.5) evidence.push({ id: `page-${page.pageNumber}-title`, page: page.pageNumber, kind: "pdf_text", text: target.title, score: exact ? 1 : fuzzy });
  }

  const sheet = normalize(target.sheetNumber || "");
  if (sheet && normalizedPage.includes(sheet)) {
    score += 0.24;
    evidence.push({ id: `page-${page.pageNumber}-sheet`, page: page.pageNumber, kind: "pdf_text", text: target.sheetNumber, score: 1 });
  }

  const discipline = normalize(target.discipline || "");
  if (discipline && normalizedPage.includes(discipline)) score += 0.08;

  // Floor-plan title words carry strong targeting information even when a title block is noisy.
  const floorWords = ["first floor", "second floor", "basement", "foundation", "roof plan", "floor plan"];
  for (const phrase of floorWords) {
    if (title.includes(phrase) && normalizedPage.includes(phrase)) score += 0.15;
    else if (!title.includes(phrase) && normalizedPage.includes(phrase) && phrase !== "floor plan") score -= 0.08;
  }

  if (page.vectorSegments.length >= 8) score += 0.04;
  return { score: Math.max(0, Math.min(1, score)), evidence };
}

export function selectTargetPage(pages: BosParsedPage[], target: { sheetNumber?: string; title?: string; discipline?: string }) {
  if (!pages.length) throw new Error("Blueprint parser received no pages.");
  const ranked = pages.map((page) => ({ page, ...scoreTargetPage(page, target) })).sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  return {
    page: winner.page,
    score: winner.score,
    evidence: winner.evidence,
    alternatives: ranked.slice(1).map((item) => ({ pageNumber: item.page.pageNumber, score: item.score })),
  };
}

export function normalizeParsedPlan(input: {
  sourceType: "pdf" | "image";
  pages: BosParsedPage[];
  target: { sheetNumber?: string; title?: string; discipline?: string };
}): BosParsedPlan {
  const selected = selectTargetPage(input.pages, input.target);
  return {
    sourceType: input.sourceType,
    pages: input.pages,
    selectedPage: selected.page.pageNumber,
    targetScore: selected.score,
    targetEvidence: selected.evidence,
  };
}

export function summarizeSelectedPlan(plan: BosParsedPlan, levelId: string) {
  const page = plan.pages.find((candidate) => candidate.pageNumber === plan.selectedPage);
  if (!page) throw new Error("Selected Blueprint page was not preserved in parsed pages.");
  return {
    page,
    scale: detectScale(page.text),
    dimensions: detectPrintedDimensions(page.text, levelId),
    vectorCount: page.vectorSegments.length,
    rasterRequired: page.rasterRequired || page.vectorSegments.length < 8,
  };
}
