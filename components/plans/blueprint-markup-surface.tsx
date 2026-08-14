"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowUpRight, BrickWall, Camera, CheckCircle2, ClipboardPlus, Eye, EyeOff, Hand, ImageIcon, Layers3, ListFilter, LockKeyhole, MapPin, Pencil, Radio, Ruler, ScanLine, Shapes, SquareDashed, Trash2, Type, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToBlueprintCollaboration } from "@/lib/blueprints/realtime";
import { loadBlueprintMedia, uploadBlueprintMedia, type BlueprintMediaAttachment } from "@/lib/blueprints/media-attachments";
import { loadBlueprintSymbols, type BlueprintSymbol } from "@/lib/blueprints/symbols";
import { BLUEPRINT_SYMBOL_MIME, BlueprintSymbolLibrary } from "./blueprint-symbol-library";
import { blueprintWallEndpoints, snapBlueprintPoint } from "@/lib/blueprints/snapping";
import { createBlueprintLayer, loadBlueprintLayers, type BlueprintLayer } from "@/lib/blueprints/layers";
import { BlueprintIssueSlaControls } from "./blueprint-issue-sla-controls";
import { BlueprintTakeoffClassification } from "./blueprint-takeoff-classification";
import { assignBlueprintIssueToWorkforce, createChangeOrderFromBlueprintIssue, createEstimateLineItemFromBlueprintTakeoff, createPunchItemFromBlueprintIssue, createRfiFromBlueprintIssue, createSubmittalFromBlueprintIssue, createTaskFromBlueprintIssue, loadBlueprintOperationalLinks, loadBlueprintProjectEstimates, loadBlueprintWorkforceOptions, scheduleBlueprintIssueTask, type BlueprintOperationalLink, type BlueprintProjectEstimate, type BlueprintWorkforceOption } from "@/lib/blueprints/operations";
import {
  createBlueprintMarkup,
  deleteBlueprintMarkup,
  loadBlueprintMarkups,
  updateBlueprintMarkupStatus,
  type BlueprintMarkup,
  type BlueprintMarkupType,
} from "@/lib/blueprints/markups";

type MarkupTool = "pan" | BlueprintMarkupType;
type Point = { x: number; y: number };

type BlueprintMarkupSurfaceProps = {
  companyId: string;
  projectId: string;
  versionId: string;
  userId: string;
  discipline: string;
  children: ReactNode;
  transform: string;
  transition: string;
  onToolChange: (isMarkingUp: boolean) => void;
  pageNumber?: number;
  toolbarExtra?: ReactNode;
  focusAnnotationId?: string | null;
};

const colors = ["#ef4444", "#f59e0b", "#2563eb", "#16a34a"];

