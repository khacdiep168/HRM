"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin, Briefcase, AlertCircle, WalletCards } from "lucide-react";

interface OrgTreePayload {
  company: {
    id: string;
    code: string;
    legal_name: string;
    english_name: string | null;
    tax_code: string;
    address: string;
    payroll_cutoff_day: number;
    payroll_advance_day: number;
  };
  locations: Array<{
    id: string;
    code: string;
    name: string;
    address: string;
    min_wage_region_code: string;
    geofence_radius_m: number;
    gps_required: boolean;
  }>;
  departments: Array<{
    id: string;
    parent_id: string | null;
    code: string;
    name: string;
    cost_center_id: string | null;
    default_location_id: string | null;
  }>;
  costCenters: Array<{
    id: string;
    code: string;
    name: string;
    accounting_ref: string | null;
  }>;
  positions: Array<{
    id: string;
    department_id: string;
    code: string;
    title: string;
    headcount_limit: number | null;
    allow_300h_ot: boolean;
  }>;
}

export default function OrgPage() {
  const [data, setData] = useState<OrgTreePayload | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/org/tree", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? { message: "Không thể tải sơ đồ tổ chức." });
        } else {
          setData(json.data);
        }
      })
      .catch(() => setError({ message: "Lỗi kết nối API /api/v1/org/tree." }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Đang tải cơ cấu tổ chức...</div>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Chưa thể hiển thị dữ liệu Tổ chức ({error?.code ?? "Yêu cầu đăng nhập"})
        </div>
        <p className="mt-2 text-xs text-amber-800">{error?.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/login"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Đăng nhập / MFA
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-medium text-amber-900"
          >
            Về Trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const rootDepts = data.departments.filter((d) => !d.parent_id);
  const childrenByParent = new Map<string, typeof data.departments>();
  for (const dept of data.departments) {
    if (dept.parent_id) {
      const list = childrenByParent.get(dept.parent_id) ?? [];
      list.push(dept);
      childrenByParent.set(dept.parent_id, list);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{data.company.legal_name}</h1>
            <p className="text-xs text-slate-500">
              {data.company.english_name} • MST: {data.company.tax_code} • {data.company.address}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              Chốt công: Ngày {data.company.payroll_cutoff_day}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
              Tạm ứng 50%: Ngày {data.company.payroll_advance_day}
            </span>
          </div>
        </div>
      </div>

      {/* Work Locations */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MapPin className="h-4 w-4 text-amber-600" />
          Địa điểm làm việc &amp; Geofence GPS ({data.locations.length})
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.locations.map((loc) => (
            <div key={loc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-700">{loc.code}</span>
                <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                  {loc.min_wage_region_code}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900">{loc.name}</div>
              <div className="mt-1 text-xs text-slate-500">{loc.address}</div>
              <div className="mt-2 text-[11px] font-medium text-slate-700">
                Bán kính GPS: {loc.geofence_radius_m}m
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Department Hierarchy & Cost Centers */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 className="h-4 w-4 text-amber-600" />
            Sơ đồ Phòng ban &amp; Bộ phận trực thuộc ({data.departments.length})
          </h2>
          <div className="mt-4 space-y-3">
            {rootDepts.map((root) => {
              const subDepts = childrenByParent.get(root.id) ?? [];
              return (
                <div key={root.id} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-slate-900">
                      <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-white">
                        {root.code}
                      </span>
                      {root.name}
                    </div>
                  </div>
                  {subDepts.length > 0 && (
                    <div className="mt-2.5 grid gap-2 pl-4 sm:grid-cols-2">
                      {subDepts.map((sub) => (
                        <div
                          key={sub.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                        >
                          <span className="mr-1.5 font-mono font-semibold text-slate-600">
                            {sub.code}
                          </span>
                          <span className="font-medium text-slate-800">{sub.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <WalletCards className="h-4 w-4 text-amber-600" />
              Cost Centers ({data.costCenters.length})
            </h2>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {data.costCenters.map((cc) => (
                <li key={cc.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-slate-800">{cc.name}</span>
                  <span className="font-mono text-slate-500">{cc.code}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Briefcase className="h-4 w-4 text-amber-600" />
              Chức danh / Vị trí ({data.positions.length})
            </h2>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {data.positions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5"
                >
                  <span className="font-medium text-slate-800">{pos.title}</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {pos.allow_300h_ot ? "OT 300h" : "OT 200h"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

