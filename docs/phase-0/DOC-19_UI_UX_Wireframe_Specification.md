# DOC-19: Đặc tả UI/UX, Sitemap & Wireframe Màn hình Trọng yếu

> **Trạng thái tài liệu:** `APPROVED_DESIGN_BASELINE`  
> **Tham chiếu gốc:** [HRM_Enterprise_Design_Baseline_v1.0.docx](../../HRM_Enterprise_Design_Baseline_v1.0.docx) — Mục 4 & Mục 10; [DOC-17](./DOC-17_Security_and_RBAC_Matrix.md); [DOC-24](./DOC-24_Open_Decisions_Log.md)  
> **Nền tảng giao diện:** Web-only Responsive (Next.js App Router + Tailwind CSS + shadcn/ui), triển khai trên **Vercel**

---

## 1. Nguyên tắc UX cho 2 Nhóm Người dùng tại Thế Kỷ Vàng

1. **Mobile-first Responsive (`360px–430px`) cho Khối Vận hành & ESS:**
   * Đối tượng: Nhân viên `Bãi xe` (3 ca 24/24), `Bảo vệ`, `Cửa hàng miễn thuế`, `Kho hàng`, `Lái xe`, `Kỹ thuật`, `Tạp vụ`.
   * Yêu cầu UX: Mở trình duyệt điện thoại vào là thấy ngay **thẻ Chấm công GPS (1 chạm)**, ca trực hôm nay, trạng thái lần quét Face ID gần nhất, nút xin nghỉ/đổi ca/OT và phiếu lương cá nhân; cỡ chữ rõ ràng, nút bấm tối thiểu `44×44px`.
2. **Desktop-first (`1280px+`) cho Khối Quản trị & Tài chính:**
   * Đối tượng: `Ban Điều hành` (`Giám đốc / Phó Giám đốc`), `Phòng HC-NS`, `Phòng Kế toán` (`Kế toán trưởng`), `Phòng IT`, `Quản lý bộ phận`.
   * Yêu cầu UX: Bảng dữ liệu mật độ cao (sticky header/column), filter nhanh theo **Phòng ban / Điểm làm việc / Cost Center**, hiển thị rõ luồng trạng thái phê duyệt, cảnh báo lỗi pháp lý/OT/công ngoại lệ bằng màu sắc nhất quán, và **che mặc định (`****1234`)** mọi dữ liệu PII nhạy cảm.

---

## 2. Sitemap & Điều hướng theo Role (Role-based Navigation)

| Nhóm Menu | Route đề xuất | Ai được nhìn thấy (`DOC-17`) |
| :--- | :--- | :--- |
| **1. Cổng cá nhân (ESS)** | `/ess/home`, `/ess/attendance-gps`, `/ess/shifts`, `/ess/leave-ot`, `/ess/payslips`, `/ess/privacy` | **Tất cả 8 Roles** (Phạm vi `SELF`) |
| **2. Quản lý Bộ phận** | `/team/dashboard`, `/team/shifts` (xếp ca 24/24), `/team/approvals` (nghỉ, OT, giải trình GPS) | `DEPT_MANAGER` (`Quản lý Bãi xe`, `Thủ kho`, `CH trưởng`, `Trưởng/Phó phòng`), `HR_ADMIN`, `DIRECTOR` |
| **3. Nhân sự & Hợp đồng** | `/hr/employees`, `/hr/org-chart`, `/hr/contracts`, `/hr/movements`, `/hr/recruitment`, `/hr/onboarding` | `HR_ADMIN`, `HR_STAFF`, `DIRECTOR` (duyệt/tóm tắt) |
| **4. Chấm công & Phép/OT** | `/time/devices` (Face ID), `/time/raw-logs`, `/time/exceptions`, `/time/summaries` (chốt kỳ ngày `25`), `/time/leave-policies` | `HR_ADMIN`, `HR_STAFF`, `DEPT_MANAGER` (Dept) |
| **5. Tiền lương, Thuế & BHXH** | `/payroll/allowances` (3 tầng), `/payroll/runs`, `/payroll/runs/:id`, `/payroll/pit`, `/payroll/insurance`, `/payroll/exports` | `HR_ADMIN` (Lập/Khóa), `ACCOUNTANT` (Kế toán trưởng duyệt/Thuế/Export), `DIRECTOR` (Chốt duyệt) |
| **6. Tài sản, KPI & Đào tạo** | `/assets`, `/performance/kpi`, `/learning/courses` | `HR_ADMIN`, `DEPT_MANAGER`, `EMPLOYEE` (Self) |
| **7. Quản trị IT & Audit** | `/admin/users-roles`, `/admin/locations-geofence`, `/admin/face-id-sync`, `/admin/audit-logs`, `/admin/privacy-requests` | `SUPER_ADMIN` (IT — ẩn lương/PII), `AUDITOR` (Read-only logs), `HR_ADMIN` (Privacy DSR) |

