// Genera un par de claves VAPID para notificaciones push. Uso: npm run vapid
import { webcrypto as c } from "node:crypto";
const kp = await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const b64 = (b) => Buffer.from(b).toString("base64url");
const pub = b64(await c.subtle.exportKey("raw", kp.publicKey));
const jwk = await c.subtle.exportKey("jwk", kp.privateKey);
console.log("Pública (NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PUBLIC_KEY):\n" + pub);
console.log("\nPrivada (solo VAPID_PRIVATE_KEY en Supabase, NUNCA en el código):\n" + jwk.d);
