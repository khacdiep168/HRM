import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasAnonKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your-supabase-anon-key"
  );
  const hasServiceKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY !== "your-supabase-service-role-key"
  );
  const hasPiiKeys = Boolean(
    process.env.PII_ENCRYPTION_KEY_BASE64 &&
      process.env.PII_ENCRYPTION_KEY_BASE64 !== "replace-with-32-byte-base64-key"
  );

  return NextResponse.json({
    data: {
      service: "hrm-thekyvang-enterprise",
      phase: "Phase 1 - Core HR, Org, Auth/RBAC & PDPL 91/2025",
      company: "CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG",
      supabaseProjectExpected: "xtswzywqbizunynahmvl",
      supabaseConfigured: supabaseUrl.includes("supabase.co") && hasAnonKey && hasServiceKey,
      piiEncryptionConfigured: hasPiiKeys,
      timestampUtc: new Date().toISOString(),
    },
  });
}

