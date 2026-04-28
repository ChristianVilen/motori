import type { Kysely } from "kysely";

interface MakeRow {
	id: string;
	name: string;
	slug: string;
}
interface MigrationDb {
	motorcycle_make: MakeRow;
	motorcycle_model: { id: string; make_id: string; name: string };
}

const MAKES = [
	{ name: "Aprilia", slug: "aprilia" },
	{ name: "Benelli", slug: "benelli" },
	{ name: "Beta", slug: "beta" },
	{ name: "BMW", slug: "bmw" },
	{ name: "Can-Am", slug: "can-am" },
	{ name: "CFMoto", slug: "cfmoto" },
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
	{ name: "Kymco", slug: "kymco" },
	{ name: "Moto Guzzi", slug: "moto-guzzi" },
	{ name: "MV Agusta", slug: "mv-agusta" },
	{ name: "Royal Enfield", slug: "royal-enfield" },
	{ name: "Sherco", slug: "sherco" },
	{ name: "Suzuki", slug: "suzuki" },
	{ name: "Triumph", slug: "triumph" },
	{ name: "Vespa", slug: "vespa" },
	{ name: "Yamaha", slug: "yamaha" },
	{ name: "Zero", slug: "zero" },
	{ name: "Muu", slug: "muu" },
];

