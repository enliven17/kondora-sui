import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/components/brand/og";

export const alt = "Kondora on Sui: trade what happens next";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg({
    title: "Trade what happens next.",
    subtitle: "Leveraged YES or NO markets on Sui testnet. Agents open and settle markets.",
  });
}
