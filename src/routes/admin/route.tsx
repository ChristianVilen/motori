import { createFileRoute, Link, Outlet, useMatchRoute, useRouter } from "@tanstack/react-router";
import { BarChart3, FileText, LogOut, Shield, Users } from "lucide-react";
import { requireAdmin } from "~/lib/admin";
import { signOut } from "~/lib/auth-client";
import { SITE_NAME } from "~/lib/constants";
import { getModerationCounts } from "~/lib/reports";

export const Route = createFileRoute("/admin")({
	beforeLoad: () => requireAdmin(),
	loader: () => getModerationCounts(),
	component: AdminLayout,
});

function NavTab({
	href,
	label,
	icon: Icon,
	active,
	badge,
}: {
	href: string;
	label: string;
	icon: typeof BarChart3;
	active: boolean;
	badge?: number;
}) {
	return (
		<a
			href={href}
			className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
				active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
			}`}
		>
			<Icon size={16} />
			{label}
			{!!badge && badge > 0 && (
				<span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
					{badge}
				</span>
			)}
		</a>
	);
}

function AdminLayout() {
	const matchRoute = useMatchRoute();
	const router = useRouter();
	const counts = Route.useLoaderData();

	async function handleSignOut() {
		await signOut();
		router.invalidate();
		router.navigate({ to: "/" });
	}

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-border bg-primary px-4 py-3">
				<div className="mx-auto flex max-w-6xl items-center justify-between">
					<div className="flex items-center gap-3">
						<a href="/admin" className="font-heading text-lg font-bold text-white">
							{SITE_NAME}
						</a>
						<span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
							Admin
						</span>
					</div>
					<div className="flex items-center gap-4">
						<Link to="/" className="text-sm text-white/70 hover:text-white">
							← Site
						</Link>
						<button
							type="button"
							onClick={handleSignOut}
							className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
						>
							<LogOut size={14} />
							Sign out
						</button>
					</div>
				</div>
			</header>
			<div className="mx-auto max-w-6xl px-4 py-6">
				<nav className="mb-8 flex gap-1 border-b border-border">
					<NavTab
						href="/admin"
						label="Stats"
						icon={BarChart3}
						active={matchRoute({ to: "/admin" }) != null}
					/>
					<NavTab
						href="/admin/listings"
						label="Listings"
						icon={FileText}
						active={matchRoute({ to: "/admin/listings", fuzzy: true }) != null}
					/>
					<NavTab
						href="/admin/users"
						label="Users"
						icon={Users}
						active={matchRoute({ to: "/admin/users", fuzzy: true }) != null}
					/>
					<NavTab
						href="/admin/moderation"
						label="Moderation"
						icon={Shield}
						active={matchRoute({ to: "/admin/moderation", fuzzy: true }) != null}
						badge={counts.pendingReports + counts.unreviewedListings}
					/>
				</nav>
				<Outlet />
			</div>
		</div>
	);
}
