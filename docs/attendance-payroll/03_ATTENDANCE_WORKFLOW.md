# 03 — QUY TRÌNH DỮ LIỆU CHẤM CÔNG (PHASE 1)

## 1. Nguyên tắc Bất biến Dữ liệu Gốc
- Mọi lượt chấm công từ GPS, máy Face ID, vân tay, thẻ từ hoặc Import CSV đều ghi vào `attendance_raw_events`.
- Trigger PostgreSQL `trg_att_raw_events_immutable` ngăn chặn mọi thao tác `UPDATE`/`DELETE` trên bảng gốc.

## 2. Quy trình Xử lý
1. **Tiếp nhận (`Ingestion`):** Kiểm tra `idempotency_key` để chống trùng lặp.
2. **Lọc quét trùng (`OBD-01`):** Các lượt quét liên tiếp trong `5 phút` cùng chiều được bỏ qua ở tầng chuẩn hóa (`attendance_sessions`) nhưng vẫn lưu vết ở `attendance_raw_events`.
3. **Ghép cặp Ca (`session-normalizer.ts`):**
   - Ca ngày: ghép lượt vào đầu tiên và lượt ra cuối cùng trong ngày.
   - Ca qua đêm (`is_overnight = true`, VD `22:00` → `06:00`): ghép lượt vào ngày `D` với lượt ra sáng ngày `D+1` trong cửa sổ `[start - 4h, end + 4h]`.
   - Thiếu Check-in hoặc Check-out: không tự bịa giờ; đánh dấu `status = 'EXCEPTION'` và tạo bản ghi `attendance_exceptions` (`MISSING_IN` / `MISSING_OUT`).
4. **Tính giờ (`OBD-02`):** Áp dụng grace period `5 phút` cho đi trễ; tách `worked_hours`, `late_minutes`, `early_minutes`, `night_hours` (`22:00–06:00`).

