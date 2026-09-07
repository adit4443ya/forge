import { ImageResponse } from "next/og";
import { STATS } from "@/data/generated/stats.js";

export const alt = "Forge — compiler, systems and HFT interview preparation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Generated rather than checked in as a PNG so the counts on the card stay
   truthful: they come from the same generated stats the landing page reads.
   Satori (what next/og renders with) requires an explicit display on every
   element that has children, so every div below states one. */
const col = (extra = {}) => ({ display: "flex", flexDirection: "column", ...extra });

export default function OgImage() {
  const stat = (n, label) => (
    <div style={col({ gap: 4 })}>
      <div style={{ display: "flex", fontSize: 44, color: "#e8e8e6", fontWeight: 600 }}>{String(n)}</div>
      <div style={{ display: "flex", fontSize: 20, color: "#8a8a85", letterSpacing: 1 }}>{label}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div
        style={col({
          width: "100%", height: "100%", justifyContent: "space-between",
          background: "#0b0b0c", padding: 72, fontFamily: "sans-serif",
        })}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 56, height: 56, borderRadius: 12, background: "#4589ff",
              color: "#0b0b0c", fontSize: 34, fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#e8e8e6", fontWeight: 600 }}>Forge</div>
        </div>
        <div style={col({ gap: 16 })}>
          <div style={{ display: "flex", fontSize: 62, color: "#e8e8e6", lineHeight: 1.1, maxWidth: 940 }}>
            Practice that behaves like the interview
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#8a8a85", maxWidth: 900 }}>
            Compiler, systems and high-frequency-trading roles. Hints on a clock, labs you run yourself.
          </div>
        </div>
        <div style={{ display: "flex", gap: 64 }}>
          {stat(STATS.problems, "PROBLEMS")}
          {stat(STATS.labs, "LABS")}
          {stat(STATS.guides, "GUIDES")}
          {stat(STATS.rapid, "RAPID FIRE")}
        </div>
      </div>
    ),
    size,
  );
}
