import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./features/prototype/app";
import { loadScenario } from "./features/prototype/storage";
import "./app/globals.css";
void loadScenario().then((loaded) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App loaded={loaded} />
    </StrictMode>,
  );
});
