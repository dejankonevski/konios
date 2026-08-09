import { getRedis } from "@/lib/bookings";

export type ExpenseCategory =
  | "Cleaning Agency"
  | "Supplies & Amenities"
  | "Utilities"
  | "Maintenance & Repairs"
  | "Laundry"
  | "Other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Cleaning Agency",
  "Supplies & Amenities",
  "Utilities",
  "Maintenance & Repairs",
  "Laundry",
  "Other",
];

export type Expense = {
  id: string;
  propertyId?: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amountEur: number;
  amountMkd?: number;
  notes: string;
  bookingId?: string;
  createdAt: number;
};

const EXPENSES_KEY = "property_expenses";
export const EUR_TO_MKD = 61.5;

function randomId() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return `exp_${Date.now()}_${values[0] % 10000}`;
}

export async function listExpenses(propertyId?: string): Promise<Expense[]> {
  const redis = getRedis();
  const raw = await redis.get<Expense[]>(EXPENSES_KEY);
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((expense) => !propertyId || (expense.propertyId || "konios-house") === propertyId).sort((a, b) => b.date.localeCompare(a.date));
}

export async function createExpense(
  input: Omit<Expense, "id" | "createdAt">
): Promise<Expense> {
  const redis = getRedis();
  const existing = await listExpenses();

  const amountEur = Number(input.amountEur) || 0;
  const amountMkd = input.amountMkd ? Number(input.amountMkd) : Math.round(amountEur * EUR_TO_MKD);

  const newExpense: Expense = {
    id: randomId(),
    propertyId: input.propertyId || "konios-house",
    date: input.date || new Date().toISOString().slice(0, 10),
    category: input.category || "Other",
    amountEur,
    amountMkd,
    notes: input.notes?.trim() || "",
    bookingId: input.bookingId || undefined,
    createdAt: Date.now(),
  };

  const updated = [newExpense, ...existing];
  await redis.set(EXPENSES_KEY, updated);
  return newExpense;
}

export async function getExpense(id: string) {
  return (await listExpenses()).find((expense) => expense.id === id) || null;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const redis = getRedis();
  const existing = await listExpenses();
  const filtered = existing.filter((e) => e.id !== id);
  if (filtered.length === existing.length) return false;
  await redis.set(EXPENSES_KEY, filtered);
  return true;
}

export async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, "id" | "createdAt">>
): Promise<Expense | null> {
  const redis = getRedis();
  const existing = await listExpenses();
  const index = existing.findIndex((e) => e.id === id);
  if (index === -1) return null;

  const item = existing[index];
  const updatedItem: Expense = {
    ...item,
    ...updates,
  };

  if (updates.amountEur !== undefined) {
    updatedItem.amountEur = Number(updates.amountEur) || 0;
    updatedItem.amountMkd = Math.round(updatedItem.amountEur * EUR_TO_MKD);
  } else if (updates.amountMkd !== undefined) {
    updatedItem.amountMkd = Number(updates.amountMkd) || 0;
    updatedItem.amountEur = Number((updatedItem.amountMkd / EUR_TO_MKD).toFixed(2));
  }

  existing[index] = updatedItem;
  await redis.set(EXPENSES_KEY, existing);
  return updatedItem;
}
