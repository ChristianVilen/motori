export default {
	hero: {
		imgAlt: "Rider on Kawasaki Ninja at sunset",
		heading: "A community for riders",
		headingAccent: "",
		subheading:
			"Buy, sell, rent and swap motorcycles, gear and parts directly with other riders.",
		searchPlaceholder: "Search make, model or gear...",
		searchButton: "Search",
		chips: {
			uusimaa: "Uusimaa",
			pirkanmaa: "Pirkanmaa",
			naked: "Naked",
			a2: "A2 licence",
			touring: "Touring",
		},
		statsListings: "listings",
		statsRegions: "regions",
		statsPrice: "from / day",
	},
	categories: {
		heading: "What are you looking for?",
		sale: { label: "Bikes for sale", desc: "Used and new motorcycles" },
		rental: { label: "Rental", desc: "For a day or a weekend" },
		gear: { label: "Gear", desc: "Helmets, jackets, boots and more" },
		parts: { label: "Parts", desc: "Parts straight from other riders" },
	},
	latestListings: {
		heading: "Latest listings",
		browseAll: "Browse all",
		tabs: {
			sale: "For sale",
			rental: "Rental",
			gear: "Gear",
			parts: "Parts",
		},
	},
	cta: {
		heading: "Post a listing",
		body: "A free listing reaches other riders directly.",
		button: "Add listing",
	},
	footer: {
		brand: "Motori",
		sale: "Bikes for sale",
		rental: "Rental",
		gear: "Gear",
		parts: "Parts",
		addListing: "Add listing",
		copyright: "© {{year}} Motori",
	},
} as const;
