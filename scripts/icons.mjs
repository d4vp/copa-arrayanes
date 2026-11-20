// Genera los íconos PWA a partir del logo vectorial. Uso: npm run icons
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const mark = readFileSync("public/brand/logo-mark.svg", "utf8");
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// Ícono sobre fondo blanco (any) y versión "maskable" con zona segura (80%).
const onBg = (bg, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${bg}"/>
  <g transform="translate(${50 - 32 * scale * 0.9} ${50 - 36 * scale * 0.9}) scale(${scale * 0.9})">${inner}</g></svg>`;

const jobs = [
  ["public/icons/icon-192.png", onBg("#ffffff", 1.25), 192],
  ["public/icons/icon-512.png", onBg("#ffffff", 1.25), 512],
  ["public/icons/maskable-512.png", onBg("#eff6ff", 0.95), 512],
  ["public/icons/apple-touch-icon.png", onBg("#ffffff", 1.15), 180],
  ["public/icons/favicon-32.png", onBg("#ffffff", 1.35), 32],
];
for (const [file, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 400 }).resize(size, size).png().toFile(file);
}
// Imagen para compartir (redes / WhatsApp) 1200x630
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect y="590" width="1200" height="40" fill="#16a34a"/>
  <g transform="translate(110 135) scale(5)">${inner.replace(/fill="#1d4ed8"/, 'fill="#ffffff" fill-opacity=".08"')}</g>
  <text x="520" y="290" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="92" fill="#fff">COPA</text>
  <text x="520" y="385" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="92" fill="#fff">ARRAYANES</text>
  <text x="522" y="445" font-family="Arial, sans-serif" font-size="30" fill="#bfdbfe">Vereda Los Arrayanes · Córdoba, Nariño</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile("public/brand/og.png");
writeFileSync("public/brand/.generated", new Date().toISOString());
console.log("Íconos generados");
