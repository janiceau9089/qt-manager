# Mô hình 2 tab: Sync (lịch) + Hợp đồng (tiền) — nối bằng Mã sự kiện

## Ai nhập gì
| Tab | Chủ | Nội dung |
|---|---|---|
| **Sync** | Thi / Vi | Lịch & logistics: Ngày, Giờ, Tên sự kiện, Khách, Địa điểm, Tỉnh, Loại, Trạng thái, **Link Drive / Beat / Lyrics**, Ghi chú. Mỗi dòng có **Mã sự kiện** (tự cấp). |
| **Hợp đồng** | Kế toán (Trúc) | **Nguồn tiền/giấy tờ**: chọn **Mã sự kiện** → Tên/Ngày tự hiện; rồi nhập Giá trị, VAT, Tổng, Số HĐ, Trạng thái HĐ, Số hóa đơn, Trạng thái hóa đơn, Đợt 1/2 (tiền · hạn · trạng thái), Link file HĐ. |

→ Khi **Push**, app tự **gộp**: lịch lấy từ Sync, **tiền lấy từ Hợp đồng** (theo Mã sự kiện). Sync không chứa tiền nữa nên Thi khỏi đụng vào số liệu kế toán.

## ⟳ Tự đồng bộ lịch (KHỎI tải/Import CSV cho tab Sync)
Tab **Sync** giờ lấy thẳng từ **Google Calendar** của QT — không cần tải CSV nữa:
- Menu **⟳ Đồng bộ lịch từ Google Calendar → Sync**: đọc lịch quocthienofficial, tự phân loại + làm sạch tên + cấp Mã sự kiện, đổ vào tab Sync. **Giữ nguyên** Link Drive/Beat/Lyrics & Ghi chú bạn đã nhập tay (chỉ cập nhật ngày/giờ/tên/địa điểm/loại).
- Menu **⏰ Bật tự đồng bộ lịch mỗi sáng**: tự chạy ~7h sáng hằng ngày (không cần bấm).
- Cần thêm quyền vào `appsscript.json` (chỉ thêm 1 dòng):
  ```json
  "oauthScopes": [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
  ```
- Lịch QT phải được **share** cho tài khoản chạy script (janice.au9089) — đã share rồi.

> **Tab Hợp đồng KHÔNG tự sync** (do kế toán nhập). Lần đầu import `Quoc-Thien-hopdong.csv` để có sẵn số liệu; sau đó kế toán nhập trực tiếp, tự nối Sync qua Mã sự kiện. Nếu thích, vẫn có thể tải CSV cũ để import lại bất cứ lúc nào.

## Cài đặt 1 lần
1. Dán đè `firestore-sync.gs` mới vào Apps Script (Extensions → Apps Script) → Save.
2. **Tab Sync**: Import `Quoc-Thien-sync.csv` (Replace) → menu **① Định dạng** (cấp Mã sự kiện, dropdown, tone xanh).
3. **Tab Hợp đồng**: tạo 1 sheet tên `Hợp đồng` → Import `Quoc-Thien-hopdong.csv` (Replace) → menu **③ Tạo / Cập nhật tab Hợp đồng** (đặt dropdown Mã sự kiện + công thức tự điền Tên/Ngày + định dạng).
4. Đẩy lên app: menu **② Đẩy lên app** (gộp Sync + Hợp đồng). Nếu app đang có dữ liệu seed cũ thì chạy **⚠ Reset** một lần rồi ② để Sheet làm nguồn.

## Cơ chế chống sai sót khi nhập
- **Mã sự kiện** không gõ tay — Thi để app/Sync tự cấp; kế toán **chọn từ dropdown** (cột A tab Hợp đồng) → cột "Tên sự kiện (tự)" và "Ngày (tự)" hiện ra để xác nhận đúng sự kiện.
- **Mọi trường phân loại là dropdown** (Loại, Trạng thái, Trạng thái HĐ/hóa đơn, Trạng thái từng đợt) — không gõ tự do, tránh sai chính tả.
- **Cột tiền** định dạng Việt Nam Đồng đầy đủ (`450.000.000 ₫`); chỉ nhập số.
- **Không sửa** 2 cột "Tên/Ngày (tự)" trong tab Hợp đồng — đó là công thức tự lấy từ Sync.
- 1 sự kiện = 1 dòng ở mỗi tab; muốn thêm hợp đồng mới: ở Sync tạo sự kiện trước (có Mã sự kiện), rồi sang Hợp đồng chọn Mã đó.

## Gợi ý quy trình hằng ngày
- Thi/Vi: thêm lịch mới vào **Sync** (ngày, tên, địa điểm, link beat…). Sheet tự cấp Mã sự kiện khi chạy ② hoặc ①.
- Kế toán: mở **Hợp đồng**, chọn Mã sự kiện vừa tạo → nhập tiền/đợt/giấy tờ.
- Bấm **② Đẩy lên app** để cập nhật (tiền từ Hợp đồng, lịch từ Sync).
