import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { Expense, deleteExpense, getExpense, updateExpense } from "@/lib/expenses";

async function authorized() {
  return getHostSession((await cookies()).get("konios_host")?.value);
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await authorized();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  const expense = await getExpense(id);
  if (!expense) return Response.json({ error: "Expense entry not found" }, { status: 404 });
  if (session.role !== "master" && !session.propertyIds.includes(expense.propertyId || "konios-house")) return Response.json({ error: "Property access denied." }, { status: 403 });
  const ok = await deleteExpense(id);
  if (!ok) return Response.json({ error: "Expense entry not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await authorized();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  const expense = await getExpense(id);
  if (!expense) return Response.json({ error: "Expense entry not found" }, { status: 404 });
  if (session.role !== "master" && !session.propertyIds.includes(expense.propertyId || "konios-house")) return Response.json({ error: "Property access denied." }, { status: 403 });
  const body = (await request.json()) as Partial<Expense>;

  const updated = await updateExpense(id, body);
  if (!updated) return Response.json({ error: "Expense entry not found" }, { status: 404 });
  return Response.json({ expense: updated });
}
