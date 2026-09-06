import Combine
import Foundation
import RoomPlan
import UIKit

@available(iOS 16.0, *)
@MainActor
final class RoomPlanCaptureCoordinator: NSObject, ObservableObject {
    @Published private(set) var isScanning = false
    @Published private(set) var capturedRoom: CapturedRoom?
    @Published private(set) var lastError: String?

    private let captureView = RoomCaptureView(frame: .zero)

    static var isSupported: Bool {
        RoomCaptureSession.isSupported
    }

    override init() {
        super.init()
        captureView.delegate = self
        captureView.captureSession.delegate = self
    }

    func makeCaptureView() -> RoomCaptureView {
        captureView
    }

    func start() {
        lastError = nil
        capturedRoom = nil
        guard RoomCaptureSession.isSupported else {
            isScanning = false
            lastError = "B.O.S. Reality Engine room capture requires an Apple device with a LiDAR Scanner."
            return
        }
        let configuration = RoomCaptureSession.Configuration()
        captureView.captureSession.run(configuration: configuration)
        isScanning = true
    }

    func stop() {
        guard isScanning else { return }
        captureView.captureSession.stop()
        isScanning = false
    }

    func export(_ room: CapturedRoom, to directory: URL) throws -> (usdz: URL, metadata: URL) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let usdzURL = directory.appendingPathComponent("room.usdz")
        let metadataURL = directory.appendingPathComponent("room.json")
        try room.export(to: usdzURL)
        let payload = RealityRoomPlanPayload(room: room)
        let data = try JSONEncoder.bosReality.encode(payload)
        try data.write(to: metadataURL, options: .atomic)
        return (usdzURL, metadataURL)
    }
}

@available(iOS 16.0, *)
extension RoomPlanCaptureCoordinator: RoomCaptureViewDelegate {
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        if let error {
            lastError = error.localizedDescription
            return false
        }
        return true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        isScanning = false
        if let error {
            lastError = error.localizedDescription
            capturedRoom = nil
            return
        }
        capturedRoom = processedResult
    }
}

@available(iOS 16.0, *)
extension RoomPlanCaptureCoordinator: RoomCaptureSessionDelegate {
    nonisolated func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {}

    nonisolated func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        Task { @MainActor in
            self.isScanning = false
            if let error { self.lastError = error.localizedDescription }
        }
    }
}

@available(iOS 16.0, *)
private struct RealityRoomPlanPayload: Codable {
    let schemaVersion = 1
    let capturedAt: String
    let walls: [Element]
    let doors: [Element]
    let windows: [Element]
    let openings: [Element]
    let objects: [Element]

    struct Element: Codable {
        let id: String
        let category: String
        let dimensions: Dimensions
        let transform: [Float]
    }

    struct Dimensions: Codable {
        let width: Float
        let height: Float
        let length: Float
    }

    init(room: CapturedRoom) {
        capturedAt = ISO8601DateFormatter().string(from: Date())
        walls = room.walls.map { Element(surface: $0, category: "wall") }
        doors = room.doors.map { Element(surface: $0, category: "door") }
        windows = room.windows.map { Element(surface: $0, category: "window") }
        openings = room.openings.map { Element(surface: $0, category: "opening") }
        objects = room.objects.map { object in
            Element(
                id: object.identifier.uuidString,
                category: String(describing: object.category),
                dimensions: Dimensions(width: object.dimensions.x, height: object.dimensions.y, length: object.dimensions.z),
                transform: object.transform.bosRealityArray
            )
        }
    }
}

@available(iOS 16.0, *)
private extension RealityRoomPlanPayload.Element {
    init(surface: CapturedRoom.Surface, category: String) {
        self.init(
            id: surface.identifier.uuidString,
            category: category,
            dimensions: .init(width: surface.dimensions.x, height: surface.dimensions.y, length: surface.dimensions.z),
            transform: surface.transform.bosRealityArray
        )
    }
}

private extension simd_float4x4 {
    var bosRealityArray: [Float] {
        [
            columns.0.x, columns.0.y, columns.0.z, columns.0.w,
            columns.1.x, columns.1.y, columns.1.z, columns.1.w,
            columns.2.x, columns.2.y, columns.2.z, columns.2.w,
            columns.3.x, columns.3.y, columns.3.z, columns.3.w,
        ]
    }
}

private extension JSONEncoder {
    static var bosReality: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}
