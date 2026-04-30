import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ListingImage } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";

interface ListingGalleryProps {
	images: ListingImage[];
	title: string;
}

export function ListingGallery({ images, title }: ListingGalleryProps) {
	const { t } = useTranslation("listings");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [lightboxOpen, setLightboxOpen] = useState(false);

	const [mainRef, mainApi] = useEmblaCarousel({ loop: true, skipSnaps: false });
	const [thumbRef, thumbApi] = useEmblaCarousel({
		containScroll: "keepSnaps",
		dragFree: true,
	});

	const onMainSelect = useCallback(() => {
		if (!mainApi || !thumbApi) {
			return;
		}
		const index = mainApi.selectedScrollSnap();
		setSelectedIndex(index);
		thumbApi.scrollTo(index);
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
		if (!lightboxOpen) {
			return;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setLightboxOpen(false);
			}
			if (e.key === "ArrowLeft") {
				mainApi?.scrollPrev();
			}
			if (e.key === "ArrowRight") {
				mainApi?.scrollNext();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [lightboxOpen, mainApi]);

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
			<div className="flex aspect-[4/3] items-center justify-center bg-muted-light md:rounded-l">
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
				className="group relative -mx-4 bg-black md:mx-0 md:overflow-hidden md:rounded-l md:shadow-lg"
				aria-roledescription="carousel"
				aria-label={t("gallery.carouselAriaLabel", { title })}
			>
				<div className="overflow-hidden" ref={mainRef}>
					<div className="flex touch-pan-y">
						{images.map((img, i) => (
							<div key={img.id} className="relative aspect-[4/3] w-full flex-[0_0_100%] min-w-0">
								<button
									type="button"
									className="h-full w-full cursor-zoom-in"
									onClick={() => setLightboxOpen(true)}
									aria-label={t("gallery.openLightboxAriaLabel", { title, index: i + 1 })}
								>
									<img
										src={img.url}
										alt={i === 0 ? title : `${title}, kuva ${i + 1}`}
										className="h-full w-full object-cover"
										draggable={false}
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
							className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground shadow-md opacity-0 transition-all hover:bg-white group-hover:opacity-100 max-md:opacity-100"
							aria-label={t("gallery.prevAriaLabel")}
						>
							<ChevronLeft className="h-5 w-5" />
						</button>
						<button
							type="button"
							onClick={scrollNext}
							className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-foreground shadow-md opacity-0 transition-all hover:bg-white group-hover:opacity-100 max-md:opacity-100"
							aria-label={t("gallery.nextAriaLabel")}
						>
							<ChevronRight className="h-5 w-5" />
						</button>

						{/* Counter pill */}
						<span
							className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium tabular-nums text-white"
							aria-live="polite"
						>
							{selectedIndex + 1} / {images.length}
						</span>
					</>
				)}
			</section>

			{/* Thumbnail strip */}
			{images.length > 1 && (
				<nav className="mt-3" ref={thumbRef} aria-label={t("gallery.thumbnailsAriaLabel")}>
					<div className="flex gap-2 px-0.5 py-0.5 flex-wrap">
						{images.map((img, i) => (
							<button
								key={img.id}
								type="button"
								onClick={() => onThumbClick(i)}
								aria-label={t("gallery.goToImageAriaLabel", { index: i + 1 })}
								aria-current={i === selectedIndex ? "true" : undefined}
								className={`h-18 w-18 transition-all ${
									i === selectedIndex
										? "ring-2 ring-accent ring-offset-2 ring-offset-background"
										: "opacity-60 hover:opacity-90"
								}`}
							>
								<img
									src={img.thumbnail_url ?? img.url}
									alt=""
									className="h-full w-full object-cover"
									draggable={false}
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
	const [emblaRef, emblaApi] = useEmblaCarousel({
		loop: true,
		startIndex,
		skipSnaps: false,
	});
	const { t } = useTranslation("listings");
	const [currentIndex, setCurrentIndex] = useState(startIndex);

	useEffect(() => {
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

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
			}
			if (e.key === "ArrowLeft") {
				emblaApi?.scrollPrev();
			}
			if (e.key === "ArrowRight") {
				emblaApi?.scrollNext();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [emblaApi, onClose]);

	return (
		<div
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
				className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
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
								alt={`${title}, kuva ${i + 1}`}
								className="max-h-full max-w-full select-none object-contain"
								draggable={false}
							/>
						</div>
					))}
				</div>
			</div>

			{images.length > 1 && (
				<>
					<button
						type="button"
						onClick={() => emblaApi?.scrollPrev()}
						className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
						aria-label={t("gallery.prevAriaLabel")}
					>
						<ChevronLeft className="h-7 w-7" />
					</button>
					<button
						type="button"
						onClick={() => emblaApi?.scrollNext()}
						className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
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
