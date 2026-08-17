import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "@/auth/AuthContext";
import { ActiveHouseholdProvider } from "@/hooks/useActiveHousehold";
import { SharedScopeProvider } from "@/hooks/useSharedScope";
import { AppearanceProvider } from "@/hooks/useAppearance";
import { ErrorBoundary } from "./ErrorBoundary";

createRoot(document.getElementById("root")!).render(
	<ErrorBoundary>
		<AuthProvider>
			<ActiveHouseholdProvider>
				<SharedScopeProvider>
					<AppearanceProvider>
						<App />
					</AppearanceProvider>
				</SharedScopeProvider>
			</ActiveHouseholdProvider>
		</AuthProvider>
	</ErrorBoundary>
);
