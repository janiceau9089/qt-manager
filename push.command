#!/bin/bash
# Bấm đúp file này mỗi khi muốn đẩy bản mới lên GitHub (Vercel sẽ tự deploy).
cd "$(dirname "$0")" || exit 1
echo "📂 Thư mục: $(pwd)"

if [ ! -d .git ]; then
  echo "⚠️  Chưa kết nối GitHub. Hãy bấm đúp 'setup-git.command' trước (chỉ làm 1 lần)."
  echo "Nhấn Enter để đóng."; read; exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "ℹ️  Không có thay đổi mới để đẩy."
else
  git commit -m "update $(date '+%Y-%m-%d %H:%M')"
  echo "⬆️  Đang đẩy lên GitHub..."
  git push && echo "✅ Xong! Vercel sẽ tự cập nhật sau ~30 giây." || echo "❌ Đẩy lỗi — xem thông báo phía trên (thường do chưa đăng nhập GitHub)."
fi
echo "Nhấn Enter để đóng cửa sổ."
read
