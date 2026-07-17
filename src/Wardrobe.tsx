import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PetView from "./pets/PetView";
import { getCharacter, CHARACTERS } from "./pets/registry";
import { wearablesInSlot, type Loadout } from "./pets/wearables/registry";
import type { WearableSlot } from "./pets/wearables/types";
import type { Species } from "./Creature";

const SLOTS: { id: WearableSlot; label: string }[] = [
  { id: "headwear", label: "Headwear" },
  { id: "accessory", label: "Accessories" },
  { id: "handtool", label: "Hand tools" },
  { id: "back", label: "Back" },
];

function Wardrobe() {
  const [activeCharId, setActiveCharId] = useState("hardware");
  const [species, setSpecies] = useState<Species | null>(null);
  const [loadout, setLoadout] = useState<Loadout>({});

  useEffect(() => {
    invoke<string>("get_active_character").then(setActiveCharId).catch(() => {});
    invoke<Species>("get_species").then(setSpecies).catch(() => {});
    invoke<Loadout>("get_loadout").then(setLoadout).catch(() => {});

    const unlistenChar = listen<string>("active-character-changed", (e) =>
      setActiveCharId(e.payload),
    );
    const unlistenLoadout = listen<Loadout>("loadout-changed", (e) => setLoadout(e.payload));
    return () => {
      unlistenChar.then((f) => f());
      unlistenLoadout.then((f) => f());
    };
  }, []);

  const equip = async (slot: WearableSlot, id: string) => {
    const next: Loadout = { ...loadout, [slot]: loadout[slot] === id ? undefined : id };
    await invoke("set_loadout", { loadout: next });
    setLoadout(next);
  };

  const baseChar = getCharacter(activeCharId) ?? CHARACTERS[0];
  const activeChar =
    baseChar.id === "hardware" && species ? { ...baseChar, params: species } : baseChar;

  return (
    <section>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Wardrobe</h2>
      <p style={{ fontSize: 13, color: "#9aa0ad", marginTop: 0 }}>
        One item per slot. Click an equipped item again to remove it.
      </p>

      {/* The showcase — wearing everything currently equipped. */}
      <div
        style={{
          background: "radial-gradient(ellipse at center, #1b2333 0%, #0f1117 70%)",
          border: "1px solid #232733",
          borderRadius: 16,
          padding: "32px 0",
          display: "grid",
          placeItems: "center",
          marginTop: 16,
          marginBottom: 28,
        }}
      >
        <PetView
          character={activeChar}
          state={{ mood: "Content", action: "idle", facing: "right", size: 170 }}
          loadout={loadout}
        />
      </div>

      {SLOTS.map(({ id: slot, label }) => {
        const items = wearablesInSlot(slot);
        if (items.length === 0) return null;
        return (
          <div key={slot} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: "#626878",
                marginBottom: 10,
              }}
            >
              {label}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {items.map((w) => {
                const active = loadout[slot] === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => equip(slot, w.id)}
                    style={{
                      background: active ? "#1b2333" : "#151821",
                      border: `1px solid ${active ? "#4a7dff" : "#232733"}`,
                      borderRadius: 12,
                      padding: 10,
                      width: 108,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {/* Each card renders the real pet wearing ONLY this item —
                        a genuine preview, not a static icon. */}
                    <div style={{ height: 60, display: "grid", placeItems: "center" }}>
                      <PetView
                        character={activeChar}
                        state={{ mood: "Content", action: "idle", facing: "right", size: 56 }}
                        loadout={{ [slot]: w.id }}
                      />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: "#e6e8ee" }}>
                      {w.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 4,
                        color: active ? "#4a7dff" : "#626878",
                      }}
                    >
                      {active ? "● Equipped" : "Tap to equip"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default Wardrobe;