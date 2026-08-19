import { createContext, type ReactNode, useContext } from "react";

interface LoginPromptContextValue {
	loggedIn: boolean;
	requireLogin: () => void;
}

const LoginPromptContext = createContext<LoginPromptContextValue | null>(null);

export function useLoginPrompt(): LoginPromptContextValue {
	const ctx = useContext(LoginPromptContext);
	if (!ctx) {
		throw new Error("useLoginPrompt must be used inside LoginPromptProvider");
	}
	return ctx;
}

interface LoginPromptProviderProps {
	loggedIn: boolean;
	onRequireLogin: () => void;
	children: ReactNode;
}

export function LoginPromptProvider({
	loggedIn,
	onRequireLogin,
	children,
}: LoginPromptProviderProps) {
	return (
		<LoginPromptContext.Provider value={{ loggedIn, requireLogin: onRequireLogin }}>
			{children}
		</LoginPromptContext.Provider>
	);
}
