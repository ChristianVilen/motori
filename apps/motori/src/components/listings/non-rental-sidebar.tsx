import { Link, useRouterState } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { revealListingPhone } from "~/lib/listings-detail";
import { MessageSellerButton } from "./message-seller-button";

interface NonRentalSidebarProps {
	price: number | undefined;
	listing: Listing;
	isOwner: boolean;
	ownerPhoneVisible: boolean;
	currentUserId?: string;
}

const primary =
	"col-start-3 row-start-1 row-span-2 justify-self-end inline-flex min-h-11 min-w-0 items-center justify-center rounded-full bg-reflector px-4 py-2 text-center text-sm leading-tight font-semibold text-foreground hover:bg-reflector-press min-[900px]:w-full";
const outline =
	"inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-card px-4 text-sm font-semibold hover:bg-muted-light";

export function OwnerActions({ listingShortId }: { listingShortId: string }) {
	const { t } = useTranslation("listings");
	return (
		<div className="mt-5 flex flex-wrap gap-2 min-[900px]:mt-0">
			<Link
				data-testid="listing-edit-link"
				to="/ilmoitukset/$listingId/muokkaa"
				params={{ listingId: listingShortId }}
				className={outline}
			>
				{t("detail.ownerActions.edit")}
			</Link>
			<Link data-testid="listing-owner-profile-link" to="/omat" className={outline}>
				{t("detail.ownerActions.myListings")}
			</Link>
		</div>
	);
}

export function NonRentalSidebar({
	listing,
	isOwner,
	ownerPhoneVisible,
	price,
	currentUserId,
}: NonRentalSidebarProps) {
	const { t } = useTranslation("listings");
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [phone, setPhone] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const telRef = useRef<HTMLAnchorElement>(null);
	useEffect(() => {
		if (phone) {
			telRef.current?.focus({ preventScroll: true });
		}
	}, [phone]);
	async function reveal() {
		setLoading(true);
		setError(false);
		try {
			const number = await revealListingPhone({ data: listing.id });
			setPhone(number);
			setError(!number);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}
	if (isOwner) {
		return <OwnerActions listingShortId={listing.short_id} />;
	}
	if (listing.status !== "active") {
		return null;
	}
	return (
		<div
			data-testid="listing-contact-actions"
			className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-30 grid min-h-(--action-height) grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 border-t border-border bg-card px-4 py-2 min-[900px]:static min-[900px]:flex min-[900px]:min-h-0 min-[900px]:gap-2 min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:border-0 min-[900px]:p-0"
		>
			<span className="col-start-1 row-start-1 font-heading text-lg font-extrabold tabular-nums min-[900px]:hidden">
				{price != null ? formatEur(price) : null}
			</span>
			{currentUserId ? (
				<MessageSellerButton listingId={listing.id} className={primary} />
			) : (
				<Link
					to="/kirjaudu"
					search={{ redirect: pathname }}
					data-testid="login-to-contact"
					className={primary}
				>
					{t("detail.loginToContact")}
				</Link>
			)}
			{ownerPhoneVisible && !phone && (
				<button
					type="button"
					aria-label={t("detail.revealPhone")}
					disabled={loading}
					onClick={reveal}
					className="col-start-2 row-start-1 justify-self-end inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card hover:bg-muted-light min-[900px]:w-full"
				>
					<Phone size={18} />
					<span className="hidden text-sm font-medium min-[900px]:inline">
						{t("detail.revealPhone")}
					</span>
				</button>
			)}
			{!!phone && (
				<a
					ref={telRef}
					href={`tel:${phone}`}
					className="col-span-2 col-start-1 row-start-2 block break-all text-sm font-medium underline min-[900px]:text-center"
				>
					{phone}
				</a>
			)}
			{!!error && (
				<p
					role="status"
					className="absolute inset-x-0 bottom-full bg-card px-4 py-2 text-sm text-destructive min-[900px]:static"
				>
					{t("detail.phoneUnavailable")}
				</p>
			)}
		</div>
	);
}
