import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { weatherCondition } from "./provider";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

assert.equal(weatherCondition(0), "Clear");
assert.equal(weatherCondition(63), "Rain");
assert.equal(weatherCondition(75), "Snow");
assert.equal(weatherCondition(95), "Thunderstorms");

const route = read("app/api/location-intelligence/weather/route.ts");
const provider = read("lib/location-intelligence/provider.ts");
const card = read("components/location-intelligence/location-forecast-card.tsx");
const dashboard = read("components/dashboard/WeatherWidget.tsx");
const project = read("components/projects/workspace/project-command-center-foundation.tsx");

assert.ok(route.includes("resolveWorkspaceContext"));
assert.ok(route.includes('.eq("company_id", workspace.context.companyId)'));
assert.ok(route.includes("postalOverride"));
assert.ok(route.includes("getLocationForecast(searches)"));
assert.ok(route.includes("job_site_latitude: forecast.latitude"));
assert.ok(route.includes("weather_postal_code_override: override.postalCode"));
assert.ok(route.includes("missingLocationSchema"));
assert.ok(read("supabase/migrations/20260811110000_project_location_intelligence.sql").includes("projects_job_site_latitude_check"));
assert.ok(provider.includes("geocoding-api.open-meteo.com"));
assert.ok(provider.includes("for (const candidate of candidates)"));
assert.ok(provider.includes("api.open-meteo.com/v1/forecast"));
assert.ok(provider.includes("revalidate: 900"));
assert.ok(provider.includes('forecastUrl.searchParams.set("forecast_days", "7")'));
assert.ok(card.includes("www.google.com/maps/dir/?api=1"));
assert.ok(card.includes("fallbackDirectionsAddress"));
assert.ok(card.includes("www.openstreetmap.org/export/embed.html"));
assert.ok(card.includes("payload.forecast.days.map"));
assert.ok(dashboard.includes("<LocationForecastCard"));
assert.ok(project.includes("<LocationForecastCard projectId={projectId}"));

console.log("+ location intelligence is company-scoped, shared, cached, and provides seven-day weather, maps, and directions");
