import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const layout = read("app/layout.tsx");
const manifest = read("app/manifest.ts");
const appIconRoute = read("app/api/app-icon-v3/[size]/route.tsx");
const appEntryPage = read("app/app-entry/page.tsx");
const appEntryClient = read("app/app-entry/app-entry-client.tsx");
const login = read("app/login/page.tsx");
const mobileHome = read("app/(app)/mobile-home/mobile-home-client.tsx");
const mobileCss = read("app/mobile-reference.css");
const reliabilityCss = read("app/mobile-reliability.css");
const mobileField = read("components/crews/mobile-field-operations-workspace.tsx");
const pushDispatch = read("supabase/functions/orion-push-dispatch/index.ts");

assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
assert.match(layout, /appleWebApp:\s*\{[\s\S]*?capable:\s*true/);
assert.match(layout, /viewportFit:\s*"cover"/);
assert.match(layout, /mobile-reliability\.css/);
assert.match(layout, /apple:\s*\[\{\s*url:\s*"\/api\/app-icon-v3\/180"[\s\S]*sizes:\s*"180x180"/);
assert.match(layout, /url:\s*"\/api\/app-icon-v3\/512"[\s\S]*sizes:\s*"512x512"/);

assert.match(manifest, /start_url:\s*"\/app-entry"/);
assert.match(manifest, /display:\s*"standalone"/);
assert.match(manifest, /scope:\s*"\/"/);
assert.match(manifest, /src:\s*"\/api\/app-icon-v3\/192"[\s\S]*sizes:\s*"192x192"/);
assert.match(manifest, /src:\s*"\/api\/app-icon-v3\/512"[\s\S]*sizes:\s*"512x512"/);

assert.match(appIconRoute, /new ImageResponse/);
assert.match(appIconRoute, /background:\s*"#000000"/);
assert.match(appIconRoute, /bos-operating-system-logo\.png/);
assert.match(appIconRoute, /width:\s*size,[\s\S]*height:\s*size/);
assert.match(appIconRoute, /objectFit:\s*"contain"/);

assert.match(appEntryPage, /AppEntryClient/);
assert.match(appEntryClient, /matchMedia\("\(max-width: 1023px\)"\)/);
assert.match(appEntryClient, /mobile \? "\/mobile-home" : desktopPath/);
assert.match(login, /mobileDestination[\s\S]*"\/mobile-home"/);

assert.match(mobileHome, /MobileBottomNav/);
assert.match(mobileHome, /aria-label="Mobile navigation"/);
assert.match(mobileHome, /router\.replace\(getRoleHomePath\(role\)\)/);
assert.match(mobileHome, /getMobileGreeting\(new Date\(\)\)/);
assert.doesNotMatch(mobileHome, /fallbackTasks/);
assert.doesNotMatch(mobileHome, /Daily Log submitted/);
assert.doesNotMatch(mobileHome, /Inspection scheduled/);
assert.doesNotMatch(mobileHome, /Photo uploaded/);
assert.match(mobileHome, /No recent activity to display/);
assert.match(mobileHome, /Open field time clock/);

assert.match(pushDispatch, /reminder\.linked_href \|\| "\/app-entry"/);
assert.doesNotMatch(pushDispatch, /\/mobile-entry/);

assert.match(mobileCss, /env\(safe-area-inset-bottom\)/);
assert.match(mobileCss, /env\(safe-area-inset-top\)/);
assert.match(reliabilityCss, /touch-action:\s*manipulation/);
assert.match(reliabilityCss, /-webkit-tap-highlight-color:\s*transparent/);
assert.match(mobileField, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(mobileField, /aria-label="Field quick actions"/);

console.log("B.O.S. mobile reliability contract checks passed.");
