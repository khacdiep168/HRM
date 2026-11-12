import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "DemoTkv@2026!";

const DEMO_ACCOUNTS = [
  {
    email: "demo.employee@thekyvang.vn",
    employeeCode: "TKV-0004",
    roles: ["EMPLOYEE"],
    fullName: "Lê Hoàng Phúc (Demo Employee)",
  },
  {
    email: "demo.manager@thekyvang.vn",
    employeeCode: "TKV-0006",
    roles: ["DEPARTMENT_MANAGER"],
    fullName: "Võ Văn Hùng (Demo Manager)",
  },
  {
    email: "demo.payroll@thekyvang.vn",
    employeeCode: "TKV-0003",
    roles: ["HR_ADMIN", "ACCOUNTANT"],
    fullName: "Trần Thị Ngọc Lan (Demo HR/Payroll)",
  },
  {
    email: "demo.director@thekyvang.vn",
    employeeCode: "TKV-0002",
    roles: ["DIRECTOR"],
    fullName: "Nguyễn Minh Tuấn (Demo Director)",
  },
];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const [{ data: company }, { data: rolesRows }, { data: employees }, { data: existingAuth }] =
    await Promise.all([
      admin.from("companies").select("id").limit(1).single(),
      admin.from("roles").select("id, code"),
      admin.from("employees").select("id, employee_code, full_name"),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

  if (!company) throw new Error("Company row not found");
  const roleMap = new Map((rolesRows ?? []).map((r) => [r.code, r.id]));
  const empMap = new Map((employees ?? []).map((e) => [e.employee_code, e.id]));
  const authByEmail = new Map(
    (existingAuth?.users ?? []).map((u) => [u.email?.toLowerCase(), u])
  );

  for (const acc of DEMO_ACCOUNTS) {
    const empId = empMap.get(acc.employeeCode) ?? null;
    const existing = authByEmail.get(acc.email.toLowerCase());
    let userId = existing?.id;

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: acc.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acc.fullName, is_demo: true },
      });
      if (error) throw error;
      userId = created.user.id;
    } else {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acc.fullName, is_demo: true },
      });
      if (error) throw error;
    }

    const { error: userUpsertErr } = await admin.from("users").upsert(
      {
        id: userId,
        company_id: company.id,
        employee_id: empId,
        email: acc.email,
        mfa_required: false,
        mfa_enabled: false,
        status: "ACTIVE",
      },
      { onConflict: "id" }
    );
    if (userUpsertErr) throw userUpsertErr;

    await admin.from("user_roles").delete().eq("user_id", userId);
    const roleInserts = acc.roles
      .map((code) => roleMap.get(code))
      .filter(Boolean)
      .map((roleId) => ({
        user_id: userId,
        role_id: roleId,
      }));

    if (roleInserts.length > 0) {
      const { error: roleErr } = await admin.from("user_roles").insert(roleInserts);
      if (roleErr) throw roleErr;
    }

    console.log(`READY: ${acc.email} -> emp=${acc.employeeCode} (${empId ?? "NONE"}) roles=[${acc.roles.join(",")}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

