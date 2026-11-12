# DOC-09: Đặc tả Tính lương Gross/Net & Bộ Golden Payroll Test Cases

> **Trạng thái tài liệu:** `POLICY_LOCKED_FROM_OD` (Đã chốt các nguyên tắc từ `OD-01` → `OD-16`: **100% Hợp đồng Gross**, **Địa bàn Vùng III — Bến Cầu, Tây Ninh**, **Chốt công ngày `25` — Chi lương 2 đợt: ngày `15` ứng 50% lương CB chưa phụ cấp & cuối tháng trả phần còn lại + phụ cấp − bảo hiểm/PIT**, **Tiền ăn trưa chi tiền mặt miễn thuế tối đa `1.200.000 đ/tháng`**)  
> **Kỳ tham chiếu kiểm thử:** Kỳ lương **Tháng 11/2026** (áp dụng quy định hiệu lực tại `12/11/2026`)  
> **Tham chiếu gốc:** [HRM_Enterprise_Design_Baseline_v1.0.docx](../../HRM_Enterprise_Design_Baseline_v1.0.docx) — Mục 5 & Mục 6; [DOC-24_Open_Decisions_Log.md](./DOC-24_Open_Decisions_Log.md)

---

## 1. Tham số Pháp lý áp dụng cho Bộ Test (Rule Version `VN-2026-H2`)

| Tham số | Giá trị áp dụng (`11/2026`) | Căn cứ pháp lý | Ghi chú hiệu lực |
| :--- | :--- | :--- | :--- |
| **Mức tham chiếu BHXH** | `2.530.000` đ/tháng | Luật BHXH `41/2024/QH15`; NĐ `161/2026/NĐ-CP` | Giai đoạn `01/01–30/06/2026` là `2.340.000` đ; từ `01/07/2026` là `2.530.000` đ |
| **Trần đóng BHXH / BHYT** | `50.600.000` đ/tháng (`20 × 2.530.000`) | Luật BHXH `41/2024/QH15` | Chặn tối đa căn cứ đóng BHXH & BHYT |
| **Lương tối thiểu Vùng (Mặc định Thế Kỷ Vàng: Vùng III)** | **Vùng III (Xã Bến Cầu, Tây Ninh):** `4.140.000` đ/tháng (`20.000` đ/giờ)<br>*(Tham chiếu Vùng I: `5.310.000` đ/tháng)* | NĐ `293/2025/NĐ-CP` (hiệu lực `01/01/2026`) | Từ `01/01/2027` áp dụng NĐ `399/2026/NĐ-CP` (Vùng III: `4.450.000` đ/tháng; Vùng I: `5.700.000` đ/tháng) |
| **Trần đóng BHTN (Vùng III / Vùng I)** | **Vùng III:** `82.800.000` đ/tháng (`20 × 4.140.000`)<br>*(Vùng I: `106.200.000` đ/tháng)* | Luật Việc làm & NĐ `293/2025/NĐ-CP` | Tách độc lập với trần BHXH/BHYT (`50.600.000` đ); từ `01/01/2027` trần BHTN Vùng III là `89.000.000` đ |
| **Tỷ lệ BH bắt buộc (LĐ VN)** | NLĐ: `10,5%` (`8% BHXH + 1,5% BHYT + 1% BHTN`)<br>NSDLĐ: `21,5%` (`17,5% BHXH + 3% BHYT + 1% BHTN`) | Luật BHXH `41/2024/QH15` & Luật BHYT, BHTN | NSDLĐ `17,5% BHXH` = `14%` hưu trí/tử tuất + `3%` ốm đau/thai sản + `0,5%` TNLĐ-BNN |
| **Tỷ lệ BH bắt buộc (LĐ Nước ngoài)** | NLĐ: `9,5%` (`8% BHXH + 1,5% BHYT`)<br>NSDLĐ: `20,5%` (`17,5% BHXH + 3% BHYT`) | Không tham gia BHTN | Tổng `30%` |
| **Giảm trừ gia cảnh (PIT)** | Bản thân: `15.500.000` đ/tháng<br>Người phụ thuộc: `6.200.000` đ/người/tháng | NQ `110/2025/UBTVQH15` & NĐ `253/2026/NĐ-CP` | Áp dụng cho kỳ tính thuế 2026 |
| **Biểu thuế TNCN lũy tiến 5 bậc** | Bậc 1 (`≤10tr`): `5%`<br>Bậc 2 (`>10–30tr`): `10%`<br>Bậc 3 (`>30–60tr`): `20%`<br>Bậc 4 (`>60–100tr`): `30%`<br>Bậc 5 (`>100tr`): `35%` | Luật Thuế TNCN `109/2025/QH15` | Áp dụng cho cá nhân cư trú có thu nhập từ tiền lương, tiền công kỳ 2026 |
| **Tiền ăn trưa chi tiền mặt** | Miễn thuế tối đa `1.200.000` đ/người/tháng | NĐ `253/2026/NĐ-CP` (hiệu lực `01/07/2026`) | Bỏ mức trần cũ `730.000` đ; phần vượt `1.200.000` đ tính vào thu nhập chịu thuế |
| **Quy tắc làm tròn (Đề xuất)** | `ROUND_HALF_UP` về `0` chữ số thập phân (đơn vị VND) ở kết quả từng khoản | Cần xác nhận tại `OD-09` | Dùng `DECIMAL/NUMERIC` suốt quá trình tính |

