import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tietosuoja")({
	head: () => ({
		meta: [{ title: "Tietosuoja — Vuokramoto" }],
	}),
	component: Tietosuoja,
});

function Tietosuoja() {
	return (
		<main className="mx-auto max-w-3xl px-4 py-12">
			<h1 className="font-heading text-3xl font-bold text-foreground">Tietosuojaseloste</h1>
			<p className="mt-2 text-sm text-muted">Päivitetty viimeksi: 19.4.2025</p>

			<p className="mt-6 text-sm text-foreground/80">
				Tämä tietosuojaseloste kuvaa, miten Vuokramoto kerää ja käsittelee henkilötietojasi EU:n
				yleisen tietosuoja-asetuksen (GDPR, 2016/679) mukaisesti.
			</p>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">1. Rekisterinpitäjä</h2>
				<p className="mt-3 text-sm text-foreground/80">
					Christian Vilen
					<br />
					Sähköposti: [sähköposti]
				</p>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					2. Kerättävät henkilötiedot
				</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>Keräämme seuraavia henkilötietoja:</p>
					<ul className="ml-4 list-disc space-y-2">
						<li>
							<strong>Tilitiedot:</strong> nimi, sähköpostiosoite ja salasana (salattu)
							rekisteröitymisen yhteydessä
						</li>
						<li>
							<strong>Ilmoitustiedot:</strong> julkaisemasi moottoripyörän tiedot, kuvaukset ja
							kuvat, jotka näkyvät muille käyttäjille
						</li>
						<li>
							<strong>Lokitiedot:</strong> IP-osoite ja palvelimen lokitiedot palvelun teknistä
							ylläpitoa ja turvallisuutta varten
						</li>
					</ul>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					3. Käyttötarkoitukset ja oikeusperusta
				</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>Käsittelemme henkilötietojasi seuraaviin tarkoituksiin:</p>
					<ul className="ml-4 list-disc space-y-2">
						<li>
							<strong>Palvelun tarjoaminen</strong> – tilin hallinta ja ilmoitusten julkaisu
							(oikeusperusta: sopimuksen täytäntöönpano)
						</li>
						<li>
							<strong>Käyttäjätunnistus</strong> – kirjautumisen varmentaminen (oikeusperusta:
							sopimuksen täytäntöönpano)
						</li>
						<li>
							<strong>Turvallisuus ja väärinkäytösten esto</strong> – lokitiedot (oikeusperusta:
							oikeutettu etu)
						</li>
						<li>
							<strong>Palvelun kehittäminen</strong> – käyttötilastot (oikeusperusta: oikeutettu
							etu)
						</li>
					</ul>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					4. Tietojen luovuttaminen
				</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>
						Emme myy tai luovuta henkilötietojasi kolmansille osapuolille markkinointitarkoituksiin.
					</p>
					<p>
						Ilmoituksessasi julkaisemasi tiedot (moottoripyörän tiedot, kuvat) ovat näkyvissä
						kaikille palvelun käyttäjille.
					</p>
					<p>Voimme luovuttaa tietoja viranomaisille, jos laki sitä edellyttää.</p>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">5. Säilytysaika</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>
						Säilytämme henkilötietojasi niin kauan kuin tilisi on aktiivinen, sekä enintään 2 vuotta
						tilin sulkemisen jälkeen.
					</p>
					<p>
						Kirjanpitovelvoitteiden edellyttämät tiedot säilytetään 7 vuotta voimassa olevan
						lainsäädännön mukaisesti.
					</p>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					6. Rekisteröidyn oikeudet
				</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>Sinulla on oikeus:</p>
					<ul className="ml-4 list-disc space-y-2">
						<li>tarkastaa, mitä tietoja sinusta on tallennettu</li>
						<li>vaatia virheellisten tietojen oikaisua</li>
						<li>vaatia tietojesi poistamista</li>
						<li>siirtää tietosi toiselle rekisterinpitäjälle (tietojen siirrettävyys)</li>
						<li>vastustaa tietojesi käsittelyä oikeutettuun etuun perustuvissa tilanteissa</li>
					</ul>
					<p>Oikeuksien käyttämiseksi ota yhteyttä: [sähköposti]</p>
					<p>
						Jos koet, että henkilötietojesi käsittely on lainvastaista, voit tehdä valituksen
						tietosuojavaltuutetun toimistoon:{" "}
						<a
							href="https://tietosuoja.fi"
							className="text-accent underline underline-offset-2 hover:text-accent-hover"
							target="_blank"
							rel="noreferrer"
						>
							tietosuoja.fi
						</a>
					</p>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">7. Evästeet</h2>
				<p className="mt-3 text-sm text-foreground/80">
					Käytämme ainoastaan teknisesti välttämättömiä evästeitä kirjautumisen ylläpitoon. Emme
					käytä mainos- tai seurantaevästeitä.
				</p>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					8. Muutokset tietosuojaselosteeseen
				</h2>
				<p className="mt-3 text-sm text-foreground/80">
					Voimme päivittää tätä tietosuojaselostetta. Merkittävistä muutoksista ilmoitetaan
					sähköpostitse rekisteröityneille käyttäjille.
				</p>
			</section>
		</main>
	);
}
