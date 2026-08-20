import { Button } from "@motori/ui/button";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { startConversation } from "~/lib/messages";

export interface NonRentalSidebarProps {
	price: number;
	priceTestId: string;
	negotiable?: boolean;
	statRows: Array<{ label: string; value: ReactNode }>;
	listing: Listing;
	isOwner: boolean;
	ownerPhoneVisible: boolean;
	ownerPhone: string | null;
	currentUserId?: string;
}

export function NonRentalSidebar({
	price,
	priceTestId,
	negotiable = false,
	statRows,
	listing,
	isOwner,
	ownerPhoneVisible,
	ownerPhone,
	currentUserId,
}: NonRentalSidebarProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	async function onMessageSeller() {
		const { conversationId } = await startConversation({ data: { listingId: listing.id } });
		navigate({ to: "/viestit/$conversationId", params: { conversationId } });
	}
	return (
		<div id="pricing" className="space-y-4 lg:self-start">
			<div className="rounded-l border border-border bg-card p-5 shadow-sm">
				<div data-testid="price-info" className="mb-4">
					<span data-testid={priceTestId} className="text-3xl font-bold text-accent">
						{formatEur(price)}
					</span>
					{negotiable ? (
						<span className="ml-2 text-sm text-muted">{t("detail.negotiable")}</span>
					) : null}
				</div>
				{statRows.length > 0 && (
					<dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
						{statRows.map((row) => (
							<div key={row.label}>
								<dt className="text-muted">{row.label}</dt>
								<dd className="font-medium text-foreground">{row.value}</dd>
							</div>
						))}
					</dl>
				)}
				{isOwner ? (
					<OwnerActions listingShortId={listing.short_id} />
				) : listing.status === "active" ? (
					<SellerCta
						isLoggedIn={!!currentUserId}
						redirectPath={pathname}
						ownerPhoneVisible={ownerPhoneVisible}
						ownerPhone={ownerPhone}
						onMessage={onMessageSeller}
					/>
				) : null}
			</div>
		</div>
	);
}

function OwnerActions({ listingShortId }: { listingShortId: string }) {
	const { t } = useTranslation("listings");
	return (
		<div className="flex gap-2">
			<Link
				to="/ilmoitukset/$listingId/muokkaa"
				params={{ listingId: listingShortId }}
				className="flex-1"
			>
				<Button variant="outline" className="w-full" size="sm">
					{t("detail.ownerActions.edit")}
				</Button>
			</Link>
			<Link to="/omat" className="flex-1">
				<Button variant="outline" className="w-full" size="sm">
					{t("detail.ownerActions.myListings")}
				</Button>
			</Link>
		</div>
	);
}

function SellerCta({
	isLoggedIn,
	redirectPath,
	ownerPhoneVisible,
	ownerPhone,
	onMessage,
}: {
	isLoggedIn: boolean;
	redirectPath: string;
	ownerPhoneVisible: boolean;
	ownerPhone: string | null;
	onMessage: () => void;
}) {
	const { t } = useTranslation("listings");
	return (
		<>
			{isLoggedIn ? (
				<button
					type="button"
					onClick={onMessage}
					className="hidden w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover lg:block"
				>
					{t("detail.messageSeller", "Lähetä viesti")}
				</button>
			) : null}
			{!isLoggedIn ? (
				<Link
					to="/kirjaudu"
					search={{ redirect: redirectPath }}
					data-testid="login-to-contact"
					className="hidden w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover lg:block"
				>
					{t("detail.loginToContact")}
				</Link>
			) : null}
			{ownerPhoneVisible && ownerPhone ? (
				<a
					href={`tel:${ownerPhone}`}
					className="block w-full rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent lg:mt-2"
				>
					{ownerPhone}
				</a>
			) : null}
		</>
	);
}
