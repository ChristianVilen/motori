// biome-ignore-all lint/suspicious/noConsole: CLI script — console output is expected
import { auth } from "../auth";
import { db } from "./index";

const SEED_EMAIL = "dev@vuokramoto.local";
const SEED_PASSWORD = "devpassword";
const SEED_NAME = "Dev";

const IMG = (name: string) => `/images/${name}-1200w.webp`;
const TANK = IMG("kawasaki-tank-closeup");
const R6 = IMG("yamaha-r6-graffiti-sunset");
const FERRY = IMG("motorcycle-finnish-ferry");
const LINEUP = IMG("sportbikes-lineup");

type SeedListing = {
	title: string;
	brand: string;
	model: string;
	year: number;
	engine_cc: number;
	required_license: "A1" | "A2" | "A";
	motorcycle_type: string;
	price_per_day: number; // EUR (converted to cents on insert)
	price_per_week: number | null;
	city: string;
	region: string;
	description: string;
	status?: "active" | "paused";
	images: string[];
};

const listings: SeedListing[] = [
	{
		title: "Yamaha YZF-R6 — varma ja nopea",
		brand: "Yamaha",
		model: "YZF-R6",
		year: 2018,
		engine_cc: 599,
		required_license: "A",
		motorcycle_type: "sport",
		price_per_day: 95,
		price_per_week: 550,
		city: "Helsinki",
		region: "uusimaa",
		description:
			"Hyvin huollettu R6, sopii kokeneelle kuljettajalle. Renkaat uudet keväällä, akrapovic-pakoputki.",
		images: [R6, LINEUP],
	},
	{
		title: "Kawasaki Ninja ZX-6R 636",
		brand: "Kawasaki",
		model: "Ninja ZX-6R",
		year: 2020,
		engine_cc: 636,
		required_license: "A",
		motorcycle_type: "sport",
		price_per_day: 110,
		price_per_week: 650,
		city: "Tampere",
		region: "pirkanmaa",
		description: "Vihreä Ninja, hyvässä kunnossa. Kypärä mukana, vakuutus omasta.",
		images: [LINEUP],
	},
	{
		title: "Kawasaki Z650 — kevyt naked",
		brand: "Kawasaki",
		model: "Z650",
		year: 2022,
		engine_cc: 649,
		required_license: "A2",
		motorcycle_type: "naked",
		price_per_day: 65,
		price_per_week: 380,
		city: "Turku",
		region: "varsinais-suomi",
		description: "Loistava arkikäyttöön ja kaupunkiajoon. A2-rajoitettu.",
		images: [TANK],
	},
	{
		title: "Suzuki SV650 — kaupunkiajon klassikko",
		brand: "Suzuki",
		model: "SV650",
		year: 2019,
		engine_cc: 645,
		required_license: "A2",
		motorcycle_type: "naked",
		price_per_day: 55,
		price_per_week: 320,
		city: "Espoo",
		region: "uusimaa",
		description: "Helppo ja luotettava. Sopii myös vasta-alkajalle (A2-luokka).",
		images: [FERRY],
	},
	{
		title: "BMW R 1250 RT — pitkien matkojen kuningas",
		brand: "BMW",
		model: "R 1250 RT",
		year: 2021,
		engine_cc: 1254,
		required_license: "A",
		motorcycle_type: "touring",
		price_per_day: 175,
		price_per_week: 1050,
		city: "Jyväskylä",
		region: "keski-suomi",
		description:
			"Täysvarustelu: cruise control, lämmittimet, sivulaukut. Ihanteellinen reissupyörä.",
		images: [LINEUP, FERRY],
	},
	{
		title: "Honda Goldwing 1800 — luksusta pitkille reissuille",
		brand: "Honda",
		model: "GL1800 Goldwing",
		year: 2017,
		engine_cc: 1832,
		required_license: "A",
		motorcycle_type: "touring",
		price_per_day: 165,
		price_per_week: 990,
		city: "Oulu",
		region: "pohjois-pohjanmaa",
		description: "Mukavin tapa kierrellä Lappia. Audio, GPS, lämpenevät kahvat ja istuin.",
		images: [FERRY],
	},
	{
		title: "KTM 890 Adventure — soraa ja asfalttia",
		brand: "KTM",
		model: "890 Adventure",
		year: 2022,
		engine_cc: 889,
		required_license: "A",
		motorcycle_type: "adventure",
		price_per_day: 130,
		price_per_week: 750,
		city: "Rovaniemi",
		region: "lappi",
		description:
			"Loistava Lapin reissupyörä. Off-road-renkaat saatavissa pyynnöstä, pannarit mukana.",
		images: [LINEUP],
	},
	{
		title: "Triumph Tiger 900 GT",
		brand: "Triumph",
		model: "Tiger 900 GT",
		year: 2020,
		engine_cc: 888,
		required_license: "A",
		motorcycle_type: "adventure",
		price_per_day: 120,
		price_per_week: 700,
		city: "Tampere",
		region: "pirkanmaa",
		description: "Mukava ja ketterä adventure-pyörä. Sivulaukut ja topcase mukana.",
		images: [FERRY],
	},
	{
		title: "Harley-Davidson Iron 883 — klassinen cruiseri",
		brand: "Harley-Davidson",
		model: "Iron 883",
		year: 2019,
		engine_cc: 883,
		required_license: "A2",
		motorcycle_type: "cruiser",
		price_per_day: 95,
		price_per_week: 580,
		city: "Helsinki",
		region: "uusimaa",
		description: "Mustan klassinen H-D. Sopii Helsinki–Hanko-reissuille kesäisin.",
		images: [TANK],
	},
	{
		title: "Yamaha MT-125 — A1-luokan arkipyörä",
		brand: "Yamaha",
		model: "MT-125",
		year: 2023,
		engine_cc: 125,
		required_license: "A1",
		motorcycle_type: "naked",
		price_per_day: 45,
		price_per_week: 250,
		city: "Lahti",
		region: "paijat-hame",
		description: "Vastuullinen ensimmäinen pyörä. A1-kortilla ajettava.",
		status: "paused",
		images: [TANK],
	},
];

