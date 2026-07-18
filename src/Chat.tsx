import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import PetView from "./pets/PetView";
import { getCharacter, CHARACTERS } from "./pets/registry";
import type { Loadout } from "./pets/wearables/registry";
import type { Species } from "./Creature";
import "./Chat.css";

type Turn = { at: string; who: "user" | "pet"; text: string };

function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [species, setSpecies] = useState<Species | null>(null);
  const [activeCharId, setActiveCharId] = useState("hardware");
  const [loadout, setLoadout] = useState<Loadout>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<Turn[]>("get_chat").then(setTurns).catch(() => {});
    invoke<Species>("get_species").then(setSpecies).catch(() => {});
    invoke<string>("get_active_character").then(setActiveCharId).catch(() => {});
    invoke<Loadout>("get_loadout").then(setLoadout).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, thinking]);

  const send = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    setError(null);
    setTurns((t) => [...t, { at: new Date().toISOString(), who: "user", text }]);
    setThinking(true);
    try {
      const reply = await invoke<string>("chat", { message: text });
      setTurns((t) => [...t, { at: new Date().toISOString(), who: "pet", text: reply }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setThinking(false);
    }
  };

  const baseChar = getCharacter(activeCharId) ?? CHARACTERS[0];
  const activeChar =
    baseChar.id === "hardware" && species ? { ...baseChar, params: species } : baseChar;

  return (
    <div className="chat">
      <header className="chat-head">
        <div className="chat-head-pet">
          <PetView
            character={activeChar}
            state={{ mood: "Content", action: "idle", facing: "right", size: 34 }}
            loadout={loadout}
          />
        </div>
        <span>Byteling</span>
      </header>

      <div className="chat-log">
        {turns.length === 0 && !thinking && (
          <p className="chat-empty">It&apos;s listening.</p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`chat-turn ${t.who}`}>
            {t.text}
          </div>
        ))}
        {thinking && <div className="chat-turn pet thinking">…</div>}
        {error && <div className="chat-error">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={draft}
          placeholder="Say something…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button onClick={send} disabled={!draft.trim() || thinking}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;