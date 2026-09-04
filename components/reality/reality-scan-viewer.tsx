"use client";

import { useEffect, useRef, useState } from "react";

export function RealityScanViewer({ fileUrl, label }: { fileUrl: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/loaders/USDZLoader.js"),
    ])
      .then(async ([THREE, { OrbitControls }, { USDZLoader }]) => {
        if (disposed) return;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0b1220");
        const camera = new THREE.PerspectiveCamera(55, node.clientWidth / Math.max(node.clientHeight, 1), 0.01, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(node.clientWidth, node.clientHeight);
        node.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.4));
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(6, 10, 8);
        scene.add(key);

        const object = await new USDZLoader().loadAsync(fileUrl);
        if (disposed) {
          renderer.dispose();
          return;
        }
        scene.add(object);
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = Math.max(size.length(), 1);
        controls.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(radius * 0.65, radius * 0.45, radius * 0.65));
        camera.near = Math.max(radius / 1000, 0.001);
        camera.far = Math.max(radius * 20, 100);
        camera.updateProjectionMatrix();
        controls.update();

        const resize = new ResizeObserver(() => {
          camera.aspect = node.clientWidth / Math.max(node.clientHeight, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(node.clientWidth, node.clientHeight);
        });
        resize.observe(node);

        let frameId = 0;
        const draw = () => {
          controls.update();
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(draw);
        };
        draw();
        setLoading(false);

        cleanup = () => {
          cancelAnimationFrame(frameId);
          resize.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Could not load this Reality Engine model.");
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      cleanup?.();
      node.replaceChildren();
    };
  }, [fileUrl]);

  return (
    <div className="relative min-h-80 overflow-hidden rounded-xl border border-slate-700 bg-slate-950" data-orion-region="reality-engine-3d-viewer">
      <div ref={host} className="h-80 w-full" aria-label={`Interactive Reality Engine scan ${label}`} />
      {loading ? <p className="absolute inset-0 grid place-items-center text-sm text-slate-300">Loading 3D scan…</p> : null}
      {error ? <p role="alert" className="absolute inset-x-4 bottom-4 rounded-lg bg-red-950/90 p-3 text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
