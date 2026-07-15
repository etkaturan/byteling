import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";

function Settings() {
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);
  const [trailOn, setTrailOn] = useState(true);

  useEffect(() => {
    invoke<boolean>("get_trail_enabled").then(setTrailOn);
    isEnabled().then(setAutostart).catch(() => {});
  }, []);



  const toggleTrail = async () => {
    const next = !trailOn;
    await invoke("set_trail_enabled", { enabled: next });
    setTrailOn(next);
  };

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

  const toggleAutostart = async () => {
    try {
      if (autostart) {
        await disable();
        setAutostart(false);
      } else {
        await enable();
        setAutostart(true);
      }
    } catch (e) {
      console.error(e);
    }
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

      <div style={{ marginTop: 16, borderTop: "1px solid #232733", paddingTop: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={trailOn} onChange={toggleTrail} />
          Glowing trail when moving
        </label>
        <p style={{ fontSize: 11, color: "#626878", marginTop: 6 }}>
          Your Byteling leaves a fading trail of light as it moves.
        </p>
      </div>
      
      <div style={{ marginTop: 16, borderTop: "1px solid #232733", paddingTop: 14 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={autostart}
            onChange={toggleAutostart}
          />
          Launch Byteling when the computer starts
        </label>
        <p style={{ fontSize: 11, color: "#626878", marginTop: 6 }}>
          Your Byteling will greet you each time you turn on your PC.
        </p>
      </div>
    </section>
  );
}

export default Settings;