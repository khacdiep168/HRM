# 15 — Phân quyền & Bảo mật Hệ thống (RBAC & Security)

## 1. Nguyên tắc Deny-by-Default & Server-Side Enforcement
- Mọi API Route đều gọi `resolveAuthContext()` và `assertAuthorized(ctx, module, action)` trước khi truy vấn dữ liệu.
- Kết hợp PostgreSQL Row-Level Security (RLS) theo `company_id` và vai trò người dùng.

## 2. Tách quyền Quản trị Hệ thống (`OBD-07`)
- Vai trò `SUPER_ADMIN` (Quản trị kỹ thuật/hệ thống) **không có bất kỳ quyền nào** trên module `PAYROLL` (`READ`, `CREATE`, `UPDATE`, `APPROVE`, `LOCK`, `EXPORT` đều bị từ chối với `403 FORBIDDEN`).
- Chỉ `HR_ADMIN`, `HR_STAFF` (lập/tính), `ACCOUNTANT` (Kế toán trưởng kiểm tra & xuất), và `DIRECTOR` (Giám đốc phê duyệt chi) được phép thao tác trong phạm vi được giao.

## 3. Separation of Duties (SoD) & Bảo vệ Dữ liệu Nhạy cảm
- `assertNotSelfApproval(actorUserId, creatorUserId)`: Người lập bảng lương không thể tự ký kiểm tra Kế toán; Kế toán trưởng không thể tự duyệt thay Giám đốc.
- Số tài khoản ngân hàng (`account_no_enc`) và CCCD/MST cá nhân được mã hóa `AES-256-GCM`, chỉ giải mã khi xuất file ngân hàng sau khi bảng lương đạt trạng thái `APPROVED` / `LOCKED` / `PAID`.
- Xuất CSV áp dụng `escapeCsvCell` chống CSV Formula Injection (`=`, `+`, `-`, `@`).

