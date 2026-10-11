import { Button } from "@motori/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ContractLayout } from "~/components/sale-contract-layout";
import { SITE_URL } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import fiContract from "~/lib/i18n/resources/fi/contract";
import { createContract, draftKey, normalizeListingQuery, parseDraft } from "~/lib/sale-contract";
import { getContractPrefill } from "~/lib/sale-contract-prefill";
import "~/styles/sale-contract.css";

export const Route = createFileRoute("/kauppakirja")({
	validateSearch: (search: Record<string, unknown>) => ({
		ilmoitus: normalizeListingQuery(search.ilmoitus),
	}),
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
	const { ilmoitus } = Route.useSearch();
	const prefill = Route.useLoaderData();
	return (
		<ContractEditor key={draftKey(ilmoitus)} storageKey={draftKey(ilmoitus)} prefill={prefill} />
	);
}

function ContractEditor({
	storageKey,
	prefill,
}: {
	storageKey: string;
	prefill: Awaited<ReturnType<typeof getContractPrefill>>;
}) {
	const { t } = useTranslation("contract");
	const [draft, setDraft] = useState(() => createContract(prefill));
	const [ready, setReady] = useState(false);
	const [step, setStep] = useState<"edit" | "document">("edit");
	useEffect(() => {
		let restored = null;
		try {
			restored = parseDraft(window.sessionStorage.getItem(storageKey));
		} catch {
			// Storage may be disabled. The in-memory form remains usable.
		}
		if (restored) {
			setDraft(restored);
		}
		setReady(true);
	}, [storageKey]);
	useEffect(() => {
		if (!ready) {
			return;
		}
		try {
			window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
		} catch {
			// Storage may be disabled. The in-memory form remains usable.
		}
	}, [draft, ready, storageKey]);
	function clear() {
		try {
			window.sessionStorage.removeItem(storageKey);
		} catch {
			// A blocked storage API must not prevent clearing the visible form.
		}
		setDraft(createContract(null));
		setStep("edit");
	}
	return (
		<div className="sale-contract-page mx-auto max-w-5xl px-4 py-8 md:py-12">
			<div className="contract-controls mb-8">
				<h1 className="font-heading text-3xl font-bold md:text-4xl">{t("title")}</h1>
				<p className="mt-3 max-w-2xl text-muted">{t("intro")}</p>
				<p className="mt-4 text-sm font-medium">{t("privacy")}</p>
				<p className="mt-1 text-sm text-muted">{t("storageHint")}</p>
				<ol className="mt-6 flex gap-6 text-sm" aria-label={t("title")}>
					<li aria-current={step === "edit" ? "step" : undefined}>1. {t("fill")}</li>
					<li aria-current={step === "document" ? "step" : undefined}>2. {t("preview")}</li>
				</ol>
			</div>
			<fieldset disabled={!ready} className="min-w-0">
				{step === "edit" && <ContractLayout draft={draft} setDraft={setDraft} mode="edit" />}
				<div
					className={`contract-preview-scroll${step === "edit" ? " contract-preview-hidden" : ""}`}
				>
					<ContractLayout draft={draft} setDraft={setDraft} mode="document" />
				</div>
				<div className="contract-controls mt-6 flex flex-wrap gap-3">
					{step === "edit" ? (
						<Button type="button" onClick={() => setStep("document")}>
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
			</fieldset>
			<p className="contract-controls mt-4 text-sm text-muted">{t("blankHint")}</p>
			{step === "document" && (
				<p className="contract-controls mt-2 max-w-2xl text-sm text-muted">{t("printHint")}</p>
			)}
			<section className="contract-controls mt-12 max-w-2xl border-t border-border pt-6">
				<h2 className="font-heading text-xl font-semibold">{t("stepsTitle")}</h2>
				<ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
					<li>{t("steps.copies")}</li>
					<li>{t("steps.payment")}</li>
					<li>
						<a
							className="underline underline-offset-2"
							href="https://traficom.fi/fi/autoilijat/ajoneuvon-osto-ja-myynti/myyja-tee-ajoneuvolle-luovutusilmoitus"
						>
							{t("steps.seller")}
						</a>
					</li>
					<li>
						<a
							className="underline underline-offset-2"
							href="https://traficom.fi/fi/autoilijat/ajoneuvon-osto-ja-myynti/ostaja-tee-ajoneuvon-omistajanvaihdos-luovutusilmoituksen-perusteella"
						>
							{t("steps.buyer")}
						</a>
					</li>
				</ol>
				<div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
					<a
						className="underline underline-offset-2"
						href="https://www.traficom.fi/sites/default/files/media/publication/Traficom_Ostajan_ja_Myyjan_Muistilista%20(5).pdf"
					>
						{t("checklist")}
					</a>
					<a className="underline underline-offset-2" href="https://lomakkeet.traficom.fi/B124">
						{t("official")}
					</a>
				</div>
			</section>
		</div>
	);
}
