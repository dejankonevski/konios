import { getRedis } from "@/lib/bookings";

export type CalendarBlock = {
  id: string;
  propertyId: string;
  start: string;
  end: string;
  note: string;
  createdAt: number;
};

const key = (propertyId: string) => `calendar:blocks:${propertyId}`;

export async function listCalendarBlocks(propertyId: string) {
  const blocks = await getRedis().get<CalendarBlock[]>(key(propertyId));
  return Array.isArray(blocks) ? blocks.sort((a, b) => a.start.localeCompare(b.start)) : [];
}

export async function createCalendarBlock(input: Omit<CalendarBlock, "id" | "createdAt">) {
  const blocks = await listCalendarBlocks(input.propertyId);
  const block: CalendarBlock = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
  await getRedis().set(key(input.propertyId), [...blocks, block]);
  return block;
}

export async function deleteCalendarBlock(propertyId: string, id: string) {
  const blocks = await listCalendarBlocks(propertyId);
  const updated = blocks.filter((block) => block.id !== id);
  if (updated.length === blocks.length) return false;
  await getRedis().set(key(propertyId), updated);
  return true;
}
