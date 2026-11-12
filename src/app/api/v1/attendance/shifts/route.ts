import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const shiftActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_SHIFT"),
    code: z.string().min(2).max(24),
    name: z.string().min(2).max(120),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    isOvernight: z.boolean().default(false),
    breakMinutes: z.number().int().min(0).max(180).default(60),
    earlyHandoverMinutes: z.number().int().min(0).max(120).default(0),
    countEarlyHandoverAsWork: z.boolean().default(true),
    standardWorkHours: z.number().positive().max(16).default(8),
  }),
  z.object({
    action: z.literal("ASSIGN_SHIFT_BULK"),
    shiftTemplateId: z.string().uuid(),
    scope: z.enum(["ALL", "DEPARTMENT", "EMPLOYEE"]),
    departmentId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    skipWeekends: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("ADD_HOLIDAY"),
    calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dayType: z.enum(["HOLIDAY", "COMPENSATORY_OFF", "WORKDAY"]).default("HOLIDAY"),
    holidayName: z.string().min(2).max(150),
  }),
]);

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "READ");

    const admin = getSupabaseAdminClient();
    const isAdminOrHr = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "LINE_MANAGER", "DIRECTOR", "ACCOUNTANT", "AUDITOR"].includes(r)
    );

    let assignQuery = admin
      .from("shift_assignments")
      .select(
        "id, employee_id, shift_template_id, work_date, status, source, employees(employee_code, full_name), shift_templates(code, name, start_time, end_time, is_overnight)"
      )
      .order("work_date", { ascending: false })
      .limit(120);

    if (!isAdminOrHr && ctx.employeeId) {
      assignQuery = assignQuery.eq("employee_id", ctx.employeeId);
    }

    const [
      { data: shifts, error: sErr },
      { data: calendars },
      { data: assignments },
      { data: departments },
      { data: employees },
    ] = await Promise.all([
      admin.from("shift_templates").select("*").eq("is_active", true).order("code"),
      admin
        .from("work_calendars")
        .select("*")
        .order("calendar_date", { ascending: false })
        .limit(60),
      assignQuery,
      admin.from("departments").select("id, code, name").eq("status", "ACTIVE").order("code"),
      isAdminOrHr
        ? admin
            .from("employees")
            .select("id, employee_code, full_name")
            .neq("employment_status", "TERMINATED")
            .order("employee_code")
        : Promise.resolve({ data: [] }),
    ]);

    if (sErr) throw sErr;

    return NextResponse.json({
      data: {
        shifts: shifts ?? [],
        calendars: calendars ?? [],
        assignments: assignments ?? [],
        departments: departments ?? [],
        employees: employees ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "UPDATE");

    const body = shiftActionSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company } = await admin.from("companies").select("id").limit(1).single();
    if (!company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy pháp nhân công ty." } },
        { status: 400 }
      );
    }

    if (body.action === "CREATE_SHIFT") {
      const normTime = (t: string) => (t.length === 5 ? `${t}:00` : t);
      const { data, error } = await admin
        .from("shift_templates")
        .upsert(
          {
            company_id: company.id,
            code: body.code.trim().toUpperCase(),
            name: body.name.trim(),
            start_time: normTime(body.startTime),
            end_time: normTime(body.endTime),
            is_overnight: body.isOvernight,
            break_minutes: body.breakMinutes,
            early_handover_minutes: body.earlyHandoverMinutes,
            count_early_handover_as_work: body.countEarlyHandoverAsWork,
            standard_work_hours: body.standardWorkHours,
            is_active: true,
          },
          { onConflict: "company_id,code" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    if (body.action === "ADD_HOLIDAY") {
      const { data, error } = await admin
        .from("work_calendars")
        .insert({
          company_id: company.id,
          calendar_date: body.calendarDate,
          day_type: body.dayType,
          holiday_name: body.holidayName.trim(),
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    // ASSIGN_SHIFT_BULK
    const start = new Date(`${body.startDate}T00:00:00Z`);
    const end = new Date(`${body.endDate}T00:00:00Z`);
    if (end < start) {
      return NextResponse.json(
        { error: { code: "INVALID_RANGE", message: "Ngày kết thúc phải sau ngày bắt đầu." } },
        { status: 400 }
      );
    }

    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end && dates.length < 62) {
      const day = cur.getUTCDay();
      if (!body.skipWeekends || (day !== 0 && day !== 6)) {
        dates.push(cur.toISOString().slice(0, 10));
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    let targetEmpIds: string[] = [];
    if (body.scope === "EMPLOYEE" && body.employeeId) {
      targetEmpIds = [body.employeeId];
    } else if (body.scope === "DEPARTMENT" && body.departmentId) {
      const { data: orgs } = await admin
        .from("org_assignments")
        .select("employee_id")
        .eq("department_id", body.departmentId)
        .eq("is_primary", true);
      targetEmpIds = (orgs ?? []).map((o) => o.employee_id);
    } else {
      const { data: emps } = await admin
        .from("employees")
        .select("id")
        .neq("employment_status", "TERMINATED");
      targetEmpIds = (emps ?? []).map((e) => e.id);
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const empId of targetEmpIds) {
      for (const workDate of dates) {
        rows.push({
          company_id: company.id,
          employee_id: empId,
          shift_template_id: body.shiftTemplateId,
          work_date: workDate,
          status: "SCHEDULED",
          source: "SCHEDULE",
        });
      }
    }

    if (rows.length > 0) {
      const { error: upErr } = await admin
        .from("shift_assignments")
        .upsert(rows, { onConflict: "employee_id,work_date" });
      if (upErr) throw upErr;
    }

    return NextResponse.json(
      {
        data: {
          assignedCount: rows.length,
          employeeCount: targetEmpIds.length,
          dayCount: dates.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

