"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus, ArrowRightLeft, RefreshCw } from "lucide-react";

interface CategoryRow {
  id: string;
  code: string;
  name: string;
}

interface AssetRow {
  id: string;
  asset_code: string;
  name: string;
  serial_no: string | null;
  purchase_value: number;
  status: string;
  asset_categories: { code: string; name: string } | null;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

interface AssignmentRow {
  id: string;
  assigned_at: string;
  returned_at: string | null;
  return_condition: string | null;
  handover_note: string | null;
  status: string;
  assets: { asset_code: string; name: string; serial_no: string | null } | null;
  employees: { employee_code: string; full_name: string } | null;
}

export default function AssetsPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Assign form
  const [assignAssetId, setAssignAssetId] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [handoverNote, setHandoverNote] = useState("");

  // Create asset form
  const [categoryId, setCategoryId] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("15000000");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/assets", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error?.message ?? json.error ?? "Không thể tải dữ liệu tài sản"
          );
        }
        return json;
      })
      .then((data) => {
        if (!active) return;
        const cats: CategoryRow[] = data.categories ?? [];
        const asts: AssetRow[] = data.assets ?? [];
        const emps: EmployeeOption[] = data.employees ?? [];
        setCategories(cats);
        setAssets(asts);
        setAssignments(data.assignments ?? []);
        setEmployees(emps);
        if (cats.length > 0) setCategoryId((prev) => prev || cats[0].id);
        const firstAvail = asts.find((a) => a.status === "AVAILABLE");
        if (firstAvail) setAssignAssetId((prev) => prev || firstAvail.id);
        if (emps.length > 0) setAssignEmployeeId((prev) => prev || emps[0].id);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTick]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "assign",
          asset_id: assignAssetId,
          employee_id: assignEmployeeId,
          handover_note: handoverNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể bàn giao tài sản");
      }
      setHandoverNote("");
      setAssignAssetId("");
      setNotice("Đã lập phiếu bàn giao tài sản.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi bàn giao");
    }
  }

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "asset",
          category_id: categoryId,
          asset_code: assetCode,
          name: assetName,
          serial_no: serialNo || undefined,
          purchase_value: Number(purchaseValue || 0),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể thêm tài sản");
      }
      setAssetCode("");
      setAssetName("");
      setSerialNo("");
      setNotice("Đã thêm tài sản mới vào kho.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo tài sản");
    }
  }

  async function handleReturn(assignmentId: string, condition: "GOOD" | "DAMAGED") {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "return",
          assignment_id: assignmentId,
          return_condition: condition,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể thu hồi tài sản");
      }
      setNotice(`Đã thu hồi tài sản (tình trạng: ${condition}).`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi thu hồi");
    }
  }

  const availableAssets = assets.filter((a) => a.status === "AVAILABLE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Package className="h-5 w-5 text-emerald-600" />
            Tài sản &amp; Bàn giao
          </h1>
          <p className="text-sm text-slate-600">
            Quản lý thiết bị IT, máy POS cửa hàng, xe bán tải &amp; biên bản bàn giao/thu hồi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadTick((t) => t + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Thông báo</div>
          <div className="mt-1">{error}</div>
          <Link
            href="/login"
            className="mt-2 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Đăng nhập hệ thống
          </Link>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {/* Forms */}
      <section className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleAssign}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
            Lập phiếu bàn giao tài sản
          </div>
          <select
            value={assignAssetId}
            onChange={(e) => setAssignAssetId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-- Chọn tài sản sẵn sàng (AVAILABLE) --</option>
            {availableAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.asset_code} — {a.name}
              </option>
            ))}
          </select>
          <select
            value={assignEmployeeId}
            onChange={(e) => setAssignEmployeeId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-- Chọn nhân viên nhận --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} — {emp.full_name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Ghi chú bàn giao (phụ kiện kèm theo, tình trạng...)"
            value={handoverNote}
            onChange={(e) => setHandoverNote(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={availableAssets.length === 0}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Bàn giao tài sản
          </button>
        </form>

        <form
          onSubmit={handleCreateAsset}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Plus className="h-4 w-4 text-emerald-600" />
            Nhập mới tài sản công ty
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Danh mục --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.code} — {cat.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Mã tài sản (vd: AST-IT-002)"
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Tên tài sản"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Số Serial / Biển số"
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              placeholder="Nguyên giá (VNĐ)"
              value={purchaseValue}
              onChange={(e) => setPurchaseValue(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Thêm vào kho tài sản
          </button>
        </form>
      </section>

      {/* Assets Inventory */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">
          Danh mục tài sản ({assets.length})
        </h2>
        {loading ? (
          <div className="py-6 text-sm text-slate-500">Đang tải...</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Mã TS</th>
                  <th className="py-2 pr-3">Nhóm</th>
                  <th className="py-2 pr-3">Tên tài sản</th>
                  <th className="py-2 pr-3">Serial / Biển số</th>
                  <th className="py-2 pr-3">Nguyên giá</th>
                  <th className="py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-800">
                      {a.asset_code}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {a.asset_categories?.name ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">{a.name}</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-600">
                      {a.serial_no ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {Number(a.purchase_value).toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          a.status === "AVAILABLE"
                            ? "bg-emerald-50 text-emerald-700"
                            : a.status === "ASSIGNED"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Assignments Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">
          Lịch sử bàn giao &amp; Thu hồi ({assignments.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Tài sản</th>
                <th className="py-2 pr-3">Nhân viên</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2 pr-3">Tình trạng thu hồi</th>
                <th className="py-2 pr-3">Ghi chú</th>
                <th className="py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((as) => (
                <tr key={as.id}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {as.assets ? `${as.assets.asset_code} — ${as.assets.name}` : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    {as.employees
                      ? `${as.employees.employee_code} — ${as.employees.full_name}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3">{as.status}</td>
                  <td className="py-2.5 pr-3">{as.return_condition ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {as.handover_note ?? "—"}
                  </td>
                  <td className="flex gap-1.5 py-2.5">
                    {as.status === "ACTIVE" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReturn(as.id, "GOOD")}
                          className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
                        >
                          Thu hồi (Tốt)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReturn(as.id, "DAMAGED")}
                          className="rounded bg-amber-600 px-2 py-1 text-[11px] text-white hover:bg-amber-700"
                        >
                          Thu hồi (Hỏng)
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Chưa có biên bản bàn giao nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
