import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { googleCredentials } from "@/lib/google-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({
    google: Boolean(googleCredentials()),
    session,
  });
}
