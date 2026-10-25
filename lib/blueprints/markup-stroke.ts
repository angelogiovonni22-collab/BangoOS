type Point = { x: number; y: number };

// Pointer moves may be coalesced. The release event is authoritative for the
// endpoint, including when no final pointermove was delivered.
export function finishBlueprintStroke(points: Point[], endpoint: Point, freehand = false): Point[] {
  const start = points[0];
  if (!start) return [];
  if (freehand) {
    const completed = [...points, endpoint];
    return completed.some((point) => point.x !== start.x || point.y !== start.y) ? completed : [];
  }
  return endpoint.x === start.x && endpoint.y === start.y ? [] : [start, endpoint];
}
