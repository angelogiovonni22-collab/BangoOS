"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Focus, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadModelSchedule, type ModelScheduleLink } from "@/lib/blueprints/four-d";

type Props = { fileUrl: string; fileName: string; format: "ifc" | "gltf"; companyId:string;projectId:string;versionId:string;userId:string };
type Selected = {
  name: string;
  expressId?: number;
  properties: Record<string, unknown>;
};
const DISCIPLINES = [
  "Architectural",
  "Structural",
  "Mechanical",
  "Electrical",
  "Plumbing",
];

export function Blueprint3dViewer({ fileUrl, fileName, format,companyId,projectId,versionId }: Props) {
  const host = useRef<HTMLDivElement>(null),
    resetRef = useRef<() => void>(() => {});
  const pickablesRef = useRef<
    Array<{ visible: boolean; userData: Record<string, unknown> }>
  >([]);
  const [selected, setSelected] = useState<Selected | null>(null),
    [hidden, setHidden] = useState<Set<string>>(new Set()),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const [schedule,setSchedule]=useState<ModelScheduleLink[]>([]),[playbackDate,setPlaybackDate]=useState("");
  useEffect(()=>{const supabase=createClient();if(!supabase)return;let active=true;void loadModelSchedule(supabase,{companyId,projectId,versionId}).then((next)=>{if(active){setSchedule(next);const dates=next.flatMap(item=>[item.plannedStart,item.plannedFinish]).filter(Boolean) as string[];if(dates.length)setPlaybackDate(dates.sort()[0]);}}).catch((reason:unknown)=>{if(active)setError(reason instanceof Error?reason.message:"Could not load 4D schedule.");});return()=>{active=false;};},[companyId,projectId,versionId]);
  useEffect(()=>{if(!playbackDate)return;for(const object of pickablesRef.current){const key=String(object.userData.expressId??object.userData.elementKey??"");const link=schedule.find(item=>item.elementKey===key);object.visible=!hidden.has(String(object.userData.discipline))&&(!link||!link.plannedStart||link.plannedStart<=playbackDate);}},[hidden,playbackDate,schedule]);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    const node = host.current;
    void Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/loaders/GLTFLoader.js"),
    ])
      .then(async ([THREE, { OrbitControls }, { GLTFLoader }]) => {
        if (disposed) return;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0f172a");
        const camera = new THREE.PerspectiveCamera(
          55,
          node.clientWidth / Math.max(1, node.clientHeight),
          0.01,
          10000,
        );
        camera.position.set(8, 6, 8);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(node.clientWidth, node.clientHeight);
        node.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.5));
        const sun = new THREE.DirectionalLight(0xffffff, 3);
        sun.position.set(10, 20, 10);
        scene.add(sun);
        const pickables: InstanceType<typeof THREE.Object3D>[] = [];
        pickablesRef.current = pickables;
        let ifcApi: import("web-ifc").IfcAPI | null = null,
          ifcModelId: number | null = null;
        const frame = (object: InstanceType<typeof THREE.Object3D>) => {
          const box = new THREE.Box3().setFromObject(object),
            size = box.getSize(new THREE.Vector3()),
            center = box.getCenter(new THREE.Vector3());
          controls.target.copy(center);
          camera.position
            .copy(center)
            .add(
              new THREE.Vector3(
                size.length() * 0.7,
                size.length() * 0.55,
                size.length() * 0.7,
              ),
            );
          camera.near = Math.max(0.001, size.length() / 1000);
          camera.far = Math.max(100, size.length() * 20);
          camera.updateProjectionMatrix();
          controls.update();
        };
        if (format === "gltf") {
          const gltf = await new GLTFLoader().loadAsync(fileUrl);
          scene.add(gltf.scene);
          gltf.scene.traverse((object) => {
            if ((object as InstanceType<typeof THREE.Mesh>).isMesh) {
              object.userData.discipline = String(
                object.userData.discipline || "Architectural",
              );
              pickables.push(object);
            }
          });
          frame(gltf.scene);
        } else {
          const IFC = await import("web-ifc");
          ifcApi = new IFC.IfcAPI();
          ifcApi.SetWasmPath("/web-ifc/");
          await ifcApi.Init();
          const bytes = new Uint8Array(
            await (await fetch(fileUrl)).arrayBuffer(),
          );
          ifcModelId = ifcApi.OpenModel(bytes, { COORDINATE_TO_ORIGIN: true });
          const group = new THREE.Group();
          ifcApi.StreamAllMeshes(ifcModelId, (flat) => {
            for (const placed of flat.geometries) {
              const geometry = ifcApi!.GetGeometry(
                  ifcModelId!,
                  placed.geometryExpressID,
                ),
                vertices = ifcApi!.GetVertexArray(
                  geometry.GetVertexData(),
                  geometry.GetVertexDataSize(),
                ),
                indices = ifcApi!.GetIndexArray(
                  geometry.GetIndexData(),
                  geometry.GetIndexDataSize(),
                ),
                buffer = new THREE.BufferGeometry();
              const positions: number[] = [],
                normals: number[] = [];
              for (let i = 0; i < vertices.length; i += 6) {
                positions.push(vertices[i], vertices[i + 1], vertices[i + 2]);
                normals.push(vertices[i + 3], vertices[i + 4], vertices[i + 5]);
              }
              buffer.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(positions, 3),
              );
              buffer.setAttribute(
                "normal",
                new THREE.Float32BufferAttribute(normals, 3),
              );
              buffer.setIndex(Array.from(indices));
              const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(
                  placed.color.x,
                  placed.color.y,
                  placed.color.z,
                ),
                transparent: placed.color.w < 1,
                opacity: placed.color.w,
              });
              const mesh = new THREE.Mesh(buffer, material);
              mesh.applyMatrix4(
                new THREE.Matrix4().fromArray(placed.flatTransformation),
              );
              const line = ifcApi!.GetLine(
                ifcModelId!,
                flat.expressID,
                false,
              ) as Record<string, unknown>;
              mesh.userData = {
                expressId: flat.expressID,
                discipline: disciplineForIfc(
                  ifcApi!.GetNameFromTypeCode(Number(line.type)),
                ),
              };
              group.add(mesh);
              pickables.push(mesh);
            }
          });
          scene.add(group);
          frame(group);
        }
        resetRef.current = () => frame(scene);
        const raycaster = new THREE.Raycaster(),
          pointer = new THREE.Vector2();
        const click = (event: MouseEvent) => {
          const bounds = renderer.domElement.getBoundingClientRect();
          pointer.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
          );
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(pickables, false)[0]?.object;
          if (!hit) return;
          const expressId = hit.userData.expressId as number | undefined;
          const properties =
            expressId !== undefined && ifcApi && ifcModelId !== null
              ? (ifcApi.GetLine(ifcModelId, expressId, true) as Record<
                  string,
                  unknown
                >)
              : hit.userData;
          setSelected({
            name: String(
              properties.Name || hit.name || `Element ${expressId ?? ""}`,
            ),
            expressId,
            properties,
          });
        };
        renderer.domElement.addEventListener("click", click);
        const resize = new ResizeObserver(() => {
          camera.aspect = node.clientWidth / Math.max(1, node.clientHeight);
          camera.updateProjectionMatrix();
          renderer.setSize(node.clientWidth, node.clientHeight);
        });
        resize.observe(node);
        let frameId = 0;
        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(animate);
        };
        animate();
        setLoading(false);
        return () => {
          cancelAnimationFrame(frameId);
          resize.disconnect();
          renderer.domElement.removeEventListener("click", click);
          controls.dispose();
          renderer.dispose();
          if (ifcApi && ifcModelId !== null) ifcApi.CloseModel(ifcModelId);
          renderer.domElement.remove();
        };
      })
      .then((cleanup) => {
        if (cleanup && disposed) cleanup();
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load this model.",
        ),
      );
    return () => {
      disposed = true;
      node.replaceChildren();
    };
  }, [fileUrl, format]);
  return (
    <div
      className="flex h-full min-h-[32rem] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-white"
      data-orion-region="blueprint-3d-model-viewer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs">
          <strong>{fileName}</strong>
          <span className="rounded bg-cyan-950 px-2 py-1 text-cyan-200">
            {format.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => resetRef.current()}
            className="ml-auto inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1"
          >
            <RotateCcw size={13} />
            Reset view
          </button>
        </div>
        <div
          ref={host}
          className="h-[calc(100%-2.5rem)] min-h-[29rem] touch-none"
          aria-label={`Interactive 3D model ${fileName}`}
        >
          {loading ? <p className="p-6 text-sm">Loading model…</p> : null}
          {error ? (
            <p role="alert" className="p-6 text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <aside
        className="w-64 overflow-auto border-l border-white/10 bg-slate-900 p-3"
        data-orion-region="blueprint-model-properties"
      >
        <h3 className="flex items-center gap-2 text-xs font-bold">
          <Focus size={14} />
          Model properties
        </h3>
        {selected ? (
          <>
            <p className="mt-3 text-sm font-semibold">{selected.name}</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-300">
              {JSON.stringify(selected.properties, null, 2).slice(0, 8000)}
            </pre>
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Select an element to inspect its BIM properties.
          </p>
        )}
        <h3 className="mt-5 text-xs font-bold">Discipline visibility</h3>
        {DISCIPLINES.map((discipline) => (
          <button
            key={discipline}
            type="button"
            aria-pressed={!hidden.has(discipline)}
            onClick={() =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(discipline)) next.delete(discipline);
                else next.add(discipline);
                for (const object of pickablesRef.current) object.visible = !next.has(String(object.userData.discipline));
                return next;
              })
            }
            className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-white/10"
          >
            {hidden.has(discipline) ? <EyeOff size={12} /> : <Eye size={12} />}{" "}
            {discipline}
          </button>
        ))}
        <div className="mt-5 border-t border-white/10 pt-4" data-orion-region="blueprint-4d-playback"><h3 className="text-xs font-bold">4D construction playback</h3><input aria-label="4D playback date" type="date" value={playbackDate} onChange={(event)=>setPlaybackDate(event.target.value)} className="mt-2 w-full rounded border border-white/15 bg-slate-950 px-2 py-1 text-xs"/><p className="mt-2 text-[10px] text-slate-400">{schedule.length} scheduled model element{schedule.length===1?"":"s"}</p>{schedule.filter(item=>!item.plannedStart||item.plannedStart<=playbackDate).slice(0,8).map(item=><div key={item.id} className="mt-2 rounded bg-white/5 p-2 text-[10px]"><strong>{item.title}</strong><p className="text-slate-400">{item.plannedStart||"Unscheduled"} – {item.plannedFinish||"Open"} · {item.completion}%</p></div>)}</div>
      </aside>
    </div>
  );
}
function disciplineForIfc(type: string) {
  if (/BEAM|COLUMN|SLAB|MEMBER|FOOTING/.test(type)) return "Structural";
  if (/PIPE|SANITARY|FLOW/.test(type)) return "Plumbing";
  if (/DUCT|AIR|HVAC/.test(type)) return "Mechanical";
  if (/CABLE|ELECTRIC|LIGHT|OUTLET/.test(type)) return "Electrical";
  return "Architectural";
}
