// Renders the social kit (X banner, avatars, OG, LinkedIn, community icons)
// from HTML with the real Satoshi font and brand art, using the installed Edge.
//   node brand/scripts/build-social.mjs
// Output: brand/social/*.png and public/brand/social/*.png

import puppeteer from "puppeteer-core";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "brand", "social");
const PUB = join(ROOT, "public", "brand", "social");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUB, { recursive: true });

const b64 = (p) => readFileSync(join(ROOT, p)).toString("base64");
const font = b64("app/fonts/Satoshi-Variable.woff2");
const hero = `data:image/webp;base64,${b64("public/art/hero.webp")}`;
const cta = `data:image/webp;base64,${b64("public/art/cta.webp")}`;
const split = `data:image/webp;base64,${b64("public/art/feature-split.webp")}`;

const paths = readFileSync(join(ROOT, "components/brand/logo-paths.ts"), "utf8");
const pick = (name) => JSON.parse(paths.match(new RegExp(`${name} = (.+?)(?: as const)?;`))[1]);
const MARK_TOP = pick("MARK_TOP");
const MARK_BOTTOM = pick("MARK_BOTTOM");
const GLYPHS = pick("WORDMARK_GLYPHS");
const WW = pick("WORDMARK_WIDTH");
const WH = pick("WORDMARK_HEIGHT");

const C = { paper: "#FFF3F5", blush: "#FFDAE0", petal: "#FFC7CF", plum: "#320713", cocoa: "#23050D", ink: "#050102", acc: "#FFFC8F", fg: "#FBF3F4" };

const mark = (size, color) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><path d="${MARK_TOP}" fill="${color}"/><path d="${MARK_BOTTOM}" fill="${color}"/></svg>`;
const wordmark = (height, color) =>
  `<svg height="${height}" viewBox="0 0 ${WW} ${WH}" style="width:${(height * WW) / WH}px">${GLYPHS.map((d) => `<path d="${d}" fill="${color}"/>`).join("")}</svg>`;
const lockup = (h, color) =>
  `<div style="display:flex;align-items:center;gap:${h * 0.28}px">${mark(h * 1.25, color)}${wordmark(h, color)}</div>`;

const base = (w, h, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Satoshi;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:300 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:Satoshi,sans-serif;-webkit-font-smoothing:antialiased}
.grain::after{content:"";position:absolute;inset:0;opacity:.08;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
</style></head><body>${body}</body></html>`;

const art = (src, pos = "center") => `<div style="position:absolute;inset:0;background:url(${src}) ${pos}/cover"></div>`;

