import { getRedis } from "@/lib/bookings";

export type Role = "owner" | "cohost" | "cleaner";
export type TelegramSummaryConfig = {
  greeting?: string;
  showArrivals?: boolean;
  showDepartures?: boolean;
  showGuestName?: boolean;
  showPhone?: boolean;
  showSource?: boolean;
  showPrice?: boolean;
  showNights?: boolean;
  showArrivalTime?: boolean;
  showCheckoutTime?: boolean;
  showGapNights?: boolean;
  showQuietDayNote?: boolean;
  timezone?: string;
  scheduleTimes?: string[];
};
export const defaultSummaryConfig: TelegramSummaryConfig = {
  greeting: "Hey Dejan",
  showArrivals: true,
  showDepartures: true,
  showGuestName: true,
  showPhone: true,
  showSource: true,
  showPrice: true,
  showNights: true,
  showArrivalTime: true,
  showCheckoutTime: true,
  showGapNights: true,
  showQuietDayNote: true,
  timezone: "Europe/Skopje",
  scheduleTimes: ["08:00"],
};
export type Property = { id: string; slug: string; name: string; address: string; currency: string; active: boolean; airbnbIcalUrl?: string; bookingIcalUrl?: string; telegramBotToken?: string; telegramChatId?: string; telegramEnabled?: boolean; telegramSummaryConfig?: TelegramSummaryConfig };
export type Unit = { id: string; propertyId: string; name: string; guideKey: string; active: boolean };
export type Guest = { id: string; firstName: string; lastName: string; phone?: string };
export type AccessCredential = { id: string; reservationId: string; type: "private-link" | "pin" | "lockbox"; status: "scheduled" | "active" | "revoked" | "expired"; revealsAt: number; expiresAt: number };
export type Payment = { id: string; reservationId: string; currency: string; guestTotal: number; accommodationRevenue: number; platformCommission: number; cleaningRevenue: number; taxesAndCityTax: number; collected: number };
export type CleaningTask = { id: string; reservationId: string; unitId: string; assigneeId?: string; status: "open" | "scheduled" | "complete"; cost: number };
export type ExpenseRecord = { id: string; propertyId: string; unitId?: string; category: string; amount: number; currency: string; occurredAt: string };
export type MaintenanceIssue = { id: string; propertyId: string; unitId: string; title: string; status: "open" | "in-progress" | "resolved"; assigneeId?: string };
export type MessageEvent = { id: string; reservationId: string; channel: "whatsapp" | "viber" | "airbnb" | "booking" | "sms"; templateId?: string; sentAt: number };
export type AuditEvent = { id: string; actorId: string; role: Role; action: string; entityType: string; entityId: string; createdAt: number };

export const defaultProperty: Property = { id: "konios-house", slug: "konios-house", name: "Konios House", address: "Zil Vern 12, Skopje", currency: "EUR", active: true };
export const defaultUnit: Unit = { id: "konios-house-32", propertyId: defaultProperty.id, name: "Apartment 32", guideKey: "konios-house-32", active: true };

export async function listProperties() {
  const stored = await getRedis().get<Property[]>("portfolio:properties");
  if (!stored?.length) return [defaultProperty];
  return stored.map((property) => ({ ...property, slug: property.slug || property.id }));
}

export async function getPropertyBySlug(slug: string) {
  const normalised = slug.toLowerCase().trim();
  return (await listProperties()).find((property) => property.active && (property.slug === normalised || property.id === normalised)) || null;
}

export async function getPropertyById(id: string) {
  return (await listProperties()).find((property) => property.active && property.id === id) || null;
}

export async function listUnits() {
  const stored = await getRedis().get<Unit[]>("portfolio:units");
  return stored?.length ? stored : [defaultUnit];
}

export async function saveProperties(properties: Property[]) {
  await getRedis().set("portfolio:properties", properties);
  return properties;
}

export async function createProperty(input: { name: string; slug?: string; address: string; currency?: string }) {
  const properties = await listProperties();
  const baseSlug = (input.slug || input.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `property-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;
  while (properties.some((property) => property.slug === slug || property.id === slug)) slug = `${baseSlug}-${suffix++}`;
  const property: Property = { id: crypto.randomUUID(), slug, name: input.name.trim(), address: input.address.trim(), currency: input.currency?.trim().toUpperCase() || "EUR", active: true };
  await saveProperties([...properties, property]);
  return property;
}

export async function updateProperty(id: string, updates: Partial<Omit<Property, "id">>) {
  const properties = await listProperties();
  const updated = properties.map((p) => {
    if (p.id === id) {
      return { ...p, ...updates };
    }
    return p;
  });
  await saveProperties(updated);
  return updated.find((p) => p.id === id) || null;
}
