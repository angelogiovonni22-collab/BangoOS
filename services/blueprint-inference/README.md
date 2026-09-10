# B.O.S. Blueprint Inference Service

This service is the isolated Python/GPU inference layer for the native B.O.S. Blueprint Engine. The Next.js application and canonical `BosBuildingGraph` remain authoritative. Learned models may propose geometry, but they may not silently replace vector/dimension evidence.

## Architecture

`B.O.S. TypeScript engine -> signed raster page -> Python inference -> evidence-backed candidates -> TypeScript consensus/validation -> BosBuildingGraph -> GLB/IFC`

The service deliberately starts fail-closed: if no concrete GPU model adapter is installed, `/v1/infer` returns zero geometry and reports model capabilities as unavailable. This prevents a missing model, missing checkpoint, or CPU-only deployment from degrading an otherwise-valid deterministic reconstruction.

## Model roles

- **Raster2Seq (SIGGRAPH 2026)**: primary raster-to-structured room polygon proposal.
- **SAM 2.1**: promptable segmentation for ambiguous architectural regions; supporting evidence, not geometry truth by itself.
- **MitUNet-style wall segmentation**: thin-wall mask/boundary proposal.
- **CAGE-style continuity-aware edges**: topology-oriented wall-edge proposal where its input representation is applicable.
- **RoomFormer**: secondary polygon proposal for consensus/fallback benchmarking.

Adapters and checkpoint licenses must be reviewed before Production deployment. Model weights are not committed to this repository.

## Security

`/v1/infer` requires `X-BOS-Inference-Token`. The service must never receive a Supabase service-role key. Source images should be short-lived signed URLs, and Production networking should restrict the service to B.O.S. callers.

## Local validation

```bash
python -m pip install -e '.[test]'
pytest
python -m uvicorn bos_blueprint_inference.app:app --app-dir src --host 127.0.0.1 --port 8090
```

Install the `ml` extra only in the GPU image used for learned-model adapters.
