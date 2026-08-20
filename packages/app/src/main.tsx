import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HudWindow } from "./windows/HudWindow";
import { OnboardingWindow } from "./windows/OnboardingWindow";

// The hud/onboarding Tauri windows load this same bundle with a `window`
// query param (see src-tauri/src/lib.rs's create_hidden_window) rather than
// getting a separate Vite entry point, to reuse the existing build/dev setup.
function Root() {
  const windowParam = new URLSearchParams(window.location.search).get("window");
  if (windowParam === "hud") return <HudWindow />;
  if (windowParam === "onboarding") return <OnboardingWindow />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