---

## 2. Luồng thuật toán chuẩn (Gross-to-Net & Net-to-Gross)

### 2.1. Luồng Gross-to-Net
1. **Tính thu nhập theo công thực tế & phụ cấp/OT:** Xác định tổng thu nhập (`Gross Total`) và phần thu nhập được **miễn thuế TNCN** (`Tax-Exempt Income`: phần chênh lệch OT vượt 100% đơn giá ngày thường, tiền ăn ca trong hạn mức miễn thuế...).
2. **Xác định căn cứ đóng bảo hiểm (`SI Base`):**
   * `BHXH_BHYT_Base = min(Contract_SI_Base, Cap_BHXH_BHYT)` (nếu đủ ngày công đóng BHXH trong tháng).
   * `BHTN_Base = 0` (nếu LĐ nước ngoài) hoặc `min(Contract_SI_Base, Cap_BHTN_Region)`.
3. **Tính Bảo hiểm phía NLĐ (`EE_Ins`) & phía NSDLĐ (`ER_Ins`):** làm tròn từng quỹ (`BHXH`, `BHYT`, `BHTN`).
4. **Tính Thu nhập chịu thuế (`Assessable Income`):** `Gross Total - Tax-Exempt Income`.
5. **Tính Thu nhập tính thuế (`Taxable Income`):** `max(0, Assessable Income - Self_Deduction - Dependent_Deduction - EE_Ins)`.
6. **Tính Thuế TNCN (`PIT`)** theo biểu 5 bậc lũy tiến (hoặc 10% nếu hợp đồng thử việc/ngắn hạn thuộc diện khấu trừ tại nguồn).
7. **Tính Thực lĩnh (`Net Payable`):** `Gross Total - EE_Ins - PIT - Other_Deductions`.

### 2.2. Thuật toán Net-to-Gross (Piecewise Bracketing + Reverse Check)
* Vì hàm `Net(Gross)` là hàm đơn điệu tăng từng khúc (có các điểm gãy tại trần BHXH/BHYT `50,6tr`, trần BHTN `106,2tr` và 5 ngưỡng thu nhập tính thuế), thuật toán thực hiện:
  1. Tìm kiếm nhị phân (Binary Search) trên miền số nguyên `[Target_Net, Target_Net × 2.5]` để tìm `Gross*` sao cho `G2N(Gross*).Net == Target_Net`.
  2. Do làm tròn từng bước VND, có thể xuất hiện bước nhảy `±1đ` tại điểm biên; solver kiểm tra lân cận `±5đ` quanh nghiệm để chọn nghiệm khớp `0đ` (hoặc nhỏ nhất có `Net >= Target_Net` và ghi nhận dòng chênh lệch làm tròn nếu `OD-09` cho phép).
  3. **Bắt buộc chạy ngược** `Gross-to-Net` trên nghiệm `Gross*` để xuất bảng giải thích chi tiết từng thành phần trên payslip.

