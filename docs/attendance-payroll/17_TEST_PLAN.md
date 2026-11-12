# 17 — Kế hoạch Kiểm thử (Test Plan)

## 1. Phạm vi & Công cụ
- **Unit & Engine Tests:** `Vitest` (`npm test`) kiểm thử logic thuần trên `Decimal.js`, ghép cặp ca qua đêm, nạp `legal_rule_registry`, `calcOvertimePay`, `solveNetToGross`, SoD & RBAC, CSV export sanitization.
- **Static & Type Safety:** TypeScript strict (`npm run typecheck`) và ESLint (`npm run lint`).
- **Build & Route Verification:** Next.js production build (`npm run build`).

## 2. Tiêu chí Nghiệm thu (Exit Criteria)
- `100%` test suites PASS, không bỏ qua (`skip`) hoặc nới lỏng assertion.
- Sai số `solveNetToGross` tối đa `±1 VNĐ`.
- Không cho phép `SUPER_ADMIN` truy cập `PAYROLL` (`OBD-07`).
- Không cho phép tính lại hoặc sửa đổi kỳ lương đã `LOCKED`/`PAID`.

