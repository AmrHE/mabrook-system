// app/api/logout/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("role");
  cookieStore.delete("email");
  cookieStore.delete("userId");

  return NextResponse.json({ success: true });
}
