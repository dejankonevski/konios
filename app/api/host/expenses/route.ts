import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { ExpenseCategory, createExpense, listExpenses } from "@/lib/expenses";

async function authorized() {
  return verifyHostToken((await cookies()).get("konios_host")?.value);
}

export async function GET() {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = await listExpenses();
  return Response.json({ expenses });
}

export async function POST(request: Request) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const date = String(body.date || "").trim();
  const category = (String(body.category || "Other") as ExpenseCategory);
  const amountEur = Number(body.amountEur) || 0;
  const amountMkd = body.amountMkd ? Number(body.amountMkd) : undefined;
  const notes = String(body.notes || "").trim();
  const bookingId = body.bookingId ? String(body.bookingId) : undefined;

  if (!date) {
    return Response.json({ error: "Please select an expense date." }, { status: 400 });
  }

  if (amountEur <= 0 && (!amountMkd || amountMkd <= 0)) {
    return Response.json({ error: "Please enter a valid expense amount." }, { status: 400 });
  }

  const expense = await createExpense({
    date,
    category,
    amountEur,
    amountMkd,
    notes,
    bookingId,
  });

  return Response.json({ expense });
}
