import { createFileRoute, Link, Outlet, useMatchRoute, useRouter } from "@tanstack/react-router";
import { BarChart3, FileText, LogOut, Users } from "lucide-react";
import { requireAdmin } from "~/lib/admin";
import { signOut } from "~/lib/auth-client";

export const Route = createFileRoute("/admin")({
	beforeLoad: () => requireAdmin(),
	component: AdminLayout,
});

function NavTab({
	href,
	label,
	icon: Icon,
	active,
}: {
	href: string;
	label: string;
	icon: typeof BarChart3;
	active: boolean;
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
		</a>
	);
}

function AdminLayout() {
	const matchRoute = useMatchRoute();
	const router = useRouter();

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
							vuokramoto
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
				</nav>
				<Outlet />
			</div>
		</div>
	);
}
