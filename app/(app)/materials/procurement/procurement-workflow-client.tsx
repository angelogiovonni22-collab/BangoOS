"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  SectionHeader,
  Select,
  SkeletonLoader,
  SummaryCard,
  Textarea,
} from "@/components/ui";
import { createProcurementService, ProcurementServiceError } from "@/lib/materials/procurement-service";
import type {
  ProcurementMaterialRequest,
  ProcurementOverviewPayload,
  ProcurementPurchaseOrder,
  ProcurementPurchaseOrderLine,
  PurchaseOrderStatus,
} from "@/lib/materials/procurement-types";
import { useCompany } from "@/lib/company";
import { BlueprintSourceLink } from "@/components/plans/blueprint-source-link";

const STATUS_BADGE_TONE: Record<PurchaseOrderStatus, "neutral" | "warning" | "info" | "brand" | "success" | "danger"> = {
  draft: "neutral",
  approved: "brand",
  issued: "info",
  partially_received: "warning",
  fully_received: "success",
  cancelled: "danger",
};

type RequestFormState = {
  projectId: string;
  priority: "low" | "normal" | "high" | "critical";
  neededByDate: string;
  notes: string;
};

type PurchaseOrderFormLine = {
  materialId: string;
  description: string;
  quantityOrdered: string;
  unitCost: string;
  projectId: string;
  costCodeId: string;
};

type PurchaseOrderFormState = {
  requestId: string;
  vendorId: string;
  projectId: string;
  costCodeId: string;
  taxAmount: string;
  shippingAmount: string;
  notes: string;
  lines: PurchaseOrderFormLine[];
};

const EMPTY_REQUEST_FORM: RequestFormState = {
  projectId: "",
  priority: "normal",
  neededByDate: "",
  notes: "",
};

const EMPTY_PO_LINE: PurchaseOrderFormLine = {
  materialId: "",
  description: "",
  quantityOrdered: "1",
  unitCost: "0",
  projectId: "",
  costCodeId: "",
};

const EMPTY_PO_FORM: PurchaseOrderFormState = {
  requestId: "",
  vendorId: "",
  projectId: "",
  costCodeId: "",
  taxAmount: "0",
  shippingAmount: "0",
  notes: "",
  lines: [{ ...EMPTY_PO_LINE }],
};

