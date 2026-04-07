import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { fcl } from "./lib/flow";
import { setBaseUrl } from "@workspace/api-client-react";

// Point generated API client at the backend (needed when frontend and backend
// are hosted on separate domains, e.g. Render static + web service).
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
if (apiUrl) setBaseUrl(apiUrl);

// Eagerly subscribe to FCL user state on page load so the internal
// WalletConnect client is fully initialized before the user clicks
// "Connect Flow" — this eliminates the cold-start delay on the first click.
fcl.currentUser.subscribe(() => {});

createRoot(document.getElementById("root")!).render(<App />);
