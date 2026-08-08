import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { Expense, deleteExpense, updateExpense } from "@/lib/expenses";

async function authorized() {
  return verifyHostToken((await cookies()).get("konios_host")?.value);
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  const ok = await deleteExpense(id);
  if (!ok) return Response.json({ error: "Expense entry not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  const body = (await request.json()) as Partial<Expense>;

  const updated = await updateExpense(id, body);
  if (!updated) return Response.json({ error: "Expense entry not found" }, { status: 404 });
  return Response.json({ expense: updated });
}
