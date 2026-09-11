import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph } from "./building-graph";
import { applyLearnedBlueprintAssist } from "./learned-assist";

async function main() {
  const previousUrl = process.env.BOS_BLUEPRINT_INFERENCE_URL;
  const previousToken = process.env.BOS_BLUEPRINT_INFERENCE_TOKEN;
  delete process.env.BOS_BLUEPRINT_INFERENCE_URL;
  delete process.env.BOS_BLUEPRINT_INFERENCE_TOKEN;

  try {
    const graph = createEmptyBosBuildingGraph({ buildingId: "building-1", sourcePage: 2 });
    graph.building.companyId = "company-1";
    graph.building.sourceVersionId = "version-1";
    graph.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.98 };

    const result = await applyLearnedBlueprintAssist({
      graph,
      pdfBuffer: Buffer.from("this is intentionally not a pdf"),
      companyId: "company-1",
      sourceVersionId: "version-1",
      sourcePage: 2,
      sourceWidthUnits: 1000,
      sourceHeightUnits: 500,
    });

    assert.equal(result.attempted, false);
    assert.equal(result.accepted, false);
    assert.equal(result.graph, graph);
    assert.deepEqual(result.diagnostics, []);
  } finally {
    if (previousUrl === undefined) delete process.env.BOS_BLUEPRINT_INFERENCE_URL;
    else process.env.BOS_BLUEPRINT_INFERENCE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.BOS_BLUEPRINT_INFERENCE_TOKEN;
    else process.env.BOS_BLUEPRINT_INFERENCE_TOKEN = previousToken;
  }

  console.log("learned assist contract passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
