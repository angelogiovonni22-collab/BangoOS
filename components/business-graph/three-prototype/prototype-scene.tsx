"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { PROTOTYPE_EDGES, PROTOTYPE_NODES, type PrototypeNode } from "./prototype-data";
import { getPrototypeCameraView } from "./prototype-helpers";

type PrototypeSceneProps = {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  cameraMode: "overview" | "focus";
  reducedMotion: boolean;
  onHoverNode: (nodeId: string | null) => void;
  onSelectNode: (nodeId: string) => void;
};

export function PrototypeScene({
  selectedNodeId,
  hoveredNodeId,
  cameraMode,
  reducedMotion,
  onHoverNode,
  onSelectNode,
}: PrototypeSceneProps) {
  const nodeMap = useMemo(() => new Map(PROTOTYPE_NODES.map((node) => [node.id, node])), []);
  const activeNodeId = hoveredNodeId || selectedNodeId;

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 14, 22], fov: 42, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: true }}
      className="h-full w-full"
    >
      <color attach="background" args={["#07111d"]} />
      <fog attach="fog" args={["#07111d", 24, 62]} />

      <ambientLight intensity={0.65} color="#9ec5ff" />
      <directionalLight
        castShadow
        position={[10, 18, 6]}
        intensity={1.7}
        color="#d7e7ff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
      />
      <spotLight position={[-12, 16, 10]} intensity={1.15} angle={0.34} penumbra={0.7} color="#5eead4" />
      <spotLight position={[14, 14, -8]} intensity={1.05} angle={0.38} penumbra={0.7} color="#fbbf24" />

      <group position={[0, -0.06, 0]}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[21, 80]} />
          <meshStandardMaterial color="#07111a" roughness={0.76} metalness={0.32} />
        </mesh>

        <Grid
          position={[0, 0.02, 0]}
          args={[40, 40]}
          cellColor="#143c5a"
          sectionColor="#1d5d83"
          cellThickness={0.65}
          sectionThickness={1.2}
          fadeDistance={56}
          fadeStrength={1.5}
          infiniteGrid={false}
        />

        <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
          <ringGeometry args={[8.6, 9.2, 72]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.16} />
        </mesh>
      </group>

      {PROTOTYPE_EDGES.map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);

        if (!from || !to) {
          return null;
        }

        const active = activeNodeId ? edge.from === activeNodeId || edge.to === activeNodeId : false;
        const related = activeNodeId ? active : true;

        return (
          <PrototypeConnectionMesh
            key={edge.id}
            edge={edge}
            from={from}
            to={to}
            active={active}
            related={related}
          />
        );
      })}

      {PROTOTYPE_NODES.map((node) => {
        const active = activeNodeId === node.id;
        const connected = activeNodeId
          ? PROTOTYPE_EDGES.some((edge) => (edge.from === activeNodeId && edge.to === node.id) || (edge.to === activeNodeId && edge.from === node.id))
          : false;

        return (
          <PrototypeNodeMesh
            key={node.id}
            node={node}
            active={active}
            related={activeNodeId ? active || connected : true}
            reducedMotion={reducedMotion}
            onHoverNode={onHoverNode}
            onSelectNode={onSelectNode}
          />
        );
      })}

      <ContactShadows position={[0, -0.02, 0]} opacity={0.5} scale={34} blur={1.8} far={22} color="#02060c" />
      <CameraRig selectedNodeId={selectedNodeId} cameraMode={cameraMode} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function CameraRig({
  selectedNodeId,
  cameraMode,
  reducedMotion,
}: {
  selectedNodeId: string | null;
  cameraMode: "overview" | "focus";
  reducedMotion: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const desiredView = useMemo(
    () => getPrototypeCameraView(selectedNodeId, cameraMode),
    [cameraMode, selectedNodeId],
  );
  const desiredPosition = useMemo(
    () => new THREE.Vector3(...desiredView.position),
    [desiredView.position],
  );
  const desiredTarget = useMemo(
    () => new THREE.Vector3(...desiredView.target),
    [desiredView.target],
  );

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !controlsRef.current) {
      return;
    }

    if (reducedMotion) {
      camera.position.copy(desiredPosition);
      controlsRef.current.target.copy(desiredTarget);
      controlsRef.current.update();
    }
  }, [camera, desiredPosition, desiredTarget, reducedMotion]);

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !controlsRef.current || reducedMotion) {
      return;
    }

    camera.position.lerp(desiredPosition, 0.08);
    controlsRef.current.target.lerp(desiredTarget, 0.1);
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableRotate
      enableZoom
      maxDistance={34}
      minDistance={8}
      maxPolarAngle={Math.PI / 2.08}
      minPolarAngle={Math.PI / 5.2}
      dampingFactor={0.08}
      enableDamping={!reducedMotion}
    />
  );
}

