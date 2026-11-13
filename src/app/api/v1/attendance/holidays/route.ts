import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface StatutoryHolidayPreset {
  calendar_date: string;
  holiday_name: string;
  day_type: "HOLIDAY" | "COMPENSATORY_OFF";
}

export function getDefaultHolidaysForYear(
  year: number,
  options?: {
    tetScheme?: "1_4" | "2_3" | "3_2";
    nationalDayScheme?: "1_2" | "2_3";
    includeCultureDay?: boolean;
  }
): StatutoryHolidayPreset[] {
  const tet = options?.tetScheme ?? "2_3";
  const nd = options?.nationalDayScheme ?? "1_2";
  const culture = options?.includeCultureDay ?? true;

  if (year === 2026) {
    const holidays: StatutoryHolidayPreset[] = [
      {
        calendar_date: "2026-01-01",
        holiday_name: "Tết Dương lịch",
        day_type: "HOLIDAY",
      },
    ];

    // Tết Nguyên đán 2026 (Mùng 1 Tết: 17/02/2026 Thứ Ba)
    if (tet === "2_3") {
      holidays.push(
        {
          calendar_date: "2026-02-15",
          holiday_name: "Tết Nguyên đán – 2 ngày trước mùng 1",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-16",
          holiday_name: "Tết Nguyên đán – ngày cuối năm âm lịch",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-17",
          holiday_name: "Tết Nguyên đán – mùng 1",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-18",
          holiday_name: "Tết Nguyên đán – mùng 2",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-19",
          holiday_name: "Tết Nguyên đán – mùng 3",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-20",
          holiday_name: "Tết Nguyên đán – nghỉ bù cho ngày Chủ nhật 15/02",
          day_type: "COMPENSATORY_OFF",
        }
      );
    } else if (tet === "1_4") {
      holidays.push(
        {
          calendar_date: "2026-02-16",
          holiday_name: "Tết Nguyên đán – ngày cuối năm âm lịch",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-17",
          holiday_name: "Tết Nguyên đán – mùng 1",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-18",
          holiday_name: "Tết Nguyên đán – mùng 2",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-19",
          holiday_name: "Tết Nguyên đán – mùng 3",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-20",
          holiday_name: "Tết Nguyên đán – mùng 4",
          day_type: "HOLIDAY",
        }
      );
    } else {
      holidays.push(
        {
          calendar_date: "2026-02-14",
          holiday_name: "Tết Nguyên đán – 3 ngày trước mùng 1 (Thứ Bảy)",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-15",
          holiday_name: "Tết Nguyên đán – 2 ngày trước mùng 1 (Chủ nhật)",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-16",
          holiday_name: "Tết Nguyên đán – ngày cuối năm âm lịch",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-17",
          holiday_name: "Tết Nguyên đán – mùng 1",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-18",
          holiday_name: "Tết Nguyên đán – mùng 2",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-02-19",
          holiday_name: "Tết Nguyên đán – nghỉ bù cho ngày Thứ Bảy 14/02",
          day_type: "COMPENSATORY_OFF",
        },
        {
          calendar_date: "2026-02-20",
          holiday_name: "Tết Nguyên đán – nghỉ bù cho ngày Chủ nhật 15/02",
          day_type: "COMPENSATORY_OFF",
        }
      );
    }

    // Giỗ Tổ Hùng Vương 10/3 âm lịch (26/04/2026 CN -> nghỉ bù 27/04 Thứ Hai)
    holidays.push(
      {
        calendar_date: "2026-04-26",
        holiday_name: "Giỗ Tổ Hùng Vương",
        day_type: "HOLIDAY",
      },
      {
        calendar_date: "2026-04-27",
        holiday_name: "Nghỉ bù Giỗ Tổ Hùng Vương (cho ngày CN 26/04)",
        day_type: "COMPENSATORY_OFF",
      },
      {
        calendar_date: "2026-04-30",
        holiday_name: "Ngày Chiến thắng 30/4",
        day_type: "HOLIDAY",
      },
      {
        calendar_date: "2026-05-01",
        holiday_name: "Ngày Quốc tế Lao động 1/5",
        day_type: "HOLIDAY",
      }
    );

    // Quốc khánh 2/9
    if (nd === "1_2") {
      holidays.push(
        {
          calendar_date: "2026-09-01",
          holiday_name: "Quốc khánh – ngày liền kề trước",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-09-02",
          holiday_name: "Quốc khánh 2/9",
          day_type: "HOLIDAY",
        }
      );
    } else {
      holidays.push(
        {
          calendar_date: "2026-09-02",
          holiday_name: "Quốc khánh 2/9",
          day_type: "HOLIDAY",
        },
        {
          calendar_date: "2026-09-03",
          holiday_name: "Quốc khánh – ngày liền kề sau",
          day_type: "HOLIDAY",
        }
      );
    }

    // Tùy chọn Ngày Văn hóa Việt Nam 24/11
    if (culture) {
      holidays.push({
        calendar_date: "2026-11-24",
        holiday_name: "Ngày Văn hóa Việt Nam (24/11)",
        day_type: "HOLIDAY",
      });
    }

    return holidays.sort((a, b) => a.calendar_date.localeCompare(b.calendar_date));
  }

  // Năm 2027
  const holidays2027: StatutoryHolidayPreset[] = [
    { calendar_date: "2027-01-01", holiday_name: "Tết Dương lịch", day_type: "HOLIDAY" },
    { calendar_date: "2027-02-05", holiday_name: "Tết Nguyên đán – ngày cuối năm âm lịch", day_type: "HOLIDAY" },
    { calendar_date: "2027-02-06", holiday_name: "Tết Nguyên đán – mùng 1 (Thứ Bảy)", day_type: "HOLIDAY" },
    { calendar_date: "2027-02-07", holiday_name: "Tết Nguyên đán – mùng 2 (Chủ nhật)", day_type: "HOLIDAY" },
    { calendar_date: "2027-02-08", holiday_name: "Tết Nguyên đán – mùng 3", day_type: "HOLIDAY" },
    { calendar_date: "2027-02-09", holiday_name: "Tết Nguyên đán – mùng 4", day_type: "HOLIDAY" },
    { calendar_date: "2027-02-10", holiday_name: "Tết Nguyên đán – nghỉ bù cho ngày Thứ Bảy 06/02", day_type: "COMPENSATORY_OFF" },
    { calendar_date: "2027-02-11", holiday_name: "Tết Nguyên đán – nghỉ bù cho ngày Chủ nhật 07/02", day_type: "COMPENSATORY_OFF" },
    { calendar_date: "2027-04-16", holiday_name: "Giỗ Tổ Hùng Vương", day_type: "HOLIDAY" },
    { calendar_date: "2027-04-30", holiday_name: "Ngày Chiến thắng 30/4", day_type: "HOLIDAY" },
    { calendar_date: "2027-05-01", holiday_name: "Ngày Quốc tế Lao động 1/5 (Thứ Bảy)", day_type: "HOLIDAY" },
    { calendar_date: "2027-05-03", holiday_name: "Nghỉ bù Ngày Quốc tế Lao động 1/5", day_type: "COMPENSATORY_OFF" },
    { calendar_date: "2027-09-02", holiday_name: "Quốc khánh 2/9", day_type: "HOLIDAY" },
    { calendar_date: "2027-09-03", holiday_name: "Quốc khánh – ngày liền kề", day_type: "HOLIDAY" },
  ];
  return holidays2027.sort((a, b) => a.calendar_date.localeCompare(b.calendar_date));
}

