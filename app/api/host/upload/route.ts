import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { getRedis } from "@/lib/bookings";

export async function POST(request: Request) {
  try {
    const isAuthorised = await verifyHostToken((await cookies()).get("konios_host")?.value);
    if (!isAuthorised) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image (JPG, PNG, WebP)" }, { status: 400 });
    }

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image file size must be under 10MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/jpeg";
    const id = crypto.randomUUID();
    await getRedis().set(`media:${id}`, { mimeType, base64: buffer.toString("base64") });

    return NextResponse.json({ success: true, url: `/api/media/${id}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload image file" }, { status: 500 });
  }
}
