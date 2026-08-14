"use client";

import { useEffect, useMemo, useRef } from "react";
import type { OrionCoreScenario } from "@/lib/labs/orion-core";

type OrionParticleSphereProps = {
  scenario: OrionCoreScenario;
  reducedMotion: boolean;
  paused: boolean;
};

type LayerId = "inner" | "middle" | "ambient";

type Particle = {
  x: number;
  y: number;
  z: number;
  size: number;
  twinkle: number;
  hue: number;
  layer: LayerId;
  orbitalScale: number;
  clusterBias: number;
  coolBias: number;
  coreInfluence: number;
  sparkleSeed: boolean;
  microLife: boolean;
  driftPhase: number;
  driftRate: number;
  driftRadius: number;
  axisTiltX: number;
  axisTiltY: number;
  axisTiltZ: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
  size: number;
  layer: LayerId;
};

type SphereVisualConfig = {
  rotationSpeed: number;
  pulseSpeed: number;
  pulseAmplitude: number;
  lineAlpha: number;
  maxConnectionDistance: number;
  particleAlphaBoost: number;
  glowAlpha: number;
  coreBoost: number;
  warmInfluence: number;
  static: boolean;
  innerSpeedMul: number;
  middleSpeedMul: number;
  ambientSpeedMul: number;
  innerSpacingBreath: number;
  middleSpacingBreath: number;
  ambientSpacingBreath: number;
  eventIntervalMs: number;
  eventTravelMs: number;
  relationshipTightness: number;
  ambientDrift: number;
};

type SpherePalette = {
  glowInner: string;
  glowMid: string;
  lineColor: string;
  shadowColor: string;
  particleBlue: string;
  particleCyan: string;
  particleViolet: string;
  particleMagenta: string;
  coreCenter: string;
  coreMid: string;
  coreOuter: string;
  rimMid: string;
  rimOuter: string;
  accentWarm: string;
};

const DESKTOP_PARTICLE_COUNT = 820;
const MOBILE_PARTICLE_COUNT = 620;
const DESKTOP_CONNECTION_COUNT = 360;
const MOBILE_CONNECTION_COUNT = 250;

function rotateVector(x: number, y: number, z: number, ax: number, ay: number, az: number) {
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const y1 = (y * cosX) - (z * sinX);
  const z1 = (y * sinX) + (z * cosX);

  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  const x2 = (x * cosY) + (z1 * sinY);
  const z2 = (-x * sinY) + (z1 * cosY);

  const cosZ = Math.cos(az);
  const sinZ = Math.sin(az);
  const x3 = (x2 * cosZ) - (y1 * sinZ);
  const y3 = (x2 * sinZ) + (y1 * cosZ);

  return { x: x3, y: y3, z: z2 };
}

function randomPointOnSphere(index: number, total: number): Particle {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos((2 * v) - 1);

  const phaseA = Math.sin((theta * 3.2) + (phi * 2.5) + (index * 0.17));
  const phaseB = Math.cos((theta * 2.35) - (phi * 1.9) + (index * 0.11));
  const phaseC = Math.sin((theta * 5.1) + (index * 0.07));
  const densityBias = (phaseA * 0.5) + (phaseB * 0.33) + (phaseC * 0.17);
  const clusterBias = (densityBias * 0.58) + ((Math.random() - 0.5) * 0.34);

  const ratio = index / Math.max(1, total - 1);
  let layer: LayerId = "middle";
  if (ratio < 0.24) {
    layer = "inner";
  } else if (ratio > 0.86) {
    layer = "ambient";
  }

  let orbitalScale = 0.9;
  if (layer === "inner") {
    orbitalScale = 0.24 + (Math.random() * 0.3) + (clusterBias * 0.04);
  } else if (layer === "middle") {
    orbitalScale = 0.56 + (Math.random() * 0.38) + (clusterBias * 0.06);
  } else {
    orbitalScale = 0.98 + (Math.random() * 0.18) + (clusterBias * 0.03);
  }

  const coreInfluence = Math.max(0, Math.min(1, (phaseA + 1) * 0.5)) * (0.5 + (Math.random() * 0.5));

  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
    size: 0.35 + (Math.random() * 1.55),
    twinkle: Math.random() * Math.PI * 2,
    hue: Math.random(),
    layer,
    orbitalScale: Math.max(0.2, Math.min(1.24, orbitalScale)),
    clusterBias: Math.max(-1, Math.min(1, clusterBias)),
    coolBias: Math.max(0, Math.min(1, (1 - ((Math.sin(phi) + 1) * 0.5)) + (Math.random() * 0.24))),
    coreInfluence,
    sparkleSeed: ((index * 37) % 113) < 2,
    microLife: ((index * 19) % 97) < 9,
    driftPhase: Math.random() * Math.PI * 2,
    driftRate: 0.24 + (Math.random() * 0.22),
    driftRadius: 0.08 + (Math.random() * 0.2),
    axisTiltX: ((Math.random() - 0.5) * 0.32),
    axisTiltY: ((Math.random() - 0.5) * 0.32),
    axisTiltZ: ((Math.random() - 0.5) * 0.22),
  };
}

