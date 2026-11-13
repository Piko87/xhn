import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const db = getDb();
  const count = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  const session = db
    .prepare("SELECT id FROM sessions WHERE session_date = '2026-11-15' AND start_time = '19:30' AND product_id = 1")
    .get() as { id: number } | undefined;
  return NextResponse.json({
    ok: true,
    users: count("users"),
    products: count("products"),
    tickets: count("tickets"),
    venues: count("venues"),
    seats: count("seats"),
    sessions: count("sessions"),
    orders: count("orders"),
    refunds: count("refunds"),
    scarceSession: session?.id ?? null,
  });
}
