import ARKit
import RoomPlan
import UIKit

@available(iOS 16.0, *)
@MainActor
public final class RoomPlanCaptureCoordinator: NSObject, RoomCaptureViewDelegate {
    public struct ExportedScan: Sendable {
        public let jsonURL: URL
        public let usdzURL: URL
        public let roomCount: Int
        public let openingCount: Int
        public let objectCount: Int
        public let capturedAt: Date
    }

    public enum CaptureError: Error {
        case unsupportedDevice
        case exportFailed
    }

    public let captureView: RoomCaptureView
    public var onExport: ((Result<ExportedScan, Error>) -> Void)?

    private let configuration = RoomCaptureSession.Configuration()

    public override init() {
        captureView = RoomCaptureView(frame: .zero)
        super.init()
        captureView.delegate = self
    }

    public var isSupported: Bool {
        ARWorldTrackingConfiguration.isSupported && ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
    }

    public func start() throws {
        guard isSupported else { throw CaptureError.unsupportedDevice }
        captureView.captureSession.run(configuration: configuration)
    }

    public func stop() {
        captureView.captureSession.stop()
    }

    public func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        error == nil
    }

    public func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        if let error {
            onExport?(.failure(error))
            return
        }

        do {
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("bos-reality-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

            let jsonURL = directory.appendingPathComponent("roomplan.json")
            let usdzURL = directory.appendingPathComponent("room.usdz")

            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            try encoder.encode(processedResult).write(to: jsonURL, options: .atomic)
            try processedResult.export(to: usdzURL)

            let openingCount = processedResult.doors.count + processedResult.windows.count + processedResult.openings.count
            let export = ExportedScan(
                jsonURL: jsonURL,
                usdzURL: usdzURL,
                roomCount: 1,
                openingCount: openingCount,
                objectCount: processedResult.objects.count,
                capturedAt: Date()
            )
            onExport?(.success(export))
        } catch {
            onExport?(.failure(error))
        }
    }
}
