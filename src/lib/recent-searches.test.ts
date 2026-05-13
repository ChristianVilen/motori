import { beforeEach, describe, expect, it } from "vitest";
import {
	addRecentSearch,
	clearRecentSearches,
	getRecentSearches,
} from "./recent-searches";

describe("recent-searches", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns empty array when nothing stored", () => {
		expect(getRecentSearches()).toEqual([]);
	});

	it("returns empty array on parse error", () => {
		localStorage.setItem("motori:recentSearches", "not-json");
		expect(getRecentSearches()).toEqual([]);
	});

	it("adds a search and returns the new list", () => {
		const result = addRecentSearch("honda");
		expect(result).toEqual(["honda"]);
		expect(getRecentSearches()).toEqual(["honda"]);
	});

	it("prepends newest, dedupes case-insensitively", () => {
		addRecentSearch("honda");
		addRecentSearch("yamaha");
		const result = addRecentSearch("Honda");
		expect(result).toEqual(["Honda", "yamaha"]);
	});

	it("caps at 5 entries", () => {
		for (const q of ["a", "b", "c", "d", "e", "f"]) addRecentSearch(q);
		expect(getRecentSearches()).toEqual(["f", "e", "d", "c", "b"]);
	});

	it("ignores empty and whitespace-only input", () => {
		expect(addRecentSearch("")).toEqual([]);
		expect(addRecentSearch("   ")).toEqual([]);
		expect(getRecentSearches()).toEqual([]);
	});

	it("trims the stored value", () => {
		addRecentSearch("  honda  ");
		expect(getRecentSearches()).toEqual(["honda"]);
	});

	it("clears all entries", () => {
		addRecentSearch("honda");
		clearRecentSearches();
		expect(getRecentSearches()).toEqual([]);
	});
});
