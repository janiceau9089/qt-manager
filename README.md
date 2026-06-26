# QT Manager — App quản lý nghệ sĩ Quốc Thiên

App 1 trang (`index.html`) đã gắn **Firebase** (đăng nhập Anonymous + dữ liệu chung trên Firestore). Mở trên điện thoại, dữ liệu lưu chung cho cả nhóm.

## Đưa lên mạng (Vercel) — không cần cài gì
1. Tạo repo mới trên GitHub, tải lên 2 file: `index.html` và `README.md` (kéo-thả trong giao diện GitHub).
2. Vào https://vercel.com → đăng nhập bằng GitHub → **Add New → Project** → chọn repo này → **Deploy**.
3. Vercel cho 1 đường link dạng `ten-app.vercel.app` — mở trên điện thoại là dùng được.

## QUAN TRỌNG sau khi có link Vercel
- Vào **Firebase Console → Authentication → Settings → Authorized domains → Add domain** → dán domain Vercel (vd `ten-app.vercel.app`). Không có bước này, đăng nhập Anonymous sẽ bị chặn và app rơi về dữ liệu cục bộ (không chung).
- Mở **Firestore → Rules**, dán nội dung file `firestore.rules` (trong thư mục `qt-manager`) rồi Publish, để app đọc/ghi được.

## Đang ở chế độ TESTING
- App đang dùng **Anonymous auth** (bỏ qua đăng nhập cho nhanh) — ai có link đều vào được.
- Khi xong testing: bật lại **Email/Password** trong Firebase Auth và siết lại Firestore Rules. (Đã đặt nhắc.)
