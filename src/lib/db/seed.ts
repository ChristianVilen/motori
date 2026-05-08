// biome-ignore-all lint/suspicious/noConsole: CLI script — console output is expected
import { auth } from "../auth";
import { db } from "./index";

const SEED_EMAIL = "dev@motori.local";
const SEED_PASSWORD = "DevPassword1!";
const SEED_NAME = "Dev";

const IMG = (name: string) => `/images/${name}-1200w.webp`;
const TANK = IMG("kawasaki-tank-closeup");
const R6 = IMG("yamaha-r6-graffiti-sunset");
const FERRY = IMG("motorcycle-finnish-ferry");
const LINEUP = IMG("sportbikes-lineup");

type SeedListing = {
	title: string;
	makeSlug: string;
	year: number;
	engine_cc: number;
	required_license: "A1" | "A2" | "A";
	motorcycle_type: string;
	price_per_day: number;
	price_per_week: number | null;
	city: string;
	region: string;
	description: string;
	status?: "active" | "paused";
	images: string[];
};

const MAKES_SEED = [
	{ name: "Aprilia", slug: "aprilia" },
	{ name: "Beta", slug: "beta" },
	{ name: "BMW", slug: "bmw" },
	{ name: "Can-Am", slug: "can-am" },
	{ name: "Ducati", slug: "ducati" },
	{ name: "Energica", slug: "energica" },
	{ name: "GasGas", slug: "gasgas" },
	{ name: "Harley-Davidson", slug: "harley-davidson" },
	{ name: "Honda", slug: "honda" },
	{ name: "Husaberg", slug: "husaberg" },
	{ name: "Husqvarna", slug: "husqvarna" },
	{ name: "Indian", slug: "indian" },
	{ name: "Kawasaki", slug: "kawasaki" },
	{ name: "KTM", slug: "ktm" },
	{ name: "Moto Guzzi", slug: "moto-guzzi" },
	{ name: "Royal Enfield", slug: "royal-enfield" },
	{ name: "Sherco", slug: "sherco" },
	{ name: "Suzuki", slug: "suzuki" },
	{ name: "Triumph", slug: "triumph" },
	{ name: "Yamaha", slug: "yamaha" },
	{ name: "Zero", slug: "zero" },
	{ name: "Muu", slug: "muu" },
];

const MODELS_SEED: { makeSlug: string; models: string[] }[] = [
	{
		makeSlug: "honda",
		models: ["CB500F", "CB650R", "CBR600RR", "Africa Twin", "NC750X", "Gold Wing"],
	},
	{ makeSlug: "yamaha", models: ["MT-07", "MT-09", "YZF-R1", "Ténéré 700", "TMAX", "MT-125"] },
	{
		makeSlug: "kawasaki",
		models: ["Z650", "Z900", "Ninja 400", "Ninja 650", "Versys 650", "Ninja ZX-6R"],
	},
	{ makeSlug: "bmw", models: ["R 1250 GS", "S 1000 RR", "F 900 R", "R nineT", "R 1250 RT"] },
	{ makeSlug: "ktm", models: ["Duke 390", "Duke 790", "890 Adventure"] },
	{ makeSlug: "suzuki", models: ["GSX-S750", "V-Strom 650", "Hayabusa", "SV650"] },
	{ makeSlug: "harley-davidson", models: ["Sportster", "Street Glide", "Fat Boy", "Iron 883"] },
	{ makeSlug: "ducati", models: ["Monster", "Panigale V4", "Multistrada V4"] },
	{ makeSlug: "triumph", models: ["Bonneville", "Tiger 900", "Street Triple", "Tiger 900 GT"] },
	{ makeSlug: "aprilia", models: ["RS 660", "Tuono 660", "Shiver 900"] },
	{ makeSlug: "royal-enfield", models: ["Meteor 350", "Himalayan", "Classic 350"] },
	{ makeSlug: "husqvarna", models: ["Svartpilen 401", "Vitpilen 401"] },
	{ makeSlug: "zero", models: ["SR/F", "DSR/X"] },
	{ makeSlug: "indian", models: ["Scout", "Chief", "FTR 1200"] },
	{ makeSlug: "moto-guzzi", models: ["V7", "V9", "V100 Mandello"] },
	{ makeSlug: "can-am", models: ["Ryker", "Spyder F3"] },
	{ makeSlug: "energica", models: ["Ego", "Eva"] },
	{ makeSlug: "beta", models: ["RR 125", "RR 300"] },
	{ makeSlug: "gasgas", models: ["EC 250", "MC 350F"] },
	{ makeSlug: "husaberg", models: ["FE 501", "TE 300"] },
	{ makeSlug: "sherco", models: ["SE 300", "SEF 250"] },
];

