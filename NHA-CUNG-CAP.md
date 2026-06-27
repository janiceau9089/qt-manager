# Danh bạ Nhà cung cấp — quản lý trên Google Sheet

Theo lựa chọn: dữ liệu supplier (makeup, photo, social, band, dancer, tài xế…) nhập trên **Google Sheet**, app tự đọc xuống (qua Firestore, collection `vendors`).

## Tạo tab "Nhà cung cấp" trong Sheet với các cột (đúng thứ tự):

| Cột | Tên cột | Ghi chú |
|----|---------|---------|
| A | id | mã duy nhất (vd v1, v2… — để trống thì sync tự cấp) |
| B | name | Tên (người / band / group / hãng xe) |
| C | role | 1 trong: `makeup`, `photo`, `social`, `band`, `dancer`, `driver` |
| D | phone | SĐT (dùng cho tap-to-call) |
| E | fb | Link Facebook (tap-to-open) |
| F | cccd | Số CCCD |
| G | bankNo | Số tài khoản |
| H | bankName | Ngân hàng |
| I | branch | Chi nhánh |
| J | payCompany | Công ty nhận thanh toán (nếu có) |

> App dùng `role` để lọc đúng dropdown cho từng mục. Thiếu `bankNo` → app hiện cảnh báo 🔴 "Thiếu STK thanh toán"; thiếu CCCD/FB → cảnh báo 🟠.

## Bước tiếp theo (đợt plumbing, mình làm sau)
- Thêm hàm `syncVendorsFromSheet()` vào Apps Script: đọc tab "Nhà cung cấp" → đẩy vào Firestore `vendors`. Chạy chung menu "② Đẩy lên app".
- Hiện tại app đã có **danh bạ mẫu** (12 supplier) để Thi thử dropdown ngay. Khi tab Sheet sẵn sàng + wire sync, danh bạ Sheet sẽ thay seed mẫu.

## Khi chọn "Khác" trong app
Nhập tay tên + SĐT, app hiện cảnh báo màu (vàng/cam/đỏ) báo thiếu thông tin thanh toán, và có nút **"Lưu vào danh bạ"** để thêm nhanh (sau đó bổ sung STK/CCCD trên Sheet).
