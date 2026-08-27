# B.O.S. Measure — Native iOS Foundation

This directory is the native spatial-measurement engine for B.O.S. The existing `/measure` web workspace remains the fallback and persistence surface while this native engine is developed and validated on physical Apple hardware.

## Foundation target

Independent B.O.S. implementation of the core field-measurement capabilities expected from a modern iPhone measuring application:

- AR point-to-point distance measurement
- draggable/editable spatial endpoints
- height measurement
- ruler mode
- bubble and surface level / angle
- area and perimeter measurement
- continuous / chain measurement
- snap and anchor behavior
- imperial and metric display
- measurement screenshots and history
- 2D room / floor-plan capture
- LiDAR-enhanced room capture and 3D floor plans on supported hardware
- textured 3D room scanning
- graceful non-LiDAR fallbacks where Apple frameworks support them

## Apple framework architecture

- Swift + SwiftUI for the native B.O.S. field interface
- ARKit for world tracking, raycasting, planes, anchors and spatial coordinates
- RealityKit for spatial rendering and measurement overlays
- RoomPlan for supported LiDAR room capture and structured room geometry
- Core Motion for level / orientation tools
- AVFoundation for camera capture where needed
- Existing B.O.S. Supabase services for authenticated persistence

## Measurement safety boundary

Camera/AR-derived measurements are estimates until explicitly verified for critical estimating, ordering, fabrication, structural, code, or safety decisions. B.O.S. must retain measurement provenance and hardware capability metadata rather than silently presenting inferred dimensions as surveyed dimensions.

## Delivery order

1. Native app target + signing + physical-device launch
2. AR session + plane detection + point-to-point Quick Measure
3. editable endpoints + imperial/metric formatter
4. height, ruler, level, area, perimeter, chain and snap modes
5. photo/screenshot + B.O.S. measurement persistence
6. RoomPlan 2D/3D room capture
7. LiDAR/depth-enhanced scan pipeline
8. full physical-device regression and accuracy validation

## Required Apple-side setup

The repository foundation can be maintained from GitHub, but compiling and signing the native target requires macOS/Xcode. ARKit/RoomPlan acceptance testing requires a supported physical iPhone/iPad; LiDAR-specific functionality requires LiDAR-capable hardware. Do not treat simulator/web validation as physical spatial-measurement validation.
