from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Mapping

CommercialStatus = Literal["allowed", "review_required", "blocked"]


@dataclass(frozen=True)
class ModelGovernance:
    model: str
    code_license_name: str
    architecture_status: CommercialStatus
    source_url: str
    checkpoint_manifest_required: bool
    note: str

    @property
    def license_name(self) -> str:
        return self.code_license_name

    @property
    def commercial_status(self) -> CommercialStatus:
        return self.architecture_status


MODEL_GOVERNANCE: dict[str, ModelGovernance] = {
    "raster2seq": ModelGovernance(
        model="raster2seq",
        code_license_name="MIT",
        architecture_status="allowed",
        source_url="https://github.com/Cornell-VAILab/Raster2Seq",
        checkpoint_manifest_required=True,
        note="Architecture code is MIT; every checkpoint still requires independent training-data provenance and approval.",
    ),
    "sam2.1": ModelGovernance(
        model="sam2.1",
        code_license_name="Apache-2.0",
        architecture_status="allowed",
        source_url="https://github.com/facebookresearch/sam2",
        checkpoint_manifest_required=True,
        note="Architecture code is permitted; checkpoint provenance is reviewed independently.",
    ),
    "roomformer": ModelGovernance(
        model="roomformer",
        code_license_name="MIT",
        architecture_status="allowed",
        source_url="https://github.com/ywyue/RoomFormer",
        checkpoint_manifest_required=True,
        note="Architecture code is permitted; checkpoint provenance is reviewed independently.",
    ),
    "cage": ModelGovernance(
        model="cage",
        code_license_name="MIT + Commons Clause commercial restriction",
        architecture_status="blocked",
        source_url="https://github.com/ee-Liu/CAGE",
        checkpoint_manifest_required=True,
        note="Do not load in B.O.S. commercial inference without a separate commercial license from the author.",
    ),
    "mitunet": ModelGovernance(
        model="mitunet",
        code_license_name="unverified implementation/checkpoint license",
        architecture_status="review_required",
        source_url="research-paper-only",
        checkpoint_manifest_required=True,
        note="Research candidate only until a concrete implementation and checkpoint license are verified.",
    ),
}


def governance_for(model: str) -> ModelGovernance:
    return MODEL_GOVERNANCE.get(
        model,
        ModelGovernance(
            model=model,
            code_license_name="unknown",
            architecture_status="blocked",
            source_url="unknown",
            checkpoint_manifest_required=True,
            note="Unknown models fail closed until code, license, checkpoint, and provenance are reviewed.",
        ),
    )


def _is_sha256(value: object) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 64
        and all(char in "0123456789abcdef" for char in value.lower())
    )


def load_checkpoint_manifest(path: str | Path) -> Mapping[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def checkpoint_manifest_errors(model: str, manifest: Mapping[str, Any] | None) -> list[str]:
    if manifest is None:
        return ["checkpoint_manifest_missing"]
    errors: list[str] = []
    if manifest.get("schema_version") != 1:
        errors.append("schema_version_invalid")
    architecture = manifest.get("architecture")
    if not isinstance(architecture, Mapping) or architecture.get("model") != model:
        errors.append("architecture_model_mismatch")
    elif not architecture.get("code_revision") or not architecture.get("license"):
        errors.append("architecture_provenance_incomplete")
    checkpoint = manifest.get("checkpoint")
    if not isinstance(checkpoint, Mapping):
        errors.append("checkpoint_missing")
    else:
        if not checkpoint.get("id") or not checkpoint.get("version"):
            errors.append("checkpoint_identity_incomplete")
        if not _is_sha256(checkpoint.get("sha256")):
            errors.append("checkpoint_sha256_invalid")
    datasets = manifest.get("training_datasets")
    if not isinstance(datasets, list) or not datasets:
        errors.append("training_datasets_missing")
    else:
        for dataset in datasets:
            if not isinstance(dataset, Mapping):
                errors.append("training_dataset_invalid")
                continue
            if not _is_sha256(dataset.get("manifest_sha256")):
                errors.append("training_dataset_manifest_sha256_invalid")
            if not dataset.get("license") or dataset.get("commercial_use_status") != "allowed":
                errors.append("training_dataset_rights_not_allowed")
            if dataset.get("contains_customer_data") is not False:
                errors.append("training_dataset_customer_data_not_cleared")
            identity = f"{dataset.get('id', '')} {dataset.get('name', '')}".lower()
            if "mitchell" in identity:
                errors.append("held_out_benchmark_in_training_data")
    approval = manifest.get("commercial_approval")
    if not isinstance(approval, Mapping) or approval.get("status") != "approved":
        errors.append("commercial_approval_missing")
    elif not approval.get("approved_by") or not approval.get("approved_at"):
        errors.append("commercial_approval_incomplete")
    held_out = manifest.get("held_out_benchmarks")
    if not isinstance(held_out, list) or "mitchell-page-2" not in held_out:
        errors.append("mitchell_holdout_not_declared")
    return sorted(set(errors))


def verify_checkpoint_file(manifest: Mapping[str, Any], checkpoint_path: str | Path) -> bool:
    checkpoint = manifest.get("checkpoint")
    if not isinstance(checkpoint, Mapping) or not _is_sha256(checkpoint.get("sha256")):
        return False
    return hashlib.sha256(Path(checkpoint_path).read_bytes()).hexdigest() == str(
        checkpoint["sha256"]
    ).lower()


def production_model_allowed(model: str, manifest: Mapping[str, Any] | None = None) -> bool:
    governance = governance_for(model)
    if governance.architecture_status != "allowed":
        return False
    if not governance.checkpoint_manifest_required:
        return True
    return not checkpoint_manifest_errors(model, manifest)
