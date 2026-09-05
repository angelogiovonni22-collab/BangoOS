import RoomPlan
import SwiftUI
import WebKit

@available(iOS 17.0, *)
struct RealityCaptureSheet: View {
    let request: RealityCaptureRequest
    let cookieStore: WKHTTPCookieStore
    let onComplete: (Result<RealityCaptureUploadResult, Error>) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var coordinator = RoomPlanCaptureCoordinator()
    @State private var uploading = false
    @State private var uploadError: String?

    var body: some View {
        ZStack(alignment: .top) {
            RealityRoomCaptureView(coordinator: coordinator)
                .ignoresSafeArea()

            HStack {
                Button("Cancel") {
                    coordinator.stop()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)

                Spacer()

                if uploading {
                    ProgressView("Uploading")
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                } else if coordinator.isScanning {
                    Button("Finish Scan") { coordinator.stop() }
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        }
        .safeAreaInset(edge: .bottom) {
            if let message = uploadError ?? coordinator.lastError {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.ultraThinMaterial)
            } else {
                Text(coordinator.isScanning ? "Move slowly around the room until walls, openings, doors, and windows are captured." : "Processing the room model…")
                    .font(.footnote)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.ultraThinMaterial)
            }
        }
        .onAppear { coordinator.start() }
        .onReceive(coordinator.$capturedRoom.compactMap { $0 }) { room in
            guard !uploading else { return }
            uploading = true
            Task { @MainActor in
                do {
                    let directory = FileManager.default.temporaryDirectory
                        .appendingPathComponent("BOSReality-\(UUID().uuidString)", isDirectory: true)
                    defer { try? FileManager.default.removeItem(at: directory) }
                    let files = try coordinator.export(room, to: directory)
                    let result = try await RealityCaptureUploadClient(cookieStore: cookieStore).upload(
                        request: request,
                        usdzURL: files.usdz,
                        metadataURL: files.metadata
                    )
                    onComplete(.success(result))
                    dismiss()
                } catch {
                    uploading = false
                    uploadError = error.localizedDescription
                    onComplete(.failure(error))
                }
            }
        }
    }
}

@available(iOS 17.0, *)
private struct RealityRoomCaptureView: UIViewRepresentable {
    @ObservedObject var coordinator: RoomPlanCaptureCoordinator

    func makeUIView(context: Context) -> RoomCaptureView {
        coordinator.makeCaptureView()
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

    static func dismantleUIView(_ uiView: RoomCaptureView, coordinator: ()) {
        uiView.captureSession.stop()
    }
}
