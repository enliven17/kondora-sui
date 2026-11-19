import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { MARK_BOTTOM, MARK_TOP, WORDMARK_GLYPHS, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "./logo-paths";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const COLORS = {
  paper: { bg: "#FFF3F5", fg: "#23050D", sub: "#7A5E66", panel: "#FFDAE0" },
  plum: { bg: "#320713", fg: "#FBF3F4", sub: "#A8969B", panel: "#23050D" },
} as const;

const fonts = async () => {
  const dir = path.join(process.cwd(), "app", "fonts");
  const [bold, medium] = await Promise.all([readFile(path.join(dir, "Satoshi-Bold.ttf")), readFile(path.join(dir, "Satoshi-Medium.ttf"))]);
  return [
    { name: "Satoshi", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Satoshi", data: medium, weight: 500 as const, style: "normal" as const },
  ];
};

/** Kondora share card: lockup top left, big title, one line under it. */
export async function renderOg({
  title,
  subtitle,
  eyebrow,
  theme = "plum",
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  theme?: keyof typeof COLORS;
}) {
  const c = COLORS[theme];
  const wordW = 210;
  const wordH = (WORDMARK_HEIGHT / WORDMARK_WIDTH) * wordW;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: c.bg, color: c.fg, padding: 72, fontFamily: "Satoshi" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 64 64" fill={c.fg}>
            <path d={MARK_TOP} />
            <path d={MARK_BOTTOM} />
          </svg>
          <svg width={wordW} height={wordH} viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`} fill={c.fg}>
            <path d={WORDMARK_GLYPHS.join(" ")} />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow && (
            <div style={{ display: "flex", fontSize: 22, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: c.sub, marginBottom: 20 }}>{eyebrow}</div>
          )}
          <div style={{ display: "flex", fontSize: title.length > 40 ? 68 : 88, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, maxWidth: 1000 }}>{title}</div>
          {subtitle && <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: c.sub, marginTop: 24, maxWidth: 900 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 500, color: c.sub }}>
          <span>sui.kondora.xyz</span>
          <span>YES or NO, up to 5x</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
