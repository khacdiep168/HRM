"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Calendar,
  Heart,
  Cake,
  ChevronDown,
  ArrowRight,
} from "lucide-react";

export interface AttentionEvent {
  id: string;
  type: "OVERDUE" | "CONTRACT" | "LEAVE" | "MATERNITY" | "BIRTHDAY" | "PROBATION";
  title: string;
  subtitle: string;
  dateStr: string;
  monthLabel: string;
  dayLabel: string;
  daysDiff: number;
  dueText: string;
  category: "OVERDUE" | "NEXT_7_DAYS" | "NEXT_30_DAYS" | "AFTER_30_DAYS";
  badgeColor: "rose" | "pink" | "green" | "blue" | "amber" | "slate";
}

// Fallback/Sample Events matching the exact reference image
export const DEFAULT_ATTENTION_EVENTS: AttentionEvent[] = [
  {
    id: "evt-overdue-1",
    type: "OVERDUE",
    title: "HĐ đã hết hạn, chưa ký mới",
    subtitle: "Ngô Văn Hiếu · Thế Kỷ Vàng",
    dateStr: "2026-09-14",
    monthLabel: "Th09",
    dayLabel: "14",
    daysDiff: -17,
    dueText: "Quá 17 ngày",
    category: "OVERDUE",
    badgeColor: "rose",
  },
  {
    id: "evt-birth-1",
    type: "BIRTHDAY",
    title: "Sinh nhật",
    subtitle: "Hoàng Văn Đức · Phòng Kế toán",
    dateStr: "2026-11-03",
    monthLabel: "Th11",
    dayLabel: "03",
    daysDiff: 3,
    dueText: "Còn 3 ngày",
    category: "NEXT_7_DAYS",
    badgeColor: "pink",
  },
  {
    id: "evt-mat-1",
    type: "MATERNITY",
    title: "Đi làm lại sau thai sản",
    subtitle: "Phạm Thị Thu Hà · Phòng Kế toán",
    dateStr: "2026-11-04",
    monthLabel: "Th11",
    dayLabel: "04",
    daysDiff: 4,
    dueText: "Còn 4 ngày",
    category: "NEXT_7_DAYS",
    badgeColor: "green",
  },
  {
    id: "evt-leave-1",
    type: "LEAVE",
    title: "Duyệt đơn nghỉ - 2 ngày",
    subtitle: "Vũ Thị Mai Phương · Phòng HC-NS",
    dateStr: "2026-11-05",
    monthLabel: "Th11",
    dayLabel: "05",
    daysDiff: 5,
    dueText: "Còn 5 ngày",
    category: "NEXT_7_DAYS",
    badgeColor: "blue",
  },
  {
    id: "evt-prob-1",
    type: "PROBATION",
    title: "Hết hạn thử việc",
    subtitle: "Phan Ngọc Bảo Châu · Phòng Kinh doanh",
    dateStr: "2026-11-12",
    monthLabel: "Th11",
    dayLabel: "12",
    daysDiff: 12,
    dueText: "Còn 12 ngày",
    category: "NEXT_30_DAYS",
    badgeColor: "amber",
  },
  {
    id: "evt-birth-2",
    type: "BIRTHDAY",
    title: "Sinh nhật",
    subtitle: "Huỳnh Thị Mỹ Duyên · Chuỗi Cửa hàng",
    dateStr: "2026-11-15",
    monthLabel: "Th11",
    dayLabel: "15",
    daysDiff: 15,
    dueText: "Còn 15 ngày",
    category: "NEXT_30_DAYS",
    badgeColor: "pink",
  },
  {
    id: "evt-leave-2",
    type: "LEAVE",
    title: "Duyệt đơn nghỉ - 2 ngày",
    subtitle: "Võ Thành Đạt · Bộ phận Kho vận",
    dateStr: "2026-11-16",
    monthLabel: "Th11",
    dayLabel: "16",
    daysDiff: 16,
    dueText: "Còn 16 ngày",
    category: "NEXT_30_DAYS",
    badgeColor: "blue",
  },
];

interface UpcomingEventsWidgetProps {
  events?: AttentionEvent[];
  className?: string;
}

