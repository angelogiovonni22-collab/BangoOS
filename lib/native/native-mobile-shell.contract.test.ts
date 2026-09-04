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

assert(iosProject.includes("$(BOS_IOS_BUNDLE_ID)"), "iOS bundle ID must remain externally configurable");
assert(iosProject.includes("$(BOS_APPLE_TEAM_ID)"), "Apple signing team must remain externally configurable");
assert(iosConfig.includes("https://bango-os.vercel.app"));
assert(iosConfig.includes('url.scheme == "https"'), "iOS shell must fail closed to HTTPS");
assert(iosWebView.includes("WKNavigationDelegate"));
assert(iosWebView.includes("NativeAppConfiguration.isAllowed"));

assert(androidManifest.includes('android:usesCleartextTraffic="false"'), "Android shell must reject cleartext traffic");
assert(androidBuild.includes('BOS_ANDROID_APPLICATION_ID'), "Android application ID must remain externally configurable");
assert(androidActivity.includes("MIXED_CONTENT_NEVER_ALLOW"));
assert(androidActivity.includes("allowFileAccess = false"));
assert(androidActivity.includes("https://bango-os.vercel.app"));
assert(androidActivity.includes('uri.scheme == "https"'));

console.log("Native mobile shell contract passed");
