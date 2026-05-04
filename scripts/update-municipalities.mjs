#!/usr/bin/env node
// Regenerates src/lib/municipalities.ts from Tilastokeskus 2026 API + Nominatim geocoding.
// Usage: node scripts/update-municipalities.mjs [year]
// Example: node scripts/update-municipalities.mjs 2027
//
// Nominatim rate limit: 1 req/sec → ~5.5 min for 308 municipalities.

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "src", "lib", "municipalities.ts");

const year = process.argv[2] || "2026";
const classId = `kunta_1_${year}0101`;
const regionClassId = `maakunta_1_${year}0101`;
const corrUrl = `https://api.stat.fi/classificationservice/open/api/classifications/v2/correspondenceTables/${classId}%23${regionClassId}/maps?content=data&meta=max&lang=fi&format=json`;

const REGION_SLUGS = {
	Uusimaa: "uusimaa",
	"Varsinais-Suomi": "varsinais-suomi",
	Satakunta: "satakunta",
	"Kanta-Häme": "kanta-hame",
	Pirkanmaa: "pirkanmaa",
	"Päijät-Häme": "paijat-hame",
	Kymenlaakso: "kymenlaakso",
	"Etelä-Karjala": "etela-karjala",
	"Etelä-Savo": "etela-savo",
	"Pohjois-Savo": "pohjois-savo",
	"Pohjois-Karjala": "pohjois-karjala",
	"Keski-Suomi": "keski-suomi",
	"Etelä-Pohjanmaa": "etela-pohjanmaa",
	Pohjanmaa: "pohjanmaa",
	"Keski-Pohjanmaa": "keski-pohjanmaa",
	"Pohjois-Pohjanmaa": "pohjois-pohjanmaa",
	Kainuu: "kainuu",
	Lappi: "lappi",
	Ahvenanmaa: "ahvenanmaa",
};

async function geocode(name) {
	const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ", Finland")}&format=json&limit=1&accept-language=fi`;
	const res = await fetch(url, {
		headers: { "User-Agent": "motori-dev-geocoder/1.0 (one-time build script)" },
	});
	const results = await res.json();
	if (results.length > 0) {
		return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
	}
	return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
	console.log(`Fetching ${year} municipality→region data from Tilastokeskus...`);
	const res = await fetch(corrUrl);
	if (!res.ok) throw new Error(`Tilastokeskus API error: ${res.status} — is ${year} available?`);
	const raw = await res.json();

	const municipalities = raw
		.map((r) => ({
			name: r.sourceItem.classificationItemNames[0].name,
			region: r.targetItem.classificationItemNames[0].name,
		}))
		.sort((a, b) => a.name.localeCompare(b.name, "fi"));

	console.log(`Found ${municipalities.length} municipalities. Geocoding via Nominatim (~${Math.ceil(municipalities.length * 1.1 / 60)} min)...`);

	const entries = [];
	let failed = 0;

	for (let i = 0; i < municipalities.length; i++) {
		const m = municipalities[i];
		const regionSlug = REGION_SLUGS[m.region];
		if (!regionSlug) {
			console.error(`  Unknown region "${m.region}" for ${m.name} — skipping`);
			continue;
		}

		const coords = await geocode(m.name);
		if (!coords) {
			console.error(`  FAILED to geocode: ${m.name}`);
			failed++;
			entries.push({ name: m.name, region: regionSlug, lat: 0, lng: 0 });
		} else {
			entries.push({ name: m.name, region: regionSlug, lat: coords[0], lng: coords[1] });
		}

		if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${municipalities.length}...`);
		await sleep(1100);
	}

	console.log(`Geocoded ${entries.length} entries (${failed} failed).`);

	const lines = [
		`// Finnish municipalities (kunnat) ${year} — Tilastokeskus + OpenStreetMap/Nominatim coordinates`,
		`// Source: https://stat.fi/en/luokitukset/kunta/${classId}`,
		`// Generated ${new Date().toISOString().slice(0, 10)}`,
		`// Re-generate: node scripts/update-municipalities.mjs ${year}`,
		`import type { Region } from "~/lib/constants";`,
		``,
		`export interface Municipality {`,
		`\tname: string;`,
		`\tregion: Region;`,
		`\tlat: number;`,
		`\tlng: number;`,
		`}`,
		``,
		`export const MUNICIPALITIES: readonly Municipality[] = [`,
		...entries.map(
			(e) =>
				`\t{ name: ${JSON.stringify(e.name)}, region: ${JSON.stringify(e.region)}, lat: ${e.lat.toFixed(4)}, lng: ${e.lng.toFixed(4)} },`,
		),
		`];`,
		``,
		`const byName = new Map(MUNICIPALITIES.map((m) => [m.name.toLowerCase(), m]));`,
		``,
		`/** Lookup municipality by name (case-insensitive). */`,
		`export function findMunicipality(name: string): Municipality | undefined {`,
		`\treturn byName.get(name.toLowerCase());`,
		`}`,
		``,
		`/** All municipality names, sorted alphabetically. */`,
		`export const MUNICIPALITY_NAMES = MUNICIPALITIES.map((m) => m.name);`,
		``,
	];

	writeFileSync(OUTPUT, lines.join("\n"));
	console.log(`\n✅ Written to ${OUTPUT}`);
}

main().catch((err) => {
	console.error("Failed:", err);
	process.exit(1);
});
