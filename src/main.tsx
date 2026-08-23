import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "@/auth/AuthContext";
import { ActiveHouseholdProvider } from "@/hooks/useActiveHousehold";
import { SharedScopeProvider } from "@/hooks/useSharedScope";
import { NoteVaultProvider } from "@/hooks/useNoteVault";
import { AppearanceProvider } from "@/hooks/useAppearance";
import { ErrorBoundary } from "./ErrorBoundary";

const firebaseAliases = new Set(["hardyhub-7b30d.web.app", "hardyhub-7b30d.firebaseapp.com"]);

if (firebaseAliases.has(window.location.hostname)) {
	window.location.replace(`https://hardyapp.co.uk${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
	createRoot(document.getElementById("root")!).render(
		<ErrorBoundary>
			<AuthProvider>
				<ActiveHouseholdProvider>
					<SharedScopeProvider>
						<NoteVaultProvider>
							<AppearanceProvider>
								<App />
							</AppearanceProvider>
						</NoteVaultProvider>
					</SharedScopeProvider>
				</ActiveHouseholdProvider>
			</AuthProvider>
		</ErrorBoundary>
	);
}
