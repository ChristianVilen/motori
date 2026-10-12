import { Button } from "@motori/ui/button";
import { cn } from "@motori/ui/cn";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClientOnly } from "~/components/client-only";
import { ContractDocument } from "~/components/sale-contract/document";
import { ContractForm } from "~/components/sale-contract/form";
import { SITE_URL } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import fiContract from "~/lib/i18n/resources/fi/contract";
import {
	createContract,
	draftKey,
	normalizeListingQuery,
	readDraft,
	type SalePrefill,
	saveDraft,
} from "~/lib/sale-contract";
import { getContractPrefill } from "~/lib/sale-contract-prefill";
import "~/styles/sale-contract.css";

const TRAFICOM_LINKS = {
	seller:
		"https://traficom.fi/fi/autoilijat/ajoneuvon-osto-ja-myynti/myyja-tee-ajoneuvolle-luovutusilmoitus",
	buyer:
		"https://traficom.fi/fi/autoilijat/ajoneuvon-osto-ja-myynti/ostaja-tee-ajoneuvon-omistajanvaihdos-luovutusilmoituksen-perusteella",
	checklist:
		"https://www.traficom.fi/sites/default/files/media/publication/Traficom_Ostajan_ja_Myyjan_Muistilista%20(5).pdf",
	officialForm: "https://lomakkeet.traficom.fi/B124",
};

export const Route = createFileRoute("/kauppakirja")({
	validateSearch: (search: Record<string, unknown>): { ilmoitus?: string } => {
		const ilmoitus = normalizeListingQuery(search.ilmoitus);
		return ilmoitus ? { ilmoitus } : {};
	},
	loaderDeps: ({ search }) => ({ ilmoitus: search.ilmoitus }),
	loader: ({ deps }) => getContractPrefill({ data: deps.ilmoitus }),
	head: () => ({
		meta: [
			{ title: fiContract.seoTitle },
			{ name: "description", content: fiContract.description },
			{ property: "og:title", content: fiContract.seoTitle },
			{ property: "og:description", content: fiContract.description },
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: `${SITE_URL}/kauppakirja` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/kauppakirja` }],
	}),
	component: ContractPage,
});

function ContractPage() {
	const { t } = useTranslation("contract");
	const { ilmoitus } = Route.useSearch();
	const prefill = Route.useLoaderData();
	const storageKey = draftKey(ilmoitus);

	return (
		<div className="mx-auto max-w-5xl px-4 py-8 md:py-12 print:m-0 print:max-w-none print:p-0">
			<div className="print:hidden">
				<h1 className="font-heading text-3xl font-bold md:text-4xl">{t("title")}</h1>
				<p className="mt-3 max-w-2xl text-muted">{t("intro")}</p>
				<p className="mt-4 text-sm font-medium">{t("privacy")}</p>
				<p className="mt-1 text-sm text-muted">{t("storageHint")}</p>
			</div>

			<ClientOnly fallback={<div className="min-h-screen" />}>
				<ContractEditor key={storageKey} storageKey={storageKey} prefill={prefill} />
			</ClientOnly>

			<SaleSteps />
		</div>
	);
}

function ContractEditor({
	storageKey,
	prefill,
}: {
	storageKey: string;
	prefill: SalePrefill | null;
}) {
	const { t } = useTranslation("contract");
	const [draft, setDraft] = useState(() => readDraft(storageKey) ?? createContract(prefill));
	const [step, setStep] = useState<"edit" | "preview">("edit");

	useEffect(() => {
		saveDraft(storageKey, draft);
	}, [draft, storageKey]);

	function clear() {
		// The save effect stores this blank draft, so a reload does not bring back the listing values.
		setDraft(createContract(null));
		setStep("edit");
	}

	return (
		<>
			<ol className="mt-6 mb-8 flex gap-6 text-sm print:hidden" aria-label={t("title")}>
				<li aria-current={step === "edit" ? "step" : undefined}>1. {t("fill")}</li>
				<li aria-current={step === "preview" ? "step" : undefined}>2. {t("preview")}</li>
			</ol>

			{step === "edit" && <ContractForm draft={draft} onChange={setDraft} />}

			<div
				className={cn(
					"max-w-full overflow-x-auto py-4 print:overflow-visible print:p-0",
					step === "edit" && "hidden print:block",
				)}
			>
				<ContractDocument draft={draft} onChange={setDraft} />
			</div>

			<div className="mt-6 flex flex-wrap gap-3 print:hidden">
				{step === "edit" ? (
					<Button type="button" onClick={() => setStep("preview")}>
						{t("preview")}
					</Button>
				) : (
					<>
						<Button type="button" onClick={() => window.print()}>
							{t("print")}
						</Button>
						<Button type="button" variant="outline" onClick={() => setStep("edit")}>
							{t("edit")}
						</Button>
					</>
				)}

				<Button type="button" variant="ghost" onClick={clear}>
					{t("clear")}
				</Button>
			</div>

			<div className="mt-4 max-w-2xl space-y-2 text-sm text-muted print:hidden">
				<p>{t("blankHint")}</p>
				{step === "preview" && <p>{t("printHint")}</p>}
			</div>
		</>
	);
}

function SaleSteps() {
	const { t } = useTranslation("contract");

	return (
		<section className="mt-12 max-w-2xl border-t border-border pt-6 print:hidden">
			<h2 className="font-heading text-xl font-semibold">{t("stepsTitle")}</h2>

			<ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
				<li>{t("steps.copies")}</li>
				<li>{t("steps.payment")}</li>
				<li>
					<a className="underline underline-offset-2" href={TRAFICOM_LINKS.seller}>
						{t("steps.seller")}
					</a>
				</li>
				<li>
					<a className="underline underline-offset-2" href={TRAFICOM_LINKS.buyer}>
						{t("steps.buyer")}
					</a>
				</li>
			</ol>

			<div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
				<a className="underline underline-offset-2" href={TRAFICOM_LINKS.checklist}>
					{t("checklist")}
				</a>
				<a className="underline underline-offset-2" href={TRAFICOM_LINKS.officialForm}>
					{t("official")}
				</a>
			</div>
		</section>
	);
}
