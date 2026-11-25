// src/routes/pyorat/vuokraus/$listingId_.$slug.tsx
// $slug is decorative — only $listingId (the short_id) is used for DB lookup.

import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingAmount } from "~/components/listings/booking-amount";
import { BookingCalendar, useDesktopCalendar } from "~/components/listings/booking-calendar";
import { BookingPricing } from "~/components/listings/booking-pricing";
import { BookingRequestForm } from "~/components/listings/booking-request-form";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { MessageSellerButton } from "~/components/listings/message-seller-button";
import { OwnerActions } from "~/components/listings/non-rental-sidebar";
import { RentalPriceLadder } from "~/components/listings/rental-price-ladder";
import { useBookingMotion } from "~/components/listings/use-booking-motion";
import { MobileFullscreenModal } from "~/components/ui/mobile-fullscreen-modal";
import { computeBookingCost } from "~/lib/bookings";
import { createBookingRequest } from "~/lib/bookings.server";
import {
	availableSelection,
	blockedDays,
	computeNewRange,
	type RentalSearch,
	toIso,
} from "~/lib/calendar-helpers";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { handleAppError, parseAppError } from "~/lib/errors-client";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getListingAvailability, getListingForDisplay, recordView } from "~/lib/listings-detail";
import { protectedMutation } from "~/lib/middleware";
import { getReviewSummaryForUser } from "~/lib/reviews.server";
import { getSession, requireSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import { bookingRequestSchema } from "~/lib/validators";
import { z } from "~/lib/zod";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((shortId: unknown) => z.string().min(1).max(20).parse(shortId))
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		const result = await getListingForDisplay(shortId);
		if (result?.listing.category !== "rental") {
			return null;
		}

		const request = getRequest();
		const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		recordView(shortId, session?.user.id, ip);

		const ownerReviewSummary = await getReviewSummaryForUser(result.listing.owner_id);

		return { ...result, ownerReviewSummary, today: toIso(new Date()) };
	});

export const submitBookingRequest = createServerFn({ method: "POST" })
	.middleware(protectedMutation("submit-booking", 5, 300))
	.inputValidator((data: unknown) => bookingRequestSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSession();

		return createBookingRequest({
			listingId: data.listing_id,
			startDate: data.start_date,
			endDate: data.end_date,
			message: data.message,
			userId: session.user.id,
			userEmail: session.user.email,
		});
	});

