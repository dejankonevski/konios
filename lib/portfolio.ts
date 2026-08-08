import { getRedis } from "@/lib/bookings";

export type Role = "owner" | "cohost" | "cleaner";
export type Property = { id: string; name: string; address: string; currency: string; active: boolean };
export type Unit = { id: string; propertyId: string; name: string; guideKey: string; active: boolean };
export type Guest = { id: string; firstName: string; lastName: string; phone?: string };
export type AccessCredential = { id: string; reservationId: string; type: "private-link" | "pin" | "lockbox"; status: "scheduled" | "active" | "revoked" | "expired"; revealsAt: number; expiresAt: number };
export type Payment = { id: string; reservationId: string; currency: string; guestTotal: number; accommodationRevenue: number; platformCommission: number; cleaningRevenue: number; taxesAndCityTax: number; collected: number };
export type CleaningTask = { id: string; reservationId: string; unitId: string; assigneeId?: string; status: "open" | "scheduled" | "complete"; cost: number };
export type ExpenseRecord = { id: string; propertyId: string; unitId?: string; category: string; amount: number; currency: string; occurredAt: string };
export type MaintenanceIssue = { id: string; propertyId: string; unitId: string; title: string; status: "open" | "in-progress" | "resolved"; assigneeId?: string };
export type MessageEvent = { id: string; reservationId: string; channel: "whatsapp" | "viber" | "airbnb" | "booking" | "sms"; templateId?: string; sentAt: number };
export type AuditEvent = { id: string; actorId: string; role: Role; action: string; entityType: string; entityId: string; createdAt: number };

export const defaultProperty: Property = { id: "konios-house", name: "Konios House", address: "Zil Vern 12, Skopje", currency: "EUR", active: true };
export const defaultUnit: Unit = { id: "konios-house-32", propertyId: defaultProperty.id, name: "Apartment 32", guideKey: "konios-house-32", active: true };

export async function listProperties() {
  const stored = await getRedis().get<Property[]>("portfolio:properties");
  return stored?.length ? stored : [defaultProperty];
}

export async function listUnits() {
  const stored = await getRedis().get<Unit[]>("portfolio:units");
  return stored?.length ? stored : [defaultUnit];
}
