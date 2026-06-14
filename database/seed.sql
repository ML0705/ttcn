-- ============================================================
-- HYGGE — DỮ LIỆU MẪU (seed_v3.sql)
-- Khớp với schema_v3.sql (cascade delete + SP mới)
-- Lưu ý:
--   · Không INSERT vào Tai_khoan trực tiếp —
--     trigger trg_Nhan_vien_SinhMa tự tạo dòng Tai_khoan
--   · Dùng SP_TaoNhanVien để tạo NV với mật khẩu tùy chỉnh
--   · Dùng SP_CapNhatNhanVien để sửa thông tin NV (UC 2.2)
--   · Dùng SP_XoaNhanVien để xóa NV, cascade tự dọn dữ liệu liên quan (UC 2.3)
-- ============================================================

-- ============================================================
-- XÓA DỮ LIỆU CŨ + RESET SEQUENCE
-- ============================================================
DELETE FROM dbo.Cham_cong;
DELETE FROM dbo.Dang_ky_lich_lam;
DELETE FROM dbo.Lich_lam;
DELETE FROM dbo.Ca_lam;
DELETE FROM dbo.Tai_khoan;
DELETE FROM dbo.Nhan_vien;
DELETE FROM dbo.Chuc_vu;
DELETE FROM dbo.Loai_nhan_vien;
DELETE FROM dbo.Chi_nhanh;

DELETE FROM dbo._Seq_Chi_nhanh;
DELETE FROM dbo._Seq_Ca_lam;
DELETE FROM dbo._Seq_Nhan_vien_P;
DELETE FROM dbo._Seq_Nhan_vien_F;