export function ProcurementWorkflowClient({ initialProjectId }: { initialProjectId?: string }) {
  const service = useMemo(() => createProcurementService(), []);
  const { companyName } = useCompany();

  const [payload, setPayload] = useState<ProcurementOverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [selectedLineId, setSelectedLineId] = useState<string>("");

  const [requestForm, setRequestForm] = useState<RequestFormState>(() => ({ ...EMPTY_REQUEST_FORM, projectId: initialProjectId || "" }));
  const [poForm, setPoForm] = useState<PurchaseOrderFormState>(() => ({ ...EMPTY_PO_FORM, projectId: initialProjectId || "" }));

  const [receiveQuantity, setReceiveQuantity] = useState("0");
  const [receiveDamaged, setReceiveDamaged] = useState("0");
  const [receiveBackordered, setReceiveBackordered] = useState("0");
  const [receiveNotes, setReceiveNotes] = useState("");

  const [allocateQuantity, setAllocateQuantity] = useState("0");
  const [allocateProjectId, setAllocateProjectId] = useState("");
  const [allocateCostCodeId, setAllocateCostCodeId] = useState("");
  const [allocateNotes, setAllocateNotes] = useState("");

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextPayload = await service.loadOverview();
      setPayload(nextPayload);

      setSelectedPoId((current) => current || nextPayload.purchaseOrders[0]?.id || "");
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const selectedPurchaseOrder = useMemo(() => {
    if (!payload || !selectedPoId) {
      return null;
    }

    return payload.purchaseOrders.find((order) => order.id === selectedPoId) || null;
  }, [payload, selectedPoId]);

  const selectedPurchaseOrderLines = useMemo(() => {
    if (!payload || !selectedPoId) {
      return [];
    }

    return payload.lineItems.filter((line) => line.purchaseOrderId === selectedPoId);
  }, [payload, selectedPoId]);

  const selectedLine = useMemo(() => {
    if (!selectedLineId) {
      return null;
    }

    return selectedPurchaseOrderLines.find((line) => line.id === selectedLineId) || null;
  }, [selectedLineId, selectedPurchaseOrderLines]);

  const summary = useMemo(() => {
    if (!payload) {
      return {
        requestCount: 0,
        draftPoCount: 0,
        openPoCount: 0,
        pendingDeliveryCount: 0,
      };
    }

    const requestCount = payload.requests.filter((item) => item.status === "submitted" || item.status === "approved").length;
    const draftPoCount = payload.purchaseOrders.filter((item) => item.status === "draft").length;
    const openPoCount = payload.purchaseOrders.filter((item) => item.status === "approved" || item.status === "issued" || item.status === "partially_received").length;
    const pendingDeliveryCount = payload.lineItems.filter((line) => line.quantityOrdered > line.quantityReceived + line.quantityDamaged).length;

    return {
      requestCount,
      draftPoCount,
      openPoCount,
      pendingDeliveryCount,
    };
  }, [payload]);

  const submitRequest = async () => {
    if (!requestForm.projectId) {
      setErrorMessage("Project is required to submit a material request.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextPayload = await service.createMaterialRequest({
        projectId: requestForm.projectId,
        priority: requestForm.priority,
        neededByDate: requestForm.neededByDate || null,
        notes: requestForm.notes.trim() || null,
      });
      setPayload(nextPayload);
      setRequestForm({ ...EMPTY_REQUEST_FORM, projectId: initialProjectId || "" });
      setActionMessage("Material request submitted.");
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const transitionRequest = async (requestId: string, status: ProcurementMaterialRequest["status"]) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextPayload = await service.updateMaterialRequestStatus(requestId, status);
      setPayload(nextPayload);
      setActionMessage(`Material request ${status.replaceAll("_", " ")}.`);
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const upsertPurchaseOrder = async () => {
    if (!poForm.vendorId || !poForm.projectId) {
      setErrorMessage("Vendor and project are required for a purchase order.");
      return;
    }

    const normalizedLines = poForm.lines
      .map((line) => ({
        materialId: line.materialId || null,
        description: line.description.trim(),
        quantityOrdered: Number(line.quantityOrdered),
        unitCost: Number(line.unitCost),
        projectId: line.projectId || poForm.projectId,
        costCodeId: line.costCodeId || poForm.costCodeId || null,
      }))
      .filter((line) => line.description && Number.isFinite(line.quantityOrdered) && Number.isFinite(line.unitCost) && line.quantityOrdered > 0);

    if (normalizedLines.length === 0) {
      setErrorMessage("At least one valid line item is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextPayload = await service.createDraftPurchaseOrder({
        requestId: poForm.requestId || null,
        vendorId: poForm.vendorId,
        projectId: poForm.projectId,
        costCodeId: poForm.costCodeId || null,
        taxAmount: Number(poForm.taxAmount || 0),
        shippingAmount: Number(poForm.shippingAmount || 0),
        notes: poForm.notes.trim() || null,
        attachments: [],
        lines: normalizedLines,
      });

      setPayload(nextPayload);
      const firstPoId = nextPayload.purchaseOrders[0]?.id || "";
      setSelectedPoId(firstPoId);
      setSelectedLineId("");
      setPoForm({ ...EMPTY_PO_FORM, projectId: initialProjectId || "" });
      setActionMessage("Draft purchase order created and totals verified.");
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const transitionPurchaseOrder = async (purchaseOrder: ProcurementPurchaseOrder, action: "approve" | "issue" | "cancel") => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      let nextPayload: ProcurementOverviewPayload;

      if (action === "approve") {
        nextPayload = await service.approvePurchaseOrder(purchaseOrder.id);
      } else if (action === "issue") {
        nextPayload = await service.issuePurchaseOrder(purchaseOrder.id);
      } else {
        nextPayload = await service.cancelPurchaseOrder(purchaseOrder.id);
      }

      setPayload(nextPayload);
      setActionMessage(`Purchase order ${action === "cancel" ? "cancelled" : `${action}d`}.`);
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const receiveLine = async () => {
    if (!selectedPurchaseOrder || !selectedLine) {
      setErrorMessage("Select a purchase order and line item first.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextPayload = await service.receivePurchaseOrderLine({
        purchaseOrderId: selectedPurchaseOrder.id,
        lineItemId: selectedLine.id,
        quantityReceived: Number(receiveQuantity || 0),
        quantityDamaged: Number(receiveDamaged || 0),
        quantityBackordered: Number(receiveBackordered || 0),
        notes: receiveNotes.trim() || null,
      });

      setPayload(nextPayload);
      setReceiveQuantity("0");
      setReceiveDamaged("0");
      setReceiveBackordered("0");
      setReceiveNotes("");
      setActionMessage("Receipt recorded and purchase order progress updated.");
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const allocateLine = async () => {
    if (!selectedPurchaseOrder || !selectedLine || !selectedLine.materialId || !allocateProjectId) {
      setErrorMessage("Select a material line and target project to allocate.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const nextPayload = await service.allocateMaterialToProject({
        purchaseOrderId: selectedPurchaseOrder.id,
        lineItemId: selectedLine.id,
        materialId: selectedLine.materialId,
        projectId: allocateProjectId,
        costCodeId: allocateCostCodeId || selectedLine.costCodeId || null,
        quantityAllocated: Number(allocateQuantity || 0),
        unitCost: selectedLine.unitCost,
        notes: allocateNotes.trim() || null,
      });

      setPayload(nextPayload);
      setAllocateQuantity("0");
      setAllocateNotes("");
      setActionMessage("Material allocated to the project.");
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-10 w-80" />
        <SkeletonLoader className="h-28 w-full" />
        <SkeletonLoader className="h-80 w-full" />
      </div>
    );
  }

  if (errorMessage && !payload) {
    return <ErrorState title="Unable to load procurement" description={errorMessage} />;
  }

  if (!payload) {
    return <EmptyState title="No procurement data" description="No procurement records are available for this workspace." />;
  }

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        eyebrow="Materials"
        title="Procurement Workflow"
        description={`Manage requests, purchasing, receiving, and allocation for ${companyName || "your company"}.`}
        primaryAction={
          <Link href="/materials" className={getButtonClassName({ variant: "outline" })}>Back to Materials</Link>
        }
      />

      {errorMessage ? <ErrorState compact title="Unable to complete action" description={errorMessage} /> : null}
      {actionMessage ? <p role="status" className="rounded-[var(--radius-lg)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]">{actionMessage}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<span>R</span>} label="Open Requests" value={String(summary.requestCount)} context="Submitted or approved" tone="warning" />
        <SummaryCard icon={<span>D</span>} label="Draft POs" value={String(summary.draftPoCount)} context="Pending approval" tone="neutral" />
        <SummaryCard icon={<span>O</span>} label="Open POs" value={String(summary.openPoCount)} context="Approved, issued, partial" tone="brand" />
        <SummaryCard icon={<span>P</span>} label="Pending Deliveries" value={String(summary.pendingDeliveryCount)} context="Line items not fully received" tone="info" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Material Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Project" required>
              <Select value={requestForm.projectId} onChange={(event) => setRequestForm((current) => ({ ...current, projectId: event.target.value }))}>
                <option value="">Select project</option>
                {payload.projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Priority" required>
              <Select value={requestForm.priority} onChange={(event) => setRequestForm((current) => ({ ...current, priority: event.target.value as RequestFormState["priority"] }))}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </FormField>

            <FormField label="Needed by date">
              <Input type="date" value={requestForm.neededByDate} onChange={(event) => setRequestForm((current) => ({ ...current, neededByDate: event.target.value }))} />
            </FormField>

            <FormField label="Notes">
              <Textarea
                rows={3}
                value={requestForm.notes}
                onChange={(event) => setRequestForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </FormField>

            <div className="flex justify-end">
              <Button disabled={isSaving} onClick={submitRequest}>{isSaving ? "Saving..." : "Submit Request"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Purchase Order Draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="From approved request (optional)">
              <Select value={poForm.requestId} onChange={(event) => setPoForm((current) => ({ ...current, requestId: event.target.value }))}>
                <option value="">None</option>
                {payload.requests.filter((request) => request.status === "approved").map((request) => (
                  <option key={request.id} value={request.id}>{request.requestNumber} - {request.projectName}</option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Vendor" required>
                <Select value={poForm.vendorId} onChange={(event) => setPoForm((current) => ({ ...current, vendorId: event.target.value }))}>
                  <option value="">Select vendor</option>
                  {payload.vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Project" required>
                <Select value={poForm.projectId} onChange={(event) => setPoForm((current) => ({ ...current, projectId: event.target.value }))}>
                  <option value="">Select project</option>
                  {payload.projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Cost code">
                <Select value={poForm.costCodeId} onChange={(event) => setPoForm((current) => ({ ...current, costCodeId: event.target.value }))}>
                  <option value="">None</option>
                  {payload.costCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>{costCode.label}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Tax">
                <Input type="number" min="0" step="0.01" value={poForm.taxAmount} onChange={(event) => setPoForm((current) => ({ ...current, taxAmount: event.target.value }))} />
              </FormField>

              <FormField label="Shipping">
                <Input type="number" min="0" step="0.01" value={poForm.shippingAmount} onChange={(event) => setPoForm((current) => ({ ...current, shippingAmount: event.target.value }))} />
              </FormField>
            </div>

            <FormField label="Notes">
              <Textarea
                rows={2}
                value={poForm.notes}
                onChange={(event) => setPoForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </FormField>

            <SectionHeader title="Line Items" description="At least one line item is required." />

            <div className="space-y-3">
              {poForm.lines.map((line, index) => (
                <div key={`${index}-${line.materialId}-${line.description}`} className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Select
                    value={line.materialId}
                    onChange={(event) => {
                      const nextMaterialId = event.target.value;
                      const material = payload.materials.find((item) => item.id === nextMaterialId);
                      setPoForm((current) => ({
                        ...current,
                        lines: current.lines.map((row, rowIndex) => rowIndex === index
                          ? { ...row, materialId: nextMaterialId, description: material?.name || row.description }
                          : row),
                      }));
                    }}
                  >
                    <option value="">Material</option>
                    {payload.materials.map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(event) => setPoForm((current) => ({
                      ...current,
                      lines: current.lines.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row),
                    }))}
                  />
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="Qty"
                    value={line.quantityOrdered}
                    onChange={(event) => setPoForm((current) => ({
                      ...current,
                      lines: current.lines.map((row, rowIndex) => rowIndex === index ? { ...row, quantityOrdered: event.target.value } : row),
                    }))}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(event) => setPoForm((current) => ({
                      ...current,
                      lines: current.lines.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row),
                    }))}
                  />
                  <Select
                    value={line.projectId}
                    onChange={(event) => setPoForm((current) => ({
                      ...current,
                      lines: current.lines.map((row, rowIndex) => rowIndex === index ? { ...row, projectId: event.target.value } : row),
                    }))}
                  >
                    <option value="">Project</option>
                    {payload.projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </Select>
                  <Select
                    value={line.costCodeId}
                    onChange={(event) => setPoForm((current) => ({
                      ...current,
                      lines: current.lines.map((row, rowIndex) => rowIndex === index ? { ...row, costCodeId: event.target.value } : row),
                    }))}
                  >
                    <option value="">Cost code</option>
                    {payload.costCodes.map((costCode) => (
                      <option key={costCode.id} value={costCode.id}>{costCode.label}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPoForm((current) => ({ ...current, lines: [...current.lines, { ...EMPTY_PO_LINE }] }))}
              >
                Add Line
              </Button>

              <Button disabled={isSaving} onClick={upsertPurchaseOrder}>{isSaving ? "Saving..." : "Create Draft PO"}</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>3. Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.purchaseOrders.length === 0 ? (
              <EmptyState title="No purchase orders" description="Create a draft purchase order to start procurement." />
            ) : (
              <div className="space-y-2">
                {payload.purchaseOrders.map((purchaseOrder) => (
                  <div key={purchaseOrder.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                          setSelectedPoId(purchaseOrder.id);
                          setSelectedLineId("");
                        }}
                      >
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{purchaseOrder.poNumber} - {purchaseOrder.vendorName}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{purchaseOrder.projectName} | ${purchaseOrder.totalAmount.toFixed(2)}</p>
                      </button>
                      <Badge tone={STATUS_BADGE_TONE[purchaseOrder.status]}>{purchaseOrder.status.replace(/_/g, " ")}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {purchaseOrder.status === "draft" ? (
                        <Button size="sm" onClick={() => void transitionPurchaseOrder(purchaseOrder, "approve")} disabled={isSaving}>Approve</Button>
                      ) : null}
                      {purchaseOrder.status === "approved" ? (
                        <Button size="sm" onClick={() => void transitionPurchaseOrder(purchaseOrder, "issue")} disabled={isSaving}>Issue</Button>
                      ) : null}
                      {purchaseOrder.status !== "cancelled" && purchaseOrder.status !== "fully_received" ? (
                        <Button size="sm" variant="outline" onClick={() => void transitionPurchaseOrder(purchaseOrder, "cancel")} disabled={isSaving}>Cancel</Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Receiving & Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Selected PO">
              <Select value={selectedPoId} onChange={(event) => { setSelectedPoId(event.target.value); setSelectedLineId(""); }}>
                <option value="">Select PO</option>
                {payload.purchaseOrders.map((purchaseOrder) => (
                  <option key={purchaseOrder.id} value={purchaseOrder.id}>{purchaseOrder.poNumber} - {purchaseOrder.vendorName}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Line item">
              <Select value={selectedLineId} onChange={(event) => setSelectedLineId(event.target.value)}>
                <option value="">Select line</option>
                {selectedPurchaseOrderLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.materialName} | Ordered {line.quantityOrdered} | Received {line.quantityReceived}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-2 sm:grid-cols-3">
              <FormField label="Received qty">
                <Input type="number" min="0" step="0.001" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} />
              </FormField>
              <FormField label="Damaged qty">
                <Input type="number" min="0" step="0.001" value={receiveDamaged} onChange={(event) => setReceiveDamaged(event.target.value)} />
              </FormField>
              <FormField label="Backordered qty">
                <Input type="number" min="0" step="0.001" value={receiveBackordered} onChange={(event) => setReceiveBackordered(event.target.value)} />
              </FormField>
            </div>

            <FormField label="Receiving notes">
              <Input value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} />
            </FormField>

            <div className="flex justify-end">
              <Button onClick={receiveLine} disabled={isSaving || !selectedPoId || !selectedLineId}>{isSaving ? "Saving..." : "Record Receipt"}</Button>
            </div>

            <SectionHeader title="Allocate to Project" description="Allocation decreases inventory and updates project cost tracking." />

            <FormField label="Allocate quantity">
              <Input type="number" min="0" step="0.001" value={allocateQuantity} onChange={(event) => setAllocateQuantity(event.target.value)} />
            </FormField>

            <div className="grid gap-2 sm:grid-cols-2">
              <FormField label="Target project" required>
                <Select value={allocateProjectId} onChange={(event) => setAllocateProjectId(event.target.value)}>
                  <option value="">Select project</option>
                  {payload.projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Cost code">
                <Select value={allocateCostCodeId} onChange={(event) => setAllocateCostCodeId(event.target.value)}>
                  <option value="">None</option>
                  {payload.costCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>{costCode.label}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Allocation notes">
              <Input value={allocateNotes} onChange={(event) => setAllocateNotes(event.target.value)} />
            </FormField>

            <div className="flex justify-end">
              <Button onClick={allocateLine} disabled={isSaving || !selectedLine?.materialId}>{isSaving ? "Saving..." : "Allocate Material"}</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Material Requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payload.requests.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">No requests submitted yet.</p>
            ) : payload.requests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                isSaving={isSaving}
                onApprove={() => void transitionRequest(request.id, "approved")}
                onReject={() => void transitionRequest(request.id, "rejected")}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Selected PO Line Progress</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {selectedPurchaseOrderLines.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">Select a purchase order to inspect lines.</p>
            ) : selectedPurchaseOrderLines.map((line) => (
              <LineProgressRow key={line.id} line={line} isActive={line.id === selectedLineId} onSelect={() => setSelectedLineId(line.id)} />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RequestRow({
  request,
  isSaving,
  onApprove,
  onReject,
}: {
  request: ProcurementMaterialRequest;
  isSaving: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const tone = request.status === "approved"
    ? "success"
    : request.status === "rejected" || request.status === "cancelled"
      ? "danger"
      : request.status === "converted"
        ? "brand"
        : request.status === "submitted"
          ? "warning"
          : "neutral";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{request.requestNumber} - {request.projectName}</p>
        <Badge tone={tone}>{request.status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Priority: {request.priority} | Needed: {request.neededByDate || "Not set"}</p>
      {request.status === "submitted" ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={isSaving}>Approve</Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={isSaving}>Reject</Button>
        </div>
      ) : null}
      <div className="mt-3"><BlueprintSourceLink targetType="material_request" targetIds={[request.id]} /></div>
    </div>
  );
}

function LineProgressRow({
  line,
  isActive,
  onSelect,
}: {
  line: ProcurementPurchaseOrderLine;
  isActive: boolean;
  onSelect: () => void;
}) {
  const receivedPercent = line.quantityOrdered > 0
    ? Math.min(100, Math.round(((line.quantityReceived + line.quantityDamaged) / line.quantityOrdered) * 100))
    : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-[var(--radius-lg)] border p-3 text-left transition",
        isActive
          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)]"
          : "border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-subtle)]",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{line.materialName}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        Ordered {line.quantityOrdered} | Received {line.quantityReceived} | Damaged {line.quantityDamaged} | Backordered {line.quantityBackordered}
      </p>
      <div className="mt-2 h-2 rounded-full bg-[var(--color-neutral-200)]">
        <div className="h-full rounded-full bg-[var(--color-brand-500)]" style={{ width: `${receivedPercent}%` }} />
      </div>
    </button>
  );
}

function toMessage(error: unknown) {
  if (error instanceof ProcurementServiceError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected procurement error.";
}
