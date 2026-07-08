import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: () => <h1 className="font-heading text-2xl font-bold">Talli</h1>,
});