const listings: SeedListing[] = [
	{
		title: "Yamaha YZF-R6 — varma ja nopea",
		makeSlug: "yamaha",
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
		makeSlug: "kawasaki",
		year: 2020,
		engine_cc: 636,
		required_license: "A",
		motorcycle_type: "sport",
		price_per_day: 110,
		price_per_week: 650,
		city: "Tampere",
		region: "pirkanmaa",
		description: "Vihreä Ninja, hyvässä kunnossa. Kypärä mukana, vakuutus omasta.",
		images: [LINEUP, R6, TANK],
	},
	{
		title: "Kawasaki Z650 — kevyt naked",
		makeSlug: "kawasaki",
		year: 2022,
		engine_cc: 649,
		required_license: "A2",
		motorcycle_type: "naked",
		price_per_day: 65,
		price_per_week: 380,
		city: "Turku",
		region: "varsinais-suomi",
		description: "Loistava arkikäyttöön ja kaupunkiajoon. A2-rajoitettu.",
		images: [TANK, FERRY],
	},
	{
		title: "Suzuki SV650 — kaupunkiajon klassikko",
		makeSlug: "suzuki",
		year: 2019,
		engine_cc: 645,
		required_license: "A2",
		motorcycle_type: "naked",
		price_per_day: 55,
		price_per_week: 320,
		city: "Espoo",
		region: "uusimaa",
		description: "Helppo ja luotettava. Sopii myös vasta-alkajalle (A2-luokka).",
		images: [FERRY, LINEUP, R6],
	},
	{
		title: "BMW R 1250 RT — pitkien matkojen kuningas",
		makeSlug: "bmw",
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
		makeSlug: "honda",
		year: 2017,
		engine_cc: 1832,
		required_license: "A",
		motorcycle_type: "touring",
		price_per_day: 165,
		price_per_week: 990,
		city: "Oulu",
		region: "pohjois-pohjanmaa",
		description: "Mukavin tapa kierrellä Lappia. Audio, GPS, lämpenevät kahvat ja istuin.",
		images: [FERRY, TANK, LINEUP],
	},
	{
		title: "KTM 890 Adventure — soraa ja asfalttia",
		makeSlug: "ktm",
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
		images: [LINEUP, FERRY, R6],
	},
	{
		title: "Triumph Tiger 900 GT",
		makeSlug: "triumph",
		year: 2020,
		engine_cc: 888,
		required_license: "A",
		motorcycle_type: "adventure",
		price_per_day: 120,
		price_per_week: 700,
		city: "Tampere",
		region: "pirkanmaa",
		description: "Mukava ja ketterä adventure-pyörä. Sivulaukut ja topcase mukana.",
		images: [FERRY, R6],
	},
	{
		title: "Harley-Davidson Iron 883 — klassinen cruiseri",
		makeSlug: "harley-davidson",
		year: 2019,
		engine_cc: 883,
		required_license: "A2",
		motorcycle_type: "cruiser",
		price_per_day: 95,
		price_per_week: 580,
		city: "Helsinki",
		region: "uusimaa",
		description: "Mustan klassinen H-D. Sopii Helsinki–Hanko-reissuille kesäisin.",
		images: [TANK, LINEUP, FERRY],
	},
	{
		title: "Yamaha MT-125 — A1-luokan arkipyörä",
		makeSlug: "yamaha",
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

	// 2. Wipe and re-seed makes/models
	console.log("Seeding makes and models...");
	await db.deleteFrom("listing_image").execute();
	await db.deleteFrom("listing").execute();
	await db.deleteFrom("motorcycle_model").execute();
	await db.deleteFrom("motorcycle_make").execute();

	const insertedMakes = await db
		.insertInto("motorcycle_make")
		.values(MAKES_SEED.map((m) => ({ id: crypto.randomUUID(), ...m })))
		.returningAll()
		.execute();

	const makeBySlug = Object.fromEntries(insertedMakes.map((m) => [m.slug, m]));

	const modelValues = MODELS_SEED.flatMap(({ makeSlug, models }) => {
		const make = makeBySlug[makeSlug];
		if (!make) {
			return [];
		}
		return models.map((name) => ({
			id: crypto.randomUUID(),
			make_id: make.id,
			name,
		}));
	});

	await db.insertInto("motorcycle_model").values(modelValues).execute();

	// 3. Create user via BetterAuth (handles password hashing + account row)
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

	// 4. Profile
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

	// 5. Listings + images
	console.log(`Creating ${listings.length} listings...`);
	const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

	for (const seed of listings) {
		const id = crypto.randomUUID();
		const make = makeBySlug[seed.makeSlug];
		if (!make) {
			throw new Error(`Unknown make slug: ${seed.makeSlug}`);
		}

		await db
			.insertInto("listing")
			.values({
				id,
				short_id: crypto.randomUUID().slice(0, 8),
				owner_id: userId,
				category: "rental",
				title: seed.title,
				make_id: make.id,
				model_id: null,
				year: seed.year,
				engine_cc: seed.engine_cc,
				required_license: seed.required_license,
				motorcycle_type: seed.motorcycle_type,
				city: seed.city,
				region: seed.region,
				postal_code: null,
				description: seed.description,
				status: seed.status,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		await db
			.insertInto("listing_rental")
			.values({
				listing_id: id,
				price_per_day: seed.price_per_day * 100,
				price_per_week: seed.price_per_week ? seed.price_per_week * 100 : null,
				price_description: null,
				mileage_limit: null,
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

	// 6. Tori items (now gear/part listings)
	console.log("Creating gear/part listings...");

	const toriItems: Array<{
		title: string;
		category: "gear" | "parts" | "tools";
		condition: "new" | "excellent" | "good" | "fair";
		price_cents: number;
		city: string;
		region: string;
		description: string;
		status?: "active" | "removed";
	}> = [
		{
			title: "Alpinestars GP Plus -nahkatakki, koko 52",
			category: "gear",
			condition: "excellent",
			price_cents: 28000,
			city: "Helsinki",
			region: "uusimaa",
			description:
				"Käytetty yhden kauden, ei kaatumisia. CE-suojat hartioissa, kyynärpäissä ja selässä. Koko 52 (L).",
		},
		{
			title: "Shoei NXR2 -kypärä, musta matta M",
			category: "gear",
			condition: "good",
			price_cents: 22000,
			city: "Tampere",
			region: "pirkanmaa",
			description: "Kaksi kautta käytetty, hyväkuntoinen. Pinlock-kalvo mukana. Koko M (57-58cm).",
		},
		{
			title: "Kawasaki Z650 alkuperäinen pakoputki",
			category: "parts",
			condition: "good",
			price_cents: 8000,
			city: "Turku",
			region: "varsinais-suomi",
			description:
				"Alkuperäinen pakoputki vm. 2021 Z650:sta. Vaihdettu Akrapoviciin, tämä jäi yli.",
		},
		{
			title: "Oxford Kriega US-20 -tankkilaukku",
			category: "parts",
			condition: "new",
			price_cents: 9500,
			city: "Espoo",
			region: "uusimaa",
			description: "Uusi, avaamaton pakkaus. 20 litran tankkilaukku magneettikiinnityksellä.",
		},
		{
			title: "Rev'it Sand 4 -ajohousut, koko L",
			category: "gear",
			condition: "fair",
			price_cents: 12000,
			city: "Oulu",
			region: "pohjois-pohjanmaa",
			description:
				"Adventure-housut, käytetty kolme kautta. Pieni repeämä vasemmassa polvessa korjattu. CE-suojat tallella.",
		},
		{
			title: "Moottoripyörän pesuvälineet -setti",
			category: "tools",
			condition: "new",
			price_cents: 3500,
			city: "Jyväskylä",
			region: "keski-suomi",
			description:
				"S100-ketjurasva, Muc-Off-pesuaine, ketjuharja ja mikrokuituliina. Kaikki käyttämättömiä.",
		},
		{
			title: "Dainese Axial D1 -saappaat, koko 43",
			category: "gear",
			condition: "excellent",
			price_cents: 35000,
			city: "Helsinki",
			region: "uusimaa",
			description: "Ratakäyttöön ostetut, käytetty 3 ratapäivää. Magnesiumliukurit ehjät.",
			status: "removed",
		},
		{
			title: "Paddock-teline, etu + taka",
			category: "tools",
			condition: "good",
			price_cents: 6000,
			city: "Lahti",
			region: "paijat-hame",
			description: "Constands-merkkiset paddock-telineet. Sopii useimpiin naked/sport-pyöriin.",
		},
	];

	for (const item of toriItems) {
		const id = crypto.randomUUID();
		const listingCategory = item.category === "gear" ? "gear" : "part";
		await db
			.insertInto("listing")
			.values({
				id,
				short_id: crypto.randomUUID().slice(0, 8),
				owner_id: userId,
				category: listingCategory,
				title: item.title,
				description: item.description,
				city: item.city,
				region: item.region,
				postal_code: null,
				status: item.status ?? "active",
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		if (listingCategory === "gear") {
			await db
				.insertInto("listing_gear")
				.values({
					listing_id: id,
					gear_type: "other",
					condition: item.condition,
					price: item.price_cents,
				})
				.execute();
		} else {
			await db
				.insertInto("listing_part")
				.values({
					listing_id: id,
					part_category: item.category,
					condition: item.condition,
					price: item.price_cents,
				})
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
