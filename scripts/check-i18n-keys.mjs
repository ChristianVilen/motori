#!/usr/bin/env node
/**
 * Detect unused i18n keys by comparing resource files against source code usage.
 *
 * Usage:
 *   node scripts/check-i18n-keys.mjs [--fix]
 *
 * Exits with code 1 if unused keys are found (useful in CI).
 * With --fix, prints the keys that should be removed (does not auto-delete).
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RESOURCES_DIR = join(ROOT, "src/lib/i18n/resources/fi");
const SRC_DIR = join(ROOT, "src");

// Namespaces that are only used server-side (emails) — skip source scanning for these
const SERVER_ONLY_NAMESPACES = new Set(["email"]);

// Keys known to be used dynamically (template literals) — whitelist patterns
const DYNAMIC_KEY_PATTERNS = [
	/^form\.conditions\./,
	/^form\.categories\./,
	/^bookings\.tabs\./,
	/^bookings\.status\./,
	/^register\.strength/,
	/^categories\.(sale|rental|gear|parts)\.(label|desc)$/,
];

/** Flatten a nested object into dot-separated keys */
function flattenKeys(obj, prefix = "") {
	const keys = [];
	for (const [k, v] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object" && !Array.isArray(v)) {
			keys.push(...flattenKeys(v, path));
		} else {
			keys.push(path);
		}
	}
	return keys;
}

/** Load a resource file and extract all keys */
function loadResourceKeys(filePath) {
	const content = readFileSync(filePath, "utf-8");
	// Strip `export default` and `as const;` to get a JS object
	const cleaned = content
		.replace(/^export default\s*/, "return ")
		.replace(/\s*as const;\s*$/, ";");
	// biome-ignore lint: eval is fine for a dev script
	const fn = new Function(cleaned);
	const obj = fn();
	return flattenKeys(obj);
}

/** Search source files for usage of a key within a namespace */
function findUsagesInSource(namespace, key) {
	// Check if key matches a dynamic pattern
	for (const pattern of DYNAMIC_KEY_PATTERNS) {
		if (pattern.test(key)) return true;
	}

	// Escape special regex chars in the key
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	// Search for the key as a string literal in source
	// Patterns: t("key"), t('key'), t(`key`), tNs("key")
	try {
		const result = execSync(
			`grep -rl "${escaped}" "${SRC_DIR}" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "resources/" | grep -v "node_modules" | grep -v ".gen." | head -1`,
			{ encoding: "utf-8" },
		).trim();
		return result.length > 0;
	} catch {
		return false;
	}
}

// Main
const namespaces = readdirSync(RESOURCES_DIR)
	.filter((f) => f.endsWith(".ts"))
	.map((f) => f.replace(".ts", ""));

let totalUnused = 0;
const results = {};

for (const ns of namespaces) {
	if (SERVER_ONLY_NAMESPACES.has(ns)) continue;

	const filePath = join(RESOURCES_DIR, `${ns}.ts`);
	const keys = loadResourceKeys(filePath);
	const unused = [];

	for (const key of keys) {
		if (!findUsagesInSource(ns, key)) {
			unused.push(key);
		}
	}

	if (unused.length > 0) {
		results[ns] = unused;
		totalUnused += unused.length;
	}
}

// Output
if (totalUnused === 0) {
	console.log("✓ All i18n keys are used.");
	process.exit(0);
}

console.log(`\n⚠ Found ${totalUnused} potentially unused i18n key(s):\n`);
for (const [ns, keys] of Object.entries(results)) {
	console.log(`  [${ns}] (${keys.length} keys)`);
	for (const key of keys) {
		console.log(`    - ${key}`);
	}
	console.log();
}

console.log("Note: Some keys may be used dynamically. Check DYNAMIC_KEY_PATTERNS in this script.");
process.exit(1);