---

## 3. Wireframe các Màn hình Trọng yếu

### 3.1. Màn hình Mobile ESS: Chấm công GPS & Ca trực (`/ess/attendance-gps`)
```text
+------------------------------------------+
| [Logo GC] Thế Kỷ Vàng       [NV042] [🔔] |
+------------------------------------------+
| Xin chào, Nguyễn Văn A                   |
| Bộ phận: Bãi xe (Điểm tập kết) • Ca 3    |
|------------------------------------------|
| CA HÔM NAY (12/11/2026)                  |
| Ca 3 Đêm: 22:00 - 06:00                  |
| Giao ca sớm (+15'): 21:45 (Tính công/OT) |
|------------------------------------------|
| CHẤM CÔNG GPS (Bắt buộc quyền vị trí)    |
| 📍 Điểm: Bãi xe Điểm tập kết (R=150m)    |
| 🟢 Tọa độ hiện tại: Cách tâm 32m (Hợp lệ)|
| ℹ️ Chấm công Face ID gần nhất: Chưa có    |
|                                          |
|   [   BẤM CHECK-IN VÀO CA (GPS)   ]      |
|   ( ) Đánh dấu đi công tác / Lái xe      |
|------------------------------------------|
| YÊU CẦU NHANH                            |
| [Xin nghỉ phép] [Đăng ký OT] [Đổi ca]    |
| [Xem phiếu lương] [Quyền dữ liệu 91/2025]|
+------------------------------------------+
```
* **UX States & Edge Cases:**
  * Nếu chưa ký `consent_records` GPS → hiển thị **Modal Đồng ý Xử lý Dữ liệu Vị trí (Luật 91/2025/QH15)** giải thích rõ *"chỉ ghi nhận tọa độ tại thời điểm bấm nút, không theo dõi nền"* trước khi mở nút Check-in.
  * Nếu ngoài vùng Geofence (`distance_m > 150m`): nút đổi sang cảnh báo màu hổ phách **`CHECK-IN NGOÀI VÙNG (Tạo giải trình)`** kèm ô nhập ghi chú bắt buộc gửi tới Quản lý Bãi xe / Thủ kho / Cửa hàng trưởng.

---

### 3.2. Màn hình Desktop: Điều độ Ca 24/24 & Bảng công Kỳ ngày 25 (`/team/shifts` & `/time/summaries`)
```text
+---------------------------------------------------------------------------------------------------+
| QUẢN LÝ CÔNG & CA LÀM VIỆC | Kỳ lương: [Tháng 11/2026 (26/10 → 25/11)] | Điểm: [Tất cả ▼]         |
+---------------------------------------------------------------------------------------------------+
| KPI Kỳ: [186 NV] | [Chờ giải trình GPS/FaceID: 7] | [Cảnh báo OT >35h/tháng: 2] | [Chưa khóa công] |
+---------------------------------------------------------------------------------------------------+
| Bộ lọc: [Phòng: Bãi xe ▼] [Nguồn: Face ID + GPS ▼] [Tìm mã/tên NV...]       [Đồng bộ FaceID] [Chốt] |
|---------------------------------------------------------------------------------------------------|
| Mã NV | Họ tên       | Bộ phận | Ca chuẩn | FaceID | GPS  | Giao ca | OT(h) | Ngoại lệ | Trạng thái|
| NV042 | Nguyễn Văn A | Bãi xe  | Ca 3 Đêm |  22:01 |21:44 |  +15p   |  4.5  |  [0]     | Đủ công   |
| NV088 | Trần Thị B   | CHMT    | Ca Chiều |  13:55 |  —   |   —     |  0.0  | [1:Thiếu]| Cần duyệt |
| NV105 | Lê Văn C     | Bảo vệ  | Ca Ngày  |  05:30 |05:29 |  +30p   |  2.0  |  [0]     | Đủ công   |
+---------------------------------------------------------------------------------------------------+
| Footer Action: [Xuất Excel Bảng công]                         [KHÓA BẢNG CÔNG KỲ 25/11 (HR_ADMIN)] |
+---------------------------------------------------------------------------------------------------+
```
* **UX Rules:**
  * Phân biệt màu trực quan nguồn quét (`Face ID` xanh lam, `GPS Hợp lệ` xanh lá, `GPS Ngoài vùng` cam).
  * Nút **`KHÓA BẢNG CÔNG KỲ 25/11`** bị vô hiệu hóa (`disabled`) nếu vẫn còn `attendance_exceptions` ở trạng thái `PENDING` — bắt buộc duyệt hoặc từ chối hết ngoại lệ trước khi chuyển sang Payroll!

