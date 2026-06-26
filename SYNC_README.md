# Liên kết "Quoc Thien - sync" (Google Sheet) ↔ App

Mô hình giống MrK / Thảo Trang: **Sheet là nơi nhập hợp đồng/tài chính → bấm Push → dữ liệu lên app**.

## Gồm 2 file
- `Quoc-Thien-sync.csv` — dữ liệu mẫu đã điền sẵn 106 sự kiện (từ lịch), đúng schema.
- `firestore-sync.gs` — Apps Script gắn vào Sheet để đẩy lên app.

## Bước 1 — Nạp dữ liệu vào Sheet
1. Mở Google Sheet **"Quoc Thien - sync"**.
2. Đổi tên tab đầu thành **`Sync`** (cho khớp script).
3. **File → Import → Upload** `Quoc-Thien-sync.csv` → chọn **Replace current sheet** → Import.
4. (Khuyên) chọn cột `date` → Format → Plain text, để ngày không bị đổi định dạng.

## Bước 2 — Gắn Apps Script (đẩy lên app)
1. Trong Sheet: **Extensions → Apps Script**.
2. Dán toàn bộ nội dung `firestore-sync.gs` vào `Code.gs` → **Save**.
3. **Project Settings** (⚙) → tick **Show "appsscript.json"** → mở tab `appsscript.json`, thêm:
   ```json
   "oauthScopes": [
     "https://www.googleapis.com/auth/datastore",
     "https://www.googleapis.com/auth/spreadsheets"
   ]
   ```
4. Quay lại Sheet, **tải lại trang** → xuất hiện menu **Firestore Sync**.

> Quan trọng: phải đăng nhập Apps Script bằng đúng tài khoản Google sở hữu Firebase (janice.au9089) thì mới ghi được vào project `qt-manager-c55f4`.

## Bước 3 — Đẩy lên app
- Menu **Firestore Sync → Đẩy lên app (Push)**. Lần đầu Google hỏi cấp quyền → Allow.
- Xong: mỗi dòng được tạo thành 1 job + các đợt thanh toán trên app; cột `eventId` được điền, `source` chuyển `synced`. Mở app (qt-manager.vercel.app) bấm Reload là thấy.

## Lưu ý quan trọng về trùng dữ liệu
App hiện đang có sẵn 106 job **nạp từ Google Calendar** (id `g1..g106`). Nếu Push từ Sheet, sẽ tạo thêm job mới (id `qt_...`) → có thể **trùng**.

Khuyến nghị để Sheet làm nguồn chính (giống 2 project kia):
1. Chạy **Firestore Sync → ⚠ Xoá hết jobs/pays (reset)** một lần (xoá dữ liệu seed từ lịch).
2. Rồi **Push** từ Sheet.
Từ đó Sheet là nguồn duy nhất; sửa trên Sheet → Push lại là app cập nhật.

## Quy tắc tài chính (đang dùng)
- Fee = **chưa gồm VAT**: `value` = số tiền (triệu), `tax` = 8, `totalValue` = value × 1.08.
- App hiển thị `net` = value × 1.000.000đ (giá trước thuế). Đợt 1/Đợt 2 mặc định 50/50.

## Sau này: thêm hợp đồng mới
Thêm 1 dòng vào Sheet (để trống `eventId`, `source = sheet`) rồi Push. Muốn mình tự trích từ file HĐ (.docx/.pdf) thành dòng Sheet như skill của Thảo Trang thì báo — phần đó cần bật thành Skill riêng trong Settings → Capabilities.
