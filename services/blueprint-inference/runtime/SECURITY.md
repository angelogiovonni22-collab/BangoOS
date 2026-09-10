# Runtime security boundary

The bridge accepts only HTTPS image URLs, enforces a 30 MB response cap, runs Raster2Seq without shell interpolation, applies a hard subprocess timeout, and emits only JSON geometry metadata. The B.O.S. API token is never forwarded into the Raster2Seq process.