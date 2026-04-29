export function ListingCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-l border border-border bg-card">
			<div className="aspect-[16/10] animate-pulse bg-muted-light" />
			<div className="space-y-3 p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="h-4 w-3/4 animate-pulse rounded bg-muted-light" />
					<div className="h-5 w-8 animate-pulse rounded bg-muted-light" />
				</div>
				<div className="h-3 w-1/2 animate-pulse rounded bg-muted-light" />
				<div className="border-t border-border pt-3">
					<div className="flex items-center justify-between">
						<div className="h-3 w-1/3 animate-pulse rounded bg-muted-light" />
						<div className="h-5 w-16 animate-pulse rounded bg-muted-light" />
					</div>
				</div>
			</div>
		</div>
	);
}
