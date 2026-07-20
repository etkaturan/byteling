import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  /** "night" = emissive ember; "day" = molten metal. */
  theme: "day" | "night";
  hue: number;
  size: number;
};

/**
 * The 3D clock face. Real WebGL — extruded 7-segment digits that tilt toward
 * the cursor and drift. The material is the only thing that changes between
 * day (metal) and night (ember glow); geometry and motion are identical.
 */
export default function Clock3D({ theme, hue, size }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 17;

    // Canvas is wider than the digits need, so the row never touches an edge
    // and the cursor-tilt can't swing a digit out of frame.
    const canvasW = size;
    const canvasH = size * 0.42;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(canvasW, canvasH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);
    camera.aspect = canvasW / canvasH;
    camera.updateProjectionMatrix();

    const key = new THREE.PointLight(0xffffff, 1.1);
    key.position.set(6, 8, 10);
    scene.add(key);
    const emberHex = new THREE.Color(`hsl(${hue}, 90%, 55%)`).getHex();
    const fill = new THREE.PointLight(emberHex, 0.9);
    fill.position.set(-8, -2, 6);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0x402018, 0.6));

    const group = new THREE.Group();
    scene.add(group);

    const makeMat = () =>
      themeRef.current === "night"
        ? new THREE.MeshStandardMaterial({
            color: emberHex,
            emissive: new THREE.Color(`hsl(${hue}, 95%, 40%)`).getHex(),
            emissiveIntensity: 0.6,
            roughness: 0.35,
            metalness: 0.2,
          })
        : new THREE.MeshStandardMaterial({
            color: 0xcfcfcf,
            roughness: 0.15,
            metalness: 0.95,
          });

    const SEG: Record<string, [number, number, number, number]> = {
      a: [0, 3, 2, 0.5],
      b: [1.1, 1.7, 0.5, 1.6],
      c: [1.1, -0.1, 0.5, 1.6],
      d: [0, -1, 2, 0.5],
      e: [-1.1, -0.1, 0.5, 1.6],
      f: [-1.1, 1.7, 0.5, 1.6],
      g: [0, 1.3, 2, 0.5],
    };
    const ON: Record<string, string> = {
      "0": "abcdef",
      "1": "bc",
      "2": "abged",
      "3": "abgcd",
      "4": "fgbc",
      "5": "afgcd",
      "6": "afgcde",
      "7": "abc",
      "8": "abcdefg",
      "9": "abcfgd",
    };

    function digit(ch: string): THREE.Group {
      const g = new THREE.Group();
      if (ch === ":") {
        [0.7, -0.7].forEach((y) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.6), makeMat());
          m.position.set(0, y, 0);
          g.add(m);
        });
        return g;
      }
      (ON[ch] || "").split("").forEach((s) => {
        const d = SEG[s];
        if (!d) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(d[2], d[3], 0.6), makeMat());
        m.position.set(d[0], d[1], 0);
        g.add(m);
      });
      return g;
    }

    let lastStamp = "";
    function build() {
      const t = new Date();
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      const stamp = `${hh}:${mm}:${themeRef.current}`;
      if (stamp === lastStamp) return;
      lastStamp = stamp;

      while (group.children.length) {
        const c = group.children[0] as THREE.Group;
        c.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        group.remove(c);
      }
      const chars = [hh[0], hh[1], ":", mm[0], mm[1]];
      // Measure total width first, then start at -half so the row is centred.
      const widths = chars.map((c) => (c === ":" ? 1.6 : 3.3));
      const total = widths.reduce((a, b) => a + b, 0);
      let x = -total / 2 + widths[0] / 2;
      chars.forEach((c, i) => {
        const d = digit(c);
        d.position.x = x;
        x += (widths[i] + (widths[i + 1] ?? 0)) / 2;
        group.add(d);
      });
    }
    build();
    const buildTimer = window.setInterval(build, 2000);

    let mx = 0,
      my = 0;
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      group.rotation.y += (mx * 0.5 - group.rotation.y) * 0.06;
      group.rotation.x += (my * 0.35 - group.rotation.x) * 0.06;
      group.children.forEach((d, i) => {
        d.position.y = Math.sin(Date.now() * 0.0015 + i) * 0.18;
      });
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(buildTimer);
      window.removeEventListener("pointermove", onMove);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [hue, size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size * 0.42, overflow: "visible" }}
    />
  );
}
