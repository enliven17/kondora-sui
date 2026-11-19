# Kondora brand

The design system and asset contract live in [DESIGN.md](./DESIGN.md). This file is the short guide for using the brand. A live version is at sui.kondora.xyz/brand.

## Logo

The mark is a split coin: two half discs offset horizontally. YES and NO, shifted apart by leverage. The wordmark is lowercase "kondora" in Satoshi Bold, converted to outlines.

| File | Use |
| --- | --- |
| `logo/kondora-lockup-plum-on-paper.svg` | Default, on light surfaces |
| `logo/kondora-lockup-paper-on-plum.svg` | On dark surfaces |
| `logo/kondora-lockup-mono.svg`, `-mono-white.svg` | One-color print, embossing, partner pages |
| `logo/kondora-mark-*.svg` | Avatars, favicons, small spaces |
| `logo/kondora-mark-app.svg` | App icon (paper mark on plum) |
| `logo/kondora-wordmark-*.svg` | When the mark already appears nearby |
| `logo/*.png` | Raster exports at 1024 to 2000px |

`kondora-mark.svg`, `kondora-wordmark.svg` and `kondora-lockup.svg` use `currentColor`.

Regenerate every file (including `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico` and `components/brand/logo-paths.ts`) with:

```bash
node brand/scripts/build-logo.mjs
```

**Clear space:** the height of one half disc on every side.
**Minimum size:** mark 16px, lockup 80px wide.

## Colors

| Name | Hex | Use |
| --- | --- | --- |
| Paper | #FFF3F5 | Marketing background |
| Blush | #FFDAE0 | Soft panels on paper |
| Petal | #FFC7CF | Chevron squares in buttons |
| Petal hot | #FF8A94 | Big numbers on dark, focus ring |
| Acc | #FFFC8F | The action color |
| Plum | #320713 | Primary button, logo |
| Cocoa | #23050D | Dark cards on paper |
| App bg | #1B0A0E | App background |
| Mauve | #7A5E66 | Body text on paper |
| Muted | #A8969B | Secondary text on dark |
| Up | #34D57F | YES, profit |
| Down | #E0344B | NO, loss |

## Type

Satoshi for everything (variable 300 to 900, static Bold and Medium in `app/fonts/` for OG images). Display at 700 with -0.04em tracking, section titles at 500, labels 11px uppercase. Numbers use `.num`. Geist Mono only for addresses and hashes.

## Buttons

Radius 10. Primary buttons carry a 32px petal square with a plum chevron on the left (`<ButtonLink arrow>`). Dark on paper, light on imagery, accent for quick bets. No pills.

## Imagery

Dreamy pastel 3D world: soft pink and peach blossoms, warm haze, glossy plum and petal coins and orbs embossed with the split-coin mark, low saturation, light grain. Objects sit on plain blush. All raster art is in `public/art/` and is regenerated with Codex, then optimized with:

```bash
node brand/scripts/optimize-art.mjs <png-dir>
```

## Do

- Plum on paper, paper on plum.
- Keep the halves of the mark offset exactly as drawn.
- Lowercase in the logo, "Kondora" in running text.
- Short, plain copy.

## Don't

- Rotate, stretch, outline or shadow the mark.
- Close the gap between the halves or flip the offset.
- Place the logo on busy imagery without a solid panel.
- Pill shapes, dot ornaments, decorative accent lines, em dashes.
- Statues, birds, night skies, people.