export const Route = createFileRoute("/pyorat/vuokraus/$listingId_/$slug")({
	validateSearch: z.object({
		from: z.iso.date().optional().catch(undefined),
		to: z.iso.date().optional().catch(undefined),
		step: z.literal("request").optional().catch(undefined),
	}),
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getListing({ data: params.listingId }),
			getSession(),
		]);
		if (!result) {
			throw notFound();
		}
		const availability = await getListingAvailability({ data: result.listing.id });
		return { ...result, session, availability };
	},
	head: ({ loaderData }) => {
		const l = loaderData?.listing;
		if (!l) {
			return {};
		}
		const make = loaderData?.makeName ?? "";
		const model = loaderData?.modelName ?? "";
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Vuokraa ${make} ${model} (${l.year}) — ${l.city}. Alkaen ${centsToEuros(loaderData?.rental?.price_per_day ?? 0).toFixed(0)} €/pv.`;
		const slug = computeListingSlug(
			loaderData?.makeSlug ?? null,
			loaderData?.modelName ?? null,
			l.city,
		);
		const url = `${SITE_URL}/pyorat/vuokraus/${l.short_id}/${slug}`;
		return {
			meta: [
				{ title },
				{ name: "description", content: desc },
				{ property: "og:title", content: title },
				{ property: "og:description", content: desc },
				{ property: "og:url", content: url },
			],
			links: [{ rel: "canonical", href: url }],
		};
	},
	component: ListingDetailPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div
				data-testid="listing-not-found"
				className="flex min-h-screen flex-col items-center justify-center gap-4"
			>
				<h1 className="font-heading text-2xl font-bold text-foreground">{t("detail.notFound")}</h1>
				<Link to="/" className="text-sm text-foreground underline">
					{t("detail.notFoundBack")}
				</Link>
			</div>
		);
	},
});

const primary =
	"inline-flex min-h-11 items-center justify-center rounded-full bg-reflector px-5 text-sm font-semibold text-foreground hover:bg-reflector-press";
const outline =
	"inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-card px-4 text-sm font-semibold hover:bg-muted-light";

function ListingDetailPage() {
	const data = Route.useLoaderData();
	const owner = data.session?.user.id === data.listing.owner_id;
	if (owner || data.listing.status !== "active" || !data.rental) {
		return (
			<ListingDetailShell
				data={data}
				session={data.session}
				backTo="/pyorat/vuokraus"
				rentalLadder={data.rental ? <RentalPriceLadder rental={data.rental} cost={null} /> : null}
				sidebar={owner ? <OwnerActions listingShortId={data.listing.short_id} /> : null}
			/>
		);
	}
	return <RentalPage key={data.listing.id} data={data} rental={data.rental} />;
}

function RentalPage({
	data,
	rental,
}: {
	data: ReturnType<typeof Route.useLoaderData>;
	rental: NonNullable<ReturnType<typeof Route.useLoaderData>["rental"]>;
}) {
	const { listing, session, today } = data;
	const { t } = useTranslation("listings");
	const router = useRouter();
	const navigate = Route.useNavigate();
	const { selection, isBlocked, cost, notice, setNotice, writeRange, choose, panelRef } =
		useBookingDates(data);
	const { from, to } = selection;
	const desktop = useDesktopCalendar();
	const [success, setSuccess] = useState(false);
	const successRef = useRef<HTMLDivElement>(null);
	const pushed = useRef(false);
	useEffect(() => {
		if (success) {
			successRef.current?.focus();
		}
	}, [success]);
	async function submit(message: string) {
		if (!from || !to) {
			return;
		}
		try {
			await submitBookingRequest({
				data: { listing_id: listing.id, start_date: from, end_date: to, message },
			});
			setSuccess(true);
			writeRange({});
			setNotice(null);
		} catch (err) {
			if (parseAppError(err)?.code === "booking.dates_unavailable") {
				setNotice("blocked");
				await navigate({ search: {}, replace: true, state: true, resetScroll: false });
				await router.invalidate();
				return;
			}
			const result = handleAppError(err, t);
			return result?.message;
		}
	}
	const path = router.state.location.pathname;
	const dates = new URLSearchParams();
	if (from) {
		dates.set("from", from);
	}
	if (to) {
		dates.set("to", to);
	}
	const login = (
		<Link
			to="/kirjaudu"
			search={{ redirect: dates.size ? `${path}?${dates.toString()}` : path }}
			className={primary}
		>
			{t("booking.loginRequired")}
		</Link>
	);
	const summary = <BookingPricing range={selection} cost={cost} />;
	const form = <BookingRequestForm title={listing.title} ready={!!cost} onSubmit={submit} />;
	function closeRequest() {
		if (pushed.current) {
			pushed.current = false;
			router.history.back();
		} else {
			writeRange({ from, to });
		}
	}
	function proceed() {
		if (!cost) {
			const el = document.getElementById("rental-calendar");
			el?.focus({ preventScroll: true });
			el?.scrollIntoView({ block: "start" });
			return;
		}
		pushed.current = true;
		void navigate({ search: { from, to, step: "request" }, state: true, resetScroll: false });
	}
	const sidebar = success ? (
		<div
			data-testid="booking-success"
			ref={successRef}
			tabIndex={-1}
			role="status"
			className="grid gap-3 rounded-lg border border-border bg-card p-4"
		>
			<h2 className="font-heading text-xl font-bold">{t("booking.successTitle")}</h2>
			<span className="w-fit rounded-full bg-muted-light px-3 py-1 text-sm">
				{t("booking.pending")}
			</span>
			<Link to="/omat/varaukset" className={outline}>
				{t("booking.myBookings")}
			</Link>
			<button type="button" className="min-h-11 underline" onClick={() => setSuccess(false)}>
				{t("booking.backToListing")}
			</button>
		</div>
	) : (
		<div ref={panelRef} data-testid="booking-section" className="mt-7 grid gap-4 min-[900px]:mt-0">
			<BookingCalendar
				today={today}
				range={selection}
				isBlocked={isBlocked}
				onDay={choose}
				onClear={() => {
					writeRange({});
					setNotice(null);
				}}
			/>
			{!!notice && (
				<p role="status" className="text-sm font-medium text-destructive">
					{t(notice === "blocked" ? "booking.blocked" : "booking.calendar.maxStayError")}
				</p>
			)}
			{summary}
			{desktop && (session ? form : login)}
			{!!session && <MessageSellerButton listingId={listing.id} className={outline} />}
			{!desktop && (
				<MobileBookingBar
					cost={cost}
					rental={rental}
					loggedIn={!!session}
					login={login}
					onClick={proceed}
				/>
			)}
			<MobileFullscreenModal
				open={!desktop && !!session && !!cost && selection.step === "request"}
				onClose={closeRequest}
				title={t("booking.requestTitle")}
			>
				<div className="grid gap-4">
					{summary}
					{form}
				</div>
			</MobileFullscreenModal>
		</div>
	);
	return (
		<ListingDetailShell
			data={data}
			session={session}
			backTo="/pyorat/vuokraus"
			sidebar={sidebar}
			rentalLadder={<RentalPriceLadder rental={rental} cost={cost} />}
		/>
	);
}

function useBookingDates({ availability, today, rental }: ReturnType<typeof Route.useLoaderData>) {
	const router = useRouter();
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const isBlocked = useMemo(() => blockedDays(availability), [availability]);
	const selection = availableSelection(search, today, isBlocked);
	const { from, to } = selection;
	const cost =
		from && to && rental
			? computeBookingCost(
					from,
					to,
					rental.price_per_day,
					rental.price_per_week,
					rental.price_per_weekend,
				)
			: null;
	const [notice, setNotice] = useState<"blocked" | "clamped" | null>(null);
	useEffect(() => {
		if (search.from !== from || search.to !== to || search.step !== selection.step) {
			void navigate({
				search: { from, to, step: selection.step },
				replace: true,
				state: true,
				resetScroll: false,
			});
		}
	}, [search.from, search.to, search.step, from, to, selection.step, navigate]);
	const panelRef = useRef<HTMLDivElement>(null);
	const markMotion = useBookingMotion(selection, cost, rental?.price_per_day ?? 0, panelRef);
	function writeRange(next: RentalSearch) {
		void navigate({ search: next, replace: true, state: true, resetScroll: false });
	}
	function choose(iso: string) {
		if (isBlocked(iso)) {
			return;
		}
		const current = availableSelection(router.latestLocation.search, today, isBlocked);
		if (!current.from || current.to) {
			setNotice(null);
			writeRange({ from: iso });
			return;
		}
		const range = computeNewRange(iso, current.from, isBlocked);
		setNotice(range.to === null ? "blocked" : range.clamped ? "clamped" : null);
		const next = { from: range.from, to: range.to ?? undefined };
		markMotion(next);
		writeRange(next);
	}
	return { selection, isBlocked, cost, notice, setNotice, writeRange, choose, panelRef };
}
function MobileBookingBar({
	cost,
	rental,
	loggedIn,
	login,
	onClick,
}: {
	cost: ReturnType<typeof computeBookingCost> | null;
	rental: NonNullable<ReturnType<typeof Route.useLoaderData>["rental"]>;
	loggedIn: boolean;
	login: React.ReactNode;
	onClick: () => void;
}) {
	const { t } = useTranslation("listings");
	return (
		<div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-30 flex min-h-(--action-height) items-center justify-between gap-3 border-t border-border bg-card px-4 py-2 min-[900px]:hidden">
			<div className="font-heading font-extrabold tabular-nums">
				{cost ? (
					<>
						{t("booking.total")} <BookingAmount cents={cost.totalCents} />{" "}
						<span className="block text-xs font-medium">
							{t("booking.days", { count: cost.days })}
						</span>
					</>
				) : (
					<>
						{formatEur(rental.price_per_day)} {t("card.perDay")}
					</>
				)}
			</div>
			{cost && !loggedIn ? (
				login
			) : (
				<button
					type="button"
					data-testid="mobile-book-button"
					className={primary}
					onClick={onClick}
				>
					{t(cost ? "booking.continue" : "booking.chooseDates")}
				</button>
			)}
		</div>
	);
}