function buildEdges(indices: number[], count: number): Array<[number, number]> {
  if (indices.length < 2 || count <= 0) {
    return [];
  }

  const edges: Array<[number, number]> = [];
  for (let index = 0; index < count; index += 1) {
    const left = indices[Math.floor(Math.random() * indices.length)];
    let right = indices[Math.floor(Math.random() * indices.length)];

    if (left === right) {
      right = indices[(indices.indexOf(left) + 1) % indices.length];
    }

    if (left !== right) {
      edges.push([left, right]);
    }
  }

  return edges;
}

function buildStateConfig(scenarioId: OrionCoreScenario["id"]): SphereVisualConfig {
  if (scenarioId === "ANALYZING") {
    return {
      rotationSpeed: 0.2,
      pulseSpeed: 1.18,
      pulseAmplitude: 0.013,
      lineAlpha: 0.16,
      maxConnectionDistance: 0.62,
      particleAlphaBoost: 0.08,
      glowAlpha: 1,
      coreBoost: 1,
      warmInfluence: 0,
      static: false,
      innerSpeedMul: 1.48,
      middleSpeedMul: 1,
      ambientSpeedMul: 0.58,
      innerSpacingBreath: 0.026,
      middleSpacingBreath: 0.02,
      ambientSpacingBreath: 0.014,
      eventIntervalMs: 5400,
      eventTravelMs: 1150,
      relationshipTightness: 0.98,
      ambientDrift: 1,
    };
  }

  if (scenarioId === "NEW_INSIGHT") {
    return {
      rotationSpeed: 0.19,
      pulseSpeed: 1.1,
      pulseAmplitude: 0.012,
      lineAlpha: 0.17,
      maxConnectionDistance: 0.64,
      particleAlphaBoost: 0.14,
      glowAlpha: 1.1,
      coreBoost: 1.2,
      warmInfluence: 0,
      static: false,
      innerSpeedMul: 1.42,
      middleSpeedMul: 1.02,
      ambientSpeedMul: 0.62,
      innerSpacingBreath: 0.028,
      middleSpacingBreath: 0.022,
      ambientSpacingBreath: 0.015,
      eventIntervalMs: 4800,
      eventTravelMs: 980,
      relationshipTightness: 1.01,
      ambientDrift: 1.05,
    };
  }

  if (scenarioId === "ATTENTION") {
    return {
      rotationSpeed: 0.14,
      pulseSpeed: 0.82,
      pulseAmplitude: 0.002,
      lineAlpha: 0.125,
      maxConnectionDistance: 0.58,
      particleAlphaBoost: 0.02,
      glowAlpha: 0.96,
      coreBoost: 0.95,
      warmInfluence: 0.22,
      static: false,
      innerSpeedMul: 1.22,
      middleSpeedMul: 0.92,
      ambientSpeedMul: 0.55,
      innerSpacingBreath: 0.016,
      middleSpacingBreath: 0.01,
      ambientSpacingBreath: 0.008,
      eventIntervalMs: 7600,
      eventTravelMs: 1250,
      relationshipTightness: 0.94,
      ambientDrift: 0.8,
    };
  }

  if (scenarioId === "CRITICAL") {
    return {
      rotationSpeed: 0.125,
      pulseSpeed: 0.76,
      pulseAmplitude: 0.0016,
      lineAlpha: 0.12,
      maxConnectionDistance: 0.56,
      particleAlphaBoost: 0.04,
      glowAlpha: 0.98,
      coreBoost: 1,
      warmInfluence: 0.3,
      static: false,
      innerSpeedMul: 1.18,
      middleSpeedMul: 0.86,
      ambientSpeedMul: 0.48,
      innerSpacingBreath: 0.012,
      middleSpacingBreath: 0.008,
      ambientSpacingBreath: 0.006,
      eventIntervalMs: 9800,
      eventTravelMs: 1180,
      relationshipTightness: 0.9,
      ambientDrift: 0.66,
    };
  }

  if (scenarioId === "STALE_DATA") {
    return {
      rotationSpeed: 0.08,
      pulseSpeed: 0.95,
      pulseAmplitude: 0.006,
      lineAlpha: 0.07,
      maxConnectionDistance: 0.5,
      particleAlphaBoost: -0.04,
      glowAlpha: 0.8,
      coreBoost: 0.78,
      warmInfluence: 0,
      static: false,
      innerSpeedMul: 1.05,
      middleSpeedMul: 0.78,
      ambientSpeedMul: 0.42,
      innerSpacingBreath: 0.01,
      middleSpacingBreath: 0.008,
      ambientSpacingBreath: 0.006,
      eventIntervalMs: 12000,
      eventTravelMs: 1350,
      relationshipTightness: 0.8,
      ambientDrift: 0.58,
    };
  }

  if (scenarioId === "UNAVAILABLE") {
    return {
      rotationSpeed: 0,
      pulseSpeed: 0,
      pulseAmplitude: 0,
      lineAlpha: 0.05,
      maxConnectionDistance: 0.46,
      particleAlphaBoost: -0.12,
      glowAlpha: 0.6,
      coreBoost: 0.6,
      warmInfluence: 0,
      static: true,
      innerSpeedMul: 0,
      middleSpeedMul: 0,
      ambientSpeedMul: 0,
      innerSpacingBreath: 0,
      middleSpacingBreath: 0,
      ambientSpacingBreath: 0,
      eventIntervalMs: 999999,
      eventTravelMs: 1400,
      relationshipTightness: 0.76,
      ambientDrift: 0,
    };
  }

  if (scenarioId === "REDUCED_MOTION") {
    return {
      rotationSpeed: 0,
      pulseSpeed: 0,
      pulseAmplitude: 0,
      lineAlpha: 0.09,
      maxConnectionDistance: 0.54,
      particleAlphaBoost: -0.03,
      glowAlpha: 0.82,
      coreBoost: 0.82,
      warmInfluence: 0,
      static: true,
      innerSpeedMul: 0,
      middleSpeedMul: 0,
      ambientSpeedMul: 0,
      innerSpacingBreath: 0,
      middleSpacingBreath: 0,
      ambientSpacingBreath: 0,
      eventIntervalMs: 999999,
      eventTravelMs: 1300,
      relationshipTightness: 0.88,
      ambientDrift: 0,
    };
  }

  return {
    rotationSpeed: 0.14,
    pulseSpeed: 1.02,
    pulseAmplitude: 0.012,
    lineAlpha: 0.13,
    maxConnectionDistance: 0.58,
    particleAlphaBoost: 0,
    glowAlpha: 1,
    coreBoost: 1,
    warmInfluence: 0,
    static: false,
    innerSpeedMul: 1.34,
    middleSpeedMul: 1,
    ambientSpeedMul: 0.56,
    innerSpacingBreath: 0.024,
    middleSpacingBreath: 0.018,
    ambientSpacingBreath: 0.012,
    eventIntervalMs: 6900,
    eventTravelMs: 1200,
    relationshipTightness: 1,
    ambientDrift: 0.92,
  };
}

