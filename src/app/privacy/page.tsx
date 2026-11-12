"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

interface ConsentRecord {
  id: string;
  purpose_code: string;
  policy_version: string;
  consent_method: string;
  consented_at: string;
  withdrawn_at: string | null;
}

const PURPOSES = [
  {
    code: "HR_EMPLOYMENT",
    title: "Quản lý Hồ sơ Nhân sự & Hợp đồng lao động",
    desc: "Xử lý họ tên, ngày sinh, CCCD, địa chỉ và quá trình công tác theo Bộ luật Lao động 2019.",
  },
  {
    code: "PAYROLL_TAX_SI",
    title: "Tính lương, Thuế TNCN & Bảo hiểm bắt buộc",
    desc: "Xử lý số tài khoản ngân hàng, mã số thuế, người phụ thuộc để chi trả 2 đợt và kê khai BHXH/Thuế.",
  },
  {
    code: "ATTENDANCE_GPS",
    title: "Chấm công bằng GPS Geofencing",
    desc: "Thu thập tọa độ GPS tại thời điểm bấm nút check-in/check-out trong bán kính 4 địa điểm công ty.",
  },
  {
    code: "ATTENDANCE_BIOMETRIC_FACE_ID",
    title: "Dữ liệu chấm công từ máy Face ID",
    desc: "Đồng bộ nhật ký giờ quẹt thẻ/khuôn mặt từ máy chấm công vật lý (không lưu ảnh/vector gốc trên Web App).",
  },
] as const;

export default function PrivacyPage() {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/privacy/consents", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải danh sách đồng thuận.");
          return;
        }
        setError(null);
        setRecords(json.data ?? []);
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối server.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTick]);

  async function handleGrantConsent(purposeCode: string) {
    setSubmitting(purposeCode);
    setError(null);
    try {
      const res = await fetch("/api/v1/privacy/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purposeCode,
          policyVersion: "PDPL-TKV-2026.1",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Không thể ghi nhận đồng thuận.");
        return;
      }
      setReloadTick((t) => t + 1);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Đang tải trạng thái đồng thuận...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Cần đăng nhập để quản lý Đồng thuận PDPL 91/2025/QH15
        </div>
        <p className="mt-2 text-xs text-amber-800">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          Trung tâm Đồng thuận Dữ liệu Cá nhân (Luật BV BVTN 91/2025/QH15)
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Mỗi mục đích xử lý dữ liệu yêu cầu một xác nhận đồng thuận riêng biệt (tuyệt đối không gộp chung).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PURPOSES.map((purpose) => {
          const activeRecord = records.find(
            (r) => r.purpose_code === purpose.code && !r.withdrawn_at
          );
          return (
            <div
              key={purpose.code}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                    {purpose.code}
                  </span>
                  {activeRecord ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Đã đồng thuận
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                      Chưa đồng thuận
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-sm font-bold text-slate-900">{purpose.title}</h2>
                <p className="mt-1 text-xs text-slate-600">{purpose.desc}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                {activeRecord ? (
                  <span className="text-[11px] text-slate-500">
                    Phiên bản {activeRecord.policy_version} •{" "}
                    {new Date(activeRecord.consented_at).toLocaleString("vi-VN")}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Chưa có bản ghi đồng thuận</span>
                )}

                {!activeRecord && (
                  <button
                    type="button"
                    disabled={submitting === purpose.code}
                    onClick={() => handleGrantConsent(purpose.code)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {submitting === purpose.code ? "Đang lưu..." : "Xác nhận Đồng ý"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

