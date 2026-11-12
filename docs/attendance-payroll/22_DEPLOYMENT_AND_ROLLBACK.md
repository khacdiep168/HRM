# 22 — Hướng dẫn Triển khai & Khôi phục (Deployment & Rollback)

## 1. Kiểm tra Trước khi Triển khai (Pre-flight Checklist)
1. Xác nhận biến môi trường `.env.local` / Production: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PII_ENCRYPTION_KEY_BASE64`, `REQUIRE_MFA=true`.
2. Kiểm tra dữ liệu `legal_rule_registry` có bản ghi `status = 'APPROVED'` cho kỳ hiện hành (`VN-2026-H2`).
3. Chạy xác minh bắt buộc:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`

## 2. Quy trình Khôi phục (Rollback)
- **Code Rollback:** Hoàn tác về commit/release trước trên Vercel/Node server; toàn bộ migration hiện tại chỉ mang tính bổ sung, không phá hủy dữ liệu gốc (`attendance_raw_events`, `payroll_runs` đã `LOCKED`/`PAID`).
- **Xử lý Sai sót Bảng lương Chưa Khóa:** Khi ở trạng thái `DRAFT`, `CALCULATED`, hoặc chưa `LOCKED`, chạy lại Đợt tính mới (`run_version + 1`) để tạo phiên bản mới mà không xóa lịch sử đối soát.
- **Xử lý Sai sót Sau Khi Khóa (`LOCKED`/`PAID`):** Không sửa trực tiếp kỳ đã khóa; lập điều chỉnh truy lĩnh/truy thu vào `payroll_period_variables` của kỳ tiếp theo và ghi `audit_events`.

