import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

// ─── BetterAuth tables ────────────────────────────────────────────────────────
// Column names are camelCase — BetterAuth's externally-dictated convention.
// Timestamps typed as ColumnType<Date, Date, Date> — the pg driver serialises
// JS Date objects correctly; accepting raw strings would remove type safety.

export interface UserTable {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: Generated<string>;
	banned: Generated<boolean>;
	banReason: string | null;
	banExpires: ColumnType<Date, Date, Date> | null;
	createdAt: ColumnType<Date, Date, Date>;
	updatedAt: ColumnType<Date, Date, Date>;
}

export interface SessionTable {
	id: string;
	expiresAt: ColumnType<Date, Date, Date>;
	token: string;
	createdAt: ColumnType<Date, Date, Date>;
	updatedAt: ColumnType<Date, Date, Date>;
	ipAddress: string | null;
	userAgent: string | null;
	userId: string;
	impersonatedBy: string | null;
}

export interface AccountTable {
	id: string;
	accountId: string;
	providerId: string;
	userId: string;
	accessToken: string | null;
	refreshToken: string | null;
	idToken: string | null;
	accessTokenExpiresAt: ColumnType<Date, Date, Date> | null;
	refreshTokenExpiresAt: ColumnType<Date, Date, Date> | null;
	scope: string | null;
	password: string | null;
	createdAt: ColumnType<Date, Date, Date>;
	updatedAt: ColumnType<Date, Date, Date>;
}

export interface VerificationTable {
	id: string;
	identifier: string;
	value: string;
	expiresAt: ColumnType<Date, Date, Date>;
	createdAt: ColumnType<Date, Date, Date> | null;
	updatedAt: ColumnType<Date, Date, Date> | null;
}

export type DbUser = Selectable<UserTable>;
export type DbSession = Selectable<SessionTable>;
export type DbAccount = Selectable<AccountTable>;
export type DbVerification = Selectable<VerificationTable>;

// ─── App tables ───────────────────────────────────────────────────────────────
// Column names are snake_case — idiomatic PostgreSQL for app-owned tables.
// updated_at: defaultTo(now()) fires only on INSERT. Every UPDATE query must
// explicitly set updated_at = new Date() in application code.