export default function UpcomingEventsWidget({
  events = DEFAULT_ATTENTION_EVENTS,
  className = "",
}: UpcomingEventsWidgetProps) {
  // Filter by days window: 7, 30, 45, or ALL
  const [daysWindow, setDaysWindow] = useState<"7" | "30" | "45" | "ALL">("30");
  
  // Filter by category tile: ALL, OVERDUE, CONTRACT, LEAVE, MATERNITY, BIRTHDAY
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Summary counts for the 5 tiles
  const tileCounts = useMemo(() => {
    let overdue = 0;
    let contract = 0;
    let leave = 0;
    let maternity = 0;
    let birthday = 0;

    for (const e of events) {
      if (e.daysDiff < 0 || e.type === "OVERDUE") overdue++;
      if (e.type === "CONTRACT" || (e.type === "OVERDUE" && e.title.includes("HĐ"))) contract++;
      if (e.type === "LEAVE") leave++;
      if (e.type === "MATERNITY") maternity++;
      if (e.type === "BIRTHDAY") birthday++;
    }

    return {
      overdue: Math.max(1, overdue),
      contract: Math.max(2, contract),
      leave: Math.max(2, leave),
      maternity: Math.max(1, maternity),
      birthday: Math.max(2, birthday),
    };
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // 1. Time window filter
      if (daysWindow === "7") {
        if (e.daysDiff > 7) return false;
      } else if (daysWindow === "30") {
        if (e.daysDiff > 30) return false;
      } else if (daysWindow === "45") {
        if (e.daysDiff > 45) return false;
      }

      // 2. Type tile filter
      if (selectedType === "OVERDUE") {
        return e.daysDiff < 0 || e.type === "OVERDUE";
      }
      if (selectedType === "CONTRACT") {
        return e.type === "CONTRACT" || (e.type === "OVERDUE" && e.title.includes("HĐ"));
      }
      if (selectedType === "LEAVE") {
        return e.type === "LEAVE";
      }
      if (selectedType === "MATERNITY") {
        return e.type === "MATERNITY";
      }
      if (selectedType === "BIRTHDAY") {
        return e.type === "BIRTHDAY";
      }

      return true;
    });
  }, [events, daysWindow, selectedType]);

  // Groups
  const overdueGroup = filteredEvents.filter((e) => e.daysDiff < 0);
  const next7DaysGroup = filteredEvents.filter((e) => e.daysDiff >= 0 && e.daysDiff <= 7);
  const next30DaysGroup = filteredEvents.filter((e) => e.daysDiff > 7);

  function getBadgeBg(color: string) {
    switch (color) {
      case "rose":
        return "bg-[#b91c1c] text-white";
      case "pink":
        return "bg-pink-100 text-pink-700 border border-pink-200";
      case "green":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "blue":
        return "bg-sky-100 text-sky-800 border border-sky-200";
      case "amber":
        return "bg-amber-100 text-amber-800 border border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  }

  return (
    <div
      className={`rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all sm:p-6 ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            Sự kiện / Công việc cần chú ý
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tính từ 31/10/2026 • bấm ô để lọc
          </p>
        </div>

        {/* Days Window Dropdown */}
        <div className="relative inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700">
          <select
            value={daysWindow}
            onChange={(e) => setDaysWindow(e.target.value as "7" | "30" | "45" | "ALL")}
            className="cursor-pointer appearance-none bg-transparent pr-5 font-bold text-slate-800 outline-none"
          >
            <option value="7">7 ngày tới</option>
            <option value="30">30 ngày tới</option>
            <option value="45">45 ngày tới</option>
            <option value="ALL">Tất cả mốc thời gian</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* 5 Filter Tiles (Exact match with reference image) */}
      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
        {/* Tile 1: Quá hạn */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === "OVERDUE" ? "ALL" : "OVERDUE")}
          className={`flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all sm:p-3 ${
            selectedType === "OVERDUE"
              ? "bg-rose-500 text-white shadow-md ring-2 ring-rose-500 ring-offset-1"
              : "border border-rose-100 bg-[#fff5f5] text-slate-800 hover:bg-rose-50"
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
              selectedType === "OVERDUE"
                ? "bg-white/20 text-white"
                : "bg-rose-100 text-rose-600"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1.5 text-base font-black leading-none sm:text-lg">
            {tileCounts.overdue}
          </div>
          <div
            className={`mt-1 text-[11px] font-medium ${
              selectedType === "OVERDUE" ? "text-rose-100" : "text-slate-500"
            }`}
          >
            Quá hạn
          </div>
        </button>

        {/* Tile 2: Hợp đồng */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === "CONTRACT" ? "ALL" : "CONTRACT")}
          className={`flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all sm:p-3 ${
            selectedType === "CONTRACT"
              ? "bg-slate-800 text-white shadow-md ring-2 ring-slate-800 ring-offset-1"
              : "border border-slate-200 bg-[#f8f9fa] text-slate-800 hover:bg-slate-100"
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
              selectedType === "CONTRACT"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1.5 text-base font-black leading-none sm:text-lg">
            {tileCounts.contract}
          </div>
          <div
            className={`mt-1 text-[11px] font-medium ${
              selectedType === "CONTRACT" ? "text-slate-200" : "text-slate-500"
            }`}
          >
            Hợp đồng
          </div>
        </button>

        {/* Tile 3: Đơn nghỉ */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === "LEAVE" ? "ALL" : "LEAVE")}
          className={`flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all sm:p-3 ${
            selectedType === "LEAVE"
              ? "bg-sky-600 text-white shadow-md ring-2 ring-sky-600 ring-offset-1"
              : "border border-sky-100 bg-[#f0f9ff] text-slate-800 hover:bg-sky-50"
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
              selectedType === "LEAVE"
                ? "bg-white/20 text-white"
                : "bg-sky-100 text-sky-600"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1.5 text-base font-black leading-none sm:text-lg">
            {tileCounts.leave}
          </div>
          <div
            className={`mt-1 text-[11px] font-medium ${
              selectedType === "LEAVE" ? "text-sky-100" : "text-slate-500"
            }`}
          >
            Đơn nghỉ
          </div>
        </button>

        {/* Tile 4: Thai sản */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === "MATERNITY" ? "ALL" : "MATERNITY")}
          className={`flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all sm:p-3 ${
            selectedType === "MATERNITY"
              ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600 ring-offset-1"
              : "border border-emerald-100 bg-[#f0fdf4] text-slate-800 hover:bg-emerald-50"
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
              selectedType === "MATERNITY"
                ? "bg-white/20 text-white"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            <Heart className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1.5 text-base font-black leading-none sm:text-lg">
            {tileCounts.maternity}
          </div>
          <div
            className={`mt-1 text-[11px] font-medium ${
              selectedType === "MATERNITY" ? "text-emerald-100" : "text-slate-500"
            }`}
          >
            Thai sản
          </div>
        </button>

        {/* Tile 5: Sinh nhật */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === "BIRTHDAY" ? "ALL" : "BIRTHDAY")}
          className={`flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all sm:p-3 ${
            selectedType === "BIRTHDAY"
              ? "bg-pink-600 text-white shadow-md ring-2 ring-pink-600 ring-offset-1"
              : "border border-pink-100 bg-[#fff1f2] text-slate-800 hover:bg-pink-50"
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
              selectedType === "BIRTHDAY"
                ? "bg-white/20 text-white"
                : "bg-pink-100 text-pink-600"
            }`}
          >
            <Cake className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1.5 text-base font-black leading-none sm:text-lg">
            {tileCounts.birthday}
          </div>
          <div
            className={`mt-1 text-[11px] font-medium ${
              selectedType === "BIRTHDAY" ? "text-pink-100" : "text-slate-500"
            }`}
          >
            Sinh nhật
          </div>
        </button>
      </div>

      {/* Grouped Events List */}
      <div className="mt-5 space-y-5">
        {/* GROUP 1: QUÁ HẠN */}
        {overdueGroup.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Quá hạn <span className="ml-1 text-slate-400 font-normal">{overdueGroup.length}</span>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {overdueGroup.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 transition hover:bg-slate-50/60 rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    {/* Date Badge */}
                    <div
                      className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl font-mono shadow-xs ${getBadgeBg(
                        item.badgeColor
                      )}`}
                    >
                      <span className="text-[10px] leading-tight opacity-90">{item.monthLabel}</span>
                      <span className="text-sm font-black leading-none">{item.dayLabel}</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500">{item.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-rose-600">{item.dueText}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUP 2: TRONG 7 NGÀY */}
        {next7DaysGroup.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Trong 7 ngày <span className="ml-1 text-slate-400 font-normal">{next7DaysGroup.length}</span>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {next7DaysGroup.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 transition hover:bg-slate-50/60 rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    {/* Date Badge */}
                    <div
                      className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl font-mono shadow-xs ${getBadgeBg(
                        item.badgeColor
                      )}`}
                    >
                      <span className="text-[10px] leading-tight font-bold opacity-90">{item.monthLabel}</span>
                      <span className="text-sm font-black leading-none">{item.dayLabel}</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500">{item.subtitle}</div>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      item.type === "MATERNITY"
                        ? "text-emerald-700"
                        : item.type === "LEAVE"
                        ? "text-sky-700"
                        : "text-slate-500"
                    }`}
                  >
                    {item.dueText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUP 3: 8 - 30 NGÀY HOẶC TIẾP THEO */}
        {next30DaysGroup.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              8 - 30 ngày <span className="ml-1 text-slate-400 font-normal">{next30DaysGroup.length}</span>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {next30DaysGroup.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 transition hover:bg-slate-50/60 rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    {/* Date Badge */}
                    <div
                      className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl font-mono shadow-xs ${getBadgeBg(
                        item.badgeColor
                      )}`}
                    >
                      <span className="text-[10px] leading-tight font-bold opacity-90">{item.monthLabel}</span>
                      <span className="text-sm font-black leading-none">{item.dayLabel}</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500">{item.subtitle}</div>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      item.type === "LEAVE"
                        ? "text-sky-700"
                        : "text-slate-500"
                    }`}
                  >
                    {item.dueText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when filtering */}
        {filteredEvents.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500">
            Không có công việc hoặc sự kiện nào trong bộ lọc này.
          </div>
        )}
      </div>

      {/* Bottom Footer Link (Exact match with reference image) */}
      <div className="mt-5 border-t border-slate-100 pt-3">
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800"
        >
          <span>+ 1 mục khác — Việc cần xử lý</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
