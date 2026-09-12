# B.O.S. Blueprint model preparation

These tools prepare commercially controlled training input without starting a GPU or creating a bill.

1. Generate source pairs:
   `python training/synthetic_generator.py --output /secure/bos-dataset --count 1000 --seed 20260912`
2. Validate every source hash and export COCO plus Raster2Seq polygon sequences:
   `python training/export_raster2seq.py --dataset /secure/bos-dataset --output /secure/bos-export`
3. Create a hash-pinned, GPU-disabled job:
   `python training/prepare_training_job.py --export /secure/bos-export --output /secure/training-job.json --architecture-revision a6c4e27a68d11d7a459f6e4a2601fd887227dd1a`

The prepared job always has `epochs: 0` and `paid_gpu_enabled: false`. A later, separately approved training runner must set paid parameters explicitly.

Version 2 varies wall weights, ink and paper intensity, scan noise, exterior windows, dimensions, room grids, and attached-garage footprints. Even so, 1,000 plans exercise the pipeline rather than proving Production accuracy. Expand volume and add licensed real-world style distributions before a final candidate checkpoint. Keep all generated plans, exports, jobs, and weights outside source control.
