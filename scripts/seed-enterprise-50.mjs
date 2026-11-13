import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aesKeyB64 = process.env.PII_ENCRYPTION_KEY_BASE64;
const hmacKeyB64 = process.env.PII_HMAC_KEY_BASE64;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
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

// Vietnam 2026-H2 Legal Constants
const REF_LEVEL = 2530000;
const SI_CAP = 20 * REF_LEVEL; // 50,600,000 VND
const REGION_III_MIN = 4140000;
const UI_CAP = 20 * REGION_III_MIN; // 82,800,000 VND
const SELF_DEDUCTION = 15500000;
const DEP_DEDUCTION = 6200000;
const LUNCH_EXEMPT_CAP = 1200000;

function calcPit(taxable, isProbation) {
  if (taxable <= 0) return 0;
  if (isProbation) {
    return Math.round(taxable * 0.10);
  }
  // Progressive 5-bracket scale
  const b1 = Math.min(taxable, 10000000);
  let tax = b1 * 0.05;
  if (taxable > 10000000) {
    const b2 = Math.min(taxable - 10000000, 20000000);
    tax += b2 * 0.10;
  }
  if (taxable > 30000000) {
    const b3 = Math.min(taxable - 30000000, 30000000);
    tax += b3 * 0.20;
  }
  if (taxable > 60000000) {
    const b4 = Math.min(taxable - 60000000, 40000000);
    tax += b4 * 0.30;
  }
  if (taxable > 100000000) {
    const b5 = taxable - 100000000;
    tax += b5 * 0.35;
  }
  return Math.round(tax);
}

const FIRST_NAMES_MALE = ["Văn", "Quốc", "Minh", "Hoàng", "Thanh", "Tuấn", "Hùng", "Hải", "Dũng", "Khánh", "Đức", "Trọng"];
const FIRST_NAMES_FEMALE = ["Thị", "Ngọc", "Thu", "Mỹ", "Kim", "Phương", "Bích", "Ánh", "Hương", "Hà", "Mai", "Thảo"];
const LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const GIVEN_NAMES_MALE = ["Hải", "Tâm", "Kiên", "Bình", "Nam", "Long", "Cường", "Trí", "Nhân", "Sơn", "Vinh", "Khôi"];
const GIVEN_NAMES_FEMALE = ["Linh", "Trang", "Nhi", "Hằng", "Vân", "Vy", "Huyền", "Yến", "Chi", "Quyên", "Tú", "Thư"];

