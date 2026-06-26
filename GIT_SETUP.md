# Đẩy lên GitHub bằng 1 cú bấm

Mỗi lần Claude cập nhật `index.html` (lưu thẳng vào thư mục này), bạn chỉ cần bấm đúp **`push.command`** là lên live. Làm 1 lần phần cài đặt bên dưới trước.

## Cài 1 lần (đăng nhập GitHub trên máy)
Cách dễ nhất là dùng **GitHub CLI (`gh`)** để khỏi nhập mật khẩu/token thủ công:

1. Cài `gh`:
   - Có Homebrew: mở Terminal, gõ `brew install gh`
   - Không có Homebrew: tải bản cài tại https://cli.github.com → cài như app bình thường.
2. Đăng nhập: mở Terminal, gõ:
   ```
   gh auth login
   ```
   Chọn: **GitHub.com → HTTPS → Login with a web browser** → làm theo (mở trình duyệt, bấm Authorize).
3. Bấm đúp **`setup-git.command`** trong thư mục này → dán URL repo GitHub của bạn
   (vd `https://github.com/TÊN-BẠN/qt-manager.git`) → Enter.
   Lần đầu nó đẩy toàn bộ file ở đây lên repo.

> Lần đầu bấm file `.command`, macOS có thể chặn "không xác định nhà phát triển":
> vào **System Settings → Privacy & Security → Open Anyway**, hoặc bấm chuột phải file → **Open**.

## Mỗi lần cập nhật (từ giờ về sau)
- Bấm đúp **`push.command`** → nó tự commit + đẩy lên GitHub → Vercel tự deploy ~30 giây.
- Không có gì thay đổi thì nó báo "Không có thay đổi mới".

## Nếu không muốn dùng `gh`
Dùng git thuần + Personal Access Token: tạo token tại GitHub → Settings → Developer settings →
Personal access tokens → Fine-grained → quyền `Contents: Read and write` cho repo. Khi `push`
hỏi password thì dán token. (Dùng `gh` ở trên đỡ phiền hơn.)
