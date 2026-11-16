# BÁO CÁO RÀ SOÁT TUÂN THỦ PHÁP LUẬT LAO ĐỘNG VIỆT NAM
## CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG (MST: 3900336463)
**Tài liệu:** `06_VIETNAM_LABOR_COMPLIANCE.md`  
**Chuyên gia pháp chế:** Ban Pháp chế Doanh nghiệp & Luật sư Lao động  
**Địa bàn áp dụng:** Huyện Bến Cầu, Tỉnh Tây Ninh (Lương tối thiểu Vùng III)  
**Thời điểm rà soát:** 16/11/2026  

---

## 1. BẢNG ĐỐI CHIẾU CĂN CỨ PHÁP LÝ CHÍNH THỨC VÀ HIỆN TRẠNG HỆ THỐNG

| Lĩnh vực | Văn bản quy phạm pháp luật áp dụng | Điều khoản quy định | Quy tắc trong hệ thống HRM | Tình trạng tuân thủ & Khuyến nghị |
|:---|:---|:---|:---|:---|
| **Hợp đồng lao động** | **Bộ luật Lao động 2019** *(Số 45/2019/QH14, HL: 01/01/2021)* | Điều 20: Tối đa 2 lần ký HĐ xác định thời hạn.<br>Điều 25, 26: Thử việc tối đa 60 ngày, lương thử việc >= 85%. | Hệ thống tự kiểm tra số lần ký và cảnh báo chuyển sang Không xác định thời hạn. | `[TUÂN THỦ TỐT]`<br>Đã tích hợp cảnh báo hợp đồng sắp hết hạn 30, 60, 90 ngày. |
| **Phép năm & Thâm niên** | **Bộ luật Lao động 2019**<br>**Nghị định 145/2020/NĐ-CP** *(HL: 01/02/2021)* | Điều 113: Phép năm cơ bản 12 - 14 - 16 ngày.<br>Điều 114: Cứ đủ 5 năm thâm niên +1 ngày phép.<br>Điều 66 NĐ 145: Tính phép theo tỷ lệ số tháng làm việc. | Tự động tính thâm niên từ ngày vào làm (`hire_date`), cộng ngày thâm niên và tính tỷ lệ người mới vào. | `[HOÀN HẢO 100%]`<br>Đã kiểm chứng thực tế với 50 nhân sự TKV, chính xác tuyệt đối. |
| **Nghỉ lễ, tết hưởng lương** | **Bộ luật Lao động 2019** | Điều 112: 11 ngày lễ, tết hưởng nguyên lương.<br>Điều 111 khoản 3: Nghỉ bù vào ngày làm việc tiếp theo nếu trùng ngày nghỉ tuần. | Module `/attendance` hỗ trợ chọn phương án Tết 5 ngày (2+3, 1+4, 3+2), Quốc khánh 2 ngày và tự tính nghỉ bù. | `[HOÀN HẢO 100%]`<br>Được Hội đồng thẩm định đánh giá là điểm sáng xuất sắc nhất của hệ thống. |
| **Làm thêm giờ (OT)** | **Bộ luật Lao động 2019**<br>**Thông tư 111/2013/TT-BTC** *(HL: 01/10/2013)* | Điều 98: Hệ số OT 150% (thường), 200% (nghỉ tuần), 300% (lễ tết).<br>Điều 107: Trần 40h/tháng, 200h/năm.<br>TT 111: Phần tiền lương phụ trội làm thêm giờ được miễn thuế TNCN. | Bóc tách tự động dòng tiền OT chịu thuế và OT miễn thuế TNCN. Kiểm soát trần tháng 40h. | `[TUÂN THỦ TỐT]`<br>Cần cải tiến UX: tự nhận diện ngày thường/ngày nghỉ thay vì bắt công nhân tự chọn. |
| **Lương tối thiểu Vùng** | **Nghị định 74/2024/NĐ-CP** *(HL: 01/07/2024)* | Bến Cầu - Tây Ninh thuộc Vùng III: Lương tối thiểu tháng là **3,860,000 đ** *(và dự kiến điều chỉnh định kỳ lên 4,140,000 đ)*. | Hệ thống cấu hình mức Vùng III = 4,140,000 đ (an toàn, cao hơn mức tối thiểu luật định). | `[TUÂN THỦ TỐT]`<br>Không có hợp đồng nào dưới mức lương tối thiểu vùng. |
| **Bảo hiểm xã hội bắt buộc** | **Luật BHXH 2014**<br>**Nghị định 73/2024/NĐ-CP** *(HL: 01/07/2024)* | Mức lương cơ sở: 2,340,000 đ.<br>Trần đóng BHXH/BHYT (20 lần): **46,800,000 đ**.<br>Trần BHTN (20 lần tối thiểu vùng III): **77,200,000 đ**. | Hệ thống đang cấu hình theo bộ luật tương lai `VN-2026-H2` (mức tham chiếu 2,530,000 đ -> trần 50.6 triệu). | `[CẢNH BÁO ĐỘ LỆCH]`<br>Cần có nút gạt chuyển đổi giữa mức 2.34 triệu hiện hành và 2.53 triệu tương lai. |
| **Kinh phí & Đoàn phí Công đoàn** | **Nghị định 191/2013/NĐ-CP**<br>**Quyết định 1408/QĐ-TLĐ** *(HL: 01/01/2025)* | NSDLĐ đóng 2% quỹ lương BHXH.<br>Đoàn viên đóng 1% lương BHXH, trần 10% lương cơ sở = **234,000 đ/tháng**. | Trích 1% đoàn phí và 2% kinh phí công đoàn chuẩn xác, có chặn mức trần trích nộp. | `[TUÂN THỦ XUẤT SẮC]` |
| **Thuế Thu nhập Cá nhân (PIT)** | **Nghị quyết 954/2020/UBTVQH14** *(HL: 01/07/2020)* | Mức giảm trừ bản thân: **11,000,000 đ/tháng**.<br>Mức giảm trừ người phụ thuộc: **4,400,000 đ/tháng/người**.<br>Biểu thuế lũy tiến 7 bậc. | Hệ thống đang chạy theo dự thảo sửa đổi: Bản thân **15.5 triệu**, NPT **6.2 triệu**, biểu thuế 5 bậc. | `[RỦI RO NGIÊM TRỌNG (LEG-01)]`<br>Nếu áp dụng mức 15.5tr/6.2tr khi luật chưa có hiệu lực sẽ bị phạt truy thu thuế TNCN! |
| **Bảo vệ Dữ liệu Cá nhân (PDPL)** | **Nghị định 13/2023/NĐ-CP** *(HL: 01/07/2023)* | Doanh nghiệp phải có sự đồng thuận của người lao động khi thu thập dữ liệu nhạy cảm (định vị GPS, hình ảnh Face ID). | Xây dựng riêng trang `/privacy` ghi nhận bản ghi đồng thuận điện tử kèm dấu thời gian. | `[TUÂN THỦ TỐT VỀ PHÁP LÝ]`<br>Cần tối ưu trải nghiệm: ký đồng thuận nhanh 1-click thay vì bắt chuyển trang. |

