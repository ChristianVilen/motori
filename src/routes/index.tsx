import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center">
			<h1 className="text-4xl font-bold text-primary">Vuokramoto</h1>
			<p className="mt-4 text-lg text-muted">Vuokraa moottoripyörä — tai ilmoita omasi vuokralle</p>
		</div>
	);
}
