import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/leaflet-zfix.css";
// Bootstrap da engine de gamificação (Sprint 6 · Fase 2).
// Side-effect: assina o EventBus na inicialização do bundle.
import { xpEngine } from "./lib/gamification/xpEngine";
xpEngine.start();

createRoot(document.getElementById("root")!).render(<App />);
