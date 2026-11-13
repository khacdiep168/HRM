# CHANGELOG — HRM ENTERPRISE THẾ KỶ VÀNG
*Nâng cấp ứng dụng Quản trị Nhân sự & Tiền lương thực tế cho Doanh nghiệp Thương mại (Vùng III Tây Ninh)*

Tất cả các thay đổi tuân thủ nghiêm ngặt nguyên tắc: **"Ít tính năng hơn nhưng chạy trọn vẹn với dữ liệu thật"**, không phá hủy dữ liệu, bảo vệ dữ liệu PII và tuân thủ Luật Lao động & Thuế Việt Nam hiện hành.

---

## [Phiên bản 2.0.0] - 2026-11-13 — Hoàn tất trọn vẹn 6 Bước Cải tiến

### 🚀 BƯỚC 0: Khảo sát & Đánh giá hiện trạng
- Đọc và phân tích toàn diện 17 module, cơ sở dữ liệu Supabase, các chính sách RLS và API routes.
- Xuất bản báo cáo kỹ thuật `docs/AUDIT.md` chi tiết về hiện trạng hệ thống, nợ kỹ thuật, các điểm nghẽn "Đang tải...", rủi ro bảo mật PII và rủi ro pháp lý.

### 🧭 BƯỚC 1: Đơn giản hóa cấu trúc điều hướng
- Tái cấu trúc menu điều hướng thành 5 nhóm công việc trực quan theo hành vi người dùng:
  - **Tổng quan**: Dashboard điều hành theo vai trò.
  - **Hằng ngày**: Chấm công GPS, Nghỉ phép, Tăng ca, Bảng công, Việc cần duyệt (`/approvals`).
  - **Hằng tháng**: Chốt công, Bảng lương (Quy trình 5 bước), Phiếu lương.
  - **Nhân sự**: Hồ sơ nhân viên, Hợp đồng lao động.
  - **Quản trị**: Phân quyền & Tài khoản, Nhật ký Audit, Cài đặt tham số luật (`/admin`), Tuân thủ PDPL.
- Đóng băng 5 module phụ (Tuyển dụng, Đào tạo, Tài sản, KPI, BHXH 1 lần) an toàn phía sau feature flag (`src/lib/config/feature-flags.ts`), mặc định tắt.
- Thêm cơ chế bảo vệ phiên đăng nhập: Người chưa đăng nhập bị chặn tại Middleware, chuyển hướng về `/login`. Bổ sung API `/api/v1/auth/logout` và nút Đăng xuất trên thanh điều hướng.

### ⚡ BƯỚC 2: Chuẩn hóa Luồng cốt lõi
- **Cổng nhân viên di động (Mobile ESS)**: Chấm công GPS với bán kính geofence cấu hình theo chi nhánh; Xem công tháng, quỹ phép còn lại, gửi đơn xin phép/tăng ca trong 3 thao tác; Xem và tải phiếu lương PDF.
- **Màn hình "Việc cần duyệt" tập trung (`/approvals`)**: Gộp đơn nghỉ phép, tăng ca, giải trình công vào 1 màn hình duy nhất cho cấp quản lý, hỗ trợ duyệt hàng loạt 1 chạm. Sửa triệt để lỗi lệch số lượng đơn OT do sai tên cột schema.
- **Quy trình lương 5 bước có trạng thái rõ ràng (`/payroll`)**: Chốt công ➔ Tính lương & xem trước ➔ Kế toán trưởng rà soát ➔ Giám đốc phê duyệt ➔ Khóa kỳ lương & Phát hành phiếu lương.
- **Cơ chế Khóa kỳ lương & Mở khóa an toàn**: Kỳ lương đã khóa không thể chỉnh sửa; Muốn mở khóa bắt buộc phải nhập lý do giải trình và lưu vết Audit log.
- **Minh bạch phiếu lương**: Bổ sung tính năng "Vì sao con số này?" giải trình công thức chi tiết từng khoản lương, bảo hiểm, thuế và công đoàn.
- **Dashboard 6 KPI theo vai trò**: Thay thế widget tĩnh bằng số liệu thật phản ánh tỷ lệ đi làm, đi trễ, đơn chờ duyệt, quỹ lương, hợp đồng sắp hết hạn và phép sắp hết.

