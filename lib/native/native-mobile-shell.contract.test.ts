import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iosProject = fs.readFileSync(path.join(root, "native/ios/BOSApp/project.yml"), "utf8");
const iosConfig = fs.readFileSync(path.join(root, "native/ios/BOSApp/Sources/NativeAppConfiguration.swift"), "utf8");
const iosWebView = fs.readFileSync(path.join(root, "native/ios/BOSApp/Sources/BOSRootView.swift"), "utf8");
const androidManifest = fs.readFileSync(path.join(root, "native/android/app/src/main/AndroidManifest.xml"), "utf8");
const androidActivity = fs.readFileSync(path.join(root, "native/android/app/src/main/java/com/bango/bos/MainActivity.kt"), "utf8");
const androidBuild = fs.readFileSync(path.join(root, "native/android/app/build.gradle.kts"), "utf8");
const androidRootBuild = fs.readFileSync(path.join(root, "native/android/build.gradle.kts"), "utf8");

assert(iosProject.includes("$(BOS_IOS_BUNDLE_ID)"), "iOS bundle ID must remain externally configurable");
assert(iosProject.includes("$(BOS_APPLE_TEAM_ID)"), "Apple signing team must remain externally configurable");
assert(iosProject.includes("NSCameraUsageDescription"), "iOS Reality Engine must explain camera use");
assert(iosProject.includes("NSMicrophoneUsageDescription"), "iOS native shell must explain microphone use before Orion voice capture");
assert(iosConfig.includes("https://bango-os.vercel.app"));
assert(iosConfig.includes('url.scheme == "https"'), "iOS shell must fail closed to HTTPS");
assert(iosWebView.includes("WKNavigationDelegate"));
assert(iosWebView.includes("NativeAppConfiguration.isAllowed"));

assert(androidManifest.includes('android:usesCleartextTraffic="false"'), "Android shell must reject cleartext traffic");
assert(androidBuild.includes('BOS_ANDROID_APPLICATION_ID'), "Android application ID must remain externally configurable");
assert(androidBuild.includes("compileSdk = 36"), "Android shell must compile against Android 16 / API 36 for current Play submission readiness");
assert(androidBuild.includes("targetSdk = 36"), "Android shell must target Android 16 / API 36 for current Play submission readiness");
assert(androidRootBuild.includes('version "8.11.1"'), "Android Gradle plugin must support API 36");
assert(androidActivity.includes("MIXED_CONTENT_NEVER_ALLOW"));
assert(androidActivity.includes("allowFileAccess = false"));
assert(androidActivity.includes("https://bango-os.vercel.app"));
assert(androidActivity.includes('uri.scheme == "https"'));

console.log("Native mobile shell contract passed");
