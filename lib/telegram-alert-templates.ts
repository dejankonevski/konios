export type TelegramAlertTemplateKey =
  | "checkInAlertTemplate"
  | "scheduledCleaningAlertTemplate"
  | "unscheduledCleaningAlertTemplate"
  | "turnaroundAlertTemplate";

export const defaultTelegramAlertTemplates: Record<TelegramAlertTemplateKey, string> = {
  checkInAlertTemplate: "🔑 <b>GUEST CHECK-IN</b>\n🏢 <b>{propertyName}</b>\n👤 {guestName}\n📅 {checkInDate} at {checkInTime}\n📱 {phone}\n🌐 {bookingSource}\n✅ {checkInStatus}",
  scheduledCleaningAlertTemplate: "🧹 <b>CHECKOUT — CLEANING CAN START</b>\n🏢 <b>{propertyName}</b>\n👤 {guestName}\n⏰ Checkout: {checkOutTime}\n✅ {cleaningStatus}\n💵 {cleaningFee}",
  unscheduledCleaningAlertTemplate: "🚨 <b>CHECKOUT — CLEANING NOT SCHEDULED</b>\n🏢 <b>{propertyName}</b>\n👤 {guestName}\n⏰ Checkout: {checkOutTime}\n❌ <b>{cleaningStatus}</b>\n⚠️ Assign cleaning immediately and confirm with the team.",
  turnaroundAlertTemplate: "⚡ <b>URGENT SAME-DAY TURNAROUND</b>\n🏢 <b>{propertyName}</b>\n🛫 {guestName} checks out at {checkOutTime}\n🛬 {nextGuestName} arrives at {nextArrivalTime}\n⏱ Cleaning window: {cleaningWindow}\n🧹 {cleaningStatus}",
};

export const telegramAlertTemplateOptions: Array<{ key: TelegramAlertTemplateKey; label: string; description: string }> = [
  { key: "checkInAlertTemplate", label: "Guest check-in", description: "Sent when a guest reports arrival or successful entry." },
  { key: "scheduledCleaningAlertTemplate", label: "Scheduled cleaning", description: "Sent at checkout when cleaning is already assigned." },
  { key: "unscheduledCleaningAlertTemplate", label: "Cleaning not scheduled", description: "Urgent checkout alert when nobody is assigned." },
  { key: "turnaroundAlertTemplate", label: "Same-day turnaround", description: "Priority alert when one guest leaves and another arrives today." },
];

export const telegramTemplatePlaceholders = [
  "propertyName", "guestName", "phone", "bookingSource", "checkInDate", "checkInTime", "checkInStatus",
  "checkOutDate", "checkOutTime", "cleaningStatus", "cleaningFee", "nextGuestName",
  "nextArrivalTime", "cleaningWindow",
] as const;

function escapeTelegramHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderTelegramAlertTemplate(template: string, values: Record<string, unknown>) {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (placeholder, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? escapeTelegramHtml(values[key]) : placeholder
  ));
}

export function plainTelegramPreview(message: string) {
  return message.replace(/<\/?(?:b|i|u|code)>/g, "");
}


