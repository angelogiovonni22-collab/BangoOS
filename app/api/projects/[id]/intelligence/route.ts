import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

const MAX_ANALYSIS_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 60;
const MAX_PDF_TEXT_CHARS = 90_000;
const ANALYZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type SourceType = "project" | "photo" | "attachment" | "blueprint";
type IntelligenceBody = { sourceType?: SourceType; sourceId?: string | null };
type AnalysisShape = {
  summary: string;
  observations: string[];
  risks: string[];
  recommendations: string[];
  extracted_facts: Record<string, string | number | boolean | null>;
  confidence: number;
};

type SourceRecord = {
  sourceType: Exclude<SourceType, "project">;
  sourceId: string;
  sourceKey: string;
  label: string;
  mimeType: string | null;
  bucket: string;
  storagePath: string;
  note: string | null;
  createdAt: string | null;
};

async function getContext(projectId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");

  const { data: project, error } = await supabase
    .from("projects")
    .select("id,name,project_number,description,status,contract_amount,estimated_cost,estimated_start_date,estimated_end_date")
    .eq("company_id", workspace.context.companyId)
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) throw new Error("Project not found.");
  return { supabase, workspace: workspace.context, project };
}

function dbClient(supabase: SupabaseClient<Database>) {
  // Project intelligence and blueprint tables may land before generated client types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeAnalysis(raw: unknown): AnalysisShape {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const stringArray = (value: unknown) => Array.isArray(value)
    ? value.map((item) => textValue(item)).filter(Boolean).slice(0, 12)
    : [];
  const factsSource = source.extracted_facts && typeof source.extracted_facts === "object" && !Array.isArray(source.extracted_facts)
    ? source.extracted_facts as Record<string, unknown>
    : {};
  const extractedFacts = Object.fromEntries(
    Object.entries(factsSource)
      .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 30),
  ) as Record<string, string | number | boolean | null>;
  const confidence = numberValue(source.confidence);

  return {
    summary: textValue(source.summary).slice(0, 4000),
    observations: stringArray(source.observations),
    risks: stringArray(source.risks),
    recommendations: stringArray(source.recommendations),
    extracted_facts: extractedFacts,
    confidence: confidence === null ? 0 : Math.min(1, Math.max(0, confidence)),
  };
}

