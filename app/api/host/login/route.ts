import { cookies } from "next/headers";
import { createHostToken } from "@/lib/access-code";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  if (password !== "300715") return Response.json({ error: "Incorrect password." }, { status: 401 });

  (await cookies()).set("konios_host", await createHostToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete("konios_host");
  return Response.json({ ok: true });
}
