import CryptoKit
import Foundation
import WebKit

struct RealityCaptureRequest: Identifiable, Equatable {
    let id = UUID()
    let projectId: String
    let blueprintVersionId: String?
}

struct RealityCaptureUploadResult: Codable {
    let sessionId: String
    let usdzPath: String
    let metadataPath: String
}

enum RealityCaptureUploadError: LocalizedError {
    case unauthenticated
    case invalidResponse(String)

    var errorDescription: String? {
        switch self {
        case .unauthenticated: return "Your B.O.S. session is no longer authenticated. Sign in again before uploading this scan."
        case .invalidResponse(let message): return message
        }
    }
}

@MainActor
final class RealityCaptureUploadClient {
    private let cookieStore: WKHTTPCookieStore
    private let baseURL: URL

    init(cookieStore: WKHTTPCookieStore, baseURL: URL = NativeAppConfiguration.productionURL) {
        self.cookieStore = cookieStore
        self.baseURL = baseURL
    }

    func upload(request: RealityCaptureRequest, usdzURL: URL, metadataURL: URL) async throws -> RealityCaptureUploadResult {
        let cookieHeader = try await authenticatedCookieHeader()
        let metadataData = try Data(contentsOf: metadataURL)
        let roomPlan = try JSONSerialization.jsonObject(with: metadataData)
        let sourcePlatform = UIDevice.current.userInterfaceIdiom == .pad ? "ipados" : "ios"
        let appBuild = Bundle.main.infoDictionary?["CFBundleVersion"] as? String

        var captureBody: [String: Any] = [
            "projectId": request.projectId,
            "captureType": "roomplan",
            "sourcePlatform": sourcePlatform,
            "deviceModel": UIDevice.current.model,
            "osVersion": UIDevice.current.systemVersion,
            "roomPlan": roomPlan,
        ]
        if let blueprintVersionId = request.blueprintVersionId { captureBody["blueprintVersionId"] = blueprintVersionId }
        if let appBuild { captureBody["appBuild"] = appBuild }

        let capture = try await postJSON(path: "/api/reality/scans", body: captureBody, cookieHeader: cookieHeader)
        guard
            let scan = capture["scan"] as? [String: Any],
            let sessionId = scan["id"] as? String,
            !sessionId.isEmpty
        else { throw RealityCaptureUploadError.invalidResponse("B.O.S. did not return a Reality Engine capture session.") }

        let usdzPath = try await uploadAsset(
            sessionId: sessionId,
            kind: "usdz",
            fileURL: usdzURL,
            mimeType: "model/vnd.usdz+zip",
            cookieHeader: cookieHeader
        )
        let metadataPath = try await uploadAsset(
            sessionId: sessionId,
            kind: "metadata",
            fileURL: metadataURL,
            mimeType: "application/json",
            cookieHeader: cookieHeader
        )
        return RealityCaptureUploadResult(sessionId: sessionId, usdzPath: usdzPath, metadataPath: metadataPath)
    }

    private func uploadAsset(sessionId: String, kind: String, fileURL: URL, mimeType: String, cookieHeader: String) async throws -> String {
        let ticket = try await postJSON(
            path: "/api/reality/scans/\(sessionId)/assets/upload-ticket",
            body: ["assetKind": kind, "fileName": fileURL.lastPathComponent, "mimeType": mimeType],
            cookieHeader: cookieHeader
        )
        guard
            let signedUrlText = ticket["signedUrl"] as? String,
            let signedURL = URL(string: signedUrlText),
            let storagePath = ticket["path"] as? String
        else { throw RealityCaptureUploadError.invalidResponse("B.O.S. did not return a valid Reality Engine upload ticket.") }

        let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
        var uploadRequest = URLRequest(url: signedURL)
        uploadRequest.httpMethod = "PUT"
        uploadRequest.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        uploadRequest.setValue("max-age=3600", forHTTPHeaderField: "Cache-Control")
        uploadRequest.setValue("false", forHTTPHeaderField: "x-upsert")
        let (_, uploadResponse) = try await URLSession.shared.upload(for: uploadRequest, fromFile: fileURL)
        try requireSuccess(uploadResponse, fallback: "Reality Engine asset upload failed.")

        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        _ = try await postJSON(
            path: "/api/reality/scans/\(sessionId)/assets/finalize",
            body: [
                "assetKind": kind,
                "path": storagePath,
                "mimeType": mimeType,
                "byteSize": data.count,
                "sha256": digest,
            ],
            cookieHeader: cookieHeader
        )
        return storagePath
    }

    private func postJSON(path: String, body: [String: Any], cookieHeader: String) async throws -> [String: Any] {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw RealityCaptureUploadError.invalidResponse("Invalid B.O.S. Reality Engine endpoint.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw RealityCaptureUploadError.invalidResponse("B.O.S. returned an invalid Reality Engine response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let message = json?["error"] as? String ?? "Reality Engine request failed with status \(http.statusCode)."
            throw RealityCaptureUploadError.invalidResponse(message)
        }
        return ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any]) ?? [:]
    }

    private func authenticatedCookieHeader() async throws -> String {
        let cookies = await withCheckedContinuation { continuation in
            cookieStore.getAllCookies { continuation.resume(returning: $0) }
        }
        let eligible = cookies.filter { cookie in
            guard let host = baseURL.host else { return false }
            return host == cookie.domain || host.hasSuffix(cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")))
        }
        guard !eligible.isEmpty, let header = HTTPCookie.requestHeaderFields(with: eligible)["Cookie"], !header.isEmpty else {
            throw RealityCaptureUploadError.unauthenticated
        }
        return header
    }

    private func requireSuccess(_ response: URLResponse, fallback: String) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode
            throw RealityCaptureUploadError.invalidResponse(status.map { "\(fallback) Status \($0)." } ?? fallback)
        }
    }
}