export interface ProfileTable {
	user_id: string;
	display_name: string;
	city: string | null;
	phone: string | null;
	show_phone: Generated<boolean>; // DB default false — omit on insert to use default
	license_class: "A1" | "A2" | "A" | null;
	language: "fi" | "en";
	account_type: Generated<"private" | "business">;
	business_name: string | null;
	terms_accepted_at: ColumnType<Date, Date | undefined, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Profile = Selectable<ProfileTable>;
export type NewProfile = Insertable<ProfileTable>;
export type ProfileUpdate = Updateable<ProfileTable>;

export interface MotorcycleMakeTable {
	id: string;
	name: string;
	slug: string;
	approved: Generated<boolean>;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export interface MotorcycleModelTable {
	id: string;
	make_id: string;
	name: string;
	approved: Generated<boolean>;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type MotorcycleMake = Selectable<MotorcycleMakeTable>;
export type MotorcycleModel = Selectable<MotorcycleModelTable>;

export type ListingCategory = "sale" | "rental" | "gear" | "part";

export interface ListingTable {
	id: string;
	owner_id: string;
	short_id: string;
	category: ListingCategory;
	title: string;
	make_id: string | null;
	model_id: string | null;
	year: number | null;
	engine_cc: number | null;
	required_license: "A1" | "A2" | "A" | null;
	motorcycle_type: string | null;
	city: string;
	region: string;
	postal_code: string | null;
	description: string;
	status: Generated<"active" | "paused" | "rented" | "removed" | "expired">;
	view_count: Generated<number>;
	expires_at: ColumnType<Date, Date | undefined, Date> | null;
	expiry_notified_at: ColumnType<Date, Date | undefined, Date> | null;
	search_vector: Generated<string>; // tsvector, maintained by trigger
	reviewed_at: ColumnType<Date, Date | undefined, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Listing = Selectable<ListingTable>;
export type NewListing = Insertable<ListingTable>;
export type ListingUpdate = Updateable<ListingTable>;

export interface ListingImageTable {
	id: string;
	listing_id: string;
	url: string;
	thumbnail_url: string | null;
	order: Generated<number>;
}

export type ListingImage = Selectable<ListingImageTable>;
export type NewListingImage = Insertable<ListingImageTable>;

export interface ListingRentalTable {
	listing_id: string;
	price_per_day: number; // EUR cents
	price_per_week: number | null;
	price_per_weekend: number | null;
	price_description: string | null;
	mileage_limit: number | null;
	availability_default: Generated<"open" | "closed">;
}

export type ListingRental = Selectable<ListingRentalTable>;
export type NewListingRental = Insertable<ListingRentalTable>;
export type ListingRentalUpdate = Updateable<ListingRentalTable>;

export interface ListingSaleTable {
	listing_id: string;
	price: number; // EUR cents
	condition: "new" | "excellent" | "good" | "fair" | "poor";
	km_driven: number | null;
	negotiable: Generated<boolean>;
}

export type ListingSale = Selectable<ListingSaleTable>;
export type NewListingSale = Insertable<ListingSaleTable>;
export type ListingSaleUpdate = Updateable<ListingSaleTable>;

export type GearType = "helmet" | "jacket" | "pants" | "boots" | "gloves" | "other";

export interface ListingGearTable {
	listing_id: string;
	gear_type: GearType;
	size: string | null;
	condition: "new" | "excellent" | "good" | "fair" | "poor";
	price: number; // EUR cents
}

export type ListingGear = Selectable<ListingGearTable>;
export type NewListingGear = Insertable<ListingGearTable>;
export type ListingGearUpdate = Updateable<ListingGearTable>;

export interface ListingPartTable {
	listing_id: string;
	part_category: string;
	compatible_make_id: string | null;
	compatible_model_id: string | null;
	condition: "new" | "excellent" | "good" | "fair" | "poor";
	price: number; // EUR cents
}

export type ListingPart = Selectable<ListingPartTable>;
export type NewListingPart = Insertable<ListingPartTable>;
export type ListingPartUpdate = Updateable<ListingPartTable>;

export interface FavoriteTable {
	user_id: string;
	listing_id: string;
	created_at: ColumnType<Date, Date | undefined, never>;
}

export type Favorite = Selectable<FavoriteTable>;

export interface ReportTable {
	id: string;
	reporter_id: string;
	target_type: "listing" | "user";
	target_id: string;
	reason: string;
	status: Generated<"pending" | "resolved" | "dismissed">;
	admin_note: string | null;
	resolved_by: string | null;
	resolved_at: ColumnType<Date, Date, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type Report = Selectable<ReportTable>;
export type NewReport = Insertable<ReportTable>;

export type BookingStatus = "pending" | "confirmed" | "rejected" | "expired" | "cancelled";

export interface BookingTable {
	id: Generated<string>;
	short_id: string;
	listing_id: string;
	renter_user_id: string;
	// `date` columns: pg returns Date by default. We use string YYYY-MM-DD on the wire
	// for clarity (no TZ confusion). When selecting, cast with `sql<string>` (see bookings.ts).
	start_date: string;
	end_date: string;
	message: string;
	status: Generated<BookingStatus>;
	rejection_reason: string | null;
	responded_at: ColumnType<Date, Date | undefined, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Booking = Selectable<BookingTable>;
export type NewBooking = Insertable<BookingTable>;
export type BookingUpdate = Updateable<BookingTable>;

export interface ListingAvailabilityExceptionTable {
	listing_id: string;
	date: string; // YYYY-MM-DD, see note on BookingTable
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type ListingAvailabilityException = Selectable<ListingAvailabilityExceptionTable>;
export type NewListingAvailabilityException = Insertable<ListingAvailabilityExceptionTable>;

export interface ReviewTable {
	id: Generated<string>;
	booking_id: string;
	reviewer_id: string;
	target_user_id: string;
	rating: number;
	comment: string | null;
	created_at: ColumnType<Date, Date | undefined, never>;
}

export type Review = Selectable<ReviewTable>;
export type NewReview = Insertable<ReviewTable>;

// ─── Database interface ───────────────────────────────────────────────────────

export interface Database {
	user: UserTable;
	session: SessionTable;
	account: AccountTable;
	verification: VerificationTable;
	profile: ProfileTable;
	motorcycle_make: MotorcycleMakeTable;
	motorcycle_model: MotorcycleModelTable;
	listing: ListingTable;
	listing_image: ListingImageTable;
	listing_rental: ListingRentalTable;
	listing_sale: ListingSaleTable;
	listing_gear: ListingGearTable;
	listing_part: ListingPartTable;
	favorite: FavoriteTable;
	report: ReportTable;
	booking: BookingTable;
	listing_availability_exception: ListingAvailabilityExceptionTable;
	review: ReviewTable;
}