function PrototypeNodeMesh({
  node,
  active,
  related,
  reducedMotion,
  onHoverNode,
  onSelectNode,
}: {
  node: PrototypeNode;
  active: boolean;
  related: boolean;
  reducedMotion: boolean;
  onHoverNode: (nodeId: string | null) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const nodeGroupRef = useRef<THREE.Group | null>(null);
  const glowColor = useMemo(() => new THREE.Color(node.glow), [node.glow]);
  const surfaceColor = useMemo(() => new THREE.Color(node.surface), [node.surface]);

  useFrame((state) => {
    if (!nodeGroupRef.current || reducedMotion) {
      return;
    }

    const pulse = active ? 1.02 : 1;
    const wave = node.tier === "child" ? 0.02 : 0.03;
    nodeGroupRef.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 0.8 + node.position[0]) * wave;
    nodeGroupRef.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.12);
  });

  const opacity = active ? 1 : related ? 0.96 : 0.52;
  const labelWidth = node.tier === "center" ? 220 : 178;
  const labelOffsetY = node.tier === "center" ? 1.45 : node.tier === "hub" ? 1.1 : 0.82;

  return (
    <group
      ref={nodeGroupRef}
      position={[node.position[0], node.position[1], node.position[2]]}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverNode(node.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverNode(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectNode(node.id);
      }}
    >
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[node.size[0] * 0.64, node.size[0] * 0.78, 0.18, 48]} />
        <meshStandardMaterial color="#020712" roughness={0.92} metalness={0.08} opacity={opacity} transparent />
      </mesh>

      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[node.size[0], node.size[2], node.size[1], 56]} />
        <meshStandardMaterial
          color={surfaceColor}
          emissive={glowColor}
          emissiveIntensity={active ? 0.7 : node.tier === "center" ? 0.34 : 0.25}
          roughness={0.38}
          metalness={0.58}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh position={[0, node.size[1] / 2 + 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[node.size[0] * 0.58, node.size[0] * 0.84, 60]} />
        <meshBasicMaterial color={node.glow} transparent opacity={active ? 0.72 : related ? 0.28 : 0.12} />
      </mesh>

      <Html position={[0, labelOffsetY, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
        <div
          className="pointer-events-none rounded-2xl border border-white/10 bg-slate-950/86 px-3 py-2 shadow-[0_18px_46px_-24px_rgba(0,0,0,0.8)] backdrop-blur-md"
          style={{ width: labelWidth, opacity }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{node.tier}</p>
          <p className="mt-1 text-sm font-semibold text-white">{node.label}</p>
          <p className="mt-0.5 text-[11px] text-slate-300">{node.subtitle}</p>
        </div>
      </Html>
    </group>
  );
}

function PrototypeConnectionMesh({
  edge,
  from,
  to,
  active,
  related,
}: {
  edge: (typeof PROTOTYPE_EDGES)[number];
  from: PrototypeNode;
  to: PrototypeNode;
  active: boolean;
  related: boolean;
}) {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(from.position[0], from.position[1] + from.size[1] * 0.55, from.position[2]);
    const end = new THREE.Vector3(to.position[0], to.position[1] + to.size[1] * 0.55, to.position[2]);
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.y += edge.dependency ? 2.2 : 1.4;

    return new THREE.QuadraticBezierCurve3(start, midpoint, end);
  }, [edge.dependency, from.position, from.size, to.position, to.size]);

  const points = useMemo(() => curve.getPoints(40), [curve]);
  const endPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const direction = useMemo(() => endPoint.clone().sub(previousPoint).normalize(), [endPoint, previousPoint]);
  const arrowQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
    [direction],
  );

  const baseColor = active
    ? edge.family === "financials"
      ? "#fbbf24"
      : edge.family === "people"
        ? "#34d399"
        : "#60a5fa"
    : edge.family === "financials"
      ? "#d97706"
      : edge.family === "people"
        ? "#0f766e"
        : "#2563eb";

  const opacity = active ? 1 : related ? 0.72 : 0.18;
  const positions = useMemo(
    () => new Float32Array(points.flatMap((point) => [point.x, point.y, point.z])),
    [points],
  );

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={baseColor} transparent opacity={opacity * 0.28} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={baseColor} transparent opacity={opacity} />
      </line>

      <mesh position={[endPoint.x, endPoint.y, endPoint.z]} quaternion={arrowQuaternion}>
        <coneGeometry args={[0.18, 0.52, 12]} />
        <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={active ? 0.8 : 0.2} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}