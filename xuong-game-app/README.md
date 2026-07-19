# Xưởng Game

Nền tảng chia sẻ game indie: đăng nhập/đăng ký thật, đăng game (chờ admin duyệt), huy hiệu Nhà phát triển, kết bạn, nhiều tài khoản, và trang quản trị.

## 1. Chạy thử trên máy bạn

```bash
npm install
cp .env.example .env
```

Mở file `.env` vừa tạo, điền:
- `JWT_SECRET`: một chuỗi ngẫu nhiên dài bất kỳ (dùng để mã hoá phiên đăng nhập)
- `ADMIN_USERNAME`: mặc định `PanAd`
- `ADMIN_PASSWORD`: mật khẩu bạn muốn cho tài khoản admin (ví dụ `0703`)

Rồi chạy:
```bash
npm start
```
Mở `http://localhost:3000`. Lần đầu chạy, tài khoản admin `PanAd` sẽ tự động được tạo với mật khẩu bạn đặt trong `.env`.

**Quan trọng:** không commit file `.env` lên GitHub — file `.gitignore` đã loại trừ sẵn nó rồi, đừng xoá dòng đó.

## 2. Đưa code lên GitHub

1. Tạo tài khoản GitHub (miễn phí) nếu chưa có: https://github.com
2. Tạo repository mới — nên để **Private** vì đây là code quản lý tài khoản của nhóm bạn.
3. Trong thư mục dự án:
```bash
git init
git add .
git commit -m "Xuong Game - ban dau"
git branch -M main
git remote add origin https://github.com/<ten-ban>/<ten-repo>.git
git push -u origin main
```

## 3. Deploy miễn phí lên Render

1. Vào https://render.com, đăng ký bằng tài khoản GitHub.
2. Chọn **New → Web Service**, kết nối tới repo bạn vừa tạo.
3. Cấu hình:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Ở mục **Environment Variables**, thêm:
   - `JWT_SECRET` = (chuỗi ngẫu nhiên của bạn)
   - `ADMIN_USERNAME` = `PanAd`
   - `ADMIN_PASSWORD` = mật khẩu bạn muốn (đặt ở đây, không phải trong code)
5. Bấm **Create Web Service**. Sau vài phút bạn sẽ có link dạng `https://ten-app.onrender.com` — gửi link này cho bạn bè là dùng được ngay.

### Lưu ý quan trọng về lưu trữ dữ liệu (SQLite)

App này dùng SQLite (file `.db`) để đơn giản, dễ chạy thử. Nhưng gói **Render Free hiện có ổ đĩa tạm thời (ephemeral)** — nghĩa là mỗi lần Render khởi động lại server (sau khi "ngủ" vì không có ai truy cập, hoặc mỗi lần bạn deploy code mới), **toàn bộ dữ liệu trong database sẽ bị xoá về ban đầu** (chỉ còn lại tài khoản admin được tạo lại từ đầu).

Với nhóm bạn dùng thử/chơi thì việc này chấp nhận được, nhưng nếu bạn muốn dữ liệu (tài khoản, game đã đăng, bạn bè...) được giữ lâu dài, có 2 hướng:

- **Đơn giản nhất:** nâng cấp lên gói trả phí của Render (~7 USD/tháng) để gắn ổ đĩa cố định (persistent disk).
- **Vẫn miễn phí:** chuyển sang **Fly.io**, nền tảng này có hạn mức miễn phí kèm ổ đĩa lưu trữ cố định (persistent volume) phù hợp cho SQLite. Nếu bạn muốn, mình có thể viết lại hướng dẫn deploy sang Fly.io — cấu trúc code không cần đổi gì nhiều.

Giá và chính sách miễn phí của các nền tảng này thay đổi khá thường xuyên, nên trước khi deploy thật, bạn nên kiểm tra lại trang giá hiện tại của Render/Fly.io một lần nữa.

## 4. Sau khi deploy

- Đăng nhập bằng `PanAd` / mật khẩu bạn đặt trong biến môi trường `ADMIN_PASSWORD`.
- Vào tab **Quản trị** để duyệt game, gán huy hiệu Dev, xoá nội dung vi phạm.
- Bạn bè của bạn tự đăng ký tài khoản riêng qua trang đăng ký — không cần bạn tạo hộ.

## Cấu trúc thư mục

```
xuong-game-app/
  server.js        # điểm khởi động server
  db.js             # kết nối SQLite + tạo bảng + gieo tài khoản admin
  middleware/auth.js
  routes/           # auth, games, users, friends
  public/           # frontend (HTML/CSS/JS thuần)
  .env.example      # mẫu biến môi trường — copy thành .env, không commit .env thật
```
