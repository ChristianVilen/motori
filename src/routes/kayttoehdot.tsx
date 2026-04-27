import { createFileRoute } from "@tanstack/react-router";
import { SITE_NAME } from "~/lib/constants";

export const Route = createFileRoute("/kayttoehdot")({
	head: () => ({
		meta: [{ title: `Käyttöehdot — ${SITE_NAME}` }],
	}),
	component: Kayttoehdot,
});

function Kayttoehdot() {
	return (
		<main className="mx-auto max-w-3xl px-4 py-12">
			<h1 className="font-heading text-3xl font-bold text-foreground">Käyttöehdot</h1>
			<p className="mt-2 text-sm text-muted">Päivitetty viimeksi: 19.4.2025</p>

			<p className="mt-6 text-sm text-foreground/80">
				Rekisteröitymällä Motori-palveluun tai julkaisemalla ilmoituksen hyväksyt nämä käyttöehdot.
				Ehdot koskevat kaikkia palvelun käyttäjiä.
			</p>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">1. Määritelmät</h2>
				<ul className="mt-3 space-y-2 text-sm text-foreground/80">
					<li>
						<strong>Palvelu</strong> – Motori-verkkosivusto (motori.fi), joka toimii moottoripyörien
						vuokrausilmoitusten alustana.
					</li>
					<li>
						<strong>Käyttäjä</strong> – kaikki palveluun rekisteröityneet tai sitä selailevat
						henkilöt.
					</li>
					<li>
						<strong>Vuokralleantaja</strong> – käyttäjä, joka julkaisee moottoripyörän
						vuokrausilmoituksen.
					</li>
					<li>
						<strong>Vuokraaja</strong> – käyttäjä, joka ottaa yhteyttä vuokralleantajaan vuokrauksen
						sopimiseksi.
					</li>
					<li>
						<strong>Ilmoitus</strong> – vuokralleantajan julkaisema moottoripyörän vuokraustarjous.
					</li>
					<li>
						<strong>Sopimus</strong> – vuokralleantajan ja vuokraajan välinen vuokrasopimus, johon
						Motori ei ole osapuolena.
					</li>
				</ul>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">2. Yleiset ehdot</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>
						Motori on ilmoitusalusta, joka mahdollistaa yksityishenkilöiden välisen moottoripyörien
						vuokrauksen. Motori ei ole osapuolena käyttäjien välisissä sopimuksissa eikä vastaa
						niiden täytäntöönpanosta.
					</p>
					<p>
						Käyttäjät julkaisevat ilmoituksia ja sopivat vuokrauksista keskenään omalla vastuullaan.
						Motori toimii ainoastaan teknisenä alustana.
					</p>
					<p>
						Motori pidättää oikeuden muuttaa näitä käyttöehtoja. Muutoksista ilmoitetaan
						sähköpostitse.
					</p>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					3. Käyttäjän velvollisuudet
				</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>Käyttäjä sitoutuu:</p>
					<ul className="ml-4 list-disc space-y-2">
						<li>
							antamaan oikeat ja ajantasaiset tiedot rekisteröityessään ja ilmoituksia
							julkaistessaan
						</li>
						<li>
							julkaisemaan ilmoituksia ainoastaan ajoneuvoista, joiden vuokraukseen hänellä on
							oikeus
						</li>
						<li>noudattamaan Suomen lakia palvelua käyttäessään</li>
						<li>olemaan käyttämättä palvelua laittomiin tarkoituksiin tai petokseen</li>
						<li>
							pitämään kirjautumistietonsa turvassa ja ilmoittamaan epäilystä luvattomasta käytöstä
						</li>
					</ul>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">4. Vastuunrajoitus</h2>
				<div className="mt-3 space-y-3 text-sm text-foreground/80">
					<p>
						Motori ei vastaa käyttäjien välisistä sopimuksista, ajoneuvojen kunnosta,
						vakuutusasioista eikä vuokrauksen aikana mahdollisesti aiheutuvista vahingoista.
						Käyttäjät vastaavat näistä itse.
					</p>
					<p>
						Motori ei takaa ilmoitusten oikeellisuutta tai täydellisyyttä. Käyttäjä vastaa itse
						julkaisemansa sisällön lainmukaisuudesta.
					</p>
					<p>Motorin vastuu rajoittuu aina Suomen pakottavan lainsäädännön sallimaan minimiin.</p>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">5. Tilin sulkeminen</h2>
				<p className="mt-3 text-sm text-foreground/80">
					Motori voi sulkea käyttäjän tilin ilman ennakkoilmoitusta, jos käyttäjä rikkoo näitä
					ehtoja, julkaisee harhaanjohtavaa sisältöä tai käyttää palvelua lain vastaisesti. Käyttäjä
					voi itse sulkea tilinsä ottamalla yhteyttä ylläpitoon.
				</p>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">6. Sovellettava laki</h2>
				<p className="mt-3 text-sm text-foreground/80">
					Näihin ehtoihin sovelletaan Suomen lakia. Mahdolliset riidat ratkaistaan ensisijaisesti
					Helsingin käräjäoikeudessa.
				</p>
			</section>

			<section className="mt-8">
				<h2 className="font-heading text-xl font-semibold text-foreground">7. Yhteystiedot</h2>
				<p className="mt-3 text-sm text-foreground/80">
					Christian Vilen
					<br />
					Sähköposti: support@motari.fi
				</p>
			</section>
		</main>
	);
}