async function main() {
	console.log("\n🌱 Seeding dev data...\n");

	// 1. Wipe previous seed user — ON DELETE CASCADE handles listings, images, profile, sessions, accounts
	const existing = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", SEED_EMAIL)
		.executeTakeFirst();

	if (existing) {
		console.log(`Removing previous seed user (${existing.id})...`);
		await db.deleteFrom("user").where("id", "=", existing.id).execute();
	}

	// 2. Create user via BetterAuth (handles password hashing + account row)
	console.log(`Creating user ${SEED_EMAIL}...`);
	const result = await auth.api.signUpEmail({
		body: { email: SEED_EMAIL, password: SEED_PASSWORD, name: SEED_NAME },
	});
	const userId = result.user.id;

	// Force email verified + admin role so login and admin dashboard work without extra steps
	await db
		.updateTable("user")
		.set({ emailVerified: true, role: "admin", updatedAt: new Date() })
		.where("id", "=", userId)
		.execute();

	// 3. Profile
	await db
		.insertInto("profile")
		.values({
			user_id: userId,
			display_name: SEED_NAME,
			city: "Helsinki",
			license_class: "A",
			language: "fi",
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// 4. Listings + images
	console.log(`Creating ${listings.length} listings...`);
	const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

	for (const seed of listings) {
		const id = crypto.randomUUID();

		await db
			.insertInto("listing")
			.values({
				id,
				owner_id: userId,
				title: seed.title,
				brand: seed.brand,
				model: seed.model,
				year: seed.year,
				engine_cc: seed.engine_cc,
				required_license: seed.required_license,
				motorcycle_type: seed.motorcycle_type,
				price_per_day: seed.price_per_day * 100,
				price_per_week: seed.price_per_week ? seed.price_per_week * 100 : null,
				price_description: null,
				deposit_amount: null,
				city: seed.city,
				region: seed.region,
				postal_code: null,
				available_from: null,
				available_to: null,
				description: seed.description,
				mileage_limit: null,
				status: seed.status,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		if (seed.images.length > 0) {
			await db
				.insertInto("listing_image")
				.values(
					seed.images.map((url, i) => ({
						id: crypto.randomUUID(),
						listing_id: id,
						url,
						order: i,
					})),
				)
				.execute();
		}
	}

	console.log(`\n✅ Done. Login: ${SEED_EMAIL} / ${SEED_PASSWORD}\n`);

	await db.destroy();
}

main().catch(async (err) => {
	console.error("Seed failed:", err);
	await db.destroy();
	process.exit(1);
});
