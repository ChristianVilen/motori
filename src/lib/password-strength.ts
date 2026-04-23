type StrengthKey = "strengthWeak" | "strengthFair" | "strengthStrong";

export function passwordStrength(pw: string): {
	score: number;
	labelKey: StrengthKey;
	color: string;
} {
	let score = 0;
	if (pw.length >= 8) {
		score++;
	}
	if (pw.length >= 12) {
		score++;
	}
	if (/[A-Z]/.test(pw)) {
		score++;
	}
	if (/[0-9]/.test(pw)) {
		score++;
	}
	if (/[^A-Za-z0-9]/.test(pw)) {
		score++;
	}

	if (score <= 1) {
		return { score, labelKey: "strengthWeak", color: "bg-destructive" };
	}
	if (score <= 3) {
		return { score, labelKey: "strengthFair", color: "bg-warning" };
	}
	return { score, labelKey: "strengthStrong", color: "bg-success" };
}
