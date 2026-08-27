# B.O.S. Measure — Adaptive Spatial Foundation

B.O.S. Measure is an independently implemented, cross-platform field measurement system. The existing `/measure` web workspace remains the universal fallback and persistence surface while native spatial providers are added.

## Product rule

The user never chooses ARKit, ARCore, LiDAR, Depth API, or fallback mode. B.O.S. detects device capabilities at runtime and selects the strongest safe provider available.

## Capability ladder

1. **Enhanced spatial** — hardware depth/LiDAR + native world tracking where available.
2. **Standard spatial** — supported AR world tracking, raycasting and planes without dedicated depth hardware.
3. **Camera calibrated** — existing B.O.S. calibrated-photo measurement.
4. **Manual verified** — user-entered verified field measurement.

Every saved measurement carries provenance, capability tier, verification state and confidence metadata so lower-quality inference is never silently presented as surveyed truth.

## Shared B.O.S. Measure Core

Platform-neutral concepts and behavior:

- point-to-point distance
- draggable/editable endpoints
- height and ruler modes
- area and perimeter
- continuous/chain measurements
- snap/anchor behavior
- level and angle
- imperial/metric formatting
- measurement history and evidence
- 2D floor-plan geometry
- 3D room/scan model contract
- confidence and verification rules
- B.O.S. project/estimate persistence contract

## Spatial provider adapters

### Apple

- ARKit: tracking, planes, raycasting, anchors and spatial coordinates
- RealityKit: spatial rendering/overlays
- RoomPlan: supported room capture and structured geometry
- LiDAR/scene depth when supported
- Core Motion: level/orientation
- AVFoundation: camera capture

### Android

- ARCore: tracking, planes, hit tests/anchors
- ARCore Depth API when supported
- hardware depth/ToF where exposed through supported platform APIs
- Android sensors for level/orientation
- camera capture

### Universal fallback

The current B.O.S. web camera calibration/manual verification workflow remains available when native spatial capability is absent or unavailable.

## Runtime capability contract

Each native provider must report capabilities before a measurement session begins. Feature availability is derived from capabilities, not device brand/model assumptions.

```text
SpatialCapabilities
  worldTracking
  planeDetection
  raycast
  depth
  hardwareDepth
  roomCapture
  meshReconstruction
  motionSensors
  camera
```

B.O.S. selects the provider/tier automatically and may degrade during a session if tracking quality becomes insufficient.

## Foundation target

- Quick Measure (live point-to-point)
- Grab/drag endpoint correction
- Height
- Ruler
- Bubble/surface level and angle
- Area/perimeter
- Snap & chain
- Imperial/metric
- screenshots/photos/history
- 2D room/floor plans
- 3D floor plans
- depth-enhanced room scanning
- textured 3D scans where device capability permits

## Delivery order

1. Shared capability/provenance contracts
2. Apple provider + physical-device Quick Measure
3. Android provider + physical-device Quick Measure
4. editable endpoints + unit formatter
5. height/ruler/level/area/perimeter/chain/snap
6. evidence + B.O.S. persistence
7. room capture + 2D plan
8. depth/LiDAR-enhanced 3D pipeline
9. cross-device accuracy/regression matrix

## Build constraint

The shared architecture and source remain in GitHub. Native iOS compilation/signing still requires Apple's iOS build toolchain; Android compilation requires the Android toolchain. Physical spatial accuracy must be validated on representative real devices. Web/simulator checks are not substitutes for physical-device validation.