export function BlueprintMarkupSurface({
  companyId,
  projectId,
  versionId,
  userId,
  discipline,
  children,
  transform,
  transition,
  onToolChange,
  pageNumber = 1,
  toolbarExtra,
  focusAnnotationId,
}: BlueprintMarkupSurfaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const surfaceRef = useRef<SVGSVGElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<{ pointerId: number; start: Point; points: Point[] } | null>(null);
  const [tool, setTool] = useState<MarkupTool>("pan");
  const [color, setColor] = useState(colors[0]);
  const [note, setNote] = useState("");
  const [knownLength, setKnownLength] = useState("10");
  const [measurementUnit, setMeasurementUnit] = useState<"ft" | "m">("ft");
  const [markups, setMarkups] = useState<BlueprintMarkup[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BlueprintMarkup | null>(null);
  const [registerOpen, setRegisterOpen] = useState(Boolean(focusAnnotationId));
  const [visibleLayers, setVisibleLayers] = useState<Set<"redlines" | "issues" | "measurements">>(new Set(["redlines", "issues", "measurements"]));
  const [registerFilter, setRegisterFilter] = useState<"all" | "mine" | "open">("all");
  const [activeUserIds, setActiveUserIds] = useState<string[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [media, setMedia] = useState<BlueprintMediaAttachment[]>([]);
  const [queuedMedia, setQueuedMedia] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [activeMedia, setActiveMedia] = useState<BlueprintMediaAttachment | null>(null);
  const [symbols, setSymbols] = useState<BlueprintSymbol[]>([]);
  const [symbolLibraryOpen, setSymbolLibraryOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<BlueprintSymbol | null>(null);
  const [dimensionLockValue, setDimensionLockValue] = useState("10");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [layers, setLayers] = useState<BlueprintLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set());
  const [newLayerName, setNewLayerName] = useState("");
  const [operationalLinks, setOperationalLinks] = useState<BlueprintOperationalLink[]>([]);
  const [creatingTaskFor, setCreatingTaskFor] = useState<string | null>(null);
  const [projectEstimates, setProjectEstimates] = useState<BlueprintProjectEstimate[]>([]);
  const [selectedEstimateId, setSelectedEstimateId] = useState("");
  const [creatingEstimateItemFor, setCreatingEstimateItemFor] = useState<string | null>(null);
  const [creatingChangeOrderFor, setCreatingChangeOrderFor] = useState<string | null>(null);
  const [workforceOptions, setWorkforceOptions] = useState<BlueprintWorkforceOption[]>([]);
  const [selectedWorkforceKey, setSelectedWorkforceKey] = useState("");
  const [assigningWorkforceFor, setAssigningWorkforceFor] = useState<string | null>(null);
  const [creatingPunchItemFor, setCreatingPunchItemFor] = useState<string | null>(null);
  const [creatingRfiFor, setCreatingRfiFor] = useState<string | null>(null);
  const [creatingSubmittalFor, setCreatingSubmittalFor] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleFinish, setScheduleFinish] = useState("");
  const [schedulingTaskFor, setSchedulingTaskFor] = useState<string | null>(null);

  const identity = useMemo(() => ({ companyId, projectId, versionId }), [companyId, projectId, versionId]);

  const requestMarkups = useCallback(async () => {
    if (!supabase) throw new Error("Blueprint markup storage is unavailable.");
    return loadBlueprintMarkups(supabase, identity);
  }, [identity, supabase]);

  const reload = useCallback(async () => {
    setMarkups(await requestMarkups());
  }, [requestMarkups]);

  const reloadOperationalLinks = useCallback(async () => {
    if (supabase) setOperationalLinks(await loadBlueprintOperationalLinks(supabase, identity));
  }, [identity, supabase]);

  useEffect(() => {
    let active = true;
    void requestMarkups()
      .then((next) => {
        if (!active) return;
        setMarkups(next);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load plan markups.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestMarkups]);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void loadBlueprintOperationalLinks(supabase, identity)
      .then((next) => { if (active) setOperationalLinks(next); })
      .catch((linkError: unknown) => { if (active) setError(linkError instanceof Error ? linkError.message : "Could not load linked project records."); });
    return () => { active = false; };
  }, [identity, supabase]);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void loadBlueprintProjectEstimates(supabase, { companyId, projectId })
      .then((next) => {
        if (!active) return;
        setProjectEstimates(next);
        setSelectedEstimateId((current) => current || next[0]?.id || "");
      })
      .catch((estimateError: unknown) => { if (active) setError(estimateError instanceof Error ? estimateError.message : "Could not load project estimates."); });
    return () => { active = false; };
  }, [companyId, projectId, supabase]);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void loadBlueprintWorkforceOptions(supabase, companyId).then((next) => {
      if (!active) return;
      setWorkforceOptions(next);
      setSelectedWorkforceKey((current) => current || (next[0] ? `${next[0].type}:${next[0].id}` : ""));
    }).catch((workforceError: unknown) => { if (active) setError(workforceError instanceof Error ? workforceError.message : "Could not load workforce options."); });
    return () => { active = false; };
  }, [companyId, supabase]);
  const reloadLayers = useCallback(async () => { if (supabase) setLayers(await loadBlueprintLayers(supabase, companyId, projectId)); }, [companyId, projectId, supabase]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void loadBlueprintLayers(supabase, companyId, projectId)
      .then((next) => { if (active) setLayers(next); })
      .catch((layerError:unknown) => { if (active) setError(layerError instanceof Error ? layerError.message : "Could not load plan layers."); });
    return () => { active = false; };
  }, [companyId, projectId, supabase]);

  const requestMedia = useCallback(async () => supabase ? loadBlueprintMedia(supabase, identity) : [], [identity, supabase]);
  const reloadMedia = useCallback(async () => { setMedia(await requestMedia()); }, [requestMedia]);
  useEffect(() => {
    let active = true;
    void requestMedia()
      .then((next) => { if (active) setMedia(next); })
      .catch((mediaError: unknown) => { if (active) setError(mediaError instanceof Error ? mediaError.message : "Could not load plan media."); });
    return () => { active = false; };
  }, [requestMedia]);
  useEffect(() => { if (!supabase) return; let active = true; void loadBlueprintSymbols(supabase, companyId).then((next) => { if (active) setSymbols(next); }).catch((symbolError: unknown) => { if (active) setError(symbolError instanceof Error ? symbolError.message : "Could not load symbols."); }); return () => { active = false; }; }, [companyId, supabase]);

  useEffect(() => {
    if (!supabase) return;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToBlueprintCollaboration(
      supabase,
      { ...identity, userId },
      {
        onAnnotationChange: () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            void requestMarkups()
              .then((next) => {
                setMarkups(next);
                setError(null);
              })
              .catch((syncError: unknown) => {
                setError(syncError instanceof Error ? syncError.message : "Could not synchronize plan markups.");
              });
          }, 75);
        },
        onPresenceChange: setActiveUserIds,
        onStatusChange: (status) => setRealtimeConnected(status === "SUBSCRIBED"),
      },
    );
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [identity, requestMarkups, supabase, userId]);

  const chooseTool = (nextTool: MarkupTool) => {
    setTool(nextTool);
    onToolChange(nextTool !== "pan");
    setError(null);
  };

  const createTask = async (markup: BlueprintMarkup) => {
    if (!supabase || creatingTaskFor) return;
    setCreatingTaskFor(markup.id);
    setError(null);
    try {
      await createTaskFromBlueprintIssue(supabase, { ...identity, annotationId: markup.id });
      await reloadOperationalLinks();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Could not create a project task from this issue.");
    } finally {
      setCreatingTaskFor(null);
    }
  };

  const addTakeoffToEstimate = async (markup: BlueprintMarkup) => {
    if (!supabase || creatingEstimateItemFor || !selectedEstimateId) return;
    setCreatingEstimateItemFor(markup.id);
    setError(null);
    try {
      await createEstimateLineItemFromBlueprintTakeoff(supabase, { ...identity, annotationId: markup.id, estimateId: selectedEstimateId });
      await reloadOperationalLinks();
    } catch (takeoffError) {
      setError(takeoffError instanceof Error ? takeoffError.message : "Could not add this takeoff to the estimate.");
    } finally {
      setCreatingEstimateItemFor(null);
    }
  };

  const startChangeOrder = async (markup: BlueprintMarkup) => {
    if (!supabase || creatingChangeOrderFor) return;
    setCreatingChangeOrderFor(markup.id);
    setError(null);
    try {
      await createChangeOrderFromBlueprintIssue(supabase, { ...identity, annotationId: markup.id });
      await reloadOperationalLinks();
    } catch (changeOrderError) {
      setError(changeOrderError instanceof Error ? changeOrderError.message : "Could not start a change order from this issue.");
    } finally {
      setCreatingChangeOrderFor(null);
    }
  };

  const assignWorkforce = async (markup: BlueprintMarkup) => {
    if (!supabase || assigningWorkforceFor || !selectedWorkforceKey) return;
    const [assignmentType, assigneeId] = selectedWorkforceKey.split(":") as ["employee" | "crew", string];
    if (!assigneeId) return;
    setAssigningWorkforceFor(markup.id);
    setError(null);
    try {
      await assignBlueprintIssueToWorkforce(supabase, { ...identity, annotationId: markup.id, assignmentType, assigneeId });
      await reloadOperationalLinks();
    } catch (workforceError) {
      setError(workforceError instanceof Error ? workforceError.message : "Could not assign this Blueprint issue.");
    } finally {
      setAssigningWorkforceFor(null);
    }
  };

  const createPunchItem = async (markup: BlueprintMarkup) => {
    if (!supabase || creatingPunchItemFor) return;
    setCreatingPunchItemFor(markup.id);
    setError(null);
    try {
      await createPunchItemFromBlueprintIssue(supabase, { ...identity, annotationId: markup.id });
      await reloadOperationalLinks();
    } catch (punchError) {
      setError(punchError instanceof Error ? punchError.message : "Could not create a punch item from this issue.");
    } finally {
      setCreatingPunchItemFor(null);
    }
  };

  const createRfi = async (markup: BlueprintMarkup) => {
    if (!supabase || creatingRfiFor) return;
    setCreatingRfiFor(markup.id);
    setError(null);
    try {
      await createRfiFromBlueprintIssue(supabase, { ...identity, annotationId: markup.id });
      await reloadOperationalLinks();
    } catch (rfiError) {
      setError(rfiError instanceof Error ? rfiError.message : "Could not create an RFI from this issue.");
    } finally {
      setCreatingRfiFor(null);
    }
  };

  const createSubmittal = async (markup: BlueprintMarkup) => {
    if (!supabase || creatingSubmittalFor) return;
    setCreatingSubmittalFor(markup.id); setError(null);
    try { await createSubmittalFromBlueprintIssue(supabase, { ...identity, annotationId: markup.id }); await reloadOperationalLinks(); }
    catch (submittalError) { setError(submittalError instanceof Error ? submittalError.message : "Could not create a submittal from this issue."); }
    finally { setCreatingSubmittalFor(null); }
  };

  const scheduleTask = async (markup: BlueprintMarkup) => {
    if (!supabase || schedulingTaskFor || !scheduleStart || !scheduleFinish) return;
    setSchedulingTaskFor(markup.id);
    setError(null);
    try {
      await scheduleBlueprintIssueTask(supabase, { ...identity, annotationId: markup.id, plannedStart: scheduleStart, plannedFinish: scheduleFinish });
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Could not schedule the linked task.");
    } finally {
      setSchedulingTaskFor(null);
    }
  };

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const persist = async (type: BlueprintMarkupType, geometry: Record<string, unknown>, content?: string) => {
    if (!supabase || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createBlueprintMarkup(supabase, { ...identity, userId, type, color, discipline, layerId: activeLayerId, geometry: { ...geometry, page: pageNumber }, content });
      await reload();
      if (type === "pin" || type === "text") setNote("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this markup.");
    } finally {
      setSaving(false);
      setDraft([]);
      draftRef.current = null;
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "pan" || saving || event.button !== 0) return;
    const point = pointFromEvent(event);

    if (selectedSymbol) { void persist("symbol", { ...point, symbolKey: selectedSymbol.key, glyph: selectedSymbol.glyph, label: selectedSymbol.label }); setSelectedSymbol(null); chooseTool("pan"); return; }

    if (queuedMedia) {
      const file = queuedMedia;
      setSaving(true);
      void uploadBlueprintMedia(supabase!, { ...identity, userId, pageNumber, ...point, caption: mediaCaption, file })
        .then(reloadMedia).then(() => { setQueuedMedia(null); setMediaCaption(""); chooseTool("pan"); })
        .catch((mediaError: unknown) => setError(mediaError instanceof Error ? mediaError.message : "Could not pin this media."))
        .finally(() => setSaving(false));
      return;
    }

    if (tool === "pin" || tool === "text") {
      if (!note.trim()) {
        setError(`Enter ${tool === "pin" ? "an issue note" : "text"} before placing it.`);
        return;
      }
      void persist(tool, point, note);
      return;
    }

    draftRef.current = { pointerId: event.pointerId, start: point, points: [point] };
    setDraft([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const activeDraft = draftRef.current;
    if (!activeDraft || activeDraft.pointerId !== event.pointerId) return;
    const rawPoint = pointFromEvent(event);
    const point = snapEnabled && ["wall", "locked_dimension"].includes(tool) ? snapBlueprintPoint(rawPoint, activeDraft.start, blueprintWallEndpoints(markups, pageNumber)) : rawPoint;
    const points = tool === "arrow" || tool === "calibration" || tool === "distance" || tool === "area" || tool === "wall" || tool === "locked_dimension"
      ? [activeDraft.start, point]
      : [...activeDraft.points, point];
    activeDraft.points = points;
    setDraft(points);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const activeDraft = draftRef.current;
    if (!activeDraft || activeDraft.pointerId !== event.pointerId || !["freehand", "arrow", "calibration", "distance", "area", "wall", "locked_dimension"].includes(tool)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = activeDraft.points;
    if (points.length > 1) {
      const line = { x1: points[0].x, y1: points[0].y, x2: points.at(-1)!.x, y2: points.at(-1)!.y };
      if (tool === "wall") {
        void persist(tool, { ...line, snapped: snapEnabled });
      } else if (tool === "locked_dimension") {
        const lockedValue = Number(dimensionLockValue);
        if (!Number.isFinite(lockedValue) || lockedValue <= 0) { setError("Enter a valid locked dimension."); setDraft([]); draftRef.current = null; return; }
        void persist(tool, { ...line, lockedValue, unit: measurementUnit, snapped: snapEnabled });
      } else if (tool === "calibration") {
        const realLength = Number(knownLength);
        const drawingLength = normalizedDistance(line);
        if (!Number.isFinite(realLength) || realLength <= 0 || drawingLength <= 0) {
          setError("Enter a valid known length before calibrating.");
          setDraft([]);
          draftRef.current = null;
          return;
        }
        void persist(tool, { ...line, realLength, unit: measurementUnit, unitsPerDrawingUnit: realLength / drawingLength });
      } else if (tool === "distance") {
        const calibration = currentCalibration(markups, pageNumber);
        if (!calibration) {
          setError("Calibrate this page before measuring distance.");
          setDraft([]);
          draftRef.current = null;
          return;
        }
        void persist(tool, { ...line, value: normalizedDistance(line) * calibration.unitsPerDrawingUnit, unit: calibration.unit });
      } else if (tool === "area") {
        const calibration = currentCalibration(markups, pageNumber);
        if (!calibration) {
          setError("Calibrate this page before measuring area.");
          setDraft([]);
          draftRef.current = null;
          return;
        }
        const normalizedArea = Math.abs((line.x2 - line.x1) * (line.y2 - line.y1));
        void persist(tool, { ...line, value: normalizedArea * calibration.unitsPerDrawingUnit ** 2, unit: `${calibration.unit}²` });
      } else {
        const drawingTool: BlueprintMarkupType = tool === "arrow" ? "arrow" : "freehand";
        void persist(drawingTool, drawingTool === "arrow" ? line : { points: points.map((point) => [point.x, point.y]) });
      }
    } else {
      setDraft([]);
      draftRef.current = null;
    }
  };

  const removeMarkup = async (markup: BlueprintMarkup) => {
    if (!supabase || markup.createdBy !== userId) return;
    setSaving(true);
    try {
      await deleteBlueprintMarkup(supabase, { ...identity, markupId: markup.id });
      await reload();
      setPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this markup.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (markup: BlueprintMarkup, status: "open" | "resolved") => {
    if (!supabase) return;
    setSaving(true);
    try {
      await updateBlueprintMarkupStatus(supabase, { ...identity, markupId: markup.id, status });
      await reload();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update this issue.");
    } finally {
      setSaving(false);
    }
  };

  const visibleMarkups = markups.filter((markup) => Number(markup.geometry.page ?? 1) === pageNumber);
  const layeredMarkups = visibleMarkups.filter((markup) => markup.discipline === discipline && visibleLayers.has(layerForMarkup(markup.type)) && (!markup.layerId || !hiddenLayerIds.has(markup.layerId)));
  const registerMarkups = visibleMarkups.filter((markup) => registerFilter === "all" || (registerFilter === "mine" ? markup.createdBy === userId : markup.status === "open"));
  const calibration = currentCalibration(markups, pageNumber);
  const lastOwnedMarkup = [...visibleMarkups].reverse().find((markup) => markup.createdBy === userId);

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-slate-950 px-2.5 py-2 text-white"
        data-orion-region="blueprint-markup-toolbar"
        data-blueprint-controls
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MarkupButton label="Pan" active={tool === "pan"} onClick={() => chooseTool("pan")}><Hand size={14} /></MarkupButton>
        <MarkupButton label="Draw" active={tool === "freehand"} onClick={() => chooseTool("freehand")}><Pencil size={14} /></MarkupButton>
        <MarkupButton label="Arrow" active={tool === "arrow"} onClick={() => chooseTool("arrow")}><ArrowUpRight size={14} /></MarkupButton>
        <MarkupButton label="Text" active={tool === "text"} onClick={() => chooseTool("text")}><Type size={14} /></MarkupButton>
        <MarkupButton label="Issue pin" active={tool === "pin"} onClick={() => chooseTool("pin")}><MapPin size={14} /></MarkupButton>
        <input ref={mediaInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => { const file = event.target.files?.[0] ?? null; setQueuedMedia(file); if (file) chooseTool("pin"); event.currentTarget.value = ""; }} />
        <button type="button" onClick={() => mediaInputRef.current?.click()} className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-slate-200 hover:bg-white/20"><Camera size={14} /><span className="hidden sm:inline">Media pin</span></button>
        <button type="button" aria-expanded={symbolLibraryOpen} onClick={() => setSymbolLibraryOpen((value) => !value)} className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-slate-200 hover:bg-white/20"><Shapes size={14}/><span className="hidden sm:inline">Symbols</span></button>
        <MarkupButton label="Calibrate" active={tool === "calibration"} onClick={() => chooseTool("calibration")}><ScanLine size={14} /></MarkupButton>
        <MarkupButton label="Distance" active={tool === "distance"} onClick={() => chooseTool("distance")}><Ruler size={14} /></MarkupButton>
        <MarkupButton label="Area" active={tool === "area"} onClick={() => chooseTool("area")}><SquareDashed size={14} /></MarkupButton>
        <MarkupButton label="Wall" active={tool === "wall"} onClick={() => chooseTool("wall")}><BrickWall size={14}/></MarkupButton>
        <MarkupButton label="Lock dimension" active={tool === "locked_dimension"} onClick={() => chooseTool("locked_dimension")}><LockKeyhole size={14}/></MarkupButton>
        <button type="button" aria-pressed={snapEnabled} onClick={() => setSnapEnabled((value) => !value)} className={`h-7 rounded-md border px-2 text-[11px] font-semibold ${snapEnabled ? "border-cyan-300 bg-cyan-700 text-white" : "border-white/15 bg-white/10 text-slate-300"}`}>Snap {snapEnabled ? "on" : "off"}</button>
        <button type="button" aria-expanded={registerOpen} onClick={() => setRegisterOpen((value) => !value)} className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-slate-200 hover:bg-white/20"><ListFilter size={14} /><span className="hidden sm:inline">Register</span></button>
        <div className="mx-1 h-5 w-px bg-white/15" />
        {colors.map((option) => (
          <button key={option} type="button" aria-label={`Use ${option} markup color`} onClick={() => setColor(option)} className={`h-5 w-5 rounded-full border-2 ${color === option ? "border-white" : "border-transparent"}`} style={{ backgroundColor: option }} />
        ))}
        {tool === "pin" || tool === "text" ? (
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={tool === "pin" ? "Issue note…" : "Plan note…"} className="ml-1 min-w-36 flex-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
        ) : null}
        {queuedMedia ? <input value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} maxLength={1000} placeholder="Caption, then tap drawing…" className="min-w-44 flex-1 rounded-md border border-cyan-300/40 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-slate-400" /> : null}
        {tool === "calibration" ? (
          <div className="flex items-center gap-1">
            <input aria-label="Known calibration length" type="number" min="0.01" step="0.01" value={knownLength} onChange={(event) => setKnownLength(event.target.value)} className="w-20 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white focus:border-blue-400 focus:outline-none" />
            <select aria-label="Measurement unit" value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value as "ft" | "m")} className="rounded-md border border-white/15 bg-slate-900 px-1 py-1 text-xs text-white"><option value="ft">ft</option><option value="m">m</option></select>
          </div>
        ) : null}
        {tool === "locked_dimension" ? <div className="flex items-center gap-1"><input aria-label="Locked dimension value" type="number" min="0.01" step="0.01" value={dimensionLockValue} onChange={(event) => setDimensionLockValue(event.target.value)} className="w-20 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white"/><select aria-label="Locked dimension unit" value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value as "ft" | "m")} className="rounded-md border border-white/15 bg-slate-900 px-1 py-1 text-xs text-white"><option value="ft">ft</option><option value="m">m</option></select></div> : null}
        <button
          type="button"
          disabled={!lastOwnedMarkup || saving}
          onClick={() => setPendingDelete(lastOwnedMarkup ?? null)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-slate-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
          title="Delete your most recent markup"
        >
          <Trash2 size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Undo last</span>
        </button>
        {pendingDelete ? (
          <div className="flex items-center gap-1 rounded-md border border-amber-300/50 bg-amber-950/80 px-2 py-1 text-[11px] text-amber-50" role="alertdialog" aria-label="Confirm undo last markup">
            <span className="hidden sm:inline">Delete last markup?</span>
            <button type="button" disabled={saving} onClick={() => void removeMarkup(pendingDelete)} className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-500 disabled:opacity-50">Delete</button>
            <button type="button" disabled={saving} onClick={() => setPendingDelete(null)} className="rounded border border-white/20 px-2 py-1 font-semibold hover:bg-white/10 disabled:opacity-50">Cancel</button>
          </div>
        ) : null}
        <span className="ml-auto text-[10px] text-slate-400">{saving ? "Saving…" : loading ? "Loading…" : calibration ? `Calibrated · ${visibleMarkups.length} items` : `${visibleMarkups.length} markup${visibleMarkups.length === 1 ? "" : "s"}`}</span>
        {toolbarExtra}
      </div>

      {error ? <div className="border-b border-red-400/30 bg-red-950 px-3 py-2 text-xs text-red-100" role="alert">{error}</div> : null}

      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-1.5 text-[10px] text-slate-300" data-orion-region="blueprint-layer-controls">
        <Layers3 size={13} aria-hidden="true" /><span className="font-semibold">Layers</span>
        {(["redlines", "issues", "measurements"] as const).map((layer) => <LayerToggle key={layer} layer={layer} visible={visibleLayers.has(layer)} onToggle={() => setVisibleLayers((current) => { const next = new Set(current); if (next.has(layer)) next.delete(layer); else next.add(layer); return next; })} />)}
        <span className="rounded bg-cyan-950 px-2 py-1 font-semibold text-cyan-200">{discipline}</span>
        <select aria-label="Active drawing layer" value={activeLayerId??""} onChange={(event)=>setActiveLayerId(event.target.value||null)} className="rounded border border-white/15 bg-slate-950 px-2 py-1 text-[10px] text-white"><option value="">Default layer</option>{layers.filter((layer)=>layer.discipline===discipline).map((layer)=><option key={layer.id} value={layer.id}>{layer.name}</option>)}</select>
        <input aria-label="New layer name" value={newLayerName} onChange={(event)=>setNewLayerName(event.target.value)} maxLength={80} placeholder="New layer" className="w-24 rounded border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white"/>
        <button type="button" disabled={!newLayerName.trim()||saving} onClick={()=>{if(!supabase)return;setSaving(true);void createBlueprintLayer(supabase,{companyId,projectId,userId,name:newLayerName,discipline,color}).then(()=>{setNewLayerName("");return reloadLayers();}).catch((layerError:unknown)=>setError(layerError instanceof Error?layerError.message:"Could not create layer.")).finally(()=>setSaving(false));}} className="rounded border border-white/15 px-2 py-1 font-semibold disabled:opacity-35">Add layer</button>
        {layers.filter((layer)=>layer.discipline===discipline).map((layer)=><button key={layer.id} type="button" aria-pressed={!hiddenLayerIds.has(layer.id)} onClick={()=>setHiddenLayerIds((current)=>{const next=new Set(current);if(next.has(layer.id))next.delete(layer.id);else next.add(layer.id);return next;})} className={`rounded px-2 py-1 ${hiddenLayerIds.has(layer.id)?"text-slate-500":"bg-white/10 text-white"}`}>{layer.name}</button>)}
        <span className="ml-auto inline-flex items-center gap-1.5" data-orion-region="blueprint-collaboration-status" role="status">
          {realtimeConnected ? <Radio size={11} className="text-green-400" aria-hidden="true" /> : <Radio size={11} className="text-amber-400" aria-hidden="true" />}
          <span>{realtimeConnected ? "Live" : "Connecting"}</span>
          <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-slate-200" title="People viewing this revision">
            <Users size={11} aria-hidden="true" />{Math.max(1, activeUserIds.length)}
          </span>
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" onDragOver={(event) => { if (event.dataTransfer.types.includes(BLUEPRINT_SYMBOL_MIME)) event.preventDefault(); }} onDrop={(event) => { const raw = event.dataTransfer.getData(BLUEPRINT_SYMBOL_MIME); if (!raw || !surfaceRef.current) return; event.preventDefault(); const symbol = JSON.parse(raw) as BlueprintSymbol; const bounds = surfaceRef.current.getBoundingClientRect(); void persist("symbol", { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)), symbolKey: symbol.key, glyph: symbol.glyph, label: symbol.label }); }}>
        <div className="relative inline-flex max-h-full max-w-full" style={{ transform, transition }}>
          {children}
          <svg
          ref={surfaceRef}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-label="Blueprint markup layer"
          className={`absolute inset-0 h-full w-full ${tool === "pan" ? "pointer-events-none" : "cursor-crosshair touch-none"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <marker id="blueprint-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
            </marker>
          </defs>
          {layeredMarkups.map((markup) => <MarkupShape key={markup.id} markup={markup} />)}
          {media.filter((item) => item.pageNumber === pageNumber).map((item) => <g key={item.id} role="button" tabIndex={0} aria-label={`Open media attachment ${item.caption || item.fileName}`} onClick={() => setActiveMedia(item)} className="cursor-pointer"><circle cx={item.x * 1000} cy={item.y * 1000} r="27" fill="#0891b2" stroke="white" strokeWidth="5" vectorEffect="non-scaling-stroke" /><image href={item.signedUrl} x={item.x * 1000 - 15} y={item.y * 1000 - 15} width="30" height="30" preserveAspectRatio="xMidYMid slice" /></g>)}
          {draft.length > 1 ? <DraftShape tool={tool} points={draft} color={color} /> : null}
          </svg>
        </div>
        {registerOpen ? (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(22rem,90%)] flex-col border-l border-slate-700 bg-slate-950/95 text-white shadow-2xl" data-orion-region="blueprint-annotation-register">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><div><p className="text-sm font-bold">Annotation register</p><p className="text-[10px] text-slate-400">Page {pageNumber} · {visibleMarkups.length} items</p></div><button type="button" aria-label="Close annotation register" onClick={() => setRegisterOpen(false)} className="rounded p-1 hover:bg-white/10"><X size={16} /></button></div>
            <div className="flex gap-1 border-b border-white/10 p-2">{(["all", "mine", "open"] as const).map((filter) => <button key={filter} type="button" aria-pressed={registerFilter === filter} onClick={() => setRegisterFilter(filter)} className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${registerFilter === filter ? "bg-blue-600" : "bg-white/10 hover:bg-white/15"}`}>{filter}</button>)}</div>
            {projectEstimates.length ? <div className="border-b border-white/10 p-2"><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400" htmlFor="blueprint-estimate-target">Takeoff estimate</label><select id="blueprint-estimate-target" value={selectedEstimateId} onChange={(event) => setSelectedEstimateId(event.target.value)} className="w-full rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">{projectEstimates.map((estimate) => <option key={estimate.id} value={estimate.id}>{estimate.label} · {estimate.status}</option>)}</select></div> : null}
            {workforceOptions.length ? <div className="border-b border-white/10 p-2"><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400" htmlFor="blueprint-workforce-target">Issue responsibility</label><select id="blueprint-workforce-target" value={selectedWorkforceKey} onChange={(event) => setSelectedWorkforceKey(event.target.value)} className="w-full rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">{workforceOptions.map((option) => <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>{option.type === "crew" ? "Crew" : "Employee"} · {option.label}</option>)}</select></div> : null}
            <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Task start<input type="date" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} className="mt-1 w-full rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white" /></label><label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Task finish<input type="date" min={scheduleStart || undefined} value={scheduleFinish} onChange={(event) => setScheduleFinish(event.target.value)} className="mt-1 w-full rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white" /></label></div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">{registerMarkups.length ? registerMarkups.map((markup) => <RegisterItem key={markup.id} markup={markup} companyId={companyId} projectId={projectId} versionId={versionId} onReload={reload} mine={markup.createdBy === userId} saving={saving || creatingTaskFor === markup.id || creatingEstimateItemFor === markup.id || creatingChangeOrderFor === markup.id || assigningWorkforceFor === markup.id || creatingPunchItemFor === markup.id || creatingRfiFor === markup.id || creatingSubmittalFor === markup.id || schedulingTaskFor === markup.id} taskLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "task")} changeOrderLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "change_order")} punchItemLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "punch_item")} rfiLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "rfi")} submittalLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "submittal")} workforceLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "workforce_assignment")} estimateItemLinked={operationalLinks.some((link) => link.annotationId === markup.id && link.targetType === "estimate_line_item")} canAddToEstimate={Boolean(selectedEstimateId)} canAssignWorkforce={Boolean(selectedWorkforceKey)} canSchedule={Boolean(scheduleStart && scheduleFinish)} onAddToEstimate={() => void addTakeoffToEstimate(markup)} onAssignWorkforce={() => void assignWorkforce(markup)} onCreatePunchItem={() => void createPunchItem(markup)} onCreateRfi={() => void createRfi(markup)} onCreateSubmittal={() => void createSubmittal(markup)} onCreateTask={() => void createTask(markup)} onScheduleTask={() => void scheduleTask(markup)} onStartChangeOrder={() => void startChangeOrder(markup)} onStatus={(status) => void updateStatus(markup, status)} />) : <p className="p-3 text-xs text-slate-400">No annotations match this filter.</p>}</div>
          </aside>
        ) : null}
        {symbolLibraryOpen ? <BlueprintSymbolLibrary symbols={symbols} selected={selectedSymbol} onSelect={(symbol) => { setSelectedSymbol(symbol); chooseTool("symbol"); }} onClose={() => setSymbolLibraryOpen(false)} /> : null}
        {activeMedia ? <aside className="absolute bottom-3 right-3 z-30 w-[min(22rem,calc(100%-1.5rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-white shadow-2xl" data-orion-region="blueprint-media-preview"><div className="flex items-center justify-between px-3 py-2"><span className="inline-flex items-center gap-2 text-xs font-bold"><ImageIcon size={14} />Pinned media</span><button type="button" aria-label="Close media preview" onClick={() => setActiveMedia(null)}><X size={16} /></button></div><div className="h-72 w-full bg-black bg-contain bg-center bg-no-repeat" role="img" aria-label={activeMedia.caption || activeMedia.fileName} style={{ backgroundImage: `url(${activeMedia.signedUrl})` }} /><div className="p-3"><p className="text-xs font-semibold">{activeMedia.caption || activeMedia.fileName}</p><p className="mt-1 text-[10px] text-slate-400">Page {activeMedia.pageNumber}</p></div></aside> : null}
      </div>
    </div>
  );
}

