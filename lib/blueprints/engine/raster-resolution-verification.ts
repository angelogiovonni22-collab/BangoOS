export const BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION = 2400;
export const HIGH_RESOLUTION_BLUEPRINT_RASTER_MAX_DIMENSION = 2592;

/**
 * The Production benchmark may opt into a source-resolution raster extraction for read-only
 * comparison. This selector is intentionally closed: arbitrary query values cannot increase
 * server work or silently alter the normal 2400 px extraction path.
 */
export function resolveBlueprintBenchmarkRasterMaxDimension(value: string | null | undefined) {
  return value === String(HIGH_RESOLUTION_BLUEPRINT_RASTER_MAX_DIMENSION)
    ? HIGH_RESOLUTION_BLUEPRINT_RASTER_MAX_DIMENSION
    : BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION;
}