const designs = [
  {
    name: "x-banner",
    w: 1500,
    h: 500,
    // X puts the avatar over the bottom left, so the copy sits right.
    html: `<div class="grain" style="position:relative;width:100%;height:100%">${art(hero, "center 40%")}
      <div style="position:absolute;inset:0;background:linear-gradient(270deg,${C.ink}e6 0%,${C.ink}99 38%,transparent 70%)"></div>
      <div style="position:absolute;right:90px;top:50%;transform:translateY(-50%);text-align:right;color:${C.fg}">
        <div style="display:flex;justify-content:flex-end">${lockup(46, C.fg)}</div>
        <div style="margin-top:26px;font-size:64px;font-weight:700;letter-spacing:-0.045em;line-height:.95">Trade what<br/>happens next.</div>
        <div style="margin-top:18px;font-size:22px;font-weight:500;color:${C.fg}cc">Leveraged prediction markets on Sui</div>
      </div></div>`,
  },
  {
    name: "avatar-plum",
    w: 1024,
    h: 1024,
    html: `<div style="width:100%;height:100%;display:grid;place-items:center;background:${C.plum}">${mark(560, C.petal)}</div>`,
  },
  {
    name: "avatar-petal",
    w: 1024,
    h: 1024,
    html: `<div style="width:100%;height:100%;display:grid;place-items:center;background:${C.petal}">${mark(560, C.plum)}</div>`,
  },
  {
    name: "avatar-art",
    w: 1024,
    h: 1024,
    html: `<div class="grain" style="position:relative;width:100%;height:100%;display:grid;place-items:center">${art(split)}
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 40%,${C.plum}66 100%)"></div></div>`,
  },
  {
    name: "og-default",
    w: 1200,
    h: 630,
    html: `<div class="grain" style="position:relative;width:100%;height:100%">${art(cta)}
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,${C.ink}e6 0%,${C.ink}88 45%,transparent 80%)"></div>
      <div style="position:absolute;left:80px;top:80px">${lockup(40, C.fg)}</div>
      <div style="position:absolute;left:80px;bottom:90px;color:${C.fg}">
        <div style="font-size:92px;font-weight:700;letter-spacing:-0.045em;line-height:.92">Trade what<br/>happens next.</div>
        <div style="margin-top:22px;font-size:28px;font-weight:500;color:${C.fg}cc">YES or NO, up to 5x. AI agents settle every market.</div>
      </div></div>`,
  },
  {
    name: "linkedin-banner",
    w: 1584,
    h: 396,
    html: `<div class="grain" style="position:relative;width:100%;height:100%">${art(hero, "center 45%")}
      <div style="position:absolute;inset:0;background:linear-gradient(270deg,${C.ink}e6 0%,${C.ink}88 40%,transparent 72%)"></div>
      <div style="position:absolute;right:90px;top:50%;transform:translateY(-50%);text-align:right;color:${C.fg}">
        <div style="font-size:56px;font-weight:700;letter-spacing:-0.045em;line-height:.95">Trade what happens next.</div>
        <div style="margin-top:14px;font-size:22px;font-weight:500;color:${C.fg}cc">sui.kondora.xyz</div>
      </div></div>`,
  },
  {
    name: "paper-card",
    w: 1200,
    h: 1200,
    html: `<div style="width:100%;height:100%;background:${C.paper};display:flex;flex-direction:column;justify-content:space-between;padding:96px">
      ${lockup(56, C.plum)}
      <div style="color:${C.cocoa};font-size:120px;font-weight:700;letter-spacing:-0.05em;line-height:.9">Trade what<br/>happens next.</div>
      <div style="display:flex;justify-content:space-between;align-items:center;color:${C.cocoa}">
        <div style="font-size:30px;font-weight:500;opacity:.7">Leveraged prediction markets on Sui</div>
        <div style="background:${C.acc};color:${C.ink};font-weight:700;font-size:28px;padding:14px 22px;border-radius:10px">Up to 5x</div>
      </div></div>`,
  },
];

if (process.argv.includes("--html-only")) {
  const dir = join(ROOT, ".local", "social-render");
  mkdirSync(dir, { recursive: true });
  const selected = designs.filter((d) => ["x-banner", "paper-card", "linkedin-banner", "og-default"].includes(d.name));
  for (const d of selected) writeFileSync(join(dir, `${d.name}.html`), base(d.w, d.h, d.html));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(selected.map(({ name, w, h }) => ({ name, w, h }))));
  console.log(`Prepared ${selected.length} social designs in ${dir}`);
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
for (const d of designs) {
  const page = await browser.newPage();
  await page.setViewport({ width: d.w, height: d.h, deviceScaleFactor: 1 });
  await page.setContent(base(d.w, d.h, d.html), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const file = join(OUT, `${d.name}.png`);
  await page.screenshot({ path: file, type: "png" });
  copyFileSync(file, join(PUB, `${d.name}.png`));
  // Small avatar sizes for platforms that want them.
  if (d.name.startsWith("avatar")) {
    await page.setViewport({ width: d.w, height: d.h, deviceScaleFactor: 400 / 1024 });
    const small = join(OUT, `${d.name}-400.png`);
    await page.screenshot({ path: small, type: "png" });
    copyFileSync(small, join(PUB, `${d.name}-400.png`));
  }
  await page.close();
  console.log(`${d.name} ${d.w}x${d.h}`);
}
await browser.close();
