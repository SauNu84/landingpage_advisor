import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function getKey(): Buffer {
  const raw =
    process.env.SESSION_SECRET ?? "dev-secret-must-change-in-production!!";
  return createHash("sha256").update(raw).digest();
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const key = getKey();
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(ciphertext: string): string {
  const colonIndex = ciphertext.indexOf(":");
  if (colonIndex === -1) throw new Error("Invalid ciphertext format");
  const ivHex = ciphertext.slice(0, colonIndex);
  const encrypted = ciphertext.slice(colonIndex + 1);
  const iv = Buffer.from(ivHex, "hex");
  const key = getKey();
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
