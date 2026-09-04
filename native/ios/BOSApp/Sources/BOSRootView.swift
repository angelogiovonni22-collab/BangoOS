import SwiftUI
import WebKit

struct BOSRootView: View {
    var body: some View {
        BOSWebView(url: NativeAppConfiguration.productionURL)
            .ignoresSafeArea()
    }
}

struct BOSWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
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