### 2.3. Quy trình Tính & Chi trả Lương 2 Đợt (Chốt công ngày 25 — Ngày 15 & Cuối tháng)
1. **Đợt 1 — Ngày `15` hàng tháng (`MID_MONTH_ADVANCE`):**
   * Chi trả trước **`50%` lương cơ bản** (`Advance_15 = round(Base_Salary × 0.5)`) cho các nhân viên đang `ACTIVE`/`PROBATION` đủ điều kiện trong kỳ.
   * **Không cộng các khoản phụ cấp, thưởng, OT** và **chưa khấu trừ BHXH/BHYT/BHTN/Thuế TNCN** ở đợt này.
2. **Đợt 2 — Ngày `cuối tháng` (`END_MONTH_SETTLEMENT`, sau khi chốt công ngày `25`):**
   * Tính **Toàn bộ Bảng lương Tháng chuẩn (`Full_Month_Net`)** theo công chốt ngày `25` + Phụ cấp (3 tầng) + OT + Thưởng − Bảo hiểm bắt buộc (BHXH/BHYT/BHTN) − Thuế TNCN 5 bậc (hoặc 10%).
   * Số tiền thực chi đợt cuối tháng: **`Net_Payable_End_Month = Full_Month_Net - Advance_15`**.
   * **Cơ chế bảo vệ âm lương:** Nếu nhân viên nghỉ không lương nhiều ngày hoặc thôi việc sau ngày `15` làm cho `Full_Month_Net < Advance_15`, hệ thống gán `Net_Payable_End_Month = 0`, cảnh báo đỏ `NEGATIVE_NET_BALANCE`, chặn chuyển khoản đợt 2 cho nhân viên đó và ghi nhận `negative_balance_carryover` để quyết toán/thu hồi.

---

## 3. Bộ Golden Payroll Test Cases (`GTC-01` → `GTC-11`)

*(Toàn bộ số liệu đã được kiểm chứng bằng phép tính `Decimal` chính xác đến từng đồng Việt Nam, giả định địa bàn Vùng I, cá nhân cư trú trừ `GTC-07`, công chuẩn tháng = `22 ngày / 176 giờ`)*

