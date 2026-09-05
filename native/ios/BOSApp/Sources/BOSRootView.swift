import SwiftUI
import WebKit

@MainActor
final class BOSWebViewModel: ObservableObject {
    weak var webView: WKWebView?

    func emitRealityCaptureResult(_ result: Result<RealityCaptureUploadResult, Error>) {
        guard let webView else { return }
        let payload: [String: Any]
        switch result {
        case .success(let value):
            payload = [
                "ok": true,
                "sessionId": value.sessionId,
                "usdzPath": value.usdzPath,
                "metadataPath": value.metadataPath,
            ]
        case .failure(let error):
            payload = ["ok": false, "error": error.localizedDescription]
        }
        guard
            JSONSerialization.isValidJSONObject(payload),
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8)
        else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('bos:reality-capture-complete',{detail:\(json)}));")
    }
}

struct BOSRootView: View {
    @StateObject private var webViewModel = BOSWebViewModel()
    @State private var realityRequest: RealityCaptureRequest?

    var body: some View {
        BOSWebView(url: NativeAppConfiguration.productionURL, model: webViewModel) { request in
            realityRequest = request
        }
        .ignoresSafeArea()
        .fullScreenCover(item: $realityRequest) { request in
            if let webView = webViewModel.webView {
                RealityCaptureSheet(
                    request: request,
                    cookieStore: webView.configuration.websiteDataStore.httpCookieStore,
                    onComplete: { result in webViewModel.emitRealityCaptureResult(result) }
                )
            } else {
                Text("B.O.S. Reality Engine is unavailable until the workspace finishes loading.")
            }
        }
    }
}

struct BOSWebView: UIViewRepresentable {
    let url: URL
    @ObservedObject var model: BOSWebViewModel
    let onRealityCapture: (RealityCaptureRequest) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onRealityCapture: onRealityCapture)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(context.coordinator, name: "bosRealityCapture")
        configuration.userContentController.addUserScript(WKUserScript(
            source: """
            window.BOSNativeReality = Object.freeze({
              available: true,
              startCapture: function(payload) {
                window.webkit.messageHandlers.bosRealityCapture.postMessage(Object.assign({ action: 'start' }, payload || {}));
              }
            });
            window.dispatchEvent(new CustomEvent('bos:native-ready', { detail: { realityCapture: true } }));
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.webView = webView
        model.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.webView = webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "bosRealityCapture")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        weak var webView: WKWebView?
        private let onRealityCapture: (RealityCaptureRequest) -> Void

        init(onRealityCapture: @escaping (RealityCaptureRequest) -> Void) {
            self.onRealityCapture = onRealityCapture
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard
                message.name == "bosRealityCapture",
                message.frameInfo.isMainFrame,
                let webView,
                let currentURL = webView.url,
                NativeAppConfiguration.isAllowed(currentURL),
                let body = message.body as? [String: Any],
                body["action"] as? String == "start",
                let projectId = body["projectId"] as? String,
                !projectId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return }
            let blueprintVersionId = (body["blueprintVersionId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            onRealityCapture(RealityCaptureRequest(
                projectId: projectId.trimmingCharacters(in: .whitespacesAndNewlines),
                blueprintVersionId: blueprintVersionId?.isEmpty == false ? blueprintVersionId : nil
            ))
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let target = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if NativeAppConfiguration.isAllowed(target) {
                decisionHandler(.allow)
                return
            }
            if target.scheme == "mailto" || target.scheme == "tel" || target.scheme == "sms" {
                UIApplication.shared.open(target)
            }
            decisionHandler(.cancel)
        }
    }
}
