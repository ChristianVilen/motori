import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { ListingImage } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import { photoStyle } from "~/lib/listing-photo-transition";
import { reducedMotionQuery } from "~/lib/motion";
import { useFocusTrap } from "~/lib/use-focus-trap";

const breakpoints = { [reducedMotionQuery]: { duration: 0 } };

interface ListingGalleryProps {
	shortId: string;
	images: ListingImage[];
	title: string;
}

export function ListingGallery({ images, title, shortId }: ListingGalleryProps) {
	const { t } = useTranslation("listings");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [lightboxOpen, setLightboxOpen] = useState(false);

	const [mainRef, mainApi] = useEmblaCarousel({ breakpoints, loop: true, skipSnaps: false });
	const [thumbRef, thumbApi] = useEmblaCarousel({
		breakpoints,
		containScroll: "keepSnaps",
		dragFree: true,
	});

	const onMainSelect = useCallback(() => {
		if (!mainApi) {
			return;
		}
		const index = mainApi.selectedScrollSnap();
		setSelectedIndex(index);
		thumbApi?.scrollTo(index);
	}, [mainApi, thumbApi]);

	useEffect(() => {
		if (!mainApi) {
			return;
		}
		onMainSelect();
		mainApi.on("select", onMainSelect);
		return () => {
			mainApi.off("select", onMainSelect);
		};
	}, [mainApi, onMainSelect]);

	const onThumbClick = useCallback(
		(index: number) => {
			if (!mainApi) {
				return;
			}
			mainApi.scrollTo(index);
		},
		[mainApi],
	);

	const scrollPrev = useCallback(() => mainApi?.scrollPrev(), [mainApi]);
	const scrollNext = useCallback(() => mainApi?.scrollNext(), [mainApi]);

	useEffect(() => {
		if (lightboxOpen) {
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = "";
			};
		}
	}, [lightboxOpen]);

	if (images.length === 0) {
		return (
			<div className="-mx-4 flex aspect-[4/3] items-center justify-center bg-muted-light min-[900px]:mx-0 min-[900px]:aspect-[3/2] min-[900px]:rounded-lg">
				<svg
					className="h-16 w-16 text-border"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1}
						d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A1.5 1.5 0 0022.5 18.75V6.75A1.5 1.5 0 0021 5.25H3A1.5 1.5 0 001.5 6.75v12A1.5 1.5 0 003 20.25z"
					/>
				</svg>
			</div>
		);
	}

	return (
		<>
			{/* Main carousel — edge-to-edge on mobile, rounded on desktop */}
			<section
				className="group relative -mx-4 aspect-[4/3] overflow-hidden bg-muted-light min-[900px]:mx-0 min-[900px]:aspect-[3/2] min-[900px]:rounded-lg"
				aria-roledescription="carousel"
				aria-label={t("gallery.carouselAriaLabel", { title })}
			>
				<div className="h-full overflow-hidden" ref={mainRef}>
					<div className="flex h-full touch-pan-y">
						{images.map((img, i) => (
							<div key={img.id} className="relative h-full w-full min-w-0 flex-[0_0_100%]">
								<button
									type="button"
									className="block h-full w-full cursor-zoom-in"
									tabIndex={selectedIndex === i ? 0 : -1}
									onClick={() => setLightboxOpen(true)}
									aria-label={t("gallery.openLightboxAriaLabel", { title, index: i + 1 })}
								>
									<img
										src={img.url}
										style={i === 0 ? photoStyle(shortId) : undefined}
										alt={i === 0 ? title : t("gallery.imageAlt", { title, index: i + 1 })}
										className="h-full w-full object-cover"
										draggable={false}
										loading={i === 0 ? "eager" : "lazy"}
										fetchPriority={i === 0 ? "high" : undefined}
									/>
								</button>
							</div>
						))}
					</div>
				</div>

				{images.length > 1 && (
					<>
						<button
							type="button"
							onClick={scrollPrev}
							className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground hidden size-11 place-items-center opacity-0 hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 min-[900px]:grid"
							aria-label={t("gallery.prevAriaLabel")}
						>
							<ChevronLeft className="h-5 w-5" />
						</button>
						<button
							type="button"
							onClick={scrollNext}
							className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground hidden size-11 place-items-center opacity-0 hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 min-[900px]:grid"
							aria-label={t("gallery.nextAriaLabel")}
						>
							<ChevronRight className="h-5 w-5" />
						</button>

						<div
							aria-hidden="true"
							className="pointer-events-none absolute bottom-[18px] left-1/2 flex -translate-x-1/2 gap-1.5 min-[900px]:hidden"
						>
							{images.map((img, index) => (
								<span
									key={img.id}
									className={`size-1.5 rounded-full ${index === selectedIndex ? "scale-125 bg-white" : "bg-white/55"}`}
								/>
							))}
						</div>
					</>
				)}
				<span
					className="absolute bottom-3 right-3 rounded-full bg-primary/80 px-2.5 py-[3px] text-xs font-semibold tabular-nums text-white"
					aria-live="polite"
				>
					{selectedIndex + 1} / {images.length}
				</span>
			</section>

			{/* Thumbnail strip */}
			{images.length > 1 && (
				<nav
					className="mt-2.5 hidden overflow-hidden min-[900px]:block"
					ref={thumbRef}
					aria-label={t("gallery.thumbnailsAriaLabel")}
				>
					<div className="flex gap-2.5 p-1">
						{images.map((img, i) => (
							<button
								key={img.id}
								type="button"
								onClick={() => onThumbClick(i)}
								aria-label={t("gallery.goToImageAriaLabel", { index: i + 1 })}
								aria-current={i === selectedIndex ? "true" : undefined}
								className={`aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md ${
									i === selectedIndex
										? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
										: "opacity-60 hover:opacity-90"
								}`}
							>
								<img
									src={img.thumbnail_url ?? img.url}
									alt=""
									className="h-full w-full object-cover"
									draggable={false}
									loading="lazy"
								/>
							</button>
						))}
					</div>
				</nav>
			)}

			{/* Fullscreen lightbox — swipeable with its own Embla instance */}
			{lightboxOpen ? (
				<Lightbox
					images={images}
					title={title}
					startIndex={selectedIndex}
					onClose={() => setLightboxOpen(false)}
					onSlideChange={(index) => mainApi?.scrollTo(index)}
				/>
			) : null}
		</>
	);
}

