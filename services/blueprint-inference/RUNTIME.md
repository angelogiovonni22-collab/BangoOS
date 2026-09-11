# B.O.S. Raster2Seq runtime

The Python Blueprint inference API remains lightweight. Raster2Seq runs in a separate GPU environment because its Detectron2/PyTorch dependency stack is intentionally isolated from the FastAPI service and from the Next.js application.

Production wiring is fail-closed:

- `BOS_RASTER2SEQ_BRIDGE_COMMAND` enables the adapter. Leave it unset to keep learned inference disabled.
- The bridge included at `runtime/raster2seq_bridge.py` expects an MIT-licensed Raster2Seq checkout at `BOS_RASTER2SEQ_REPO_PATH` (default `/opt/Raster2Seq`).
- `BOS_RASTER2SEQ_CHECKPOINT` defaults to `hf:raster2graph-512`.
- `BOS_RASTER2SEQ_IMAGE_SIZE` defaults to `512` and must be 256 or 512.
- The worker requires CUDA and the upstream Raster2Seq runtime dependencies. Model weights are not stored in the B.O.S. repository.
- The API request must include a verified drawing scale plus source page width/height in drawing units. Without those values, learned geometry is withheld so pixel coordinates can never be mistaken for construction dimensions.

The adapter converts Raster2Seq's aspect-ratio-preserving `ResizeAndPad` coordinate frame back to the exact source page frame, then to meters. Room polygons also produce evidence-backed boundary-wall proposals. Learned walls cannot enter the canonical Building Graph directly: the TypeScript deterministic-consensus gate must return `promotion_candidate`, and the learned topology repair gate accepts only endpoint-supported additions that improve both validation score and wall-topology metrics.

CAGE remains blocked from commercial B.O.S. inference under its published license. MitUNet-style research remains disabled until a concrete implementation/checkpoint license is verified. Raster2Seq, SAM 2.1, and RoomFormer are governed independently by `model_governance.py`.
