/**
 * Tests: src/lib/encrypt.ts
 * AES-256-CBC symmetric encryption utilities
 */

process.env.SESSION_SECRET = "test-secret-32chars-padded-here!!";

import { encrypt, decrypt } from "@/lib/encrypt";

describe("encrypt / decrypt", () => {
  it("round-trips a plain-text string", () => {
    const original = "phc_mySecretApiKey1234567890";
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const text = "same-input";
    const c1 = encrypt(text);
    const c2 = encrypt(text);
    expect(c1).not.toBe(c2);
  });

  it("ciphertext format is iv:encrypted (colon separator)", () => {
    const ct = encrypt("hello");
    expect(ct).toMatch(/^[0-9a-f]{32}:.+$/);
  });

  it("decrypt throws on malformed ciphertext (no colon)", () => {
    expect(() => decrypt("nodividerhere")).toThrow("Invalid ciphertext format");
  });

  it("decrypt throws on tampered ciphertext", () => {
    const ct = encrypt("original");
    const tampered = ct.slice(0, -4) + "ffff";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("handles empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("handles unicode content", () => {
    const original = "api-key: \u4e2d\u6587\u6d4b\u8bd5 🔑";
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it("handles long strings (>1 AES block)", () => {
    const original = "x".repeat(500);
    expect(decrypt(encrypt(original))).toBe(original);
  });
});