async function loadProjectContextData(supabase: SupabaseClient<Database>, companyId: string, projectId: string) {
  const db = dbClient(supabase);
  const [tasks, changeOrders, rfis, inspections, photos, attachments, blueprints, analyses] = await Promise.all([
    db.from("tasks").select("id,title,description,notes,status,priority,planned_start,planned_finish,completion_percentage").eq("company_id", companyId).eq("project_id", projectId).order("planned_finish", { ascending: true }).limit(150),
    db.from("change_orders").select("id,change_order_number,title,status,total_amount,created_at").eq("company_id", companyId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
    db.from("project_communications").select("id,subject,status,channel,created_at").eq("company_id", companyId).eq("project_id", projectId).eq("channel", "rfi").order("created_at", { ascending: false }).limit(50),
    db.from("project_inspections").select("id,inspection_type,status,scheduled_at,completed_at").eq("company_id", companyId).eq("project_id", projectId).order("scheduled_at", { ascending: false }).limit(50),
    db.from("project_photos").select("id,storage_path,original_filename,mime_type,note,category,created_at").eq("company_id", companyId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(150),
    db.from("record_attachments").select("id,storage_path,original_filename,mime_type,caption,created_at").eq("company_id", companyId).eq("entity_type", "project").eq("entity_id", projectId).order("sort_order", { ascending: true }).limit(150),
    db.from("blueprint_versions").select("id,storage_path,original_filename,mime_type,revision_label,status,created_at,blueprint_sheet_id,version_number").eq("company_id", companyId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(150),
    db.from("project_intelligence_artifacts").select("id,source_type,source_id,source_key,source_label,source_mime_type,model,summary,observations,risks,recommendations,extracted_facts,confidence,analyzed_at").eq("company_id", companyId).eq("project_id", projectId).order("analyzed_at", { ascending: false }).limit(300),
  ]);

  for (const response of [tasks, changeOrders, rfis, inspections, photos, attachments, blueprints, analyses]) {
    if (response.error) throw new Error(response.error.message);
  }

  const sources: SourceRecord[] = [
    ...(photos.data ?? []).map((row: Record<string, unknown>) => ({
      sourceType: "photo" as const,
      sourceId: String(row.id),
      sourceKey: `photo:${row.id}`,
      label: textValue(row.original_filename) || textValue(row.note) || `Project photo ${String(row.id).slice(0, 8)}`,
      mimeType: textValue(row.mime_type) || null,
      bucket: "project-photos",
      storagePath: textValue(row.storage_path),
      note: [textValue(row.category), textValue(row.note)].filter(Boolean).join(" · ") || null,
      createdAt: textValue(row.created_at) || null,
    })),
    ...(attachments.data ?? []).map((row: Record<string, unknown>) => ({
      sourceType: "attachment" as const,
      sourceId: String(row.id),
      sourceKey: `attachment:${row.id}`,
      label: textValue(row.original_filename) || `Project attachment ${String(row.id).slice(0, 8)}`,
      mimeType: textValue(row.mime_type) || null,
      bucket: "record-attachments",
      storagePath: textValue(row.storage_path),
      note: textValue(row.caption) || null,
      createdAt: textValue(row.created_at) || null,
    })),
    ...(blueprints.data ?? []).map((row: Record<string, unknown>) => ({
      sourceType: "blueprint" as const,
      sourceId: String(row.id),
      sourceKey: `blueprint:${row.id}`,
      label: [textValue(row.original_filename), textValue(row.revision_label) ? `Rev ${textValue(row.revision_label)}` : ""].filter(Boolean).join(" · ") || `Blueprint ${String(row.id).slice(0, 8)}`,
      mimeType: textValue(row.mime_type) || null,
      bucket: "blueprints",
      storagePath: textValue(row.storage_path),
      note: textValue(row.status) || null,
      createdAt: textValue(row.created_at) || null,
    })),
  ];

  return {
    context: {
      tasks: tasks.data ?? [],
      changeOrders: changeOrders.data ?? [],
      rfis: rfis.data ?? [],
      inspections: inspections.data ?? [],
    },
    sources,
    analyses: analyses.data ?? [],
  };
}

async function downloadSource(supabase: SupabaseClient<Database>, source: SourceRecord) {
  const result = await supabase.storage.from(source.bucket).download(source.storagePath);
  if (result.error || !result.data) throw new Error(result.error?.message || "Unable to read the selected project file.");
  if (result.data.size > MAX_ANALYSIS_BYTES) throw new Error("This file is too large for Orion intelligence. Use a file 25 MB or smaller for analysis.");
  return Buffer.from(await result.data.arrayBuffer());
}

async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false }).promise;
  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES);
  const chunks: string[] = [];
  let length = 0;
  for (let pageNumber = 1; pageNumber <= pageCount && length < MAX_PDF_TEXT_CHARS; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => "str" in item && typeof item.str === "string" ? item.str : "")
      .filter(Boolean)
      .join(" ")
      .trim();
    if (text) {
      const chunk = `Page ${pageNumber}: ${text}\n`;
      chunks.push(chunk);
      length += chunk.length;
    }
  }
  return chunks.join("\n").slice(0, MAX_PDF_TEXT_CHARS);
}

function buildProjectPrompt(project: Record<string, unknown>, context: Record<string, unknown>, source?: SourceRecord) {
  const projectContext = JSON.stringify({
    name: project.name,
    number: project.project_number,
    description: project.description,
    status: project.status,
    contractAmount: project.contract_amount,
    estimatedCost: project.estimated_cost,
    estimatedStartDate: project.estimated_start_date,
    estimatedEndDate: project.estimated_end_date,
    ...context,
  });
  return [
    "You are Orion Project Intelligence inside B.O.S., a construction operating system.",
    "Analyze only evidence supplied in this request. Never invent dimensions, quantities, completion percentages, defects, code violations, contract terms, or costs.",
    "Separate observations from risks. A risk is a concern requiring human verification, not a proven defect unless the evidence clearly proves it.",
    "Compare visible/file evidence to the project scope, tasks, RFIs, change orders, inspections, and schedule context when relevant.",
    "Recommendations must be specific operational next steps. Never claim that B.O.S. already created a task, RFI, change order, punch item, or note.",
    "Return JSON only with keys summary, observations, risks, recommendations, extracted_facts, confidence. observations/risks/recommendations are arrays of short strings. extracted_facts is an object of evidence-backed scalar facts. confidence is 0 to 1.",
    source ? `Selected source: ${source.label}. Source note: ${source.note || "none"}. MIME type: ${source.mimeType || "unknown"}.` : "This is a project-level briefing based on B.O.S. records and previously analyzed project evidence.",
    `B.O.S. project context: ${projectContext}`,
  ].join("\n");
}