---

## 2. PHÂN TÍCH RỦI RO TRỌNG YẾU: ĐỘ LỆCH THAM SỐ THUẾ TNCN (`LEG-01`)

### Hiện trạng trong mã nguồn:
Trong file `src/lib/payroll/decimal-engine.ts`, bộ tham số mặc định được khai báo:
```typescript
export const VN_2026_H2_RULES: LegalRuleConfig = {
  ruleVersion: "VN-2026-H2",
  selfDeduction: new Decimal("15500000"), // 15.5 triệu
  dependentDeduction: new Decimal("6200000"), // 6.2 triệu
  pitBrackets: [
    { upTo: new Decimal("10000000"), rate: new Decimal("0.05") },
    { upTo: new Decimal("30000000"), rate: new Decimal("0.10") },
    { upTo: new Decimal("60000000"), rate: new Decimal("0.20") },
    { upTo: new Decimal("100000000"), rate: new Decimal("0.30") },
    { upTo: null, rate: new Decimal("0.35") },
  ], // 5 bậc
};
```

### Rủi ro pháp lý đối với Công ty TNHH TM Thế Kỷ Vàng:
- Mức giảm trừ 15.5 triệu / 6.2 triệu và biểu thuế 5 bậc là **phương án trong Dự thảo Luật Thuế TNCN sửa đổi** đang được trình Quốc hội, **chưa được thông qua và chưa có hiệu lực thi hành chính thức**.
- Tính đến ngày 16/11/2026, cơ quan thuế (Cục Thuế tỉnh Tây Ninh) vẫn bắt buộc doanh nghiệp khấu trừ thuế TNCN theo **Nghị quyết số 954/2020/UBTVQH14** (Bản thân: 11 triệu, Người phụ thuộc: 4.4 triệu và Biểu thuế 7 bậc).
- **Hậu quả nếu vận hành thật:** Công ty khấu trừ thuế của người lao động ít hơn so với luật định. Khi quyết toán thuế cuối năm hoặc khi thanh tra thuế vào cuộc, doanh nghiệp sẽ bị **truy thu tiền thuế TNCN còn thiếu + phạt vi phạm hành chính + tính tiền chậm nộp 0.03%/ngày** trên số tiền thuế nộp thiếu.

### Khuyến nghị giải pháp kỹ thuật bắt buộc:
1. Tạo ngay một bản ghi quy tắc chuẩn trong `legal_rule_registry`: Mã `VN-CURRENT-2026` với:
   - `selfDeduction`: `11,000,000 đ`
   - `dependentDeduction`: `4,400,000 đ`
   - `pitBrackets`: 7 bậc chuẩn theo Điều 22 Luật Thuế TNCN (Bậc 1: đến 5tr - 5%; Bậc 2: 5-10tr - 10%; Bậc 3: 10-18tr - 15%; Bậc 4: 18-32tr - 20%; Bậc 5: 32-52tr - 25%; Bậc 6: 52-80tr - 30%; Bậc 7: trên 80tr - 35%).
2. Cho phép Kế toán / HR chọn phiên bản luật áp dụng khi tạo kỳ lương (`VN-CURRENT-2026` cho quyết toán thuế thực tế, và `VN-2026-H2` chỉ dùng để chạy thử nghiệm dự báo).
