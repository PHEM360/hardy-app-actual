import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "@/auth/AuthContext";
import { ActiveHouseholdProvider } from "@/hooks/useActiveHousehold";
import { SharedScopeProvider } from "@/hooks/useSharedScope";
import { NoteVaultProvider } from "@/hooks/useNoteVault";
import { AppearanceProvider } from "@/hooks/useAppearance";
import { ErrorBoundary } from "./ErrorBoundary";

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