function buildStatePalette(scenarioId: OrionCoreScenario["id"]): SpherePalette {
  if (scenarioId === "ANALYZING") {
    return {
      glowInner: "118, 95, 184",
      glowMid: "96, 70, 170",
      lineColor: "121, 102, 188",
      shadowColor: "#584392",
      particleBlue: "94, 128, 192",
      particleCyan: "108, 142, 194",
      particleViolet: "146, 112, 206",
      particleMagenta: "176, 126, 214",
      coreCenter: "248, 244, 255",
      coreMid: "182, 148, 229",
      coreOuter: "107, 76, 176",
      rimMid: "134, 109, 206",
      rimOuter: "112, 88, 184",
      accentWarm: "223, 175, 96",
    };
  }

  if (scenarioId === "NEW_INSIGHT") {
    return {
      glowInner: "95, 192, 134",
      glowMid: "73, 156, 106",
      lineColor: "86, 162, 117",
      shadowColor: "#3c7b56",
      particleBlue: "96, 174, 132",
      particleCyan: "122, 211, 161",
      particleViolet: "101, 182, 138",
      particleMagenta: "129, 198, 154",
      coreCenter: "255, 255, 255",
      coreMid: "204, 243, 220",
      coreOuter: "86, 164, 120",
      rimMid: "112, 198, 148",
      rimOuter: "88, 167, 126",
      accentWarm: "231, 182, 98",
    };
  }

  if (scenarioId === "ATTENTION") {
    return {
      glowInner: "203, 156, 82",
      glowMid: "171, 133, 79",
      lineColor: "177, 144, 92",
      shadowColor: "#8f6f43",
      particleBlue: "154, 143, 111",
      particleCyan: "189, 165, 103",
      particleViolet: "171, 135, 95",
      particleMagenta: "195, 150, 102",
      coreCenter: "255, 247, 232",
      coreMid: "230, 186, 117",
      coreOuter: "168, 132, 84",
      rimMid: "194, 161, 103",
      rimOuter: "170, 133, 86",
      accentWarm: "224, 173, 88",
    };
  }

  if (scenarioId === "CRITICAL") {
    return {
      glowInner: "165, 66, 78",
      glowMid: "128, 46, 60",
      lineColor: "145, 64, 78",
      shadowColor: "#76353b",
      particleBlue: "123, 74, 93",
      particleCyan: "146, 75, 86",
      particleViolet: "136, 61, 92",
      particleMagenta: "170, 79, 102",
      coreCenter: "255, 236, 236",
      coreMid: "188, 92, 104",
      coreOuter: "118, 46, 60",
      rimMid: "162, 70, 84",
      rimOuter: "137, 58, 72",
      accentWarm: "186, 79, 74",
    };
  }

  if (scenarioId === "STALE_DATA") {
    return {
      glowInner: "162, 170, 182",
      glowMid: "138, 147, 160",
      lineColor: "154, 162, 176",
      shadowColor: "#6b7483",
      particleBlue: "172, 180, 194",
      particleCyan: "188, 196, 206",
      particleViolet: "165, 173, 186",
      particleMagenta: "196, 204, 214",
      coreCenter: "245, 248, 252",
      coreMid: "200, 208, 220",
      coreOuter: "145, 154, 168",
      rimMid: "185, 194, 206",
      rimOuter: "164, 173, 188",
      accentWarm: "162, 147, 122",
    };
  }

  if (scenarioId === "UNAVAILABLE") {
    return {
      glowInner: "64, 69, 77",
      glowMid: "54, 58, 66",
      lineColor: "74, 80, 88",
      shadowColor: "#3d4148",
      particleBlue: "90, 96, 106",
      particleCyan: "97, 103, 112",
      particleViolet: "88, 93, 101",
      particleMagenta: "101, 106, 114",
      coreCenter: "203, 209, 216",
      coreMid: "117, 123, 132",
      coreOuter: "72, 77, 86",
      rimMid: "86, 92, 101",
      rimOuter: "74, 79, 87",
      accentWarm: "122, 108, 95",
    };
  }

  if (scenarioId === "REDUCED_MOTION") {
    return {
      glowInner: "106, 146, 185",
      glowMid: "84, 116, 154",
      lineColor: "112, 142, 179",
      shadowColor: "#486485",
      particleBlue: "116, 153, 194",
      particleCyan: "142, 183, 214",
      particleViolet: "132, 152, 188",
      particleMagenta: "154, 172, 203",
      coreCenter: "238, 246, 252",
      coreMid: "178, 205, 224",
      coreOuter: "112, 142, 178",
      rimMid: "147, 177, 207",
      rimOuter: "124, 153, 186",
      accentWarm: "196, 176, 146",
    };
  }

  return {
    glowInner: "86, 182, 224",
    glowMid: "66, 119, 208",
    lineColor: "76, 151, 214",
    shadowColor: "#33689f",
    particleBlue: "79, 152, 216",
    particleCyan: "110, 198, 232",
    particleViolet: "104, 138, 199",
    particleMagenta: "133, 163, 210",
    coreCenter: "246, 252, 255",
    coreMid: "171, 223, 243",
    coreOuter: "84, 138, 207",
    rimMid: "104, 184, 226",
    rimOuter: "84, 149, 204",
    accentWarm: "222, 173, 94",
  };
}

