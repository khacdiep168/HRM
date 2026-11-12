# 10 — Đặc tả Gross & Net-to-Gross Solver

## 1. Hỗ trợ 2 Cấu trúc Hợp đồng (`pay_structure`)
- **`GROSS`:** Hệ thống lấy `proratedBase + allowances + otPay` làm tổng thu nhập Gross, sau đó khấu trừ bảo hiểm, giảm trừ gia cảnh, thuế TNCN và đoàn phí để ra `netTakeHome`.
- **`NET`:** Khi nhân viên ký hợp đồng lương Net, `POST /api/v1/payroll/runs` gọi `solveNetToGross(targetNet, options)` để quy đổi ngược về Gross tương ứng.

## 2. Thuật toán `solveNetToGross`
- Sử dụng tìm kiếm nhị phân (Binary Search) trong tối đa `60` vòng lặp trên hàm xuôi `calculateGrossPayroll` với khoảng `[low = targetNet, high = targetNet × 2.5 + 20,000,000]`.
- Điều kiện hội tụ: `|netTakeHome - targetNet| ≤ 1 VNĐ`.
- Kết quả trả về `solvedGross` cùng toàn bộ bảng phân rã bảo hiểm và thuế TNCN đồng nhất tuyệt đối với công thức xuôi.