function Lightbox({
	images,
	title,
	startIndex,
	onClose,
	onSlideChange,
}: {
	images: ListingImage[];
	title: string;
	startIndex: number;
	onClose: () => void;
	onSlideChange: (index: number) => void;
}) {
	const [initialIndex] = useState(startIndex);
	const [emblaRef, emblaApi] = useEmblaCarousel({
		breakpoints,
		loop: true,
		startIndex: initialIndex,
		skipSnaps: false,
	});
	const { t } = useTranslation("listings");
	const [currentIndex, setCurrentIndex] = useState(startIndex);
	const trapRef = useFocusTrap(true);

	useLayoutEffect(() => {
		if (!emblaApi) {
			return;
		}
		const onSelect = () => {
			const idx = emblaApi.selectedScrollSnap();
			setCurrentIndex(idx);
			onSlideChange(idx);
		};
		emblaApi.on("select", onSelect);
		return () => {
			emblaApi.off("select", onSelect);
		};
	}, [emblaApi, onSlideChange]);

	return (
		<div
			ref={trapRef}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					emblaApi?.scrollPrev();
				}
				if (event.key === "ArrowRight") {
					event.preventDefault();
					emblaApi?.scrollNext();
				}
			}}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
			role="dialog"
			aria-modal="true"
			aria-label={t("gallery.lightboxAriaLabel")}
		>
			<button
				type="button"
				className="absolute inset-0 cursor-default"
				onClick={onClose}
				aria-label={t("gallery.closeLightboxAriaLabel")}
				tabIndex={-1}
			/>

			<button
				type="button"
				onClick={onClose}
				className="absolute right-4 top-4 z-10 rounded-full grid size-11 place-items-center bg-white text-foreground hover:bg-muted-light"
				aria-label={t("gallery.closeLightboxAriaLabel")}
			>
				<X className="h-6 w-6" />
			</button>

			{/* Swipeable lightbox carousel */}
			<div className="relative z-10 h-[85vh] w-[90vw] overflow-hidden" ref={emblaRef}>
				<div className="flex h-full touch-pan-y">
					{images.map((img, i) => (
						<div
							key={img.id}
							className="flex h-full w-full flex-[0_0_100%] min-w-0 items-center justify-center"
						>
							<img
								src={img.url}
								alt={t("gallery.imageAlt", { title, index: i + 1 })}
								className="max-h-full max-w-full select-none object-contain"
								draggable={false}
								loading={i === startIndex ? "eager" : "lazy"}
							/>
						</div>
					))}
				</div>
			</div>

			{images.length > 1 && (
				<>
					<button
						type="button"
						disabled={!emblaApi}
						onClick={() => emblaApi?.scrollPrev()}
						className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full grid size-11 place-items-center bg-white text-foreground hover:bg-muted-light"
						aria-label={t("gallery.prevAriaLabel")}
					>
						<ChevronLeft className="h-7 w-7" />
					</button>
					<button
						type="button"
						disabled={!emblaApi}
						onClick={() => emblaApi?.scrollNext()}
						className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full grid size-11 place-items-center bg-white text-foreground hover:bg-muted-light"
						aria-label={t("gallery.nextAriaLabel")}
					>
						<ChevronRight className="h-7 w-7" />
					</button>

					<span className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium tabular-nums text-white backdrop-blur-md">
						{currentIndex + 1} / {images.length}
					</span>
				</>
			)}
		</div>
	);
}