async function runOpenAIAnalysis(args: {
  project: Record<string, unknown>;
  context: Record<string, unknown>;
  source?: SourceRecord;
  buffer?: Buffer;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Orion Project Intelligence is not configured for AI analysis.");
  const model = process.env.BANGO_PROJECT_INTELLIGENCE_MODEL || process.env.BANGO_RECEIPT_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 });
  const prompt = buildProjectPrompt(args.project, args.context, args.source);
  let userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] | string = prompt;

  if (args.source && args.buffer) {
    const mimeType = args.source.mimeType || "";
    if (ANALYZABLE_IMAGE_TYPES.has(mimeType)) {
      userContent = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${args.buffer.toString("base64")}`, detail: "high" } },
      ];
    } else if (mimeType === "application/pdf") {
      const pdfText = await extractPdfText(args.buffer);
      if (!pdfText) throw new Error("Orion could not extract readable text from this PDF. A scanned-image PDF must be converted to images before analysis.");
      userContent = `${prompt}\n\nExtracted PDF text (text-only evidence; do not claim visual plan observations):\n${pdfText}`;
    } else {
      throw new Error("Orion can analyze JPEG, PNG, WebP, and text-readable PDF sources in this phase.");
    }
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 2400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a conservative construction project intelligence engine. Output accurate JSON only and explicitly preserve uncertainty." },
      { role: "user", content: userContent },
    ],
  });
  const rawText = completion.choices[0]?.message?.content || "{}";
  let parsed: unknown = {};
  try { parsed = JSON.parse(rawText); } catch { parsed = {}; }
  const analysis = normalizeAnalysis(parsed);
  if (!analysis.summary && !analysis.observations.length) throw new Error("Orion did not return usable project intelligence for this source.");
  return { analysis, model };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, workspace, project } = await getContext(id);
    const data = await loadProjectContextData(supabase as SupabaseClient<Database>, workspace.companyId, id);
    return NextResponse.json({
      project,
      counts: {
        sources: data.sources.length,
        photos: data.sources.filter((source) => source.sourceType === "photo").length,
        attachments: data.sources.filter((source) => source.sourceType === "attachment").length,
        blueprints: data.sources.filter((source) => source.sourceType === "blueprint").length,
        analyses: data.analyses.length,
      },
      sources: data.sources.map(({ bucket: _bucket, storagePath: _storagePath, ...source }) => source),
      analyses: data.analyses,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Orion Project Intelligence." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as IntelligenceBody;
    const sourceType = body.sourceType;
    if (!sourceType || !["project", "photo", "attachment", "blueprint"].includes(sourceType)) {
      return NextResponse.json({ error: "Choose a valid project intelligence source." }, { status: 400 });
    }

    const { supabase, workspace, project } = await getContext(id);
    const data = await loadProjectContextData(supabase as SupabaseClient<Database>, workspace.companyId, id);
    const source = sourceType === "project"
      ? undefined
      : data.sources.find((item) => item.sourceType === sourceType && item.sourceId === body.sourceId);
    if (sourceType !== "project" && !source) {
      return NextResponse.json({ error: "The selected project source was not found or is not accessible." }, { status: 404 });
    }

    const buffer = source ? await downloadSource(supabase as SupabaseClient<Database>, source) : undefined;
    const projectContext = {
      tasks: data.context.tasks,
      changeOrders: data.context.changeOrders,
      rfis: data.context.rfis,
      inspections: data.context.inspections,
      priorEvidence: data.analyses
        .filter((analysis: Record<string, unknown>) => analysis.source_type !== "project")
        .slice(0, 40)
        .map((analysis: Record<string, unknown>) => ({
          source: analysis.source_label,
          summary: analysis.summary,
          risks: analysis.risks,
          recommendations: analysis.recommendations,
          analyzedAt: analysis.analyzed_at,
        })),
    };
    const result = await runOpenAIAnalysis({ project: project as unknown as Record<string, unknown>, context: projectContext, source, buffer });
    const sourceKey = source?.sourceKey || "project";
    const db = dbClient(supabase as SupabaseClient<Database>);
    const { data: saved, error: saveError } = await db
      .from("project_intelligence_artifacts")
      .upsert({
        company_id: workspace.companyId,
        project_id: id,
        source_type: sourceType,
        source_id: source?.sourceId || null,
        source_key: sourceKey,
        source_label: source?.label || `${project.name} project briefing`,
        source_mime_type: source?.mimeType || null,
        model: result.model,
        summary: result.analysis.summary,
        observations: result.analysis.observations,
        risks: result.analysis.risks,
        recommendations: result.analysis.recommendations,
        extracted_facts: result.analysis.extracted_facts,
        confidence: result.analysis.confidence,
        created_by: workspace.userId,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id,project_id,source_key" })
      .select("id,source_type,source_id,source_key,source_label,source_mime_type,model,summary,observations,risks,recommendations,extracted_facts,confidence,analyzed_at")
      .single();
    if (saveError) throw new Error(saveError.message);
    return NextResponse.json({ analysis: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to analyze this project source." }, { status: 400 });
  }
}