### ⚖️ BƯỚC 3: Tính đúng và Tuân thủ Luật Việt Nam
- Không hardcode tham số luật. Xây dựng bảng cấu hình tham số có hiệu lực theo thời gian `legal_rule_versions` và `docs/LEGAL_PARAMS.md` với đầy đủ căn cứ pháp lý:
  - Mức tham chiếu BHXH: 2.530.000 ₫ (Nghị định 161/2026/NĐ-CP). Trần đóng BHXH/BHYT: 50.600.000 ₫.
  - Lương tối thiểu vùng III Tây Ninh: 4.140.000 ₫ (Nghị định 293/2025/NĐ-CP). Trần đóng BHTN: 82.800.000 ₫.
  - Giảm trừ bản thân: 15.500.000 ₫; Giảm trừ người phụ thuộc: 6.200.000 ₫/người (Nghị quyết 110/2025/UBTVQH15).
  - Biểu thuế TNCN lũy tiến 5 bậc (Luật 109/2025/QH15) và khấu trừ 10% cho thử việc.
  - Phụ cấp ăn trưa miễn thuế tối đa 1.200.000 ₫ (Nghị định 253/2026/NĐ-CP).
  - Hệ số tăng ca OT chuẩn luật: 150% (ngày thường), 200% (nghỉ hàng tuần), 300% (lễ/tết).
- Toàn bộ tính toán tiền tệ chuyển sang số nguyên VND và thư viện `decimal.js` với chế độ làm tròn `ROUND_HALF_UP`, tuyệt đối không dùng float.
- Viết bộ 15 ca kiểm thử tuân thủ pháp luật chuyên sâu (`legal-compliance.test.ts`), đạt kết quả PASS 100%.

### 🎨 BƯỚC 4: Nâng tầm Trải nghiệm & Độ tin cậy
- Thay thế toàn bộ chữ "Đang tải..." bằng bộ thành phần chuẩn `SkeletonBlock`, `EmptyState` (có nút hành động nhanh) và `ErrorRetry` (có nút thử lại).
- Tối ưu hóa chuẩn hóa định dạng tiếng Việt toàn diện: Ngày tháng `dd/MM/yyyy`, tiền tệ `1.234.567 ₫`.
- Tối ưu giao diện mobile: Bố cục không tràn ngang (chiều rộng chuẩn 390px), kích thước nút bấm và vùng chạm đạt chuẩn tối thiểu 44×44px.
- Chuyển toàn bộ footer kỹ thuật (RLS, AES, Supabase) sang trang Quản trị, giữ giao diện làm việc sạch sẽ, chuyên nghiệp.

### 🔒 BƯỚC 5: Bảo mật & Bảo vệ Dữ liệu Cá nhân (PDPL)
- Triệt để phân quyền máy chủ: Lọc dữ liệu theo vai trò tại tầng API (`resolveAuthContext` + `assertAuthorized`) kết hợp PostgreSQL RLS.
- Loại bỏ hoàn toàn các trường mã hóa PII (`national_id_enc`, `national_id_hash`, `phone_enc`) khỏi danh sách trả về của API cho nhân viên thông thường.
- Ngăn chặn hoàn toàn nhân viên đọc trộm dữ liệu lương, hợp đồng hoặc số liệu dashboard của người khác qua API trực tiếp.
- Chống chấm công hộ: Ghi nhận địa chỉ IP, User-Agent và kiểm tra vị trí GPS Geofence nghiêm ngặt.
- Bổ sung cơ chế Rate-limiting chống tấn công dò mật khẩu (brute-force) tại trang Đăng nhập.

