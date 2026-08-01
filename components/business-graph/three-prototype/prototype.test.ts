import {
  PROTOTYPE_GRAPH_MODEL,
  PROTOTYPE_OVERVIEW_CAMERA,
  getPrototypeCameraView,
  getPrototypeConnections,
  getPrototypeNode,
  getPrototypeStats,
} from "./prototype-helpers";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  await test("1. prototype graph has the expected proof-of-concept shape", () => {
    const stats = getPrototypeStats();
    assert(stats.totalNodes === 10, "prototype includes one center, three hubs, and six child nodes");
    assert(stats.hubs === 3, "prototype includes exactly three surrounding hubs");
    assert(stats.childNodes === 6, "prototype includes exactly six child nodes");
    assert(stats.directionalEdges >= 9, "prototype includes directional relationship paths");
  });

  await test("2. graph model preserves node and edge counts for 2D fallback", () => {
    assert(PROTOTYPE_GRAPH_MODEL.nodes.length === 10, "2D fallback graph contains all prototype nodes");
    assert(PROTOTYPE_GRAPH_MODEL.edges.length >= 9, "2D fallback graph contains the prototype relationships");
  });

  await test("3. connection lookup exposes linked hubs and child nodes", () => {
    const companyConnections = getPrototypeConnections("bos-platform");
    assert(companyConnections.length === 3, "company platform connects to the three domain hubs");

    const projectHubConnections = getPrototypeConnections("hub-projects");
    assert(projectHubConnections.some((connection) => connection.node.id === "projects-schedule-risk"), "project hub links to schedule risk child node");
    assert(projectHubConnections.some((connection) => connection.edge.dependency), "project hub exposes dependency-sensitive links");
  });

  await test("4. camera views support both overview and focused inspection", () => {
    const overview = getPrototypeCameraView(null, "overview");
    assert(overview.position.join(",") === PROTOTYPE_OVERVIEW_CAMERA.position.join(","), "overview view matches the shared default camera");

    const focus = getPrototypeCameraView("hub-financials", "focus");
    assert(focus.target[0] > 0, "financial focus target stays on the positive X side");
    assert(focus.position[2] > focus.target[2], "focused camera sits in front of the selected node");
  });

  await test("5. prototype nodes remain addressable for inspector state", () => {
    const peopleNode = getPrototypeNode("people-field-crews");
    assert(peopleNode?.label === "Field Crews", "people child nodes are available to the inspector");
  });

  console.log(`\nBusiness Graph 3D prototype tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();