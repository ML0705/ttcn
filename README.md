# HYGGE HR — Hệ thống quản lý ca làm & chấm công

## Yêu cầu cài đặt
- Node.js (LTS): https://nodejs.org
- SQL Server + SSMS
- VSCode

## Cách chạy project

### Bước 1 — Clone repo về
git clone <link-repo>

### Bước 2 — Cài packages
cd backend
npm install

### Bước 3 — Tạo file .env
Tạo file .env trong thư mục backend (KHÔNG push file này lên GitHub)
Nội dung:

DB_SERVER=DESKTOP-FU4M18N\SQLEXPRESS02
DB_NAME=HyggeDB
DB_USER=
DB_PASSWORD=
PORT=3000
JWT_SECRET=hygge_secret_2026

Lưu ý: DB_SERVER lấy từ ô Server name khi đăng nhập SSMS

### Bước 4 — Tạo database
Mở SSMS → đổi dropdown sang HyggeDB
Chạy file: database/schema.sql
Chạy file: database/seed.sql

### Bước 5 — Chạy server
cd backend
node server.js

Thấy "Kết nối SQL Server thành công" là xong.

## ĐỂ KẾT NỐI DATABASE THÌ KHẢ NĂNG PHẢI SỬA CẢ DB.JS NỮA, NMA NẾU MN SỬA DB.JS THÌ BẢO GITIGNORE NÓ ĐI NHÉ, KO ĐẾN LÚC PULL VỀ GHI ĐÈ FILE DB CỦA NHAU LẠI KO KẾT NỐI ĐC DATABASE
## MK ở DATABASE T MÃ HÓA RỒI NHÉ