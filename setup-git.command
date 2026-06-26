#!/bin/bash
# Chạy 1 LẦN DUY NHẤT để kết nối thư mục này với repo GitHub của bạn.
cd "$(dirname "$0")" || exit 1
echo "=== Kết nối GitHub (chỉ làm 1 lần) ==="

# kiểm tra git
if ! command -v git >/dev/null 2>&1; then
  echo "⚠️  Máy chưa có 'git'. Sẽ hiện cửa sổ cài Xcode Command Line Tools — bấm Install rồi chạy lại file này."
  xcode-select --install
  echo "Nhấn Enter để đóng."; read; exit 1
fi

read -p "Dán URL repo GitHub (vd https://github.com/TÊN-BẠN/qt-manager.git): " URL
if [ -z "$URL" ]; then echo "Chưa nhập URL. Thoát."; read; exit 1; fi

git init
git branch -M main
git remote remove origin 2>/dev/null
git remote add origin "$URL"
git add -A
git commit -m "init from local"
echo "⬆️  Đẩy lần đầu (ghi đè nội dung repo bằng các file ở đây)..."
git push -u origin main --force \
  && echo "✅ Kết nối xong! Từ giờ chỉ cần bấm đúp 'push.command' mỗi lần cập nhật." \
  || echo "❌ Lỗi đẩy — thường do chưa đăng nhập GitHub. Xem GIT_SETUP.md (cài 'gh' rồi chạy: gh auth login)."
echo "Nhấn Enter để đóng."
read
