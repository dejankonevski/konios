export type GuestPass = {
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  issuedAt: number;
};

const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) throw new Error("ACCESS_CODE_SECRET is not configured");
  return secret;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signed));
}

export async function createGuestCode(pass: GuestPass) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(pass)));
  return `${payload}.${await signature(payload)}`;
}

export async function createHostToken() {
  return signature("konios-host-session");
}

export async function verifyHostToken(token?: string) {
  if (!token) return false;
  const expected = await createHostToken();
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < token.length; index += 1) mismatch |= token.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function verifyGuestCode(code: string): Promise<GuestPass | null> {
  try {
    const [payload, suppliedSignature, extra] = code.trim().split(".");
    if (!payload || !suppliedSignature || extra) return null;
    const expectedSignature = await signature(payload);
    if (suppliedSignature.length !== expectedSignature.length) return null;

    let mismatch = 0;
    for (let index = 0; index < suppliedSignature.length; index += 1) {
      mismatch |= suppliedSignature.charCodeAt(index) ^ expectedSignature.charCodeAt(index);
    }
    if (mismatch !== 0) return null;

    const pass = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as GuestPass;
    if (!pass.firstName || !pass.lastName || !/^\d{4}-\d{2}-\d{2}$/.test(pass.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(pass.checkOut)) return null;
    const expiresAt = new Date(`${pass.checkOut}T23:59:59.999Z`).getTime();
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    return pass;
  } catch {
    return null;
  }
}
