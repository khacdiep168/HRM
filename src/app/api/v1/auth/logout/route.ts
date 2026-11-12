import { NextResponse } from "next/server";
import { getSupabaseServerSessionClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await getSupabaseServerSessionClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true });
}