DBCC CHECKIDENT ('dbo._Seq_Chi_nhanh',   RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo._Seq_Ca_lam',      RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo._Seq_Nhan_vien_P', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo._Seq_Nhan_vien_F', RESEED, 0) WITH NO_INFOMSGS;
GO

-- ============================================================
-- 1. CHI NHÁNH → CN01, CN02
-- ============================================================
INSERT INTO dbo.Chi_nhanh (tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai)
VALUES (N'Chi nhánh Đống Đa',
        N'12 Chùa Bộc, Quang Trung, Đống Đa, Hà Nội',
        '0241234567', '07:30', '22:00', 1);

INSERT INTO dbo.Chi_nhanh (tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai)
VALUES (N'Chi nhánh Cầu Giấy',
        N'88 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
        '0247654321', '07:30', '22:00', 1);
GO

-- ============================================================
-- 2. LOẠI NHÂN VIÊN + CHỨC VỤ
-- Chức vụ hiển thị dạng combobox trong form Thêm/Sửa tài khoản
-- ============================================================
INSERT INTO dbo.Loai_nhan_vien (maloainhanvien, tenloainhanvien)
VALUES ('LNV01', N'Fulltime'), ('LNV02', N'Parttime');

INSERT INTO dbo.Chuc_vu (machucvu, tenchucvu)
VALUES ('CV01', N'Quản lý'), ('CV02', N'Nhân viên bán hàng');
GO

-- ============================================================
-- 3. NHÂN VIÊN — dùng SP_TaoNhanVien (hash bcrypt = Hygge@2025)
-- ============================================================
DECLARE
    @maNV1 VARCHAR(10), @maNV2 VARCHAR(10), @maNV3 VARCHAR(10),
    @maNV4 VARCHAR(10), @maNV5 VARCHAR(10);

-- NV1: Fulltime - Quản lý - Đống Đa
EXEC dbo.SP_TaoNhanVien
    @machinhanh     = 'CN01',
    @maloainhanvien = 'LNV01',
    @machucvu       = 'CV01',
    @hoten          = N'Tạ Mai Phương',
    @email          = 'maiphuong@hygge.vn',
    @sodienthoai    = '0901111111',
    @matkhau        = '$2b$10$SOmva0kj5nwtknuU/gksa0qUPUUALVohJBaEhFd6Wrws3mDzT9LC.',
    @manhanvien_out = @maNV1 OUTPUT;

-- NV2: Parttime - Nhân viên - Đống Đa
EXEC dbo.SP_TaoNhanVien
    @machinhanh     = 'CN01',
    @maloainhanvien = 'LNV02',
    @machucvu       = 'CV02',
    @hoten          = N'Nguyễn Thị Mỹ Hạnh',
    @email          = 'myhanh@hygge.vn',
    @sodienthoai    = '0902222222',
    @matkhau        = '$2b$10$N0k0GxVUGfa6KZv.3uO8X0iU/BB4IzrKuuVUbFdrqBS4ZpX0qFhkO',
    @manhanvien_out = @maNV2 OUTPUT;

-- NV3: Parttime - Nhân viên - Đống Đa
EXEC dbo.SP_TaoNhanVien
    @machinhanh     = 'CN01',
    @maloainhanvien = 'LNV02',
    @machucvu       = 'CV02',
    @hoten          = N'Trần Văn An',
    @email          = 'tranan@hygge.vn',
    @sodienthoai    = '0903333333',
    @matkhau        = '$2b$10$qNIdsD8tnvEK6mBjIQ2tSeEoh46zHFP62ePCnKVg9tFTh7ncjkOV.',
    @manhanvien_out = @maNV3 OUTPUT;

-- NV4: Fulltime - Quản lý - Cầu Giấy
EXEC dbo.SP_TaoNhanVien
    @machinhanh     = 'CN02',
    @maloainhanvien = 'LNV01',
    @machucvu       = 'CV01',
    @hoten          = N'Lê Thị Bình',
    @email          = 'thibinh@hygge.vn',
    @sodienthoai    = '0904444444',
    @matkhau        = '$2b$10$GluF2Xs5zqw47U3XQhKPneYXu/GB18z2OorGRQ1vDGfHwzmuiplny',
    @manhanvien_out = @maNV4 OUTPUT;

-- NV5: Parttime - Nhân viên - Cầu Giấy
EXEC dbo.SP_TaoNhanVien
    @machinhanh     = 'CN02',
    @maloainhanvien = 'LNV02',
    @machucvu       = 'CV02',
    @hoten          = N'Phạm Quốc Huy',
    @email          = 'quochuy@hygge.vn',
    @sodienthoai    = '0905555555',
    @matkhau        = '$2b$10$9sNkOV1sdbDR20.cdeS1jej/KN3Fl0WMzPqD4cvrszoYoU/KX7uV6',
    @manhanvien_out = @maNV5 OUTPUT;

PRINT N'NV1=' + @maNV1 + N' | NV2=' + @maNV2 + N' | NV3=' + @maNV3 +
      N' | NV4=' + @maNV4 + N' | NV5=' + @maNV5;
GO

-- ============================================================
-- 4. CA LÀM → C01, C02, C03
-- ============================================================
INSERT INTO dbo.Ca_lam (tenca, batdau, ketthuc) VALUES (N'Ca sáng',  '08:00', '12:00');
INSERT INTO dbo.Ca_lam (tenca, batdau, ketthuc) VALUES (N'Ca chiều', '13:00', '17:00');
INSERT INTO dbo.Ca_lam (tenca, batdau, ketthuc) VALUES (N'Ca tối',   '17:00', '21:00');
GO

-- ============================================================
-- 5. LỊCH LÀM — trigger tự sinh mã + snapshot giờ từ Ca_lam
-- ============================================================
INSERT INTO dbo.Lich_lam (maca, ngay)
SELECT cl.maca, d.ngay
FROM (VALUES
    (N'Ca sáng',  '2025-06-16'), (N'Ca chiều', '2025-06-16'), (N'Ca tối',   '2025-06-16'),
    (N'Ca sáng',  '2025-06-17'), (N'Ca chiều', '2025-06-17'), (N'Ca tối',   '2025-06-17'),
    (N'Ca sáng',  '2025-06-18'), (N'Ca chiều', '2025-06-18'),
    (N'Ca sáng',  '2025-06-19'), (N'Ca chiều', '2025-06-19'), (N'Ca tối',   '2025-06-19'),
    (N'Ca sáng',  '2025-06-20'), (N'Ca chiều', '2025-06-20')
) AS d(tenca, ngay)
INNER JOIN dbo.Ca_lam cl ON cl.tenca = d.tenca;
GO

-- ============================================================
-- 6. ĐĂNG KÝ LỊCH LÀM
-- ============================================================
-- Mỹ Hạnh (NV2): Ca sáng 16,18,20 | Ca chiều 17
INSERT INTO dbo.Dang_ky_lich_lam (manhanvien, malichlam)
SELECT nv.manhanvien, ll.malichlam
FROM dbo.Nhan_vien nv
CROSS JOIN dbo.Lich_lam ll
INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
WHERE nv.sodienthoai = '0902222222'
  AND (
      (ll.ngay IN ('2025-06-16', '2025-06-18', '2025-06-20') AND cl.tenca = N'Ca sáng') OR
      (ll.ngay = '2025-06-17' AND cl.tenca = N'Ca chiều')
  );

-- Trần Văn An (NV3): Ca chiều 16,17 | Ca tối 19
INSERT INTO dbo.Dang_ky_lich_lam (manhanvien, malichlam)
SELECT nv.manhanvien, ll.malichlam
FROM dbo.Nhan_vien nv
CROSS JOIN dbo.Lich_lam ll
INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
WHERE nv.sodienthoai = '0903333333'
  AND (
      (ll.ngay IN ('2025-06-16', '2025-06-17') AND cl.tenca = N'Ca chiều') OR
      (ll.ngay = '2025-06-19' AND cl.tenca = N'Ca tối')
  );

-- Tạ Mai Phương (NV1): Ca sáng toàn bộ ngày
INSERT INTO dbo.Dang_ky_lich_lam (manhanvien, malichlam)
SELECT nv.manhanvien, ll.malichlam
FROM dbo.Nhan_vien nv
CROSS JOIN dbo.Lich_lam ll
INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
WHERE nv.sodienthoai = '0901111111'
  AND ll.ngay IN ('2025-06-16','2025-06-17','2025-06-18','2025-06-19','2025-06-20')
  AND cl.tenca = N'Ca sáng';
GO

-- ============================================================
-- 7. CHẤM CÔNG
-- ============================================================
-- Mỹ Hạnh — Ca sáng 16/06: đúng giờ
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0902222222'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-16' AND cl.tenca = N'Ca sáng'),
    '2025-06-16 07:58', '2025-06-16 12:03', 0, 0
);