const MODELS: { makeSlug: string; models: string[] }[] = [
	{
		makeSlug: "honda",
		models: [
			"CB125R",
			"CB300R",
			"CB500F",
			"CB500X",
			"CB650R",
			"CB750 Hornet",
			"CB1000R",
			"CBR500R",
			"CBR600RR",
			"CBR650R",
			"CBR1000RR Fireblade",
			"Africa Twin",
			"CRF300L",
			"CRF450L",
			"NC750X",
			"NC750S",
			"XL750 Transalp",
			"Rebel 500",
			"Rebel 1100",
			"Gold Wing",
			"PCX125",
			"SH125",
		],
	},
	{
		makeSlug: "yamaha",
		models: [
			"MT-03",
			"MT-07",
			"MT-09",
			"MT-10",
			"MT-125",
			"YZF-R3",
			"YZF-R7",
			"YZF-R1",
			"Ténéré 700",
			"Super Ténéré",
			"Tracer 7",
			"Tracer 9",
			"XSR700",
			"XSR900",
			"TMAX",
			"XMAX",
			"NMAX",
		],
	},
	{
		makeSlug: "kawasaki",
		models: [
			"Z400",
			"Z650",
			"Z900",
			"Z1000",
			"Z H2",
			"Ninja 400",
			"Ninja 650",
			"Ninja 1000SX",
			"Ninja ZX-6R",
			"Ninja ZX-10R",
			"Ninja H2",
			"Versys 650",
			"Versys 1000",
			"Vulcan S",
			"Vulcan 900",
			"W800",
		],
	},
	{
		makeSlug: "bmw",
		models: [
			"G 310 R",
			"G 310 GS",
			"F 750 GS",
			"F 850 GS",
			"F 900 R",
			"F 900 XR",
			"R nineT",
			"R nineT Scrambler",
			"R 1250 GS",
			"R 1250 GS Adventure",
			"R 1250 R",
			"R 1250 RS",
			"R 1250 RT",
			"S 1000 R",
			"S 1000 RR",
			"S 1000 XR",
			"M 1000 RR",
			"C 400 X",
			"C 400 GT",
		],
	},
	{
		makeSlug: "ktm",
		models: [
			"Duke 125",
			"Duke 390",
			"Duke 790",
			"Duke 890",
			"Duke 1290",
			"RC 390",
			"390 Adventure",
			"790 Adventure",
			"890 Adventure",
			"1090 Adventure",
			"1290 Super Adventure",
			"350 EXC-F",
			"500 EXC-F",
		],
	},
	{
		makeSlug: "suzuki",
		models: [
			"GSX-S125",
			"GSX-S750",
			"GSX-S950",
			"GSX-S1000",
			"GSX-R600",
			"GSX-R750",
			"GSX-R1000",
			"Hayabusa",
			"SV650",
			"V-Strom 250",
			"V-Strom 650",
			"V-Strom 1050",
			"Burgman 400",
		],
	},
	{
		makeSlug: "harley-davidson",
		models: [
			"Iron 883",
			"Iron 1200",
			"Forty-Eight",
			"Sportster S",
			"Fat Boy",
			"Fat Bob",
			"Street Glide",
			"Street Glide Special",
			"Road Glide",
			"Softail Standard",
			"Heritage Classic",
			"Low Rider S",
			"Pan America 1250",
		],
	},
	{
		makeSlug: "ducati",
		models: [
			"Monster",
			"Monster SP",
			"Panigale V2",
			"Panigale V4",
			"Panigale V4S",
			"Multistrada V2",
			"Multistrada V4",
			"Diavel V4",
			"Scrambler Icon",
			"Scrambler Desert Sled",
			"Supersport 950",
			"Hypermotard 698",
		],
	},
	{
		makeSlug: "triumph",
		models: [
			"Trident 660",
			"Street Triple R",
			"Street Triple RS",
			"Speed Twin 900",
			"Speed Twin 1200",
			"Bonneville T100",
			"Bonneville T120",
			"Scrambler 400X",
			"Scrambler 1200",
			"Tiger 660",
			"Tiger 900",
			"Tiger 1200",
			"Rocket 3",
		],
	},
	{
		makeSlug: "aprilia",
		models: ["RS 125", "RS 660", "Tuono 660", "Tuono V4", "RSV4", "Shiver 900", "Dorsoduro 900"],
	},
	{
		makeSlug: "royal-enfield",
		models: [
			"Meteor 350",
			"Classic 350",
			"Himalayan",
			"Interceptor 650",
			"Continental GT 650",
			"Hunter 350",
			"Scram 411",
		],
	},
	{
		makeSlug: "husqvarna",
		models: [
			"Svartpilen 125",
			"Svartpilen 401",
			"Svartpilen 701",
			"Vitpilen 401",
			"Vitpilen 701",
			"Norden 901",
		],
	},
	{
		makeSlug: "zero",
		models: [
			"Zero S",
			"Zero SR",
			"Zero SR/F",
			"Zero SR/S",
			"Zero DS",
			"Zero DSR",
			"Zero DSR/X",
			"Zero FX",
			"Zero FXE",
		],
	},
	{
		makeSlug: "indian",
		models: [
			"Scout",
			"Scout Bobber",
			"Scout Sixty",
			"Chief",
			"Chief Dark Horse",
			"Springfield",
			"FTR 1200",
			"Pursuit",
		],
	},
	{
		makeSlug: "moto-guzzi",
		models: ["V7", "V7 Stone", "V9 Bobber", "V9 Roamer", "V100 Mandello", "Stelvio"],
	},
	{
		makeSlug: "can-am",
		models: ["Ryker", "Ryker Rally", "Spyder F3", "Spyder RT"],
	},
	{
		makeSlug: "energica",
		models: ["Ego", "Ego+", "Eva Ribelle", "Experia"],
	},
	{
		makeSlug: "beta",
		models: ["RR 125", "RR 200", "RR 250", "RR 300", "RR 350", "RR 430", "RR 480"],
	},
	{
		makeSlug: "gasgas",
		models: ["EC 250", "EC 300", "EC 350F", "MC 250F", "MC 350F", "MC 450F", "ES 700"],
	},
	{
		makeSlug: "husaberg",
		models: ["FE 350", "FE 450", "FE 501", "TE 150", "TE 250", "TE 300"],
	},
	{
		makeSlug: "sherco",
		models: ["SE 125", "SE 250", "SE 300", "SEF 250", "SEF 300", "SEF 450"],
	},
	{
		makeSlug: "cfmoto",
		models: ["300NK", "400NK", "650NK", "650MT", "700CL-X", "800MT", "1000NS"],
	},
	{
		makeSlug: "mv-agusta",
		models: ["Brutale 800", "Brutale 1000", "F3 800", "F4", "Dragster 800", "Superveloce 800"],
	},
	{
		makeSlug: "benelli",
		models: ["TNT 125", "TNT 300", "TNT 502S", "Leoncino 500", "TRK 502", "TRK 702"],
	},
	{
		makeSlug: "kymco",
		models: ["AK 550", "Downtown 350i", "Like 125", "People S 300i"],
	},
	{
		makeSlug: "vespa",
		models: ["Primavera 125", "Sprint 125", "GTS 125", "GTS 300", "GTV 300"],
	},
];

export async function up(db: Kysely<unknown>): Promise<void> {
	const mdb = db as Kysely<MigrationDb>;

	// Skip if already populated — supports re-running on a db that had seed data manually inserted
	const existing = await mdb.selectFrom("motorcycle_make").select("id").limit(1).executeTakeFirst();
	if (existing) {
		return;
	}

	const insertedMakes = await mdb
		.insertInto("motorcycle_make")
		.values(MAKES.map((m) => ({ id: crypto.randomUUID(), ...m })))
		.returningAll()
		.execute();

	const makeBySlug = Object.fromEntries(insertedMakes.map((m) => [m.slug, m]));

	const modelValues = MODELS.flatMap(({ makeSlug, models }) => {
		const make = makeBySlug[makeSlug];
		if (!make) {
			return [];
		}
		return models.map((name) => ({ id: crypto.randomUUID(), make_id: make.id, name }));
	});

	await mdb.insertInto("motorcycle_model").values(modelValues).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	const mdb = db as Kysely<MigrationDb>;
	await mdb.deleteFrom("motorcycle_model").execute();
	await mdb.deleteFrom("motorcycle_make").execute();
}
