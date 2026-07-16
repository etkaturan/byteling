import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import Clinic from "./Clinic";
import "./App.css";


// Each window renders a different page, decided by its Tauri label.
const label = getCurrentWindow().label;
const Page = label === "clinic" ? Clinic : App;



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);