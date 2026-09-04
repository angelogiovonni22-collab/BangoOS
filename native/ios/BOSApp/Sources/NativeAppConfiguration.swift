import Foundation

enum NativeAppConfiguration {
    static let productionURL = URL(string: "https://bango-os.vercel.app")!
    static let allowedHosts: Set<String> = ["bango-os.vercel.app"]

    static func isAllowed(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased(), url.scheme == "https" else { return false }
        return allowedHosts.contains(host)
    }
}