function generate50Employees() {
  const list = [
    // Core Demo Users & Department Heads
    { code: "TKV-0001", name: "Đặng Khắc Điệp", gender: "MALE", dept: "HR", pos: "HR_MGR", loc: "HQ-TN", salary: 25000000, si: 25000000, dep: 1, status: "ACTIVE", hire: "2020-01-01", type: "INDEFINITE_TERM" },
    { code: "TKV-0002", name: "Nguyễn Minh Tuấn", gender: "MALE", dept: "BOD", pos: "DIR", loc: "HQ-TN", salary: 65000000, si: 65000000, dep: 2, status: "ACTIVE", hire: "2019-06-01", type: "INDEFINITE_TERM" }, // High Earner > 50.6M
    { code: "TKV-0003", name: "Trần Thị Ngọc Lan", gender: "FEMALE", dept: "ACC", pos: "CHIEF_ACC", loc: "HQ-TN", salary: 22000000, si: 22000000, dep: 1, status: "ACTIVE", hire: "2021-03-15", type: "INDEFINITE_TERM" },
    { code: "TKV-0004", name: "Lê Hoàng Phúc", gender: "MALE", dept: "SALES", pos: "SALES_EXEC", loc: "HQ-TN", salary: 18500000, si: 18500000, dep: 0, status: "ACTIVE", hire: "2023-02-01", type: "DEFINITE_24M" },
    { code: "TKV-0005", name: "Phạm Thị Thu Hà", gender: "FEMALE", dept: "HR", pos: "CB_SPEC", loc: "HQ-TN", salary: 15000000, si: 15000000, dep: 0, status: "ACTIVE", hire: "2023-08-10", type: "DEFINITE_12M" },
    { code: "TKV-0006", name: "Võ Văn Hùng", gender: "MALE", dept: "WH", pos: "WH_MGR", loc: "WH-GD", salary: 16500000, si: 16500000, dep: 2, status: "ACTIVE", hire: "2021-11-01", type: "INDEFINITE_TERM" },
    { code: "TKV-0007", name: "Đặng Quốc Bảo", gender: "MALE", dept: "WH", pos: "WH_SR", loc: "WH-GD", salary: 12000000, si: 12000000, dep: 0, status: "ACTIVE", hire: "2024-01-15", type: "DEFINITE_12M" },
    { code: "TKV-0008", name: "Huỳnh Thị Mỹ Duyên", gender: "FEMALE", dept: "POS", pos: "STORE_MGR", loc: "CH-TB", salary: 13500000, si: 13500000, dep: 1, status: "ACTIVE", hire: "2022-09-01", type: "DEFINITE_24M" },
    { code: "TKV-0009", name: "Bùi Thanh Sang", gender: "MALE", dept: "POS", pos: "STORE_STAFF", loc: "CH-HT", salary: 10500000, si: 10500000, dep: 0, status: "ACTIVE", hire: "2024-06-01", type: "DEFINITE_12M" },
    { code: "TKV-0010", name: "Ngô Thị Kim Anh", gender: "FEMALE", dept: "SALES", pos: "SALES_EXEC", loc: "CH-TB", salary: 9500000, si: 0, dep: 0, status: "PROBATION", hire: "2026-10-01", type: "PROBATION" }, // Probation Flat 10%
  ];

  // Generate TKV-0011 to TKV-0050 with realistic distribution
  const departments = ["SALES", "WH", "POS", "ACC", "HR"];
  for (let i = 11; i <= 50; i++) {
    const code = `TKV-${String(i).padStart(4, "0")}`;
    const isMale = i % 2 !== 0;
    const gender = isMale ? "MALE" : "FEMALE";
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const middleName = isMale ? FIRST_NAMES_MALE[i % FIRST_NAMES_MALE.length] : FIRST_NAMES_FEMALE[i % FIRST_NAMES_FEMALE.length];
    const givenName = isMale ? GIVEN_NAMES_MALE[i % GIVEN_NAMES_MALE.length] : GIVEN_NAMES_FEMALE[i % GIVEN_NAMES_FEMALE.length];
    const name = `${lastName} ${middleName} ${givenName}`;

    let dept = departments[i % departments.length];
    let loc = "HQ-TN";
    if (dept === "WH") loc = "WH-GD";
    else if (dept === "POS") loc = i % 2 === 0 ? "CH-TB" : "CH-HT";

    let salary = 9000000 + (i * 350000) % 15000000;
    let dep = (i % 3 === 0) ? 1 : (i % 7 === 0 ? 2 : 0);
    let status = "ACTIVE";
    let type = i % 5 === 0 ? "INDEFINITE_TERM" : "DEFINITE_12M";
    let hire = `202${3 + (i % 3)}-0${1 + (i % 9)}-15`;

    // Special edge cases
    if (i === 45 || i === 46 || i === 47) {
      status = "PROBATION";
      type = "PROBATION";
      salary = 8500000 + i * 200000;
      hire = "2026-10-01";
      dep = 0;
    } else if (i === 48) {
      // High earner Deputy Director
      dept = "BOD";
      loc = "HQ-TN";
      salary = 55000000;
      dep = 3;
      type = "INDEFINITE_TERM";
      hire = "2020-05-01";
    } else if (i === 49) {
      // Unpaid leave edge case
      salary = 11000000;
    } else if (i === 50) {
      // Mid month hire edge case
      salary = 12000000;
      hire = "2026-10-15";
    }

    list.push({
      code,
      name,
      gender,
      dept,
      pos: dept === "WH" ? "WH_STAFF" : (dept === "POS" ? "STORE_STAFF" : "STAFF"),
      loc,
      salary,
      si: status === "PROBATION" ? 0 : salary,
      dep,
      status,
      hire,
      type,
    });
  }
  return list;
}

