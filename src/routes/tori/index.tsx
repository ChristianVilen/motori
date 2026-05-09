import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tori/")({
  loader: () => {
    throw redirect({ to: "/varusteet", replace: true });
  },
  component: () => null,
});
