import { describe, expect, test } from "vitest";
import { getEmailT } from "./email";

describe("getEmailT", () => {
	test("returns Finnish translations for 'fi'", () => {
		const t = getEmailT("fi");
		expect(t("verification.subject")).toBe("Vahvista sähköpostiosoitteesi — Motori");
		expect(t("passwordReset.subject")).toBe("Vaihda salasanasi — Motori");
	});

	test("returns English translations for 'en'", () => {
		const t = getEmailT("en");
		expect(t("verification.subject")).toBe("Verify your email — Motori");
		expect(t("passwordReset.subject")).toBe("Reset your password — Motori");
	});
});