async function run() {
  console.log("================================================================================");
  console.log("🚀 BƯỚC 6: SEED ENTERPRISE DATASET (50 NHÂN SỰ, 3 THÁNG CÔNG, KỲ LƯƠNG ĐẦU-CUỐI)");
  console.log("================================================================================");

  const { data: company, error: compErr } = await sb
    .from("companies")
    .select("id, legal_name")
    .limit(1)
    .single();
  if (compErr || !company) throw compErr ?? new Error("Company not found");
  const companyId = company.id;
  console.log(`🏢 Doanh nghiệp: ${company.legal_name} (${companyId})`);

  const { data: adminUser } = await sb.from("users").select("id").limit(1).single();
  const actorId = adminUser?.id ?? null;

  const [locsRes, deptsRes, posRes, ccRes, leaveTypesRes] = await Promise.all([
    sb.from("locations").select("id, code").eq("company_id", companyId),
    sb.from("departments").select("id, code").eq("company_id", companyId),
    sb.from("positions").select("id, code, department_id").eq("company_id", companyId),
    sb.from("cost_centers").select("id, code").eq("company_id", companyId),
    sb.from("leave_types").select("id, code").eq("company_id", companyId),
  ]);

  const locs = Object.fromEntries((locsRes.data ?? []).map((x) => [x.code, x]));
  const depts = Object.fromEntries((deptsRes.data ?? []).map((x) => [x.code, x]));
  const positions = posRes.data ?? [];
  const ccs = Object.fromEntries((ccRes.data ?? []).map((x) => [x.code, x]));
  const leaveTypes = Object.fromEntries((leaveTypesRes.data ?? []).map((x) => [x.code, x]));

  const defaultLoc = locs["HQ-TN"] ?? Object.values(locs)[0];
  const defaultCc = ccs["CC-ADMIN"] ?? Object.values(ccs)[0];
  const findPos = (deptCode) => {
    const dept = depts[deptCode];
    return positions.find((p) => p.department_id === dept?.id) ?? positions[0];
  };

  // Ensure Payroll Periods for Sep, Oct, Nov 2026
  const periodsData = [
    { period_code: "2026-M09", period_month: 9, period_year: 2026, start_date: "2026-09-01", end_date: "2026-09-30", cutoff_date: "2026-09-28", advance_pay_date: "2026-09-15", settlement_pay_date: "2026-10-05", status: "CLOSED" },
    { period_code: "2026-M10", period_month: 10, period_year: 2026, start_date: "2026-10-01", end_date: "2026-10-31", cutoff_date: "2026-10-28", advance_pay_date: "2026-10-15", settlement_pay_date: "2026-11-05", status: "CLOSED" },
    { period_code: "2026-M11", period_month: 11, period_year: 2026, start_date: "2026-11-01", end_date: "2026-11-30", cutoff_date: "2026-11-27", advance_pay_date: "2026-11-15", settlement_pay_date: "2026-12-05", status: "OPEN" },
  ];

  const periodMap = new Map();
  for (const p of periodsData) {
    const { data: periodRow } = await sb
      .from("payroll_periods")
      .upsert(
        { ...p, company_id: companyId, standard_work_days: 22 },
        { onConflict: "company_id, period_code" }
      )
      .select("id, period_code")
      .single();
    if (periodRow) periodMap.set(periodRow.period_code, periodRow.id);
  }
  console.log(`📅 Đã đồng bộ 3 kỳ lương: 2026-M09, 2026-M10, 2026-M11`);

  const employees = generate50Employees();
  console.log(`👥 Chuẩn bị nạp ${employees.length} nhân sự...`);

  const empMap = new Map();
  const { data: existingEmps } = await sb
    .from("employees")
    .select("id, employee_code, full_name")
    .eq("company_id", companyId);
  for (const e of existingEmps ?? []) empMap.set(e.employee_code, e);

  for (const emp of employees) {
    const cccd = `0720${String(1985 + (parseInt(emp.code.split("-")[1], 10) % 15))}${String(100000 + parseInt(emp.code.split("-")[1], 10)).slice(1)}`;
    const phone = `0908${String(100000 + parseInt(emp.code.split("-")[1], 10))}`;
    const email = `${emp.code.toLowerCase().replace("-", "")}@thekyvang.vn`;
    const dob = `199${(parseInt(emp.code.split("-")[1], 10) % 9)}-0${1 + (parseInt(emp.code.split("-")[1], 10) % 8)}-15`;

    let empId = empMap.get(emp.code)?.id;
    if (!empId) {
      const { data: created, error: insErr } = await sb
        .from("employees")
        .insert({
          company_id: companyId,
          employee_code: emp.code,
          full_name: emp.name,
          dob,
          gender: emp.gender,
          nationality: "VN",
          is_foreign_worker: false,
          national_id_enc: encryptPii(cccd),
          national_id_hash: hmacBlindIndex(cccd),
          national_id_last4: cccd.slice(-4),
          work_email: email,
          employment_status: emp.status,
          hire_date: emp.hire,
        })
        .select("id, employee_code, full_name")
        .single();
      if (insErr) {
        console.error(`Lỗi tạo ${emp.code}:`, insErr.message);
        continue;
      }
      empId = created.id;
      empMap.set(emp.code, created);

      const dept = depts[emp.dept] ?? Object.values(depts)[0];
      const pos = findPos(emp.dept);
      const loc = locs[emp.loc] ?? defaultLoc;
      await sb.from("org_assignments").insert({
        company_id: companyId,
        employee_id: empId,
        department_id: dept.id,
        position_id: pos.id,
        location_id: loc.id,
        cost_center_id: defaultCc.id,
        is_primary: true,
        effective_from: emp.hire,
      });
    }

    // Upsert Contacts
    await sb.from("employee_contacts").upsert(
      {
        company_id: companyId,
        employee_id: empId,
        phone_enc: encryptPii(phone),
        phone_last4: phone.slice(-4),
        personal_email: email,
        emergency_contact_name: `Người thân ${emp.name}`,
      },
      { onConflict: "employee_id" }
    );

    // Upsert Labor Contract
    await sb.from("labor_contracts").upsert(
      {
        company_id: companyId,
        employee_id: empId,
        contract_code: `HD-${emp.code}-2026`,
        contract_type: emp.type,
        start_date: emp.hire,
        base_salary: emp.salary,
        insurance_salary: emp.status === "PROBATION" ? 0 : emp.salary,
        status: "ACTIVE",
      },
      { onConflict: "company_id, contract_code" }
    );

    // Upsert Leave Balance
    if (leaveTypes["ANNUAL"]) {
      await sb.from("leave_balances").upsert(
        {
          company_id: companyId,
          employee_id: empId,
          leave_type_id: leaveTypes["ANNUAL"].id,
          year: 2026,
          entitled_days: 12,
          used_days: emp.dep > 0 ? 2 : 1,
          remaining_days: emp.dep > 0 ? 10 : 11,
        },
        { onConflict: "employee_id, leave_type_id, year" }
      );
    }
  }

  console.log(`✅ Đã đồng bộ đầy đủ 50 Hồ sơ, Hợp đồng lao động, Danh bạ & Quỹ phép!`);

  // Seed Attendance Raw Events (3 months: Sep, Oct, Nov 2026)
  const workDaysSample = [
    // Sep 2026
    "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14",
    // Oct 2026
    "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12",
    // Nov 2026
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11"
  ];

  const rawEvents = [];
  for (const emp of employees.slice(0, 20)) {
    const eRow = empMap.get(emp.code);
    if (!eRow) continue;
    const loc = locs[emp.loc] ?? defaultLoc;
    for (const d of workDaysSample) {
      rawEvents.push({
        company_id: companyId,
        employee_id: eRow.id,
        event_time: `${d}T07:56:00+07:00`,
        direction: "IN",
        source_type: "WEB_GPS",
        verify_mode: "GPS_GEOFENCE",
        location_id: loc.id,
        is_within_geofence: true,
        work_mode: "ONSITE",
        idempotency_key: `E50-${emp.code}-${d}-IN`,
      });
      rawEvents.push({
        company_id: companyId,
        employee_id: eRow.id,
        event_time: `${d}T17:04:00+07:00`,
        direction: "OUT",
        source_type: "WEB_GPS",
        verify_mode: "GPS_GEOFENCE",
        location_id: loc.id,
        is_within_geofence: true,
        work_mode: "ONSITE",
        idempotency_key: `E50-${emp.code}-${d}-OUT`,
      });
    }
  }

  // Upsert in batches of 200
  for (let i = 0; i < rawEvents.length; i += 200) {
    const chunk = rawEvents.slice(i, i + 200);
    await sb.from("attendance_raw_events").upsert(chunk, { onConflict: "company_id, idempotency_key" });
  }
  console.log(`✅ Đã nạp ${rawEvents.length} lượt chấm công GPS 3 tháng cho nhân viên mẫu.`);

  // Seed Attendance Summaries for Period 2026-M10 (October 2026)
  const periodOctId = periodMap.get("2026-M10");
  if (periodOctId) {
    const summaries = employees.map((emp) => {
      const eRow = empMap.get(emp.code);
      let workedDays = 22;
      let unpaidDays = 0;
      let otWeekday = 0;
      let otWeekend = 0;

      if (emp.code === "TKV-0049") {
        // Edge case: 16 days unpaid leave
        workedDays = 6;
        unpaidDays = 16;
      } else if (emp.code === "TKV-0050") {
        // Edge case: Mid-month hire on Oct 15
        workedDays = 12;
      } else if (emp.code === "TKV-0007") {
        otWeekend = 8; // 8 hours weekend OT
      } else if (emp.code === "TKV-0004") {
        otWeekday = 6; // 6 hours weekday OT
      }

      return {
        company_id: companyId,
        payroll_period_id: periodOctId,
        employee_id: eRow.id,
        version: 1,
        standard_days: 22,
        paid_days: workedDays,
        unpaid_days: unpaidDays,
        ot_weekday_hours: otWeekday,
        ot_weekend_hours: otWeekend,
        ot_holiday_hours: 0,
        ot_night_hours: 0,
        is_locked: true,
      };
    });

    await sb.from("attendance_summaries").upsert(summaries, { onConflict: "payroll_period_id, employee_id, version" });
    console.log(`✅ Đã nạp 50 bảng tổng hợp công kỳ 2026-M10 (có ca biên nghỉ không lương, tăng ca, thử việc).`);
  }

  // End-to-End Payroll Run for 2026-M10 (October 2026)
  if (periodOctId) {
    const { data: run, error: runErr } = await sb
      .from("payroll_runs")
      .upsert(
        {
          company_id: companyId,
          payroll_period_id: periodOctId,
          run_type: "END_MONTH_SETTLEMENT",
          run_version: 1,
          status: "PAID",
          legal_rule_snapshot: {
            ruleVersion: "VN-2026-H2",
            bhxhReferenceLevel: REF_LEVEL,
            siCap: SI_CAP,
            uiCap: UI_CAP,
            selfDeduction: SELF_DEDUCTION,
            depDeduction: DEP_DEDUCTION,
            lunchCap: LUNCH_EXEMPT_CAP,
          },
          total_employees: 50,
          created_by: actorId,
          accountant_reviewed_by: actorId,
          accountant_reviewed_at: "2026-11-02T10:00:00+07:00",
          director_approved_by: actorId,
          director_approved_at: "2026-11-03T15:00:00+07:00",
          locked_by: actorId,
          locked_at: "2026-11-04T09:00:00+07:00",
          paid_at: "2026-11-05T14:30:00+07:00",
        },
        { onConflict: "payroll_period_id, run_type, run_version" }
      )
      .select("id")
      .single();

    if (runErr || !run) {
      console.error("Lỗi tạo kỳ lương 2026-M10:", runErr?.message);
    } else {
      let runTotalGross = 0;
      let runTotalNet = 0;

      const payrollResults = employees.map((emp) => {
        const eRow = empMap.get(emp.code);
        const isProbation = emp.status === "PROBATION";
        let workedDays = 22;
        if (emp.code === "TKV-0049") workedDays = 6;
        if (emp.code === "TKV-0050") workedDays = 12;

        const basePaid = Math.round((emp.salary * workedDays) / 22);

        // OT Calculation
        let otPay = 0;
        let otExempt = 0;
        const hourlyRate = emp.salary / (22 * 8);
        if (emp.code === "TKV-0007") {
          // 8 hours weekend OT (200%)
          otPay = Math.round(8 * hourlyRate * 2.0);
          otExempt = Math.round(8 * hourlyRate * 1.0); // 100% exempt
        } else if (emp.code === "TKV-0004") {
          // 6 hours weekday OT (150%)
          otPay = Math.round(6 * hourlyRate * 1.5);
          otExempt = Math.round(6 * hourlyRate * 0.5); // 50% exempt
        }

        const lunchAllowance = 1000000; // 1M lunch cash (< 1.2M cap => 100% tax exempt)
        const gross = basePaid + otPay + lunchAllowance;

        // Social Insurance: Capped at 50,600,000 VND. Probation or >= 14 days unpaid leave => 0
        let siBaseBhxh = 0;
        let siBaseBhtn = 0;
        let eeIns = 0;
        let erIns = 0;
        let unionFeeEe = 0;
        let unionFeeEr = 0;

        const hasSi = !isProbation && emp.code !== "TKV-0049";
        if (hasSi) {
          siBaseBhxh = Math.min(emp.salary, SI_CAP);
          siBaseBhtn = Math.min(emp.salary, UI_CAP);
          const eeBhxh = Math.round(siBaseBhxh * 0.08);
          const eeBhyt = Math.round(siBaseBhxh * 0.015);
          const eeBhtn = Math.round(siBaseBhtn * 0.01);
          eeIns = eeBhxh + eeBhyt + eeBhtn;

          const erBhxh = Math.round(siBaseBhxh * 0.175);
          const erBhyt = Math.round(siBaseBhxh * 0.03);
          const erBhtn = Math.round(siBaseBhtn * 0.01);
          erIns = erBhxh + erBhyt + erBhtn;

          unionFeeEe = Math.min(Math.round(siBaseBhxh * 0.01), 253000);
          unionFeeEr = Math.round(siBaseBhxh * 0.02);
        }

        // Tax calculation
        const exemptIncome = lunchAllowance + otExempt;
        const assessable = Math.max(0, gross - exemptIncome);
        const selfDed = isProbation ? 0 : SELF_DEDUCTION;
        const depDed = isProbation ? 0 : emp.dep * DEP_DEDUCTION;
        const taxable = Math.max(0, assessable - eeIns - selfDed - depDed);
        const pit = calcPit(taxable, isProbation);

        const fullNet = gross - eeIns - pit - unionFeeEe;
        const advance = Math.round(fullNet * 0.4);
        const netPayable = fullNet - advance;
        const erCost = gross + erIns + unionFeeEr;

        runTotalGross += gross;
        runTotalNet += netPayable;

        return {
          payroll_run_id: run.id,
          employee_id: eRow.id,
          cost_center_id: defaultCc.id,
          base_salary_snapshot: emp.salary,
          gross_income: gross,
          si_base_bhxh: siBaseBhxh,
          si_base_bhtn: siBaseBhtn,
          ee_insurance_total: eeIns,
          er_insurance_total: erIns,
          tax_exempt_income: exemptIncome,
          assessable_income: assessable,
          personal_deduction: selfDed,
          dependent_deduction: depDed,
          taxable_income: taxable,
          pit_amount: pit,
          other_deductions: unionFeeEe,
          full_month_net: fullNet,
          mid_month_advance_paid: advance,
          net_payable: netPayable,
          negative_balance_carryover: 0,
          employer_total_cost: erCost,
          explanation_json: {
            workedDays,
            standardDays: 22,
            otPay,
            otExempt,
            lunchAllowance,
            unionFeeEe,
            unionFeeEr,
            formula: isProbation
              ? "Thuế TNCN 10% toàn phần trên thu nhập tính thuế (HĐ Thử việc); Không đóng BHXH"
              : `Lương đóng BHXH: ${siBaseBhxh.toLocaleString("vi-VN")} đ • Giảm trừ bản thân: 15.5tr • NPT (${emp.dep}): ${(emp.dep * 6.2).toFixed(1)}tr`,
          },
        };
      });

      // Upsert payroll results
      await sb.from("payroll_results").upsert(payrollResults, { onConflict: "payroll_run_id, employee_id" });

      // Update run totals
      await sb
        .from("payroll_runs")
        .update({
          total_gross_amount: runTotalGross,
          total_net_payable: runTotalNet,
        })
        .eq("id", run.id);

      console.log(`✅ Đã kết chuyển thành công Bảng lương Tháng 10/2026 (50 người):`);
      console.log(`   - Tổng quỹ lương Gross: ${runTotalGross.toLocaleString("vi-VN")} ₫`);
      console.log(`   - Thực chi đợt 2 (Net Payable): ${runTotalNet.toLocaleString("vi-VN")} ₫`);
    }
  }

  console.log("================================================================================");
  console.log("🎉 BƯỚC 6: HOÀN TẤT SEED DỮ LIỆU ENTERPRISE 50 NHÂN SỰ & KỲ LƯƠNG ĐẦU-CUỐI!");
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("❌ Seed Script Failure:", err);
  process.exit(1);
});

