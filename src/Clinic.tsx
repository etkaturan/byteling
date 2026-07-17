import { useState } from "react";
import Vitals from "./Vitals";
import Gallery from "./Gallery";
import Shop from "./Shop";
import Wardrobe from "./Wardrobe";
import Settings from "./Settings";
import "./Clinic.css";

type Tab = "vitals" | "gallery" | "shop" | "wardrobe" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "vitals", label: "Vitals", icon: "💓" },
  { id: "gallery", label: "Gallery", icon: "🖼️" },
  { id: "shop", label: "Shop", icon: "🛍️" },
  { id: "wardrobe", label: "Wardrobe", icon: "🎽" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

function Clinic() {
  const [tab, setTab] = useState<Tab>("vitals");

  return (
    <div className="clinic">
      <nav className="clinic-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`clinic-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="clinic-content">
        {tab === "vitals" && <Vitals />}
        {tab === "gallery" && <Gallery />}
        {tab === "shop" && <Shop />}
        {tab === "wardrobe" && <Wardrobe />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

export default Clinic;