export function ListingCardSkeleton() {
	return (
		<div aria-hidden="true" className="min-w-0 animate-pulse">
			<div className="aspect-[4/5] rounded-lg bg-muted-light" />
			<div className="mt-[9px] h-5 w-1/3 rounded bg-muted-light" />
			<div className="mt-1 h-4 w-4/5 rounded bg-muted-light" />
			<div className="mt-1 h-3 w-3/5 rounded bg-muted-light" />
		</div>
	);
}