| Mã TC | Kịch bản kiểm thử | Đầu vào chính | Diễn giải tính toán chi tiết (VND) | Kết quả mong đợi (Expected Output) |
| :--- | :--- | :--- | :--- | :--- |
| **GTC-01** | **NV chính thức chuẩn** (dưới trần BH, PIT bậc 1) | Gross: `25.000.000`<br>SI Base: `25.000.000`<br>Phụ thuộc: `1` | • BH NLĐ (`10,5% × 25tr`): BHXH `2.000.000` + BHYT `375.000` + BHTN `250.000` = `2.625.000`<br>• Giảm trừ: `15.500.000 + 6.200.000 + 2.625.000` = `24.325.000`<br>• TN tính thuế: `25.000.000 - 24.325.000` = `675.000`<br>• PIT (`5% × 675.000`): `33.750` | • **EE Insurance:** `2.625.000`<br>• **PIT:** `33.750`<br>• **Net:** `22.341.250`<br>• **ER Cost:** `30.375.000` (`ER Ins: 5.375.000`) |
| **GTC-02** | **Lương cao tách 2 trần** (vượt trần BHXH/BHYT `50,6tr`, dưới trần BHTN `106,2tr`) | Gross: `70.000.000`<br>SI Base: `70.000.000`<br>Phụ thuộc: `0` | • Căn cứ BHXH/BHYT = `50.600.000`; Căn cứ BHTN = `70.000.000`<br>• BH NLĐ: BHXH `4.048.000` + BHYT `759.000` + BHTN `700.000` = `5.507.000`<br>• TN tính thuế: `70.000.000 - 15.500.000 - 5.507.000` = `48.993.000`<br>• PIT 5 bậc: `10tr×5% + 20tr×10% + 18.993.000×20%` = `500.000 + 2.000.000 + 3.798.600` = `6.298.600` | • **EE Insurance:** `5.507.000`<br>• **PIT:** `6.298.600`<br>• **Net:** `58.194.400`<br>• **ER Cost:** `81.073.000` (`ER Ins: 11.073.000`) |
| **GTC-03** | **Lương điều hành vượt cả 2 trần** (PIT chạm bậc 5: `35%`) | Gross: `150.000.000`<br>SI Base: `150.000.000`<br>Phụ thuộc: `2` | • Căn cứ BHXH/BHYT = `50.600.000`; Căn cứ BHTN = `106.200.000`<br>• BH NLĐ: `4.048.000 + 759.000 + 1.062.000` = `5.869.000`<br>• Giảm trừ: `15.500.000 + 12.400.000 + 5.869.000` = `33.769.000`<br>• TN tính thuế: `150.000.000 - 33.769.000` = `116.231.000`<br>• PIT: `10tr×5% + 20tr×10% + 30tr×20% + 40tr×30% + 16.231.000×35%` = `20.500.000 + 5.680.850` = `26.180.850` | • **EE Insurance:** `5.869.000`<br>• **PIT:** `26.180.850`<br>• **Net:** `117.950.150`<br>• **ER Cost:** `161.435.000` (`ER Ins: 11.435.000`) |
| **GTC-04** | **OT ngày thường + OT đêm ngày nghỉ** (miễn thuế phần vượt `100%`) | Lương HĐ: `22.000.000` (`125.000đ/h`)<br>OT thường ngày: `10h` (`150%`)<br>OT đêm ngày nghỉ: `4h` (`270%`)<br>Phụ thuộc: `0` | • OT thường: `10 × 125.000 × 1,5` = `1.875.000` (miễn thuế `625.000`)<br>• OT đêm ngày nghỉ*: `4 × 125.000 × 2,7` = `1.350.000` (miễn thuế `850.000`)<br>• Tổng Gross: `22.000.000 + 3.225.000` = `25.225.000`; Miễn thuế OT: `1.475.000`<br>• BH NLĐ (`10,5% × 22tr`): `2.310.000`<br>• TN tính thuế: `(25.225.000 - 1.475.000) - 15.500.000 - 2.310.000` = `5.940.000`<br>• PIT (`5% × 5.940.000`): `297.000` | • **Gross Total:** `25.225.000`<br>• **Tax-Exempt:** `1.475.000`<br>• **EE Insurance:** `2.310.000`<br>• **PIT:** `297.000`<br>• **Net:** `22.618.000` |
| **GTC-05** | **Prorate nghỉ không lương + Phụ cấp ăn trưa vượt trần NĐ `253/2026` + Xăng xe** | Lương HĐ: `20.000.000`<br>Công: `18/22` (nghỉ KL 4 ngày `< 14` ngày → vẫn đóng BH trên `20tr`)<br>Ăn trưa tiền mặt: `1.500.000`<br>Xăng xe: `1.000.000`<br>Phụ thuộc: `0` | • Lương theo công: `round(20.000.000 × 18 / 22)` = `16.363.636`<br>• Tổng Gross: `16.363.636 + 1.500.000 + 1.000.000` = `18.863.636`<br>• Miễn thuế ăn trưa (NĐ `253/2026`): `1.200.000` (`300.000` vượt mức chịu thuế)<br>• BH NLĐ (`10,5% × 20tr`): `2.100.000`<br>• TN tính thuế: `(18.863.636 - 1.200.000) - 15.500.000 - 2.100.000` = `63.636`<br>• PIT (`5% × 63.636`): `3.182` | • **Gross Total:** `18.863.636`<br>• **EE Insurance:** `2.100.000`<br>• **PIT:** `3.182`<br>• **Net:** `16.760.454`<br>• **ER Cost:** `23.163.636` |
| **GTC-06** | **Net-to-Gross chính xác** | Target Net: `30.000.000`<br>Phụ thuộc: `1`<br>Vùng I, toàn bộ đóng BH | • Solver tìm được `Gross = 34.007.645`<br>• Kiểm chứng ngược:<br>  - BHXH `2.720.612` + BHYT `510.115` + BHTN `340.076` = `3.570.803`<br>  - TN tính thuế: `34.007.645 - 15.500.000 - 6.200.000 - 3.570.803` = `8.736.842`<br>  - PIT (`5% × 8.736.842`): `436.842`<br>  - Net = `34.007.645 - 3.570.803 - 436.842` = `30.000.000` | • **Gross Solved:** `34.007.645`<br>• **EE Insurance:** `3.570.803`<br>• **PIT:** `436.842`<br>• **Net Verified:** `30.000.000` (`Sai số = 0đ`) |
| **GTC-07** | **Thử việc (HĐ thử việc `< 3` tháng, chưa đóng BH, khấu trừ 10%)** | Lương thử việc: `17.000.000` (`85%` của `20tr`)<br>Chưa có cam kết `08/CK-TNCN` | • Không thuộc đối tượng đóng BHXH bắt buộc (trong giai đoạn thử việc tách riêng)<br>• Khấu trừ thuế tại nguồn `10%`: `17.000.000 × 10%` = `1.700.000` | • **EE Insurance:** `0`<br>• **PIT (10%):** `1.700.000`<br>• **Net:** `15.300.000` |
| **GTC-08** | **Lao động nước ngoài** (không đóng BHTN, cư trú, vượt trần BHXH/BHYT) | Gross: `80.000.000`<br>Phụ thuộc: `0`<br>Cư trú tại VN | • Căn cứ BHXH/BHYT = `50.600.000`; `BHTN_Base = 0`<br>• BH NLĐ (`9,5%`): BHXH `4.048.000` + BHYT `759.000` = `4.807.000`<br>• TN tính thuế: `80.000.000 - 15.500.000 - 4.807.000` = `59.693.000`<br>• PIT: `10tr×5% + 20tr×10% + 29.693.000×20%` = `500.000 + 2.000.000 + 5.938.600` = `8.438.600` | • **EE Insurance:** `4.807.000`<br>• **PIT:** `8.438.600`<br>• **Net:** `66.754.400`<br>• **ER Cost:** `90.373.000` (`ER Ins: 10.373.000`) |
| **GTC-09** | **Quản lý cấp cao tại Thế Kỷ Vàng — Vùng III (Bến Cầu, Tây Ninh)** vượt cả trần BHXH `50,6tr` và trần BHTN Vùng III `82,8tr` | Gross: `100.000.000`<br>SI Base: `100.000.000`<br>Phụ thuộc: `1`<br>Địa bàn: **Vùng III** | • Căn cứ BHXH/BHYT = `50.600.000`; Căn cứ BHTN (Vùng III) = `82.800.000`<br>• BH NLĐ: BHXH `4.048.000` + BHYT `759.000` + BHTN `828.000` = `5.635.000`<br>• Giảm trừ: `15.500.000 + 6.200.000 + 5.635.000` = `27.335.000`<br>• TN tính thuế: `100.000.000 - 27.335.000` = `72.665.000`<br>• PIT 5 bậc: `10tr×5% + 20tr×10% + 30tr×20% + 12.665.000×30%` = `8.500.000 + 3.799.500` = `12.299.500` | • **EE Insurance:** `5.635.000`<br>• **PIT:** `12.299.500`<br>• **Net:** `82.065.500`<br>• **ER Cost:** `111.201.000` (`ER Ins: 11.201.000`) |
| **GTC-10** | **Phụ cấp linh hoạt tùy bộ phận & tùy người** (NV Bãi xe Vùng III, ăn trưa theo ngày công thực tế + phụ cấp trách nhiệm bộ phận + xăng xe cá nhân) | Lương CB (SI Base): `8.000.000`<br>PC trách nhiệm Bãi xe: `1.200.000`<br>Ăn trưa (`40k × 24 công`): `960.000`<br>Xăng xe cá nhân: `600.000`<br>Phụ thuộc: `0` | • Tổng Gross: `8.000.000 + 1.200.000 + 960.000 + 600.000` = `10.760.000`<br>• Miễn thuế ăn trưa (NĐ `253/2026`, `960.000 ≤ 1.200.000`): `960.000`<br>• BH NLĐ (`10,5% × 8.000.000`): BHXH `640.000` + BHYT `120.000` + BHTN `80.000` = `840.000`<br>• TN chịu thuế: `9.800.000`; TN tính thuế: `max(0, 9.800.000 - 15.500.000 - 840.000)` = `0` → PIT = `0` | • **Gross Total:** `10.760.000`<br>• **Tax-Exempt:** `960.000`<br>• **EE Insurance:** `840.000`<br>• **PIT:** `0`<br>• **Net:** `9.920.000`<br>• **ER Cost:** `12.480.000` (`ER Ins: 1.720.000`) |
| **GTC-11** | **Trả lương 2 đợt chuẩn Thế Kỷ Vàng** (Chốt công ngày `25`: Đợt 1 ngày `15` ứng 50% LCB chưa phụ cấp; Đợt 2 cuối tháng trả 50% còn lại + phụ cấp + OT − BHXH/PIT) | Lương CB (SI Base): `12.000.000` (công `22/22`)<br>Ăn trưa tiền mặt: `1.000.000`<br>PC trách nhiệm & xăng: `2.000.000`<br>OT thường `8h` (`150%`)<br>Phụ thuộc: `0` | • **Đợt 1 (Ngày 15):** `50% × 12.000.000` = **`6.000.000`** *(chưa phụ cấp, chưa trừ BH/PIT)*<br>• **Đợt 2 (Cuối tháng — Tính toàn tháng):**<br>  - OT thường (`8 × 12tr/176 × 1,5`): `818.182` *(miễn thuế `272.727`)*<br>  - Tổng Gross tháng: `12.000.000 + 1.000.000 + 2.000.000 + 818.182` = `15.818.182`<br>  - Miễn thuế: `1.000.000 + 272.727` = `1.272.727` → TN chịu thuế: `14.545.455`<br>  - BH NLĐ (`10,5% × 12tr`): `1.260.000` (`960k + 180k + 120k`)<br>  - TN tính thuế: `max(0, 14.545.455 - 15.500.000 - 1.260.000)` = `0` → PIT = `0`<br>  - `Full_Month_Net` = `15.818.182 - 1.260.000` = `14.558.182`<br>  - **Thực chi Đợt 2 (Cuối tháng):** `14.558.182 - 6.000.000` = **`8.558.182`** | • **Chi Đợt 1 (15):** `6.000.000`<br>• **Chi Đợt 2 (Cuối tháng):** `8.558.182`<br>• **Tổng Net cả tháng:** `14.558.182` (`6tr + 8.558.182`)<br>• **EE Insurance:** `1.260.000`<br>• **PIT:** `0` |

*\*Ghi chú GTC-04:* Hệ số `270%` cho OT đêm ngày nghỉ hằng tuần được tính theo Điều 98 BLLĐ (`200%` làm thêm ngày nghỉ + `30%` phụ cấp làm đêm + `20% × 200%` tiền lương giờ làm việc ban ngày của ngày nghỉ = `270%`). Công thức cụ thể cho mọi loại ca đêm/OT phải được Legal & Kế toán xác nhận chính thức khi ký duyệt `DOC-09`.

---

## 4. Tiêu chí nghiệm thu Payroll Engine (Phase 3 Gate)

* **100% Golden Test Cases (`GTC-01` → `GTC-11`)** và các case bổ sung do Kế toán cung cấp phải chạy tự động trong CI và khớp `0đ`.
* **Idempotency Test:** Chạy lại cùng một `payroll_run_inputs` + `legal_rule_snapshot` 10 lần liên tiếp cho kết quả bit-for-bit giống nhau.
* **Lock & Adjustment Test:** Sau khi `Locked`, mọi API sửa trực tiếp bị chặn (`409 Conflict`); chỉnh sửa chỉ được thực hiện qua `Adjustment Run` mới liên kết `original_payroll_run_id`.