function layerForMarkup(type: BlueprintMarkupType): "redlines" | "issues" | "measurements" { return type === "pin" ? "issues" : ["calibration", "distance", "area", "locked_dimension"].includes(type) ? "measurements" : "redlines"; }
function LayerToggle({ layer, visible, onToggle }: { layer: string; visible: boolean; onToggle: () => void }) { return <button type="button" aria-pressed={visible} onClick={onToggle} className={`inline-flex items-center gap-1 rounded px-2 py-1 capitalize ${visible ? "bg-white/15 text-white" : "bg-transparent text-slate-500"}`}>{visible ? <Eye size={11} /> : <EyeOff size={11} />}{layer}</button>; }
function RegisterItem({ markup, companyId, projectId, versionId, onReload, mine, saving, taskLinked, changeOrderLinked, punchItemLinked, rfiLinked, submittalLinked, workforceLinked, estimateItemLinked, canAddToEstimate, canAssignWorkforce, canSchedule, onAddToEstimate, onAssignWorkforce, onCreatePunchItem, onCreateRfi, onCreateSubmittal, onCreateTask, onScheduleTask, onStartChangeOrder, onStatus }: { markup: BlueprintMarkup; companyId: string; projectId: string; versionId: string; onReload: () => Promise<void>; mine: boolean; saving: boolean; taskLinked: boolean; changeOrderLinked: boolean; punchItemLinked: boolean; rfiLinked: boolean; submittalLinked: boolean; workforceLinked: boolean; estimateItemLinked: boolean; canAddToEstimate: boolean; canAssignWorkforce: boolean; canSchedule: boolean; onAddToEstimate: () => void; onAssignWorkforce: () => void; onCreatePunchItem: () => void; onCreateRfi: () => void; onCreateSubmittal: () => void; onCreateTask: () => void; onScheduleTask: () => void; onStartChangeOrder: () => void; onStatus: (status: "open" | "resolved") => void }) { const label = markup.content || markup.type; const isTakeoff = markup.type === "distance" || markup.type === "area"; return <article className="rounded-lg border border-white/10 bg-white/5 p-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold capitalize">{label}</p><p className="mt-1 text-[10px] text-slate-400">{markup.type} · {mine ? "You" : "Team"}</p></div><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${markup.status === "resolved" ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>{markup.status}</span></div>{markup.type === "pin" ? <><BlueprintIssueSlaControls markup={markup} companyId={companyId} projectId={projectId} versionId={versionId} onSaved={onReload} /><div className="mt-2 flex flex-wrap gap-1"><button type="button" disabled={saving} onClick={() => onStatus(markup.status === "open" ? "resolved" : "open")} className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[10px] font-semibold hover:bg-white/10 disabled:opacity-50"><CheckCircle2 size={11} />{markup.status === "open" ? "Resolve issue" : "Reopen issue"}</button><button type="button" disabled={saving || taskLinked} onClick={onCreateTask} className="inline-flex items-center gap-1 rounded border border-blue-400/40 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-60"><ClipboardPlus size={11} />{taskLinked ? "Task linked" : "Create task"}</button>{taskLinked ? <button type="button" disabled={saving || !canSchedule} onClick={onScheduleTask} className="inline-flex items-center gap-1 rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"><ClipboardPlus size={11} />Schedule task</button> : null}<button type="button" disabled={saving || punchItemLinked} onClick={onCreatePunchItem} className="inline-flex items-center gap-1 rounded border border-red-400/40 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-60"><ClipboardPlus size={11} />{punchItemLinked ? "Punch item linked" : "Create punch item"}</button><button type="button" disabled={saving || rfiLinked} onClick={onCreateRfi} className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-60"><ClipboardPlus size={11} />{rfiLinked ? "RFI linked" : "Create RFI"}</button><button type="button" disabled={saving || submittalLinked} onClick={onCreateSubmittal} className="inline-flex items-center gap-1 rounded border border-teal-400/40 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold text-teal-200 hover:bg-teal-500/20 disabled:opacity-60"><ClipboardPlus size={11} />{submittalLinked ? "Submittal linked" : "Create submittal"}</button><button type="button" disabled={saving || workforceLinked || !canAssignWorkforce} onClick={onAssignWorkforce} className="inline-flex items-center gap-1 rounded border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-[10px] font-semibold text-purple-200 hover:bg-purple-500/20 disabled:opacity-60"><Users size={11} />{workforceLinked ? "Workforce assigned" : "Assign workforce"}</button><button type="button" disabled={saving || changeOrderLinked} onClick={onStartChangeOrder} className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"><ClipboardPlus size={11} />{changeOrderLinked ? "Change order linked" : "Start change order"}</button></div></> : null}{isTakeoff ? <><BlueprintTakeoffClassification markup={markup} companyId={companyId} projectId={projectId} versionId={versionId} onSaved={onReload} /><button type="button" disabled={saving || estimateItemLinked || !canAddToEstimate} onClick={onAddToEstimate} className="mt-2 inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"><ClipboardPlus size={11} />{estimateItemLinked ? "Estimate item linked" : "Add to estimate"}</button></> : null}</article>; }

function MarkupShape({ markup }: { markup: BlueprintMarkup }) {
  const geometry = markup.geometry as Record<string, unknown>;
  if (markup.type === "freehand") {
    const points = (geometry.points as number[][] | undefined) ?? [];
    return <polyline points={points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")} fill="none" stroke={markup.color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  }
  if (markup.type === "arrow") {
    return <line x1={Number(geometry.x1) * 1000} y1={Number(geometry.y1) * 1000} x2={Number(geometry.x2) * 1000} y2={Number(geometry.y2) * 1000} stroke={markup.color} strokeWidth="7" markerEnd="url(#blueprint-arrowhead)" vectorEffect="non-scaling-stroke" />;
  }
  if (markup.type === "calibration" || markup.type === "distance") {
    const x1 = Number(geometry.x1) * 1000; const y1 = Number(geometry.y1) * 1000;
    const x2 = Number(geometry.x2) * 1000; const y2 = Number(geometry.y2) * 1000;
    const label = markup.type === "calibration" ? `Scale: ${formatMeasurement(Number(geometry.realLength))} ${String(geometry.unit)}` : `${formatMeasurement(Number(geometry.value))} ${String(geometry.unit)}`;
    return <g><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={markup.type === "calibration" ? "#22d3ee" : markup.color} strokeWidth="6" strokeDasharray={markup.type === "calibration" ? "14 10" : undefined} vectorEffect="non-scaling-stroke" /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 14} textAnchor="middle" fontSize="30" fontWeight="700" fill={markup.type === "calibration" ? "#0891b2" : markup.color} stroke="white" strokeWidth="5" paintOrder="stroke">{label}</text></g>;
  }
  if (markup.type === "area") {
    const x = Math.min(Number(geometry.x1), Number(geometry.x2)) * 1000; const y = Math.min(Number(geometry.y1), Number(geometry.y2)) * 1000;
    const width = Math.abs(Number(geometry.x2) - Number(geometry.x1)) * 1000; const height = Math.abs(Number(geometry.y2) - Number(geometry.y1)) * 1000;
    return <g><rect x={x} y={y} width={width} height={height} fill={`${markup.color}25`} stroke={markup.color} strokeWidth="6" strokeDasharray="12 8" vectorEffect="non-scaling-stroke" /><text x={x + width / 2} y={y + height / 2} textAnchor="middle" fontSize="30" fontWeight="700" fill={markup.color} stroke="white" strokeWidth="5" paintOrder="stroke">{formatMeasurement(Number(geometry.value))} {String(geometry.unit)}</text></g>;
  }
  if (markup.type === "symbol") { const x = Number(geometry.x) * 1000; const y = Number(geometry.y) * 1000; return <g role="img" aria-label={String(geometry.label || "Plan symbol")}><circle cx={x} cy={y} r="27" fill="white" stroke={markup.color} strokeWidth="5" vectorEffect="non-scaling-stroke"/><text x={x} y={y + 8} textAnchor="middle" fontSize="22" fontWeight="800" fill={markup.color}>{String(geometry.glyph || "?")}</text></g>; }
  if (markup.type === "wall" || markup.type === "locked_dimension") { const x1=Number(geometry.x1)*1000,y1=Number(geometry.y1)*1000,x2=Number(geometry.x2)*1000,y2=Number(geometry.y2)*1000; return <g><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={markup.type === "wall" ? "#334155" : markup.color} strokeWidth={markup.type === "wall" ? "12" : "5"} strokeDasharray={markup.type === "locked_dimension" ? "10 6" : undefined} vectorEffect="non-scaling-stroke"/>{markup.type === "locked_dimension" ? <text x={(x1+x2)/2} y={(y1+y2)/2-12} textAnchor="middle" fontSize="28" fontWeight="800" fill={markup.color} stroke="white" strokeWidth="5" paintOrder="stroke">{formatMeasurement(Number(geometry.lockedValue))} {String(geometry.unit)} 🔒</text> : null}</g>; }
  const x = Number(geometry.x) * 1000;
  const y = Number(geometry.y) * 1000;
  return (
    <g role="img" aria-label={markup.content || markup.type}>
      {markup.type === "pin" ? <><circle cx={x} cy={y} r="24" fill={markup.color} /><text x={x} y={y + 8} textAnchor="middle" fontSize="24" fontWeight="700" fill="white">!</text></> : <text x={x} y={y} fontSize="34" fontWeight="700" fill={markup.color} stroke="white" strokeWidth="4" paintOrder="stroke">{markup.content}</text>}
      {markup.type === "pin" && markup.content ? <text x={x + 34} y={y + 9} fontSize="28" fontWeight="700" fill={markup.color} stroke="white" strokeWidth="4" paintOrder="stroke">{markup.content}</text> : null}
    </g>
  );
}

function DraftShape({ tool, points, color }: { tool: MarkupTool; points: Point[]; color: string }) {
  if (tool === "area") { const end = points.at(-1)!; return <rect x={Math.min(points[0].x, end.x) * 1000} y={Math.min(points[0].y, end.y) * 1000} width={Math.abs(end.x - points[0].x) * 1000} height={Math.abs(end.y - points[0].y) * 1000} fill={`${color}25`} stroke={color} strokeWidth="6" strokeDasharray="12 8" vectorEffect="non-scaling-stroke" />; }
  if (["arrow", "calibration", "distance", "wall", "locked_dimension"].includes(tool)) return <line x1={points[0].x * 1000} y1={points[0].y * 1000} x2={points.at(-1)!.x * 1000} y2={points.at(-1)!.y * 1000} stroke={tool === "calibration" ? "#22d3ee" : tool === "wall" ? "#334155" : color} strokeWidth={tool === "wall" ? "12" : "7"} markerEnd={tool === "arrow" ? "url(#blueprint-arrowhead)" : undefined} strokeDasharray={tool === "calibration" ? "14 10" : tool === "locked_dimension" ? "10 6" : undefined} vectorEffect="non-scaling-stroke" />;
  return <polyline points={points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
}

function normalizedDistance(line: { x1: number; y1: number; x2: number; y2: number }) { return Math.hypot(line.x2 - line.x1, line.y2 - line.y1); }
function currentCalibration(markups: BlueprintMarkup[], page: number) {
  const markup = [...markups].reverse().find((item) => item.type === "calibration" && Number(item.geometry.page ?? 1) === page);
  if (!markup) return null;
  return { unitsPerDrawingUnit: Number(markup.geometry.unitsPerDrawingUnit), unit: String(markup.geometry.unit) };
}
function formatMeasurement(value: number) { return Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0"; }

function MarkupButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${active ? "border-blue-300 bg-blue-600 text-white" : "border-white/15 bg-white/10 text-slate-200 hover:bg-white/20"}`}>{children}<span className="hidden sm:inline">{label}</span></button>;
}