---

### 3.3. Màn hình Desktop: Cấu hình Tiền ăn & Phụ cấp 3 Tầng + Bảng lương (`/payroll/allowances` & `/payroll/runs/:id`)
```text
+---------------------------------------------------------------------------------------------------+
| BẢNG TÍNH LƯƠNG THÁNG 11/2026 (100% GROSS • VÙNG III BẾN CẦU)     Trạng thái: [PENDING_ACCOUNTANT]|
| Kỳ công chốt ngày 25 (26/10 → 25/11) • Chi Đợt 1 (15/11: 50% LCB) • Chi Đợt 2 (30/11: Quyết toán) |
+---------------------------------------------------------------------------------------------------+
| Quy trình: [1. HC-NS Lập ✓] ──► [2. Kế toán trưởng Duyệt (Đang chờ)] ──► [3. Giám đốc] ──► [4. Khóa]|
|---------------------------------------------------------------------------------------------------|
| Tab: [Đợt 2: Quyết toán cuối tháng] [Đợt 1: Ứng 50% ngày 15 ✓] [Phụ cấp 3 Tầng] [BHXH/TNCN]       |
|---------------------------------------------------------------------------------------------------|
| Tóm tắt: Tổng Gross: X đ | BHXH+PIT: Y đ | Đã chi Đợt 1 (15/11): A đ | Còn trả Đợt 2 (30/11): B đ|
|---------------------------------------------------------------------------------------------------|
| Mã NV | Họ tên  | Lương CB  | Ăn ca* | PC Khác | BH+PIT  | Full Net  | Đã trả 15/11 | Còn trả 30/11|
| NV042 | Ng.VănA | 8.000.000 |960.000 |1.800.000| 840.000 | 9.920.000 |  4.000.000   |    5.920.000 |
| NV065 | Trần.B  |12.000.000 |1.000.00|2.000.000|1.260.000|14.558.182 |  6.000.000   |    8.558.182 |
| (*Click vào ô "Ăn ca" hoặc "PC Khác" mở Drawer giải thích Tầng 1 Bộ phận / Tầng 2 Cá nhân / Tầng 3)|
+---------------------------------------------------------------------------------------------------+
| Hành động Kế toán trưởng: [Yêu cầu HC-NS chỉnh lại]     [KÝ DUYỆT HỒ SƠ LƯƠNG THƯỞNG (MFA + Ký)]   |
+---------------------------------------------------------------------------------------------------+
```
* **UX Drawer Chi tiết Phụ cấp 3 Tầng (khi click vào 1 nhân viên):**
  * Hiển thị rõ từng dòng đang áp dụng nguồn nào:
    * `Ăn ca tiền mặt`: Đang áp dụng **Tầng 2 (Cá nhân)** `40.000đ × 24 công = 960.000đ` *(Miễn thuế 100% theo NĐ `253/2026` vì `≤ 1.200.000đ`)*.
    * `Phụ cấp trách nhiệm`: Đang kế thừa **Tầng 1 (Bộ phận Bãi xe)** `1.200.000đ`.
    * `Thưởng doanh số CHMT`: Lấy từ **Tầng 3 (Biến động kỳ 11/2026)** `2.500.000đ`.
* **Bảo mật UI (`DOC-17`):**
  * Role `SUPER_ADMIN` (Phòng IT) hoặc `DEPT_MANAGER` không bao giờ thấy menu `/payroll/runs`.
  * Nếu `HR_ADMIN` tạo run lương → nút duyệt của bước kế tiếp bắt buộc tài khoản `ACCOUNTANT` (Kế toán trưởng) khác `actor_id` và yêu cầu xác nhận MFA trước khi ký duyệt hoặc export file chuyển khoản ngân hàng.

---

### 3.4. Màn hình Quản trị Tích hợp Face ID & Geofence (`/admin/face-id-sync` & `/admin/locations-geofence`)
* **Mục tiêu cho Phòng IT (`SUPER_ADMIN`):**
  * Xem bản đồ/danh sách 4 `locations` (`VP 75A`, `Kho hàng`, `CHMT Mộc Bài`, `Bãi xe`), chỉnh tọa độ `(lat, lng)` và bán kính Geofence (`50m–300m`).
  * Xem trạng thái kết nối **4 máy Face ID** (Heartbeat lần cuối, số log nhận được hôm nay, tỷ lệ thành công, danh sách `UNMAPPED_USER` cần gán `deviceUserId` ↔ `employee_code`).
  * **Kiểm soát tách quyền:** Trên màn hình này Phòng IT **chỉ thấy `employee_code`, tên và mã thiết bị** — tuyệt đối không thấy mức lương, CCCD hay tài khoản ngân hàng.

