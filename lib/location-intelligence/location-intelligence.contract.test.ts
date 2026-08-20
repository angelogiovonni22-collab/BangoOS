import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { selectBestPlace, weatherCondition } from "./provider";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

assert.equal(weatherCondition(0), "Clear");
assert.equal(weatherCondition(63), "Rain");
assert.equal(weatherCondition(75), "Snow");
assert.equal(weatherCondition(95), "Thunderstorms");
assert.equal(selectBestPlace([
  { name: "Maryville", admin1: "Tennessee", country: "United States", latitude: 35.75, longitude: -83.97 },
  { name: "Marysville", admin1: "Ohio", country: "United States", postcodes: ["43040"], latitude: 40.24, longitude: -83.37 },
], { state: "OH", postalCode: "43040" })?.admin1, "Ohio");

const route = read("app/api/location-intelligence/weather/route.ts");
const provider = read("lib/location-intelligence/provider.ts");
const card = read("components/location-intelligence/location-forecast-card.tsx");
const weatherScene = read("components/location-intelligence/location-weather-scene.module.css");
const dashboard = read("components/dashboard/WeatherWidget.tsx");
const project = read("components/projects/workspace/project-workspace-hero.tsx");

assert.ok(route.includes("resolveWorkspaceContext"));
assert.ok(route.includes('.eq("company_id", workspace.context.companyId)'));
assert.ok(route.includes("postalOverride"));
assert.ok(route.includes("getLocationForecast(searches, {"));
assert.ok(route.includes("state: project.state"));
assert.ok(route.includes("postalCode: postalOverride || project.postal_code"));
assert.ok(route.includes("job_site_latitude: forecast.latitude"));
assert.ok(route.includes("weather_postal_code_override: override.postalCode"));
assert.ok(route.includes("missingLocationSchema"));
assert.ok(read("supabase/migrations/20260811110000_project_location_intelligence.sql").includes("projects_job_site_latitude_check"));
assert.ok(provider.includes("geocoding-api.open-meteo.com"));
assert.ok(provider.includes("for (const candidate of candidates)"));
assert.ok(provider.includes("api.open-meteo.com/v1/forecast"));
assert.ok(provider.includes("revalidate: 900"));
assert.ok(provider.includes('forecastUrl.searchParams.set("forecast_days", "7")'));
assert.ok(provider.includes('forecastUrl.searchParams.set("hourly"'));
assert.ok(provider.includes("hours: weather.hourly.time.slice"));
assert.ok(card.includes("www.google.com/maps/dir/?api=1"));
assert.ok(card.includes("fallbackDirectionsAddress"));
assert.ok(card.includes("www.google.com/maps?q="));
assert.ok(card.includes("www.google.com/maps/search/?api=1"));
assert.ok(card.includes("payload.forecast.days.map"));
assert.ok(card.includes("WeatherGlyph"));
assert.ok(card.includes("WeatherAtmosphere"));
assert.ok(card.includes("data-live-weather"));
assert.ok(card.includes("document.visibilityState"));
assert.ok(card.includes("10 * 60 * 1000"));
assert.ok(card.includes('setForecastMode("hourly")'));
assert.ok(card.includes('setForecastMode("daily")'));
assert.ok(card.includes("weatherSceneKind"));
assert.ok(card.includes('className="grid gap-3"'));
assert.ok(!card.includes("lg:grid-cols-2"));
assert.ok(!card.includes("overflow-x-auto"));
assert.ok(card.includes("payload.forecast.hours.slice(0, 6)"));
assert.ok(card.includes("liveLabel"));
assert.ok(/prefers-reduced-motion\s*:\s*reduce/.test(weatherScene));
assert.ok(weatherScene.includes("stormFlash"));
assert.ok(weatherScene.includes("rainSweep"));
assert.ok(weatherScene.includes("cloudMiddle"));
assert.ok(weatherScene.includes("rainFar"));
assert.ok(weatherScene.includes("rainNear"));
assert.ok(weatherScene.includes('grid-template-columns:repeat(6'));
assert.ok(card.includes("formatWeatherTime"));
assert.ok(dashboard.includes("<LocationForecastCard"));
assert.ok(project.includes("<LocationForecastCard projectId={projectId}"));
assert.ok(!read("components/projects/workspace/project-command-center-foundation.tsx").includes("<LocationForecastCard"));

console.log("+ location intelligence is company-scoped, shared, cached, and provides seven-day weather, maps, and directions");
