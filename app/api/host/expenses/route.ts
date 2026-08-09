import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { ExpenseCategory, createExpense, listExpenses } from "@/lib/expenses";

async function authorized() {
  return getHostSession((await cookies()).get("konios_host")?.value);
}

export async function GET(request: Request) {
  const session = await authorized();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const propertyId = new URL(request.url).searchParams.get("propertyId") || (session.role === "property-admin" ? session.propertyIds[0] : "konios-house");
  if (session.role !== "master" && !session.propertyIds.includes(propertyId)) return Response.json({ error: "Property access denied." }, { status: 403 });
  const expenses = await listExpenses(propertyId);
  return Response.json({ expenses });
}

export async function POST(request: Request) {
  const session = await authorized();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const date = String(body.date || "").trim();
  const category = (String(body.category || "Other") as ExpenseCategory);
  const amountEur = Number(body.amountEur) || 0;
  const amountMkd = body.amountMkd ? Number(body.amountMkd) : undefined;
  const notes = String(body.notes || "").trim();
  const bookingId = body.bookingId ? String(body.bookingId) : undefined;
  const propertyId = String(body.propertyId || (session.role === "property-admin" ? session.propertyIds[0] : "konios-house"));
  if (session.role !== "master" && !session.propertyIds.includes(propertyId)) return Response.json({ error: "Property access denied." }, { status: 403 });

  if (!date) {
    return Response.json({ error: "Please select an expense date." }, { status: 400 });
  }

  if (amountEur <= 0 && (!amountMkd || amountMkd <= 0)) {
    return Response.json({ error: "Please enter a valid expense amount." }, { status: 400 });
  }

  const expense = await createExpense({
    date,
    propertyId,
    category,
    amountEur,
    amountMkd,
    notes,
    bookingId,
  });

  return Response.json({ expense });
}
