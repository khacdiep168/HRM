import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aesKeyB64 = process.env.PII_ENCRYPTION_KEY_BASE64;
const hmacKeyB64 = process.env.PII_HMAC_KEY_BASE64;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey);

function encryptPii(plaintext) {
  if (!aesKeyB64) return null;
  const key = Buffer.from(aesKeyB64, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function hmacBlindIndex(plaintext) {
  if (!hmacKeyB64) return null;
  const key = Buffer.from(hmacKeyB64, "base64");
  return crypto.createHmac("sha256", key).update(plaintext.trim()).digest("hex");
}

async function run() {
  console.log("🚀 Bắt đầu nạp dữ liệu mẫu Enterprise cho CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG...");

  const { data: company, error: compErr } = await sb
    .from("companies")
    .select("id, legal_name")
    .limit(1)
    .single();
  if (compErr || !company) throw compErr ?? new Error("Company not found");
  const companyId = company.id;

  const { data: adminUser, error: userErr } = await sb
    .from("users")
    .select("id")
    .limit(1)
    .single();
  if (userErr || !adminUser) throw userErr ?? new Error("Admin user not found");
  const actorUserId = adminUser.id;

  const [locsRes, deptsRes, posRes, ccRes, leaveTypesRes, periodsRes, devicesRes] =
    await Promise.all([
      sb.from("locations").select("id, code, name").eq("company_id", companyId),
      sb.from("departments").select("id, code, name").eq("company_id", companyId),
      sb.from("positions").select("id, code, title, department_id").eq("company_id", companyId),
      sb.from("cost_centers").select("id, code").eq("company_id", companyId),
      sb.from("leave_types").select("id, code").eq("company_id", companyId),
      sb.from("payroll_periods").select("id, period_code").eq("company_id", companyId),
      sb.from("attendance_devices").select("id, device_code, location_id").eq("company_id", companyId),
    ]);

  const locs = Object.fromEntries((locsRes.data ?? []).map((x) => [x.code, x]));
  const depts = Object.fromEntries((deptsRes.data ?? []).map((x) => [x.code, x]));
  const positions = posRes.data ?? [];
  const ccs = ccRes.data ?? [];
  const leaveTypes = Object.fromEntries((leaveTypesRes.data ?? []).map((x) => [x.code, x]));
  const periodNov = periodsRes.data?.[0];
  const devices = devicesRes.data ?? [];

  const defaultLoc = locs["HQ-TN"] ?? Object.values(locs)[0];
  const defaultCc = ccs[0];
  const findPos = (deptCode) => {
    const dept = depts[deptCode];
    return positions.find((p) => p.department_id === dept?.id) ?? positions[0];
  };

  const demoEmployees = [
    { code: "TKV-0001", name: "Khắc Điệp", dob: "1989-05-15", phone: "0908111001", email: "khacdiep168@gmail.com", gender: "MALE", cccd: "072089000001", hire: "2020-01-01", status: "ACTIVE", dept: "HR", loc: "HQ-TN", salary: 25000000, si: 25000000, dep: 1 },
    { code: "TKV-0002", name: "Nguyễn Minh Tuấn", dob: "1988-08-20", phone: "0908111002", email: "tuan.nm@thekyvang.vn", gender: "MALE", cccd: "072088001102", hire: "2022-03-01", status: "ACTIVE", dept: "BOD", loc: "HQ-TN", salary: 38000000, si: 38000000, dep: 2 },
    { code: "TKV-0003", name: "Trần Thị Ngọc Lan", dob: "1991-11-12", phone: "0908111003", email: "lan.ttn@thekyvang.vn", gender: "FEMALE", cccd: "072191002304", hire: "2023-01-15", status: "ACTIVE", dept: "ACC", loc: "HQ-TN", salary: 22000000, si: 22000000, dep: 1 },
    { code: "TKV-0004", name: "Lê Hoàng Phúc", dob: "1993-04-05", phone: "0908111004", email: "phuc.lh@thekyvang.vn", gender: "MALE", cccd: "072093004506", hire: "2023-06-01", status: "ACTIVE", dept: "SALES", loc: "HQ-TN", salary: 18500000, si: 18500000, dep: 0 },
    { code: "TKV-0005", name: "Phạm Thị Thu Hà", dob: "1995-09-18", phone: "0908111005", email: "ha.ptt@thekyvang.vn", gender: "FEMALE", cccd: "072195006708", hire: "2024-02-01", status: "ACTIVE", dept: "HR", loc: "HQ-TN", salary: 15000000, si: 15000000, dep: 0 },
    { code: "TKV-0006", name: "Võ Văn Hùng", dob: "1990-02-22", phone: "0908111006", email: "hung.vv@thekyvang.vn", gender: "MALE", cccd: "072090008910", hire: "2022-08-10", status: "ACTIVE", dept: "WH", loc: "WH-GD", salary: 14500000, si: 14500000, dep: 2 },
    { code: "TKV-0007", name: "Đặng Quốc Bảo", dob: "1996-07-09", phone: "0908111007", email: "bao.dq@thekyvang.vn", gender: "MALE", cccd: "072096001214", hire: "2024-05-15", status: "ACTIVE", dept: "WH", loc: "WH-GD", salary: 11500000, si: 11500000, dep: 0 },
    { code: "TKV-0008", name: "Huỳnh Thị Mỹ Duyên", dob: "1998-03-30", phone: "0908111008", email: "duyen.htm@thekyvang.vn", gender: "FEMALE", cccd: "072198003416", hire: "2024-07-01", status: "ACTIVE", dept: "POS", loc: "CH-TB", salary: 10500000, si: 10500000, dep: 0 },
    { code: "TKV-0009", name: "Bùi Thanh Sang", dob: "1997-12-14", phone: "0908111009", email: "sang.bt@thekyvang.vn", gender: "MALE", cccd: "072097005618", hire: "2025-01-10", status: "ACTIVE", dept: "POS", loc: "CH-HT", salary: 10200000, si: 10200000, dep: 1 },
    { code: "TKV-0010", name: "Ngô Thị Kim Anh", dob: "1999-06-25", phone: "0908111010", email: "anh.ntk@thekyvang.vn", gender: "FEMALE", cccd: "072199007820", hire: "2026-10-01", status: "PROBATION", dept: "SALES", loc: "CH-TB", salary: 9500000, si: 0, dep: 0 },
    { code: "TKV-0011", name: "Trương Văn Tài", dob: "1994-01-17", phone: "0908111011", email: "tai.tv@thekyvang.vn", gender: "MALE", cccd: "072094009022", hire: "2023-11-01", status: "ACTIVE", dept: "WH", loc: "WH-GD", salary: 12000000, si: 12000000, dep: 1 },
    { code: "TKV-0012", name: "Phan Ngọc Bảo Châu", dob: "1997-10-08", phone: "0908111012", email: "chau.pnb@thekyvang.vn", gender: "FEMALE", cccd: "072197001324", hire: "2026-10-15", status: "PROBATION", dept: "POS", loc: "CH-HT", salary: 8800000, si: 0, dep: 0 },
  ];

  const empMap = new Map();
  const { data: existingEmps } = await sb
    .from("employees")
    .select("id, employee_code, full_name, dob")
    .eq("company_id", companyId);
  for (const e of existingEmps ?? []) empMap.set(e.employee_code, e);

  for (const item of demoEmployees) {
    let empId = empMap.get(item.code)?.id;
    if (!empId) {
      const dept = depts[item.dept] ?? Object.values(depts)[0];
      const pos = findPos(item.dept);
      const loc = locs[item.loc] ?? defaultLoc;

      const { data: created, error: insErr } = await sb
        .from("employees")
        .insert({
          company_id: companyId,
          employee_code: item.code,
          full_name: item.name,
          dob: item.dob,
          gender: item.gender,
          nationality: "VN",
          is_foreign_worker: false,
          national_id_enc: encryptPii(item.cccd),
          national_id_hash: hmacBlindIndex(item.cccd),
          national_id_last4: item.cccd.slice(-4),
          work_email: item.email,
          employment_status: item.status,
          hire_date: item.hire,
        })
        .select("id, employee_code, full_name")
        .single();

      if (insErr) {
        console.error(`Err insert ${item.code}:`, insErr.message);
        continue;
      }
      empMap.set(created.employee_code, created);
      empId = created.id;

      await sb.from("org_assignments").insert({
        company_id: companyId,
        employee_id: created.id,
        department_id: dept.id,
        position_id: pos.id,
        location_id: loc.id,
        cost_center_id: defaultCc.id,
        is_primary: true,
        effective_from: item.hire,
      });
    } else if (!empMap.get(item.code)?.dob) {
      await sb
        .from("employees")
        .update({ dob: item.dob, gender: item.gender })
        .eq("id", empId);
    }

    // Ensure contact (phone_enc, phone_last4) exists for every employee
    await sb.from("employee_contacts").upsert(
      {
        company_id: companyId,
        employee_id: empId,
        phone_enc: encryptPii(item.phone),
        phone_last4: item.phone.slice(-4),
        personal_email: item.email,
        emergency_contact_name: `Người thân (${item.name})`,
      },
      { onConflict: "employee_id" }
    );
  }

  console.log(`✅ Tổng nhân sự + SĐT + Ngày sinh đã đồng bộ: ${empMap.size} người`);

  // Seed Attendance Raw Events (Tháng 11/2026: ngày 02..11) if empty
  const { count: attCount } = await sb
    .from("attendance_raw_events")
    .select("*", { count: "exact", head: true });
  if ((attCount ?? 0) === 0) {
    const workDates = [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
    ];
    const defaultDevice = devices[0];
    const eventsToInsert = [];
    for (const item of demoEmployees) {
      const emp = empMap.get(item.code);
      if (!emp) continue;
      const loc = locs[item.loc] ?? defaultLoc;
      for (const d of workDates) {
        eventsToInsert.push(
          {
            company_id: companyId,
            employee_id: emp.id,
            event_time: `${d}T07:55:00+07:00`,
            direction: "IN",
            source_type: "DEVICE_FACE_ID",
            verify_mode: "FACE_ID",
            device_id: defaultDevice?.id ?? null,
            location_id: loc.id,
            is_within_geofence: true,
            work_mode: "ONSITE",
            idempotency_key: `SEED-${item.code}-${d}-IN`,
          },
          {
            company_id: companyId,
            employee_id: emp.id,
            event_time: `${d}T17:05:00+07:00`,
            direction: "OUT",
            source_type: "DEVICE_FACE_ID",
            verify_mode: "FACE_ID",
            device_id: defaultDevice?.id ?? null,
            location_id: loc.id,
            is_within_geofence: true,
            work_mode: "ONSITE",
            idempotency_key: `SEED-${item.code}-${d}-OUT`,
          }
        );
      }
    }
    const { error: attErr } = await sb.from("attendance_raw_events").insert(eventsToInsert);
    if (attErr) console.error("attErr:", attErr.message);
    else console.log(`✅ Đã nạp ${eventsToInsert.length} lượt chấm công Face ID mẫu tháng 11/2026.`);
  }

  // Enrich payroll_results with full Vietnam breakdown if empty or missing explanation_json
  if (periodNov) {
    const { data: runRow } = await sb
      .from("payroll_runs")
      .select("id")
      .eq("payroll_period_id", periodNov.id)
      .limit(1)
      .single();
    if (runRow) {
      const { data: existingPr } = await sb
        .from("payroll_results")
        .select("id")
        .eq("payroll_run_id", runRow.id);
      if (!existingPr || existingPr.length === 0) {
        const rows = demoEmployees.slice(0, 6).map((meta) => {
          const emp = empMap.get(meta.code);
          const base = meta.salary;
          const siBase = Math.min(meta.si, 46800000);
          const eeIns = Math.round(siBase * 0.105);
          const erIns = Math.round(siBase * 0.215);
          const eeUnionDues = Math.min(Math.round(siBase * 0.01), 253000);
          const unionFeeEr = Math.round(siBase * 0.02);
          const personalDed = 15500000;
          const depDed = meta.dep * 6200000;
          const taxable = Math.max(0, base - eeIns - personalDed - depDed);
          const pit = Math.round(taxable * 0.1);
          const fullNet = base - eeIns - pit - eeUnionDues;
          const adv = Math.round(base * 0.5);
          return {
            payroll_run_id: runRow.id,
            employee_id: emp.id,
            base_salary_snapshot: base,
            gross_income: base,
            si_base_bhxh: siBase,
            si_base_bhtn: siBase,
            ee_insurance_total: eeIns,
            er_insurance_total: erIns,
            personal_deduction: personalDed,
            dependent_deduction: depDed,
            taxable_income: taxable,
            pit_amount: pit,
            other_deductions: eeUnionDues,
            full_month_net: fullNet,
            mid_month_advance_paid: adv,
            net_payable: fullNet - adv,
            employer_total_cost: base + erIns + unionFeeEr,
            explanation_json: { workedDays: 22, standardDays: 22, eeUnionDues, unionFeeEr },
          };
        });
        await sb.from("payroll_results").insert(rows);
      }
    }
  }

  // Ensure leave balances exist
  const annualLeave = leaveTypes["ANNUAL"];
  if (annualLeave) {
    for (const item of demoEmployees) {
      const emp = empMap.get(item.code);
      if (!emp) continue;
      const { data: lb } = await sb
        .from("leave_balances")
        .select("id")
        .eq("employee_id", emp.id)
        .eq("year", 2026)
        .limit(1);
      if (!lb || lb.length === 0) {
        await sb.from("leave_balances").insert({
          company_id: companyId,
          employee_id: emp.id,
          leave_type_id: annualLeave.id,
          year: 2026,
          entitled_days: 12,
          used_days: 1,
          remaining_days: 11,
        });
      }
    }
  }

  void actorUserId;
  console.log("🎉 Hoàn tất nạp dữ liệu mẫu Enterprise!");
}

run().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
