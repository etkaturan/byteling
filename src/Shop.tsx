import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import PetView from "./pets/PetView";
import { CHARACTERS } from "./pets/registry";

function Shop() {
  const [activeId, setActiveId] = useState("hardware");

  useEffect(() => {
    invoke<string>("get_active_character").then(setActiveId);
  }, []);

  const choose = async (id: string) => {
    await invoke("set_active_character", { id });
    setActiveId(id);
  };

  return (
    <section>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Companions</h2>
      <p style={{ fontSize: 13, color: "#9aa0ad", marginTop: 0 }}>
        Choose who lives on your desktop. Your hardware Byteling is always yours.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 14,
          marginTop: 16,
        }}
      >
        {CHARACTERS.map((c) => {
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              onClick={() => choose(c.id)}
              style={{
                background: active ? "#1b2333" : "#151821",
                border: `1px solid ${active ? "#4a7dff" : "#232733"}`,
                borderRadius: 12,
                padding: 12,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ height: 90, display: "grid", placeItems: "center" }}>
                <PetView
                  character={c}
                  state={{ mood: "Content", action: "idle", facing: "right", size: 80 }}
                />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>
                {c.name}
              </div>
              <div style={{ fontSize: 11, color: "#9aa0ad", marginTop: 3 }}>
                {c.bio}
              </div>
              <div
                style={{
                  fontSize: 11,
                  marginTop: 8,
                  color: active ? "#4a7dff" : "#626878",
                }}
              >
                {active ? "● Active" : "Click to switch"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default Shop;