import { getRedis } from "@/lib/bookings";

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

export type HostRole = "master" | "property-admin";
export type HostSession = { id: string; role: HostRole; username: string; propertyIds: string[] };
export type PropertyAdmin = { id: string; username: string; passwordHash: string; salt: string; propertyIds: string[]; active: boolean; createdAt: number };

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function derivePassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 210_000 }, key, 256);
  return toBase64Url(new Uint8Array(bits));
}

async function passwordMatches(password: string, hash: string, salt: string) {
  const candidate = await derivePassword(password, salt);
  if (candidate.length !== hash.length) return false;
  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) mismatch |= candidate.charCodeAt(index) ^ hash.charCodeAt(index);
  return mismatch === 0;
}

export async function createPasswordRecord(password: string) {
  const salt = randomSalt();
  return { salt, passwordHash: await derivePassword(password, salt) };
}

export async function createHostToken(session: HostSession = { id: "master", role: "master", username: "master", propertyIds: [] }) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = toBase64Url(bytes);
  await Promise.all([
    getRedis().set(`host-session:${token}`, { ...session, createdAt: Date.now() }, { ex: 60 * 60 * 8 }),
    getRedis().sadd(`host-sessions:${session.id}`, token),
  ]);
  return token;
}

export async function verifyHostToken(token?: string) {
  return Boolean(await getHostSession(token));
}

export async function getHostSession(token?: string): Promise<HostSession | null> {
  if (!token) return null;
  const session = await getRedis().get<HostSession>(`host-session:${token}`);
  return session?.role ? session : null;
}

export async function verifyMasterPassword(password: string) {
  const stored = await getRedis().get<{ passwordHash: string; salt: string }>("auth:master");
  if (stored) return passwordMatches(password, stored.passwordHash, stored.salt);
  const configured = process.env.HOST_PASSWORD;
  if (!configured || password.length !== configured.length) return false;
  let mismatch = 0;
  for (let index = 0; index < password.length; index += 1) mismatch |= password.charCodeAt(index) ^ configured.charCodeAt(index);
  return mismatch === 0;
}

export async function setMasterPassword(password: string) {
  await getRedis().set("auth:master", await createPasswordRecord(password));
}

export async function getPropertyAdmin(username: string) {
  return getRedis().get<PropertyAdmin>(`auth:property-admin:${username.toLowerCase()}`);
}

export async function verifyPropertyAdminPassword(username: string, password: string) {
  const admin = await getPropertyAdmin(username);
  if (!admin?.active || !(await passwordMatches(password, admin.passwordHash, admin.salt))) return null;
  return admin;
}

export async function listPropertyAdmins() {
  const usernames = await getRedis().smembers<string[]>("auth:property-admins");
  if (!usernames.length) return [];
  return (await Promise.all(usernames.map((username) => getPropertyAdmin(username)))).filter((admin): admin is PropertyAdmin => Boolean(admin));
}

export async function savePropertyAdmin(input: { id?: string; username: string; password?: string; propertyIds: string[]; active?: boolean }) {
  const username = input.username.trim().toLowerCase();
  const existing = await getPropertyAdmin(username);
  if (!existing && !input.password) throw new Error("A password is required for a new manager.");
  const password = input.password ? await createPasswordRecord(input.password) : existing!;
  const admin: PropertyAdmin = {
    id: existing?.id || input.id || crypto.randomUUID(),
    username,
    passwordHash: password.passwordHash,
    salt: password.salt,
    propertyIds: input.propertyIds,
    active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt || Date.now(),
  };
  await Promise.all([
    getRedis().set(`auth:property-admin:${username}`, admin),
    getRedis().sadd("auth:property-admins", username),
  ]);
  if (input.password || input.active === false) await revokeHostSessions(admin.id);
  return admin;
}

export async function revokeHostToken(token?: string) {
  if (!token) return;
  const session = await getHostSession(token);
  await getRedis().del(`host-session:${token}`);
  if (session) await getRedis().srem(`host-sessions:${session.id}`, token);
}

export async function revokeHostSessions(id: string) {
  const tokens = await getRedis().smembers<string[]>(`host-sessions:${id}`);
  if (tokens.length) await Promise.all(tokens.map((token) => getRedis().del(`host-session:${token}`)));
  await getRedis().del(`host-sessions:${id}`);
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
