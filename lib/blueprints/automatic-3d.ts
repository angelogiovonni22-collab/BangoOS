export type Blueprint3dWall = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
  height?: number;
  label?: string;
};

export type Blueprint3dAnalysis = {
  units: "ft" | "m";
  ceilingHeight: number;
  floorThickness?: number;
  walls: Blueprint3dWall[];
  confidence: number;
  assumptions: string[];
  notes?: string[];
};

export type NormalizedBlueprint3dAnalysis = {
  units: "m";
  ceilingHeight: number;
  floorThickness: number;
  walls: Required<Pick<Blueprint3dWall, "x1" | "y1" | "x2" | "y2" | "thickness" | "height">> & { label?: string }[];
  confidence: number;
  assumptions: string[];
  notes: string[];
};

const FEET_TO_METERS = 0.3048;
const DEFAULT_CEILING_HEIGHT_FT = 8;
const DEFAULT_WALL_THICKNESS_FT = 0.5;
const DEFAULT_FLOOR_THICKNESS_FT = 0.5;
const MAX_WALLS = 400;

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value: unknown, fallback: number) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function clampConfidence(value: unknown) {
  return Math.max(0, Math.min(1, finite(value, 0)));
}

export function normalizeBlueprint3dAnalysis(raw: unknown): NormalizedBlueprint3dAnalysis {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const units = source.units === "m" ? "m" : "ft";
  const factor = units === "ft" ? FEET_TO_METERS : 1;
  const defaultHeight = positive(source.ceilingHeight, units === "ft" ? DEFAULT_CEILING_HEIGHT_FT : DEFAULT_CEILING_HEIGHT_FT * FEET_TO_METERS);
  const defaultThickness = units === "ft" ? DEFAULT_WALL_THICKNESS_FT : DEFAULT_WALL_THICKNESS_FT * FEET_TO_METERS;
  const defaultFloorThickness = units === "ft" ? DEFAULT_FLOOR_THICKNESS_FT : DEFAULT_FLOOR_THICKNESS_FT * FEET_TO_METERS;
  const wallsSource = Array.isArray(source.walls) ? source.walls : [];

  const walls = wallsSource
    .slice(0, MAX_WALLS)
    .map((wall): NormalizedBlueprint3dAnalysis["walls"][number] | null => {
      if (!wall || typeof wall !== "object") return null;
      const item = wall as Record<string, unknown>;
      const x1 = finite(item.x1, Number.NaN);
      const y1 = finite(item.y1, Number.NaN);
      const x2 = finite(item.x2, Number.NaN);
      const y2 = finite(item.y2, Number.NaN);
      if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
      if (Math.hypot(x2 - x1, y2 - y1) < 0.02) return null;
      return {
        x1: x1 * factor,
        y1: y1 * factor,
        x2: x2 * factor,
        y2: y2 * factor,
        thickness: positive(item.thickness, defaultThickness) * factor,
        height: positive(item.height, defaultHeight) * factor,
        label: typeof item.label === "string" ? item.label.trim().slice(0, 120) || undefined : undefined,
      };
    })
    .filter((wall): wall is NonNullable<typeof wall> => Boolean(wall));

  const assumptions = Array.isArray(source.assumptions)
    ? source.assumptions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 300)).slice(0, 30)
    : [];
  const notes = Array.isArray(source.notes)
    ? source.notes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 300)).slice(0, 30)
    : [];

  if (!source.ceilingHeight) assumptions.push("Ceiling height was not explicit; B.O.S. used an 8 ft conceptual default.");

  return {
    units: "m",
    ceilingHeight: defaultHeight * factor,
    floorThickness: positive(source.floorThickness, defaultFloorThickness) * factor,
    walls,
    confidence: clampConfidence(source.confidence),
    assumptions: [...new Set(assumptions)],
    notes,
  };
}

export function isUsableBlueprint3dAnalysis(analysis: NormalizedBlueprint3dAnalysis) {
  return analysis.walls.length >= 2;
}

export function buildBlueprintGlb(analysis: NormalizedBlueprint3dAnalysis): Buffer {
  const { positions, normals, indices } = cubeGeometry();
  const positionBuffer = Buffer.from(new Float32Array(positions).buffer);
  const normalBuffer = Buffer.from(new Float32Array(normals).buffer);
  const indexBuffer = Buffer.from(new Uint16Array(indices).buffer);
  const binary = pad4(Buffer.concat([positionBuffer, normalBuffer, indexBuffer]));

  const xs = analysis.walls.flatMap((wall) => [wall.x1, wall.x2]);
  const zs = analysis.walls.flatMap((wall) => [wall.y1, wall.y2]);
  const minX = Math.min(...xs, -1);
  const maxX = Math.max(...xs, 1);
  const minZ = Math.min(...zs, -1);
  const maxZ = Math.max(...zs, 1);
  const floorPadding = 0.25;
  const floorWidth = Math.max(1, maxX - minX + floorPadding * 2);
  const floorDepth = Math.max(1, maxZ - minZ + floorPadding * 2);

  const nodes: Array<Record<string, unknown>> = [];
  nodes.push({
    name: "Generated Floor",
    mesh: 0,
    translation: [(minX + maxX) / 2, analysis.floorThickness / 2, (minZ + maxZ) / 2],
    scale: [floorWidth, analysis.floorThickness, floorDepth],
  });

  analysis.walls.forEach((wall, index) => {
    const dx = wall.x2 - wall.x1;
    const dz = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dz);
    const angle = -Math.atan2(dz, dx);
    nodes.push({
      name: wall.label || `Wall ${index + 1}`,
      mesh: 0,
      translation: [(wall.x1 + wall.x2) / 2, wall.height / 2, (wall.y1 + wall.y2) / 2],
      rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
      scale: [length, wall.height, wall.thickness],
    });
  });

  const json = {
    asset: { version: "2.0", generator: "B.O.S. Automatic Blueprint-to-3D" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes: [{
      name: "B.O.S. Generated Building Element",
      primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
    }],
    materials: [{
      name: "B.O.S. Conceptual Model",
      pbrMetallicRoughness: {
        baseColorFactor: [0.72, 0.82, 0.95, 1],
        metallicFactor: 0,
        roughnessFactor: 0.74,
      },
      doubleSided: true,
    }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: positionBuffer.length, byteLength: normalBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: positionBuffer.length + normalBuffer.length, byteLength: indexBuffer.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: indices.length, type: "SCALAR" },
    ],
  };

  const jsonBuffer = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.write("JSON", 4, "ascii");
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.write("BIN\0", 4, "ascii");
  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binary]);
}

function pad4(buffer: Buffer, byte = 0) {
  const remainder = buffer.length % 4;
  if (!remainder) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, byte)]);
}

function cubeGeometry() {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const faces: Array<{ normal: [number, number, number]; corners: Array<[number, number, number]> }> = [
    { normal: [1, 0, 0], corners: [[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5],[0.5,-0.5,0.5]] },
    { normal: [-1, 0, 0], corners: [[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5],[-0.5,-0.5,-0.5]] },
    { normal: [0, 1, 0], corners: [[-0.5,0.5,-0.5],[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5]] },
    { normal: [0, -1, 0], corners: [[-0.5,-0.5,0.5],[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5]] },
    { normal: [0, 0, 1], corners: [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]] },
    { normal: [0, 0, -1], corners: [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]] },
  ];
  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face.corners) {
      positions.push(...corner);
      normals.push(...face.normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}