export async function GET(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "READ");

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || 2026;

    const admin = getSupabaseAdminClient();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: rows, error } = await admin
      .from("work_calendars")
      .select("*")
      .gte("calendar_date", startDate)
      .lte("calendar_date", endDate)
      .in("day_type", ["HOLIDAY", "COMPENSATORY_OFF"])
      .order("calendar_date", { ascending: true });

    if (error) throw error;

    // If no custom rows configured yet for this year, seed or return defaults
    if (!rows || rows.length === 0) {
      const defaults = getDefaultHolidaysForYear(year);
      return NextResponse.json({
        data: {
          year,
          isUsingDefaults: true,
          holidays: defaults.map((d, idx) => ({
            id: `default-${year}-${idx}`,
            calendar_date: d.calendar_date,
            holiday_name: d.holiday_name,
            day_type: d.day_type,
          })),
        },
      });
    }

    return NextResponse.json({
      data: {
        year,
        isUsingDefaults: false,
        holidays: rows,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const mutateHolidaySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("GENERATE_SCHEME"),
    year: z.number().int().min(2025).max(2035),
    tetScheme: z.enum(["1_4", "2_3", "3_2"]).default("2_3"),
    nationalDayScheme: z.enum(["1_2", "2_3"]).default("1_2"),
    includeCultureDay: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("ADD_HOLIDAY"),
    year: z.number().int().min(2025).max(2035),
    calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    holidayName: z.string().min(2).max(100),
    dayType: z.enum(["HOLIDAY", "COMPENSATORY_OFF"]).default("HOLIDAY"),
  }),
  z.object({
    action: z.literal("DELETE_HOLIDAY"),
    id: z.string().optional(),
    calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    action: z.literal("RESET_DEFAULTS"),
    year: z.number().int().min(2025).max(2035),
  }),
]);

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "UPDATE");

    const payload = mutateHolidaySchema.parse(await req.json());
    const admin = getSupabaseAdminClient();
    const { data: comp } = await admin.from("companies").select("id").limit(1).single();
    const companyId = comp?.id ?? "10000000-0000-4000-8000-000000000001";

    if (payload.action === "GENERATE_SCHEME") {
      const presets = getDefaultHolidaysForYear(payload.year, {
        tetScheme: payload.tetScheme,
        nationalDayScheme: payload.nationalDayScheme,
        includeCultureDay: payload.includeCultureDay,
      });

      // Clear existing holidays for that year
      await admin
        .from("work_calendars")
        .delete()
        .gte("calendar_date", `${payload.year}-01-01`)
        .lte("calendar_date", `${payload.year}-12-31`)
        .in("day_type", ["HOLIDAY", "COMPENSATORY_OFF"]);

      const rowsToInsert = presets.map((p) => ({
        company_id: companyId,
        calendar_date: p.calendar_date,
        holiday_name: p.holiday_name,
        day_type: p.day_type,
      }));

      const { data: inserted, error: insErr } = await admin
        .from("work_calendars")
        .insert(rowsToInsert)
        .select("*");
      if (insErr) throw insErr;

      return NextResponse.json({
        data: {
          year: payload.year,
          message: `Đã áp dụng lịch nghỉ năm ${payload.year} theo phương án lựa chọn.`,
          holidays: inserted,
        },
      });
    }

    if (payload.action === "ADD_HOLIDAY") {
      const { data: inserted, error: insErr } = await admin
        .from("work_calendars")
        .upsert(
          {
            company_id: companyId,
            calendar_date: payload.calendarDate,
            holiday_name: payload.holidayName,
            day_type: payload.dayType,
          },
          { onConflict: "company_id,location_id,calendar_date" }
        )
        .select("*");
      if (insErr) throw insErr;

      return NextResponse.json({ data: inserted });
    }

    if (payload.action === "DELETE_HOLIDAY") {
      if (payload.id && !payload.id.startsWith("default-")) {
        await admin.from("work_calendars").delete().eq("id", payload.id);
      } else if (payload.calendarDate) {
        await admin.from("work_calendars").delete().eq("calendar_date", payload.calendarDate);
      }
      return NextResponse.json({ data: { success: true } });
    }

    if (payload.action === "RESET_DEFAULTS") {
      // Clear custom and seed statutory defaults
      await admin
        .from("work_calendars")
        .delete()
        .gte("calendar_date", `${payload.year}-01-01`)
        .lte("calendar_date", `${payload.year}-12-31`)
        .in("day_type", ["HOLIDAY", "COMPENSATORY_OFF"]);

      const defaults = getDefaultHolidaysForYear(payload.year);
      const rowsToInsert = defaults.map((p) => ({
        company_id: companyId,
        calendar_date: p.calendar_date,
        holiday_name: p.holiday_name,
        day_type: p.day_type,
      }));
      const { data: inserted } = await admin.from("work_calendars").insert(rowsToInsert).select("*");

      return NextResponse.json({
        data: {
          year: payload.year,
          holidays: inserted ?? defaults,
        },
      });
    }

    return NextResponse.json({ error: { message: "Invalid action" } }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}

