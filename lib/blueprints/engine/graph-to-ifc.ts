import type { BosBuildingGraph, BosWall } from "./building-graph";

function q(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function guidSeed(id: string) {
  // Stable, deterministic 22-character placeholder identifier for exported coordination IFC.
  // It is intentionally generated from the B.O.S. object id rather than random state so exports remain diffable.
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return `BOS${hash.toString(36).padStart(8, "0")}${id.replace(/[^A-Za-z0-9]/g, "").slice(0, 11)}`.slice(0, 22);
}

function wallLength(wall: BosWall) {
  return Math.hypot(wall.centerline.end.x - wall.centerline.start.x, wall.centerline.end.y - wall.centerline.start.y);
}

export function buildBosBuildingGraphIfc(graph: BosBuildingGraph) {
  if (!graph.levels.length) throw new Error("B.O.S. Building Graph has no levels to export to IFC.");
  let n = 1;
  const lines: string[] = [];
  const add = (body: string) => { const id = n++; lines.push(`#${id}=${body};`); return id; };

  const ownerHistory = add("IFCOWNERHISTORY($,$,$,.ADDED.,$,$,$,0)");
  const origin = add("IFCCARTESIANPOINT((0.,0.,0.))");
  const zAxis = add("IFCDIRECTION((0.,0.,1.))");
  const xAxis = add("IFCDIRECTION((1.,0.,0.))");
  const worldPlacement = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zAxis},#${xAxis})`);
  const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${worldPlacement},$)`);
  const unitLength = add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)");
  const units = add(`IFCUNITASSIGNMENT((#${unitLength}))`);
  const project = add(`IFCPROJECT(${q(guidSeed(graph.building.id + "-project"))},#${ownerHistory},${q(graph.building.name || "B.O.S. Blueprint Reconstruction")},$,$,$,$,(#${context}),#${units})`);
  const sitePlacement = add(`IFCLOCALPLACEMENT($,#${worldPlacement})`);
  const site = add(`IFCSITE(${q(guidSeed(graph.building.id + "-site"))},#${ownerHistory},'Site',$,$,#${sitePlacement},$,$,.ELEMENT.,$,$,$,$,$)`);
  const buildingPlacement = add(`IFCLOCALPLACEMENT(#${sitePlacement},#${worldPlacement})`);
  const building = add(`IFCBUILDING(${q(guidSeed(graph.building.id))},#${ownerHistory},${q(graph.building.name || "Building")},$,$,#${buildingPlacement},$,$,.ELEMENT.,$,$,$)`);
  add(`IFCRELAGGREGATES(${q(guidSeed("project-site"))},#${ownerHistory},$,$,#${project},(#${site}))`);
  add(`IFCRELAGGREGATES(${q(guidSeed("site-building"))},#${ownerHistory},$,$,#${site},(#${building}))`);

  for (const level of graph.levels) {
    const p = add(`IFCCARTESIANPOINT((0.,0.,${Number(level.elevation).toFixed(6)}))`);
    const axis = add(`IFCAXIS2PLACEMENT3D(#${p},#${zAxis},#${xAxis})`);
    const placement = add(`IFCLOCALPLACEMENT(#${buildingPlacement},#${axis})`);
    const storey = add(`IFCBUILDINGSTOREY(${q(guidSeed(level.id))},#${ownerHistory},${q(level.name)},$,$,#${placement},$,$,.ELEMENT.,${Number(level.elevation).toFixed(6)})`);
    add(`IFCRELAGGREGATES(${q(guidSeed(`building-${level.id}`))},#${ownerHistory},$,$,#${building},(#${storey}))`);
    const wallIds: number[] = [];

    for (const wall of graph.walls.filter((item) => item.levelId === level.id)) {
      const dx = wall.centerline.end.x - wall.centerline.start.x;
      const dy = wall.centerline.end.y - wall.centerline.start.y;
      const length = wallLength(wall);
      if (length <= 0.001) continue;
      const dirX = dx / length;
      const dirY = dy / length;
      const location = add(`IFCCARTESIANPOINT((${wall.centerline.start.x.toFixed(6)},${wall.centerline.start.y.toFixed(6)},0.))`);
      const refDirection = add(`IFCDIRECTION((${dirX.toFixed(8)},${dirY.toFixed(8)},0.))`);
      const wallAxis = add(`IFCAXIS2PLACEMENT3D(#${location},#${zAxis},#${refDirection})`);
      const wallPlacement = add(`IFCLOCALPLACEMENT(#${placement},#${wallAxis})`);
      const profileOrigin = add("IFCCARTESIANPOINT((0.,0.))");
      const profileAxis = add(`IFCAXIS2PLACEMENT2D(#${profileOrigin},$)`);
      const profile = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profileAxis},${length.toFixed(6)},${wall.thickness.toFixed(6)})`);
      const solidOrigin = add(`IFCCARTESIANPOINT((${(length / 2).toFixed(6)},0.,0.))`);
      const solidAxis = add(`IFCAXIS2PLACEMENT3D(#${solidOrigin},#${zAxis},#${xAxis})`);
      const direction = add("IFCDIRECTION((0.,0.,1.))");
      const solid = add(`IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${direction},${wall.height.toFixed(6)})`);
      const body = add(`IFCSHAPEREPRESENTATION(#${context},'Body','SweptSolid',(#${solid}))`);
      const shape = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${body}))`);
      const wallEntity = add(`IFCWALLSTANDARDCASE(${q(guidSeed(wall.id))},#${ownerHistory},${q(`${wall.type} wall ${wall.id}`)},${q(`B.O.S. confidence ${wall.confidence.toFixed(3)}; source page ${wall.sourcePage}`)},$,#${wallPlacement},#${shape},$)`);
      wallIds.push(wallEntity);
    }
    if (wallIds.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${q(guidSeed(`contain-${level.id}`))},#${ownerHistory},$,$,(${wallIds.map((id) => `#${id}`).join(",")}),#${storey})`);
  }

  const header = [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    `FILE_NAME('bos-blueprint-${graph.building.id}.ifc','${new Date().toISOString()}',('B.O.S.'),('Bango Operating System'),'B.O.S. Native Blueprint Engine','B.O.S.','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
  ];
  return `${header.join("\n")}\n${lines.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
