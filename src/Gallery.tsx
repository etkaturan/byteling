import { useState } from "react";
import PetView from "./pets/PetView";
import { CHARACTERS } from "./pets/registry";
import type { Action, Mood } from "./pets/types";

const MOODS: Mood[] = ["Thriving", "Content", "Uneasy", "Unwell", "Critical"];
const ACTIONS: Action[] = ["idle", "moving", "sleeping"];

function Gallery() {
  const [mood, setMood] = useState<Mood>("Content");
  const [action, setAction] = useState<Action>("idle");

  return (
    <div
      style={{
        background: "#0f1117",
        minHeight: "100vh",
        padding: 24,
        color: "#e6e8ee",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Pet renderer preview</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => setMood(m)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: mood === m ? "#4a7dff" : "#232733",
              color: "#fff",
              fontSize: 12,
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {ACTIONS.map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: action === a ? "#7ee081" : "#232733",
              color: action === a ? "#10131a" : "#fff",
              fontSize: 12,
            }}
          >
            {a}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          placeItems: "center",
        }}
      >
        {CHARACTERS.map((char) => (
          <div key={char.id} style={{ textAlign: "center" }}>
            <PetView
              character={char}
              state={{ mood, action, facing: "right", size: 150 }}
            />
            <div style={{ fontSize: 13, marginTop: 8 }}>{char.name}</div>
            <div style={{ fontSize: 11, color: "#9aa0ad" }}>{char.bio}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Gallery;