-- Tạ Mai Phương — Ca sáng 16/06: đúng giờ
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0901111111'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-16' AND cl.tenca = N'Ca sáng'),
    '2025-06-16 08:00', '2025-06-16 12:00', 0, 0
);

-- Trần Văn An — Ca chiều 16/06: muộn 15 phút
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0903333333'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-16' AND cl.tenca = N'Ca chiều'),
    '2025-06-16 13:15', '2025-06-16 17:05', 1, 0
);

-- Mỹ Hạnh — Ca chiều 17/06: đúng giờ
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0902222222'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-17' AND cl.tenca = N'Ca chiều'),
    '2025-06-17 13:00', '2025-06-17 17:00', 0, 0
);

-- Trần Văn An — Ca chiều 17/06: về sớm 20 phút
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0903333333'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-17' AND cl.tenca = N'Ca chiều'),
    '2025-06-17 13:02', '2025-06-17 16:40', 0, 1
);

-- Mỹ Hạnh — Ca sáng 18/06: đúng giờ
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0902222222'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-18' AND cl.tenca = N'Ca sáng'),
    '2025-06-18 07:55', '2025-06-18 12:00', 0, 0
);

-- Tạ Mai Phương — Ca sáng 18/06: đúng giờ
INSERT INTO dbo.Cham_cong (manhanvien, malichlam, checkin, checkout, trangthaicheckin, trangthaicheckout)
VALUES (
    (SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai = '0901111111'),
    (SELECT ll.malichlam FROM dbo.Lich_lam ll INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
     WHERE ll.ngay = '2025-06-18' AND cl.tenca = N'Ca sáng'),
    '2025-06-18 08:00', '2025-06-18 12:00', 0, 0
);
GO

-- ============================================================
-- DEMO SP_CapNhatNhanVien (UC 2.2) — chạy thử, không ảnh hưởng data chính
-- ============================================================
-- Ví dụ: đổi chức vụ Trần Văn An sang Quản lý, giữ nguyên mật khẩu
-- EXEC dbo.SP_CapNhatNhanVien
--     @manhanvien     = 'NVP0002',   -- mã sinh ra sau seed
--     @machinhanh     = 'CN01',
--     @maloainhanvien = 'LNV02',
--     @machucvu       = 'CV01',
--     @hoten          = N'Trần Văn An',
--     @email          = 'tranan@hygge.vn',
--     @sodienthoai    = '0903333333',
--     @matkhauMoi     = NULL;        -- NULL = giữ nguyên mật khẩu cũ

-- ============================================================
-- DEMO SP_XoaNhanVien (UC 2.3) — chạy thử, không ảnh hưởng data chính
-- Cascade tự xóa: Tai_khoan, Dang_ky_lich_lam, Cham_cong của NV đó
-- ============================================================
-- EXEC dbo.SP_XoaNhanVien @manhanvien = 'NVP0003';

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 'Chi_nhanh'  AS [Bang], machinhanh AS [Ma] FROM dbo.Chi_nhanh
UNION ALL
SELECT 'Ca_lam',    maca                          FROM dbo.Ca_lam
UNION ALL
SELECT 'Nhan_vien', manhanvien                    FROM dbo.Nhan_vien
UNION ALL
SELECT 'Lich_lam',  malichlam                     FROM dbo.Lich_lam
ORDER BY 1, 2;

SELECT COUNT(*) AS [So_tai_khoan]   FROM dbo.Tai_khoan;
SELECT COUNT(*) AS [Dang_ky_lich]   FROM dbo.Dang_ky_lich_lam;
SELECT COUNT(*) AS [Cham_cong]      FROM dbo.Cham_cong;
GO

PRINT N'✅ Hoàn thành seed_v3 — không lỗi';
GO