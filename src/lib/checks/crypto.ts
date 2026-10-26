import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { required } from "../server/config";
export type Sealed = { v: 1; nonce: string; tag: string; data: string };
function key() {
  const bytes = Buffer.from(required("CREDENTIAL_ENCRYPTION_KEY"), "base64");
  if (bytes.length !== 32) throw new Error("CONFIG:CREDENTIAL_ENCRYPTION_KEY");
  return bytes;
}
export function seal(value: string, aad: string): Sealed {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    v: 1,
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}
export function unseal(value: Sealed, aad: string) {
  if (value.v !== 1) throw new Error("Unsupported key version");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(value.nonce, "base64"),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
