import Stripe from "stripe";
import { getRedis } from "@/lib/bookings";

const STRIPE_SETTINGS_KEY = "settings:stripe-secret";
const encoder = new TextEncoder();

type EncryptedStripeSecret = {
  version: 1;
  iv: string;
  ciphertext: string;
  last4: string;
  mode: "test" | "live";
  updatedAt: number;
};

function base64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value);
}

function unbase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) throw new Error("ACCESS_CODE_SECRET is required to protect Stripe settings.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`konios-stripe:${secret}`));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptStripeSecret(secret: string): Promise<EncryptedStripeSecret> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(secret));
  return {
    version: 1,
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(encrypted)),
    last4: secret.slice(-4),
    mode: secret.startsWith("sk_live_") ? "live" : "test",
    updatedAt: Date.now(),
  };
}

async function decryptStripeSecret(record: EncryptedStripeSecret) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unbase64(record.iv) },
    await encryptionKey(),
    unbase64(record.ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

export async function getStripeSecret() {
  const stored = await getRedis().get<EncryptedStripeSecret>(STRIPE_SETTINGS_KEY);
  if (stored?.ciphertext) return decryptStripeSecret(stored);
  return process.env.STRIPE_SECRET_KEY || null;
}

export async function getStripeStatus() {
  const stored = await getRedis().get<EncryptedStripeSecret>(STRIPE_SETTINGS_KEY);
  if (stored?.ciphertext) return { configured: true, last4: stored.last4, mode: stored.mode, source: "admin" as const, updatedAt: stored.updatedAt };
  const environmentSecret = process.env.STRIPE_SECRET_KEY;
  return environmentSecret
    ? { configured: true, last4: environmentSecret.slice(-4), mode: environmentSecret.startsWith("sk_live_") ? "live" as const : "test" as const, source: "environment" as const, updatedAt: null }
    : { configured: false, last4: null, mode: null, source: null, updatedAt: null };
}

export async function verifyAndSaveStripeSecret(secret: string) {
  const normalized = secret.trim();
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(normalized)) throw new Error("Enter a valid Stripe secret key beginning with sk_test_ or sk_live_.");
  const stripe = new Stripe(normalized, { typescript: true });
  const account = await stripe.accounts.retrieve(null);
  await getRedis().set(STRIPE_SETTINGS_KEY, await encryptStripeSecret(normalized));
  return { accountId: account.id, mode: normalized.startsWith("sk_live_") ? "live" as const : "test" as const, last4: normalized.slice(-4) };
}

export async function stripeClient() {
  const secret = await getStripeSecret();
  if (!secret) throw new Error("Stripe is not configured.");
  return new Stripe(secret, { typescript: true });
}
