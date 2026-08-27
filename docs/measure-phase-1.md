# B.O.S. Measure Phase 1

Project-scoped mobile camera measurement workspace.

## Included
- rear/environment camera capture through browser media APIs
- two visual endpoints and measurement overlay
- verified distance entry in inches or centimeters
- project-scoped local measurement history
- reset/delete controls and camera-permission handling
- direct Measure entry in project navigation

## Accuracy boundary
Browser image pixels are not converted into physical distance. Phase 1 intentionally requires the field user to enter the verified dimension. This prevents false precision while preserving the camera-first workflow and data shape needed for a later native ARKit/LiDAR measurement engine.

## Next native phase
Replace the manual verified-distance source with ARKit/RoomPlan/LiDAR depth while retaining the B.O.S. project workflow, measurement history, and downstream estimate/material integrations.
