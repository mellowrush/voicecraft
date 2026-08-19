import type { Mode } from "@voicecraft/core";
import "./App.css";

// Placeholder mode reference proves the workspace import resolves and
// typechecks end-to-end; real UI arrives in a later ticket.
const placeholderMode: Mode = "rewrite";

function App() {
  return (
    <main className="container">
      <h1>Voicecraft</h1>
      <p>Scaffold ready ({placeholderMode} mode wired from @voicecraft/core).</p>
    </main>
  );
}

export default App;
