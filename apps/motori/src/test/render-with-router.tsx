import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";

interface RenderWithRouterOptions extends Omit<RenderOptions, "wrapper"> {
	initialLocation?: string;
}

/**
 * Renders a component inside a minimal TanStack Router context.
 * Use for components that use <Link>, useNavigate, etc.
 */
export function renderWithRouter(ui: ReactElement, opts: RenderWithRouterOptions = {}) {
	const { initialLocation = "/", ...renderOptions } = opts;

	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const testRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => ui,
	});

	const router = createRouter({
		routeTree: rootRoute.addChildren([testRoute]),
		history: createMemoryHistory({ initialEntries: [initialLocation] }),
	});

	const result = render(<RouterProvider router={router} />, renderOptions);
	return { ...result, router };
}
