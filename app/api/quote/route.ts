import { NextResponse } from "next/server";
import { loadBookableStay } from "@/lib/bookable-stay";
import { quoteStay, type QuoteInput } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as QuoteInput & { stayId?: string };
  const stay = await loadBookableStay(String(body.stayId ?? ""));
  if (!stay) return NextResponse.json({ error: "Stay not found" }, { status: 404 });
  const quote = quoteStay(stay, body);
  return NextResponse.json(quote);
}
