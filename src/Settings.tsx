import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function Settings() {
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>("has_groq_key").then(setHasKey);
  }, []);

  const saveKey = async () => {
    try {
      await invoke("set_groq_key", { key: keyInput.trim() });
      setKeyInput("");
      setStatus("Saved ✓");
      setHasKey(keyInput.trim().length > 0);
      setTimeout(() => setStatus(null), 4000);
    } catch (e) {
      setStatus("Failed to save");
      console.error(e);
    }
  };

  const clearKey = async () => {
    await invoke("set_groq_key", { key: "" });
    setHasKey(false);
    setStatus("Cleared");
    setTimeout(() => setStatus(null), 4000);
  };

  return (
    <section className="card">
      <h2>AI Voice (Groq)</h2>
      <p style={{ fontSize: 13, color: "#9aa0ad", marginTop: 0 }}>
        {hasKey
          ? "A Groq key is connected — Byteling speaks with AI, falling back to built-in lines."
          : "Add a free Groq API key to give Byteling an AI voice. Without one, it uses built-in lines."}
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          type="password"
          placeholder="gsk_..."
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #2a2f3a",
            background: "#0f1117",
            color: "#e6e8ee",
            fontSize: 13,
          }}
        />
        <button className="settings-btn" onClick={saveKey} disabled={!keyInput.trim()}>
          Save
        </button>
        {hasKey && (
          <button className="settings-btn ghost" onClick={clearKey}>
            Clear
          </button>
        )}
      </div>
      {status && (
        <div style={{ fontSize: 12, color: "#7ee081", marginTop: 6 }}>{status}</div>
      )}
      <p style={{ fontSize: 11, color: "#626878", marginTop: 10 }}>
        Get a free key at console.groq.com. Your key is stored locally on this
        machine and never leaves it except to call Groq.
      </p>
    </section>
  );
}

export default Settings;