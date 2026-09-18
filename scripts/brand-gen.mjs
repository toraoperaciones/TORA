import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SYMBOL = "public/brand/tora-simbolo-negro.png";

async function sized(size) {
  const pad = Math.round(size * 0.14);
  const inner = size - pad * 2;
  const symbol = await sharp(SYMBOL)
    .resize(inner, inner, { fit: "inside" })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0x13, g: 0x1f, b: 0x38, alpha: 1 },
    },
  })
    .composite([{ input: symbol, gravity: "center" }])
    .png()
    .toBuffer();
}

const png32 = await sized(32);
const png16 = await sized(16);
await sharp(png32).toFile("public/favicon-32.png");
await sharp(png16).toFile("public/favicon-16.png");

// ICO (PNG-in-ICO): cabecera + 32px + 16px
const header = Buffer.alloc(6 + 16 * 2);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(2, 2);
const off = 6 + 16 * 2;
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(off, 18);
header.writeUInt8(16, 22); header.writeUInt8(16, 23); header.writeUInt8(0, 24); header.writeUInt8(0, 25);
header.writeUInt16LE(1, 26); header.writeUInt16LE(32, 28);
header.writeUInt32LE(png16.length, 30); header.writeUInt32LE(off + png32.length, 34);
writeFileSync("app/favicon.ico", Buffer.concat([header, png32, png16]));

await sharp(await sized(180)).toFile("app/apple-icon.png");

const symWhite = await sharp(SYMBOL)
  .resize(360, 360, { fit: "inside" })
  .tint({ r: 0xf5, g: 0xf5, b: 0xf0 })
  .png()
  .toBuffer();
const ogSvg = Buffer.from(
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
     <rect width="1200" height="630" fill="#131F38"/>
     <text x="600" y="560" text-anchor="middle" fill="#F5F5F0" fill-opacity="0.92"
       font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700"
       letter-spacing="18">TORA</text>
     <text x="600" y="602" text-anchor="middle" fill="#F5F5F0" fill-opacity="0.55"
       font-family="Helvetica, Arial, sans-serif" font-size="24"
       letter-spacing="6">Infraestructura de viajes corporativos</text>
   </svg>`
);
await sharp(ogSvg)
  .composite([{ input: symWhite, top: 90, left: 420 }])
  .png()
  .toFile("public/brand/og.png");

console.log("OK: favicon.ico, favicon-16/32, apple-icon, og.png");
