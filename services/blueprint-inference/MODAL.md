# B.O.S. Blueprint Inference on Modal

This deployment keeps B.O.S. on its existing Next.js/Vercel/Supabase stack. Modal supplies only on-demand GPU compute for the learned Blueprint inference service.

## Runtime

- Modal app: `bos-blueprint-inference`
- GPU: NVIDIA A10G
- Minimum warm containers: 0
- Maximum containers: 2
- Idle scale-down window: 30 seconds
- Request timeout: 300 seconds
- Container startup timeout: 600 seconds
- Raster2Seq upstream revision: `a6c4e27a68d11d7a459f6e4a2601fd887227dd1a`
- Default checkpoint: `hf:raster2graph-512`
- Raster2Seq image size: 512

The endpoint still requires the existing `x-bos-inference-token` application-level authentication enforced by `bos_blueprint_inference.app`.

## One-time account setup

1. Create the Modal workspace and add billing.
2. Create a Modal API token and store its values as GitHub repository Actions secrets:
   - `MODAL_TOKEN_ID`
   - `MODAL_TOKEN_SECRET`
3. In Modal, create a secret named `bos-blueprint-inference` containing:
   - `BOS_BLUEPRINT_INFERENCE_TOKEN=<random server-only token>`
4. Run the GitHub Actions workflow `Blueprint Modal Deploy` manually.
5. Copy the deployed Modal HTTPS endpoint into the B.O.S./Vercel server environment as `BOS_BLUEPRINT_INFERENCE_URL`.
6. Put the same server-only token from step 3 into B.O.S./Vercel as `BOS_BLUEPRINT_INFERENCE_TOKEN`.

Do not place Modal credentials or the Blueprint inference token in source control, browser code, or public environment variables.

## Cost behavior

The function is configured with zero minimum containers. It scales to GPU compute only when inference is requested, keeps at most two GPU containers, and releases idle containers after 30 seconds. Production B.O.S. continues to fall back to deterministic reconstruction if the learned service is unavailable or unconfigured.

## Deployment

The repository intentionally uses a manual `workflow_dispatch` deployment workflow. Creating or merging this code does not start GPU compute. GPU billing begins only when the deployed endpoint actually receives work or a container is started for deployment/runtime operations.
