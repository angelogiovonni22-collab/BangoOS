# B.O.S. Native Mobile Shell

This directory contains the first native packaging foundation for B.O.S. while preserving the existing production web application as the shared product surface.

## iOS

`native/ios/BOSApp` is an XcodeGen project definition plus SwiftUI/WKWebView shell. It loads only `https://bango-os.vercel.app`, rejects non-HTTPS navigation, allows standard `mailto:`, `tel:`, and `sms:` handoff, and includes the existing RoomPlan Reality Engine source tree.

The final Apple values are intentionally not committed. Supply these at build/signing time:

- `BOS_IOS_BUNDLE_ID`
- `BOS_APPLE_TEAM_ID`
- App Store Connect signing/profile credentials through the CI secret store or Xcode account

Generate the Xcode project with XcodeGen from `native/ios/BOSApp/project.yml` before local device/archive builds.

## Android

`native/android` is a minimal Kotlin WebView application. It loads only the production B.O.S. HTTPS host, disables cleartext and mixed content, and disables direct file/content access.

The final Android package name is externally configurable with the Gradle property:

- `BOS_ANDROID_APPLICATION_ID`

The checked-in fallback is development-only (`com.bango.bos.dev`) so a production application ID can be selected before Play Console registration without rewriting the shell.

## Release boundary

This foundation deliberately does not publish or submit an app. Final iOS/Android store packaging requires developer-account identifiers, signing credentials, final bundle/application IDs, store metadata, and physical-device verification. Those values should not be committed to Git.
