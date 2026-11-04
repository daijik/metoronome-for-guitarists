import { useState } from "react";
import { Metronome } from "./components/Metronome";
import { Tuner } from "./components/Tuner";
import "./App.css";

type Tab = "metronome" | "tuner";

const TABS: { id: Tab; label: string }[] = [
  { id: "metronome", label: "メトロノーム" },
  { id: "tuner", label: "チューナー" },
];

function App() {
  const [tab, setTab] = useState<Tab>("metronome");

  return (
    <div className="app">
      <div className="app-content">
        <div className="app-tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`app-tab ${tab === id ? "app-tab--active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* メトロノームは隠すだけにして、タブを切り替えても再生を止めない */}
        <div hidden={tab !== "metronome"}>
          <Metronome />
        </div>
        {/* チューナーはアンマウントでマイクを解放する */}
        {tab === "tuner" && <Tuner />}
      </div>
    </div>
  );
}

export default App;