### 🧪 BƯỚC 6: Kiểm chứng Toàn diện & Nạp dữ liệu Mô phỏng
- Viết script `scripts/seed-enterprise-50.mjs` nạp bộ dữ liệu 50 nhân viên đầy đủ mọi phòng ban (BOD, Kế toán, Nhân sự, Kinh doanh, Kho vận, Cửa hàng bán lẻ) kèm 3 tháng công thực tế (9, 10, 11/2026).
- Tích hợp các trường hợp biên thực tế:
  - Nhân sự lương cao trên trần BHXH 50.600.000 ₫ (Giám đốc lương 65tr).
  - Nhân sự thử việc khấu trừ thuế TNCN 10% toàn phần, không đóng BHXH.
  - Nhân sự có nhiều người phụ thuộc (1, 2, 3 NPT).
  - Nhân sự nghỉ không lương trên 14 ngày (không đóng BHXH tháng đó).
  - Tăng ca ngày nghỉ cuối tuần (200%) và ngày thường (150%).
  - Nhân sự vào làm giữa tháng (tính công prorated).
- Kết chuyển thành công kỳ lương Tháng 10/2026 cho 50 nhân sự với tổng quỹ lương 980.432.387 ₫ và chuyển trạng thái `PAID`.
- Viết bộ kiểm thử tích hợp đầu cuối `e2e-workflow.test.ts` kiểm chứng toàn bộ chu trình nghiệp vụ qua 4 vai trò.
- Xuất bản tài liệu `docs/USER_GUIDE.md` ngắn gọn cho 4 vai trò và hoàn tất kiểm tra chất lượng.

### 🌟 BỔ SUNG & NÂNG CẤP TRẢI NGHIỆM ĐỒNG BỘ:
1. **Sơ đồ tổ chức (`/org`) chuẩn thiết kế trực quan:**
   - Vẽ lại sơ đồ tổ chức giống hệt hình ảnh mẫu: Thanh điều khiển đơn vị, ngày tính đến, 5 thẻ thống kê KPI (Số bộ phận, Người đang làm/đi làm, Định biên, Vị trí trống, Bộ phận thiếu người phụ trách).
   - Thẻ Ban Giám đốc và các phòng ban con liên kết nhánh ngang dọc, hiển thị người phụ trách, tỷ lệ lấp đầy định biên, danh sách nhân sự kèm nhãn trạng thái (Mới, Thử việc, Thai sản).
   - Thao tác thêm, sửa, chuyển phòng ban trực tiếp trên sơ đồ và dạng bảng.
2. **Danh sách & Hồ sơ nhân sự (`/employees`):**
   - Lọc nhanh có số đếm tức thời (Đang làm, Thử việc, Thai sản, Mới vào 30 ngày, Thiếu hồ sơ).
   - Tự chọn cột hiển thị và xuất Excel đúng theo chế độ đang xem (WYSIWYG).
   - Kiểm tra trùng CCCD (12 số), trùng SĐT (10 số), trùng mã nhân viên.
   - Checklist nhắc việc 4 bước khi cho một người nghỉ việc (`TERMINATED`).
   - Bảng kiểm soát giấy tờ hồ sơ và Kho lưu trữ bản scan/ảnh phóng to (Lightbox).
   - Xem nhanh dòng thời gian (mốc hợp đồng, quyết định lương, phiếu lương) mở popup xem ngay không cần tìm kiếm.
3. **Quản trị Hợp đồng Lao động (`/contracts`):**
   - Lọc danh sách người cần ký trong 30, 60, 90 ngày tới và quá hạn.
   - Gợi ý loại hợp đồng ký tiếp thông minh theo Bộ luật Lao động 2019.
   - Kiểm tra tự động trần thời gian thử việc (tối đa 60 ngày), lương thử việc (tối thiểu 85%), chặn ký quá 2 lần HĐ xác định thời hạn.
   - Soạn thảo mẫu hợp đồng với biến merge tags và xuất file Word (.doc) điền sẵn thông tin.
4. **Việc cần xử lý gọn hơn (`/approvals`):**
   - Lọc theo thời hạn (Trong 7 ngày tới mặc định, 14 ngày, 30 ngày, Quá hạn).
   - Việc gấp và quá hạn luôn hiển thị ghim trên đầu không bị lọc mất.
   - Gộp việc thiếu hồ sơ thành một nhiệm vụ tổng hợp mở Drawer danh sách chi tiết.


