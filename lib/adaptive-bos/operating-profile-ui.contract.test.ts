import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const settings = fs.readFileSync(path.join(root, "app/(app)/settings/page.tsx"), "utf8");
const profile = fs.readFileSync(path.join(root, "app/(app)/settings/operating-profile/page.tsx"), "utf8");
const api = fs.readFileSync(path.join(root, "app/api/adaptive-bos/profile/route.ts"), "utf8");

assert(settings.includes("/settings/operating-profile"), "Settings must expose Adaptive B.O.S. to owners/admins");
assert(settings.includes('role === "owner" || role === "administrator"'), "Operating profile settings must remain privileged");
assert(profile.includes("ADAPTIVE_BOS_TEMPLATES"), "Operating profile UI must use the canonical adaptive template catalog");
assert(profile.includes('fetch("/api/adaptive-bos/profile"'), "Operating profile UI must load tenant configuration from the API");
assert(profile.includes('method:"PATCH"'), "Operating profile UI must save through the protected profile API");
assert(profile.includes('locale === "es"'), "Operating profile UI must remain usable in Spanish");
assert(profile.includes("Construction remains the default for existing workspaces."), "Existing construction workspaces must stay non-destructive by default");
assert(api.includes("module_overrides"), "Adaptive profile API must preserve future module customization support");

console.log("Adaptive B.O.S. operating profile UI contract passed");
