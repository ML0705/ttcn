
-- ============================================================
-- XÓA DỮ LIỆU CŨ + RESET SEQUENCE
-- Trường matkhau trong seed hiện để placeholder — backend cần hash thực (bcrypt hoặc SHA-256) trước khi insert, không lưu plain text
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
-- 1. CHI NHÁNH  → CN01, CN02
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
-- ============================================================
INSERT INTO dbo.Loai_nhan_vien (maloainhanvien, tenloainhanvien)
VALUES ('LNV01', N'Fulltime'), ('LNV02', N'Parttime');

INSERT INTO dbo.Chuc_vu (machucvu, tenchucvu)
VALUES ('CV01', N'Quản lý'), ('CV02', N'Nhân viên bán hàng');
GO

-- ============================================================
-- 3. NHÂN VIÊN — INSERT từng dòng, trigger sinh mã
-- ============================================================
INSERT INTO dbo.Nhan_vien (machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
VALUES ((SELECT machinhanh FROM dbo.Chi_nhanh WHERE tenchinhanh=N'Chi nhánh Đống Đa'),
        'LNV01','CV01',N'Tạ Mai Phương','maiphuong@hygge.vn','0901111111');

INSERT INTO dbo.Nhan_vien (machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
VALUES ((SELECT machinhanh FROM dbo.Chi_nhanh WHERE tenchinhanh=N'Chi nhánh Đống Đa'),
        'LNV02','CV02',N'Nguyễn Thị Mỹ Hạnh','myhanh@hygge.vn','0902222222');

INSERT INTO dbo.Nhan_vien (machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
VALUES ((SELECT machinhanh FROM dbo.Chi_nhanh WHERE tenchinhanh=N'Chi nhánh Đống Đa'),
        'LNV02','CV02',N'Trần Văn An','tranan@hygge.vn','0903333333');

INSERT INTO dbo.Nhan_vien (machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
VALUES ((SELECT machinhanh FROM dbo.Chi_nhanh WHERE tenchinhanh=N'Chi nhánh Cầu Giấy'),
        'LNV01','CV01',N'Lê Thị Bình','thibinh@hygge.vn','0904444444');

INSERT INTO dbo.Nhan_vien (machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
VALUES ((SELECT machinhanh FROM dbo.Chi_nhanh WHERE tenchinhanh=N'Chi nhánh Cầu Giấy'),
        'LNV02','CV02',N'Phạm Quốc Huy','quochuy@hygge.vn','0905555555');
GO

-- ============================================================
-- 4. TÀI KHOẢN
-- ============================================================
INSERT INTO dbo.Tai_khoan (manhanvien, tendangnhap, matkhau)
SELECT manhanvien, sodienthoai, '$2b$10$placeholderHashReplaceMe'
FROM dbo.Nhan_vien;
GO

-- ============================================================
-- 5. CA LÀM — INSERT từng dòng → C01, C02, C03
-- ============================================================
INSERT INTO dbo.Ca_lam (tenca, batdau, ketthuc) VALUES (N'Ca sáng',  '08:00', '12:00');
INSERT INTO dbo.Ca_lam (tenca, batdau, ketthuc) VALUES (N'Ca chiều', '13:00', '17:00');
INSERT INTO dbo.Ca_lam (tenca, batdau, ketthuc) VALUES (N'Ca tối',   '17:00', '21:00');
GO

-- ============================================================
-- 6. LỊCH LÀM — trigger tự sinh mã + snapshot
-- ============================================================
INSERT INTO dbo.Lich_lam (maca, ngay)
SELECT cl.maca, d.ngay
FROM (VALUES
    (N'Ca sáng', '2025-06-16'),(N'Ca chiều','2025-06-16'),(N'Ca tối','2025-06-16'),
    (N'Ca sáng', '2025-06-17'),(N'Ca chiều','2025-06-17'),(N'Ca tối','2025-06-17'),
    (N'Ca sáng', '2025-06-18'),(N'Ca chiều','2025-06-18'),
    (N'Ca sáng', '2025-06-19'),(N'Ca chiều','2025-06-19'),(N'Ca tối','2025-06-19'),
    (N'Ca sáng', '2025-06-20'),(N'Ca chiều','2025-06-20')
) AS d(tenca, ngay)
INNER JOIN dbo.Ca_lam cl ON cl.tenca = d.tenca;
GO

-- ============================================================
-- 7. ĐĂNG KÝ LỊCH LÀM
-- ============================================================
INSERT INTO dbo.Dang_ky_lich_lam (manhanvien, malichlam)
SELECT nv.manhanvien, ll.malichlam
FROM dbo.Nhan_vien nv
CROSS JOIN dbo.Lich_lam ll
INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
WHERE nv.sodienthoai = '0902222222'
  AND ((ll.ngay IN ('2025-06-16','2025-06-18','2025-06-20') AND cl.tenca=N'Ca sáng') OR
       (ll.ngay = '2025-06-17' AND cl.tenca=N'Ca chiều'))
UNION ALL
SELECT nv.manhanvien, ll.malichlam
FROM dbo.Nhan_vien nv
CROSS JOIN dbo.Lich_lam ll
INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
WHERE nv.sodienthoai = '0903333333'
  AND ((ll.ngay IN ('2025-06-16','2025-06-17') AND cl.tenca=N'Ca chiều') OR
       (ll.ngay = '2025-06-19' AND cl.tenca=N'Ca tối'))
UNION ALL
SELECT nv.manhanvien, ll.malichlam
FROM dbo.Nhan_vien nv
CROSS JOIN dbo.Lich_lam ll
INNER JOIN dbo.Ca_lam cl ON cl.maca = ll.maca
WHERE nv.sodienthoai = '0901111111'
  AND ll.ngay IN ('2025-06-16','2025-06-17','2025-06-18','2025-06-19','2025-06-20')
  AND cl.tenca = N'Ca sáng';
GO

-- ============================================================
-- 8. CHẤM CÔNG
-- ============================================================
INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0902222222'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-16' AND cl.tenca=N'Ca sáng'),
 '2025-06-16 07:58','2025-06-16 12:03',0,0);

INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0901111111'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-16' AND cl.tenca=N'Ca sáng'),
 '2025-06-16 08:00','2025-06-16 12:00',0,0);

INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0903333333'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-16' AND cl.tenca=N'Ca chiều'),
 '2025-06-16 13:15','2025-06-16 17:05',1,0);

INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0902222222'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-17' AND cl.tenca=N'Ca chiều'),
 '2025-06-17 13:00','2025-06-17 17:00',0,0);

INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0903333333'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-17' AND cl.tenca=N'Ca chiều'),
 '2025-06-17 13:02','2025-06-17 16:40',0,1);

INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0902222222'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-18' AND cl.tenca=N'Ca sáng'),
 '2025-06-18 07:55','2025-06-18 12:00',0,0);

INSERT INTO dbo.Cham_cong(manhanvien,malichlam,checkin,checkout,trangthaicheckin,trangthaicheckout) VALUES
((SELECT manhanvien FROM dbo.Nhan_vien WHERE sodienthoai='0901111111'),
 (SELECT ll.malichlam FROM dbo.Lich_lam ll JOIN dbo.Ca_lam cl ON cl.maca=ll.maca WHERE ll.ngay='2025-06-18' AND cl.tenca=N'Ca sáng'),
 '2025-06-18 08:00','2025-06-18 12:00',0,0);
GO

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 'Chi_nhanh' AS [Bang], machinhanh AS [Ma] FROM dbo.Chi_nhanh UNION ALL
SELECT 'Ca_lam',    maca                          FROM dbo.Ca_lam    UNION ALL
SELECT 'Nhan_vien', manhanvien                    FROM dbo.Nhan_vien  UNION ALL
SELECT 'Lich_lam',  malichlam                     FROM dbo.Lich_lam
ORDER BY 1,2;

SELECT COUNT(*) AS [Dang_ky_lich_lam] FROM dbo.Dang_ky_lich_lam;
SELECT COUNT(*) AS [Cham_cong]        FROM dbo.Cham_cong;
GO

PRINT N'✅ Hoàn thành — không lỗi';
GO
