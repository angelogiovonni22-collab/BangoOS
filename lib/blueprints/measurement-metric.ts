export type MeasurementLine = { x1: number; y1: number; x2: number; y2: number };

export const MEASUREMENT_METRIC_VERSION = 2;

// Markup coordinates divide X and Y by different surface dimensions. Convert
// both axes to surface-width units before applying a physical calibration.
export function drawingDistance(line: MeasurementLine, aspectRatio: number) {
  return Math.hypot(line.x2 - line.x1, (line.y2 - line.y1) / aspectRatio);
}

export function drawingArea(line: MeasurementLine, aspectRatio: number) {
  return Math.abs((line.x2 - line.x1) * (line.y2 - line.y1)) / aspectRatio;
}

export function validMeasurementMetric(geometry: Record<string, unknown>) {
  return geometry.measurementMetricVersion === MEASUREMENT_METRIC_VERSION
    && typeof geometry.coordinateAspectRatio === "number"
    && Number.isFinite(geometry.coordinateAspectRatio) && geometry.coordinateAspectRatio > 0;
}

export function compatibleMeasurementSurface(geometry: Record<string, unknown>, aspectRatio: number) {
  return validMeasurementMetric(geometry) && Number.isFinite(aspectRatio) && aspectRatio > 0
    && Math.abs(Number(geometry.coordinateAspectRatio) / aspectRatio - 1) < 0.001;
}
