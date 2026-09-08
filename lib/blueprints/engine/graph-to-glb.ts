import type { BosBuildingGraph, BosWall } from "./building-graph";

function pad4(buffer: Buffer, byte = 0) {
  const remainder = buffer.length % 4;
  return remainder ? Buffer.concat([buffer, Buffer.alloc(4 - remainder, byte)]) : buffer;
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
    for (const corner of face.corners) { positions.push(...corner); normals.push(...face.normal); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

function wallNode(wall: BosWall, levelElevation: number) {
  const dx = wall.centerline.end.x - wall.centerline.start.x;
  const dz = wall.centerline.end.y - wall.centerline.start.y;
  const length = Math.hypot(dx, dz);
  const angle = -Math.atan2(dz, dx);
  return {
    name: `${wall.type === "exterior" ? "Exterior" : wall.type === "interior" ? "Interior" : "Wall"} · ${wall.id}`,
    mesh: 0,
    translation: [(wall.centerline.start.x + wall.centerline.end.x) / 2, levelElevation + wall.height / 2, (wall.centerline.start.y + wall.centerline.end.y) / 2],
    rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
    scale: [length, wall.height, wall.thickness],
    extras: { bosObjectId: wall.id, bosType: "wall", wallType: wall.type, confidence: wall.confidence, sourcePage: wall.sourcePage },
  };
}

export function buildBosBuildingGraphGlb(graph: BosBuildingGraph): Buffer {
  if (!graph.walls.length) throw new Error("B.O.S. Building Graph has no walls to serialize.");
  const { positions, normals, indices } = cubeGeometry();
  const positionBuffer = Buffer.from(new Float32Array(positions).buffer);
  const normalBuffer = Buffer.from(new Float32Array(normals).buffer);
  const indexBuffer = Buffer.from(new Uint16Array(indices).buffer);
  const binary = pad4(Buffer.concat([positionBuffer, normalBuffer, indexBuffer]));
  const levelById = new Map(graph.levels.map((level) => [level.id, level]));
  const nodes: Array<Record<string, unknown>> = graph.walls.map((wall) => wallNode(wall, levelById.get(wall.levelId)?.elevation || 0));

  const json = {
    asset: { version: "2.0", generator: `B.O.S. Native Blueprint Engine ${graph.reconstructionVersion}` },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes: [{ name: "B.O.S. Building Graph Wall", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{
      name: "B.O.S. Reconstructed Architecture",
      pbrMetallicRoughness: { baseColorFactor: [0.72, 0.82, 0.95, 1], metallicFactor: 0, roughnessFactor: 0.74 },
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
    extras: {
      bosBuildingGraph: {
        schemaVersion: graph.schemaVersion,
        reconstructionVersion: graph.reconstructionVersion,
        buildingId: graph.building.id,
        confidence: graph.confidence,
        validationStatus: graph.validation.status,
        validationScore: graph.validation.score,
      },
    },
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