export function OrionParticleSphere({ scenario, reducedMotion, paused }: OrionParticleSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const loopTokenRef = useRef(0);
  const hiddenRef = useRef(false);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const criticalPulseStartRef = useRef<number | null>(null);

  const stateConfig = useMemo(() => buildStateConfig(scenario.id), [scenario.id]);
  const statePalette = useMemo(() => buildStatePalette(scenario.id), [scenario.id]);

  useEffect(() => {
    if (scenario.id !== "CRITICAL") {
      criticalPulseStartRef.current = null;
    }
  }, [scenario.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    loopTokenRef.current += 1;
    const loopToken = loopTokenRef.current;

    const particleCount = window.innerWidth < 900 ? MOBILE_PARTICLE_COUNT : DESKTOP_PARTICLE_COUNT;
    const connectionCount = window.innerWidth < 900 ? MOBILE_CONNECTION_COUNT : DESKTOP_CONNECTION_COUNT;

    const particles: Particle[] = Array.from({ length: particleCount }, (_, index) => randomPointOnSphere(index, particleCount));

    const innerIndices: number[] = [];
    const middleIndices: number[] = [];
    const ambientIndices: number[] = [];
    particles.forEach((particle, index) => {
      if (particle.layer === "inner") {
        innerIndices.push(index);
      } else if (particle.layer === "middle") {
        middleIndices.push(index);
      } else {
        ambientIndices.push(index);
      }
    });

    const middleConnections = Math.floor(connectionCount * 0.84);
    const innerConnections = Math.floor(connectionCount * 0.16);
    const middleEdges = buildEdges(middleIndices, middleConnections);
    const innerEdges = buildEdges(innerIndices, innerConnections);

    const eventPaths = middleEdges.slice(0, Math.max(12, Math.floor(middleEdges.length * 0.38)));
    let nextEventAt = stateConfig.eventIntervalMs * 0.6;
    let activeEvent: { edge: [number, number]; startedAt: number } | null = null;
    let eventCursor = 0;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let centerX = 0;
    let centerY = 0;
    let radius = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      width = rect.width;
      height = rect.height;
      centerX = width / 2;
      centerY = (height / 2) - 6;
      radius = Math.min(width, height) * 0.34;
    };

    const projectPoint = (
      particle: Particle,
      layerAngles: { inner: number; middle: number; ambient: number },
      breathWave: number,
      shouldAnimate: boolean,
      time: number,
    ): ProjectedPoint => {
      const baseAngle = particle.layer === "inner"
        ? layerAngles.inner
        : particle.layer === "middle"
          ? layerAngles.middle
          : layerAngles.ambient;

      const layerSpin = particle.layer === "inner"
        ? 0.28
        : particle.layer === "middle"
          ? 0.14
          : 0.08;

      const microWave = shouldAnimate && particle.microLife
        ? Math.sin((time * particle.driftRate) + particle.driftPhase)
        : 0;

      const axisX = (baseAngle * 0.7) + particle.axisTiltX + (microWave * 0.02);
      const axisY = baseAngle + particle.axisTiltY;
      const axisZ = (baseAngle * layerSpin) + particle.axisTiltZ;
      const rotated = rotateVector(particle.x, particle.y, particle.z, axisX, axisY, axisZ);

      const breathOffset = particle.layer === "inner"
        ? stateConfig.innerSpacingBreath
        : particle.layer === "middle"
          ? stateConfig.middleSpacingBreath
          : stateConfig.ambientSpacingBreath;

      const radiusScale = particle.orbitalScale + (breathWave * breathOffset);
      const perspective = 1 / (1.55 - (rotated.z * 0.34));

      return {
        x: centerX + (rotated.x * radius * radiusScale * perspective),
        y: centerY + (rotated.y * radius * radiusScale * perspective),
        z: rotated.z,
        size: particle.size * radiusScale * perspective,
        layer: particle.layer,
      };
    };

    const drawEdges = (
      edges: Array<[number, number]>,
      projected: ProjectedPoint[],
      baseAlpha: number,
      maxDistanceScale: number,
      thickness: number,
    ) => {
      ctx.lineWidth = thickness;

      for (const [leftIndex, rightIndex] of edges) {
        const left = projected[leftIndex];
        const right = projected[rightIndex];
        const leftSource = particles[leftIndex];
        const rightSource = particles[rightIndex];

        if (left.z < -0.6 && right.z < -0.6) {
          continue;
        }

        const distance = Math.hypot(left.x - right.x, left.y - right.y);
        if (distance > radius * maxDistanceScale * stateConfig.relationshipTightness) {
          continue;
        }

        const midpointDistance = Math.hypot(((left.x + right.x) / 2) - centerX, ((left.y + right.y) / 2) - centerY);
        const centerDamping = midpointDistance < (radius * 0.2) ? 0.4 : 1;
        const avgDepth = ((left.z + right.z) * 0.5 + 1) * 0.5;
        const depthVisibility = 0.22 + (avgDepth * 0.78);
        const coolDamping = 1 - Math.min(0.32, ((leftSource.coolBias + rightSource.coolBias) * 0.5) * 0.24);

        const alpha = Math.max(
          0.004,
          (baseAlpha - (distance / (radius * 5.6))) * centerDamping * depthVisibility * coolDamping,
        );

        ctx.strokeStyle = `rgba(${statePalette.lineColor}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      }
    };

    const drawFrame = (timestamp: number) => {
      if (loopToken !== loopTokenRef.current) {
        return;
      }

      const reducedMode = reducedMotion || stateConfig.static || scenario.id === "REDUCED_MOTION";
      const shouldAnimate = !reducedMode && !paused && !hiddenRef.current;

      const time = timestamp / 1000;
      const breathWave = Math.sin(time * stateConfig.pulseSpeed);
      const pulse = shouldAnimate
        ? 0.99 + (breathWave * stateConfig.pulseAmplitude)
        : 0.99;
      const brightnessBreath = shouldAnimate ? (0.95 + (breathWave * 0.055)) : 0.95;

      const baseRotation = shouldAnimate ? time * stateConfig.rotationSpeed : 0.45;
      const layerAngles = {
        inner: (baseRotation * stateConfig.innerSpeedMul) + 0.18,
        middle: (baseRotation * stateConfig.middleSpeedMul) + 0.45,
        ambient: (baseRotation * stateConfig.ambientSpeedMul) + 0.8,
      };

      ctx.clearRect(0, 0, width, height);

      const projected = particles.map((particle) => (
        projectPoint(particle, layerAngles, breathWave, shouldAnimate, time)
      ));

      drawEdges(
        innerEdges,
        projected,
        stateConfig.lineAlpha * 0.54,
        stateConfig.maxConnectionDistance * 0.42,
        0.22,
      );

      drawEdges(
        middleEdges,
        projected,
        stateConfig.lineAlpha * 0.72,
        stateConfig.maxConnectionDistance,
        0.26,
      );

      projected
        .map((point, index) => ({ point, source: particles[index] }))
        .sort((a, b) => a.point.z - b.point.z)
        .forEach(({ point, source }) => {
          const depth = (point.z + 1) / 2;
          const twinkle = shouldAnimate ? (0.72 + (0.28 * Math.sin((time * 2.25) + source.twinkle))) : 1;
          const lifeWave = shouldAnimate && source.microLife
            ? Math.sin((time * source.driftRate) + source.driftPhase)
            : 0;
          const lifeShiftX = shouldAnimate && source.microLife
            ? Math.cos((time * source.driftRate * 0.84) + source.driftPhase) * source.driftRadius * stateConfig.ambientDrift
            : 0;
          const lifeShiftY = shouldAnimate && source.microLife
            ? Math.sin((time * source.driftRate * 0.92) + source.driftPhase) * source.driftRadius * stateConfig.ambientDrift
            : 0;

          const drawX = point.x + lifeShiftX;
          const drawY = point.y + lifeShiftY;

          const layerSizeScale = source.layer === "inner"
            ? 0.78
            : source.layer === "middle"
              ? 1
              : 0.48;

          const depthSizeScale = 0.62 + (depth * 0.72);
          const depthAlphaScale = 0.36 + (depth * 0.9);
          const clusterBrightness = 0.88 + (source.clusterBias * 0.16);
          const shimmerBoost = source.microLife ? (1 + (lifeWave * 0.06)) : 1;

          const alpha = ((0.2 + ((point.z + 1) * 0.33)) * twinkle * depthAlphaScale * clusterBrightness * brightnessBreath * shimmerBoost) + stateConfig.particleAlphaBoost;
          const safeAlpha = Math.max(0.05, Math.min(0.95, alpha));
          const coolDepth = Math.max(0, source.coolBias - depth);

          let color = `rgba(${statePalette.particleBlue}, ${safeAlpha})`;
          if (source.hue > 0.84) {
            color = `rgba(${statePalette.particleMagenta}, ${safeAlpha * 0.72})`;
          } else if (source.hue > 0.67) {
            color = `rgba(${statePalette.particleViolet}, ${safeAlpha})`;
          } else if (source.hue > 0.42) {
            color = `rgba(${statePalette.particleCyan}, ${safeAlpha})`;
          }

          if (coolDepth > 0.24) {
            const cooledAlpha = Math.max(0.05, safeAlpha * (1 - (coolDepth * 0.34)));
            color = `rgba(${statePalette.particleBlue}, ${cooledAlpha})`;
          }

          if (stateConfig.warmInfluence > 0) {
            const warmAlpha = Math.min(0.72, safeAlpha * stateConfig.warmInfluence);
            color = `rgba(${statePalette.accentWarm}, ${warmAlpha})`;
          }

          const radialDistance = Math.hypot(drawX - centerX, drawY - centerY);
          if (source.coreInfluence > 0.62 && radialDistance < (radius * 0.24)) {
            const influencedAlpha = Math.min(0.92, safeAlpha * (0.94 + (source.coreInfluence * 0.44)));
            color = `rgba(${statePalette.coreMid}, ${influencedAlpha})`;
          }

          const haloSize = Math.max(0.12, point.size * layerSizeScale * (0.56 + (depth * 0.38)));
          const haloAlpha = source.layer === "ambient"
            ? Math.min(0.1, safeAlpha * (0.08 + (depth * 0.08)))
            : Math.min(0.21, safeAlpha * (0.11 + (depth * 0.15)));

          ctx.fillStyle = color.replace(`${safeAlpha})`, `${haloAlpha})`);
          ctx.beginPath();
          ctx.arc(drawX, drawY, haloSize, 0, Math.PI * 2);
          ctx.fill();

          if (source.sparkleSeed && depth > 0.62) {
            ctx.fillStyle = `rgba(${statePalette.coreCenter}, ${Math.min(0.86, 0.56 + (depth * 0.2))})`;
            ctx.beginPath();
            ctx.arc(drawX, drawY, 0.44, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(drawX, drawY, Math.max(0.12, point.size * layerSizeScale * depthSizeScale), 0, Math.PI * 2);
          ctx.fill();

          const corePinAlpha = Math.min(0.96, safeAlpha * (0.68 + (depth * 0.27)));
          ctx.fillStyle = `rgba(${statePalette.coreCenter}, ${corePinAlpha})`;
          ctx.beginPath();
          ctx.arc(drawX, drawY, Math.max(0.11, point.size * layerSizeScale * (0.15 + (depth * 0.11))), 0, Math.PI * 2);
          ctx.fill();
        });

      let criticalPulseBoost = 1;
      if (scenario.id === "CRITICAL") {
        if (criticalPulseStartRef.current === null) {
          criticalPulseStartRef.current = timestamp;
        }

        const elapsed = timestamp - criticalPulseStartRef.current;
        if (elapsed < 1100) {
          criticalPulseBoost = 1 + ((1 - (elapsed / 1100)) * 0.24);
        }
      }

      const corePulse = shouldAnimate
        ? (1 + (Math.sin(time * (stateConfig.pulseSpeed * 0.64)) * 0.16))
        : 1;
      const coreRadiusScale = corePulse * stateConfig.coreBoost * criticalPulseBoost;
      const shimmerX = shouldAnimate ? Math.sin(time * 0.72) * 0.62 : 0;
      const shimmerY = shouldAnimate ? Math.cos(time * 0.66) * 0.44 : 0;

      const coreGlow = ctx.createRadialGradient(centerX + shimmerX, centerY + shimmerY, 0, centerX, centerY, 15 * coreRadiusScale * pulse);
      coreGlow.addColorStop(0, `rgba(${statePalette.coreCenter}, 0.98)`);
      coreGlow.addColorStop(0.12, `rgba(${statePalette.coreCenter}, 0.86)`);
      coreGlow.addColorStop(0.31, `rgba(${statePalette.coreMid}, 0.62)`);
      coreGlow.addColorStop(0.62, `rgba(${statePalette.coreOuter}, 0.24)`);
      coreGlow.addColorStop(1, `rgba(${statePalette.coreOuter}, 0)`);

      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 16.2 * coreRadiusScale * pulse, 0, Math.PI * 2);
      ctx.fill();

      const innerEnergy = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 10.2 * coreRadiusScale);
      innerEnergy.addColorStop(0, `rgba(${statePalette.coreMid}, 0.44)`);
      innerEnergy.addColorStop(0.48, `rgba(${statePalette.coreOuter}, 0.25)`);
      innerEnergy.addColorStop(1, `rgba(${statePalette.coreOuter}, 0)`);
      ctx.fillStyle = innerEnergy;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10.4 * coreRadiusScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${statePalette.coreCenter}, 0.99)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 1.14 * coreRadiusScale, 0, Math.PI * 2);
      ctx.fill();

      if (!reducedMode && shouldAnimate && eventPaths.length > 0) {
        if (!activeEvent && timestamp >= nextEventAt) {
          activeEvent = {
            edge: eventPaths[eventCursor % eventPaths.length],
            startedAt: timestamp,
          };
          eventCursor += 1;
        }

        if (activeEvent) {
          const progress = (timestamp - activeEvent.startedAt) / stateConfig.eventTravelMs;
          if (progress >= 1) {
            activeEvent = null;
            const cadenceBend = 0.86 + ((Math.sin(eventCursor * 0.87) + 1) * 0.18);
            nextEventAt = timestamp + (stateConfig.eventIntervalMs * cadenceBend);
          } else {
            const [fromIndex, toIndex] = activeEvent.edge;
            const fromPoint = projected[fromIndex];
            const toPoint = projected[toIndex];
            const eventX = fromPoint.x + ((toPoint.x - fromPoint.x) * progress);
            const eventY = fromPoint.y + ((toPoint.y - fromPoint.y) * progress);
            const eventAlpha = Math.max(0.2, 1 - Math.abs((progress * 2) - 1));
            const eventSize = 1.2 + (eventAlpha * 0.9);

            const eventAura = ctx.createRadialGradient(eventX, eventY, 0, eventX, eventY, eventSize * 2.4);
            eventAura.addColorStop(0, `rgba(${statePalette.coreCenter}, ${0.88 * eventAlpha})`);
            eventAura.addColorStop(0.42, `rgba(${statePalette.coreMid}, ${0.45 * eventAlpha})`);
            eventAura.addColorStop(1, `rgba(${statePalette.coreOuter}, 0)`);

            ctx.fillStyle = eventAura;
            ctx.beginPath();
            ctx.arc(eventX, eventY, eventSize * 2.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(${statePalette.coreCenter}, ${0.92 * eventAlpha})`;
            ctx.beginPath();
            ctx.arc(eventX, eventY, eventSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (stateConfig.warmInfluence > 0) {
        const warmLayer = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.82);
        warmLayer.addColorStop(0, `rgba(${statePalette.accentWarm}, ${0.2 * stateConfig.warmInfluence})`);
        warmLayer.addColorStop(1, `rgba(${statePalette.accentWarm}, 0)`);
        ctx.fillStyle = warmLayer;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.82, 0, Math.PI * 2);
        ctx.fill();
      }

      if (shadowRef.current) {
        const widthScale = 0.95 + ((pulse - 0.99) * 1.6);
        const opacity = Math.max(0.5, Math.min(0.9, 0.64 + ((pulse - 0.99) * 1.7)));
        shadowRef.current.style.transform = `scaleX(${widthScale.toFixed(3)})`;
        shadowRef.current.style.opacity = opacity.toFixed(3);
      }

      if (shouldAnimate) {
        animationFrameIdRef.current = window.requestAnimationFrame(drawFrame);
      } else {
        animationFrameIdRef.current = null;
      }
    };

    const cancelCurrentFrame = () => {
      if (animationFrameIdRef.current !== null) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };

    const handleVisibility = () => {
      hiddenRef.current = document.visibilityState === "hidden";

      if (hiddenRef.current) {
        cancelCurrentFrame();
        return;
      }

      if (animationFrameIdRef.current === null) {
        animationFrameIdRef.current = window.requestAnimationFrame(drawFrame);
      }
    };

    resize();
    hiddenRef.current = document.visibilityState === "hidden";
    resizeObserverRef.current = new ResizeObserver(() => {
      resize();
      if (animationFrameIdRef.current === null) {
        drawFrame(performance.now());
      }
    });
    resizeObserverRef.current.observe(canvas);

    document.addEventListener("visibilitychange", handleVisibility);

    animationFrameIdRef.current = window.requestAnimationFrame(drawFrame);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelCurrentFrame();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      loopTokenRef.current += 1;
    };
  }, [paused, reducedMotion, scenario.id, stateConfig, statePalette]);

  return (
    <div className={[
      "oc-sphere-stage",
      `oc-sphere-${scenario.id.toLowerCase().replace(/_/g, "-")}`,
      reducedMotion ? "oc-sphere-reduced" : "",
      paused ? "oc-sphere-paused" : "",
    ].filter(Boolean).join(" ")}
    >
      <div className="oc-sphere-wrap">
        <canvas ref={canvasRef} className="oc-sphere-canvas" aria-hidden="true" />
        <div ref={shadowRef} className="oc-sphere-shadow" aria-hidden="true" />
        <div className="oc-sphere-status" aria-hidden="true">
          <div className="oc-sphere-active">ORION IS ACTIVE</div>
          <div className="oc-sphere-caption">{scenario.textCue}</div>
        </div>
      </div>
    </div>
  );
}
