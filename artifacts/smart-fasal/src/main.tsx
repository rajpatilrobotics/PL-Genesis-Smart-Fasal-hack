import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { fcl } from "./lib/flow";

// Eagerly subscribe to FCL user state on page load so the internal
// WalletConnect client is fully initialized before the user clicks
// "Connect Flow" — this eliminates the cold-start delay on the first click.
fcl.currentUser.subscribe(() => {});

createRoot(document.getElementById("root")!).render(<App />);
