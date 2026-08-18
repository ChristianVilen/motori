import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { getFavoriteIdsFn, toggleFavoriteFn } from "~/lib/favorites-fns";

interface FavoritesContextValue {
	isFavorite: (listingId: string) => boolean;
	toggle: (listingId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue>({
	isFavorite: () => false,
	toggle: () => {},
});

export function useFavorites() {
	return useContext(FavoritesContext);
}

interface FavoritesProviderProps {
	loggedIn: boolean;
	onRequireLogin: () => void;
	children: ReactNode;
}

export function FavoritesProvider({ loggedIn, onRequireLogin, children }: FavoritesProviderProps) {
	const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

	useEffect(() => {
		if (!loggedIn) {
			setIds(new Set());
			return;
		}
		let cancelled = false;
		getFavoriteIdsFn().then((list) => {
			if (!cancelled) {
				setIds(new Set(list));
			}
		});
		return () => {
			cancelled = true;
		};
	}, [loggedIn]);

	const isFavorite = useCallback((listingId: string) => ids.has(listingId), [ids]);

	const toggle = useCallback(
		(listingId: string) => {
			if (!loggedIn) {
				onRequireLogin();
				return;
			}
			// Optimistic flip; revert if the server disagrees or fails.
			setIds((prev) => {
				const next = new Set(prev);
				if (next.has(listingId)) {
					next.delete(listingId);
				} else {
					next.add(listingId);
				}
				return next;
			});
			toggleFavoriteFn({ data: { listingId } }).then(
				({ favorited }) => {
					setIds((prev) => {
						if (prev.has(listingId) === favorited) {
							return prev;
						}
						const next = new Set(prev);
						if (favorited) {
							next.add(listingId);
						} else {
							next.delete(listingId);
						}
						return next;
					});
				},
				() => {
					setIds((prev) => {
						const next = new Set(prev);
						if (next.has(listingId)) {
							next.delete(listingId);
						} else {
							next.add(listingId);
						}
						return next;
					});
				},
			);
		},
		[loggedIn, onRequireLogin],
	);

	return (
		<FavoritesContext.Provider value={{ isFavorite, toggle }}>{children}</FavoritesContext.Provider>
	);
}
