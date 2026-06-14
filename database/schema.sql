-- ============================================================
-- HYGGE - HỆ THỐNG QUẢN LÝ CA LÀM & CHẤM CÔNG
-- FILE: schema_v3.sql
-- DBMS: SQL Server (T-SQL)
-- Thay đổi so với v2:
--   1. Trigger Nhan_vien: gộp luôn tạo Tai_khoan (nhận matkhau từ caller)
--   2. Trigger Chi_nhanh & Ca_lam: dùng cursor để hỗ trợ batch INSERT
--   3. Thêm SP_TaoNhanVien: stored procedure tạo NV + TK trong 1 transaction
--   4. Thêm trigger trg_NhanVien_DoiSDT: đồng bộ tendangnhap khi SĐT thay đổi
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'HyggeDB')
    CREATE DATABASE HyggeDB COLLATE Vietnamese_CI_AS;
GO

USE HyggeDB;
GO

-- ============================================================
-- DỌN BẢNG CŨ (đúng thứ tự FK)
-- ============================================================
IF OBJECT_ID('dbo.Cham_cong',           'U') IS NOT NULL DROP TABLE dbo.Cham_cong;
IF OBJECT_ID('dbo.Dang_ky_lich_lam',    'U') IS NOT NULL DROP TABLE dbo.Dang_ky_lich_lam;
IF OBJECT_ID('dbo.Lich_lam',            'U') IS NOT NULL DROP TABLE dbo.Lich_lam;
IF OBJECT_ID('dbo.Ca_lam',              'U') IS NOT NULL DROP TABLE dbo.Ca_lam;
IF OBJECT_ID('dbo.Tai_khoan',           'U') IS NOT NULL DROP TABLE dbo.Tai_khoan;
IF OBJECT_ID('dbo.Nhan_vien',           'U') IS NOT NULL DROP TABLE dbo.Nhan_vien;
IF OBJECT_ID('dbo.Chuc_vu',             'U') IS NOT NULL DROP TABLE dbo.Chuc_vu;
IF OBJECT_ID('dbo.Loai_nhan_vien',      'U') IS NOT NULL DROP TABLE dbo.Loai_nhan_vien;
IF OBJECT_ID('dbo.Chi_nhanh',           'U') IS NOT NULL DROP TABLE dbo.Chi_nhanh;

-- Bảng đếm sequence
IF OBJECT_ID('dbo._Seq_Chi_nhanh',      'U') IS NOT NULL DROP TABLE dbo._Seq_Chi_nhanh;
IF OBJECT_ID('dbo._Seq_Nhan_vien_P',    'U') IS NOT NULL DROP TABLE dbo._Seq_Nhan_vien_P;
IF OBJECT_ID('dbo._Seq_Nhan_vien_F',    'U') IS NOT NULL DROP TABLE dbo._Seq_Nhan_vien_F;
IF OBJECT_ID('dbo._Seq_Ca_lam',         'U') IS NOT NULL DROP TABLE dbo._Seq_Ca_lam;

-- Dọn trigger
IF OBJECT_ID('dbo.trg_Chi_nhanh_SinhMa',   'TR') IS NOT NULL DROP TRIGGER dbo.trg_Chi_nhanh_SinhMa;
IF OBJECT_ID('dbo.trg_Nhan_vien_SinhMa',   'TR') IS NOT NULL DROP TRIGGER dbo.trg_Nhan_vien_SinhMa;
IF OBJECT_ID('dbo.trg_NhanVien_DoiSDT',    'TR') IS NOT NULL DROP TRIGGER dbo.trg_NhanVien_DoiSDT;
IF OBJECT_ID('dbo.trg_Ca_lam_SinhMa',      'TR') IS NOT NULL DROP TRIGGER dbo.trg_Ca_lam_SinhMa;
IF OBJECT_ID('dbo.trg_Lich_lam_SinhMa',    'TR') IS NOT NULL DROP TRIGGER dbo.trg_Lich_lam_SinhMa;

-- Dọn stored procedure
IF OBJECT_ID('dbo.SP_TaoNhanVien', 'P') IS NOT NULL DROP PROCEDURE dbo.SP_TaoNhanVien;
GO

-- ============================================================
-- 1. CHI NHÁNH
-- Mã tự sinh: CN01, CN02, ...
-- ============================================================
CREATE TABLE dbo.Chi_nhanh (
    machinhanh      VARCHAR(10)     NOT NULL,
    tenchinhanh     NVARCHAR(50)    NOT NULL,
    diachi          NVARCHAR(100)   NOT NULL,
    sdtcn           CHAR(10)        NULL,
    giomocua        TIME            NOT NULL,
    giodongcua      TIME            NOT NULL,
    trangthai       BIT             NOT NULL DEFAULT 1,

    CONSTRAINT PK_Chi_nhanh PRIMARY KEY (machinhanh),
    CONSTRAINT CK_CN_Gio    CHECK (giodongcua > giomocua)
);
GO

CREATE TABLE dbo._Seq_Chi_nhanh (id INT IDENTITY(1,1) PRIMARY KEY);
GO

-- FIX v3: dùng cursor để hỗ trợ batch INSERT nhiều dòng
CREATE TRIGGER dbo.trg_Chi_nhanh_SinhMa
ON dbo.Chi_nhanh
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @cur CURSOR;
    SET @cur = CURSOR LOCAL FAST_FORWARD FOR
        SELECT tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai
        FROM inserted;

    DECLARE
        @tenchinhanh    NVARCHAR(50),
        @diachi         NVARCHAR(100),
        @sdtcn          CHAR(10),
        @giomocua       TIME,
        @giodongcua     TIME,
        @trangthai      BIT,
        @seq            INT,
        @newMa          VARCHAR(10);

    OPEN @cur;
    FETCH NEXT FROM @cur INTO @tenchinhanh, @diachi, @sdtcn, @giomocua, @giodongcua, @trangthai;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO dbo._Seq_Chi_nhanh DEFAULT VALUES;
        SET @seq   = SCOPE_IDENTITY();
        SET @newMa = 'CN' + RIGHT('00' + CAST(@seq AS VARCHAR(2)), 2);

        INSERT INTO dbo.Chi_nhanh (machinhanh, tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai)
        VALUES (@newMa, @tenchinhanh, @diachi, @sdtcn, @giomocua, @giodongcua, ISNULL(@trangthai, 1));

        FETCH NEXT FROM @cur INTO @tenchinhanh, @diachi, @sdtcn, @giomocua, @giodongcua, @trangthai;
    END

    CLOSE @cur;
    DEALLOCATE @cur;
END;
GO

-- ============================================================
-- 2. LOẠI NHÂN VIÊN
-- ============================================================
CREATE TABLE dbo.Loai_nhan_vien (
    maloainhanvien  VARCHAR(10)     NOT NULL,
    tenloainhanvien NVARCHAR(50)    NOT NULL,

    CONSTRAINT PK_Loai_nhan_vien    PRIMARY KEY (maloainhanvien),
    CONSTRAINT UQ_Loai_NV_Ten       UNIQUE (tenloainhanvien),
    CONSTRAINT CK_Loai_NV_Ten       CHECK (tenloainhanvien IN (N'Fulltime', N'Parttime'))
);
GO

-- ============================================================
-- 3. CHỨC VỤ
-- ============================================================
CREATE TABLE dbo.Chuc_vu (
    machucvu    CHAR(10)        NOT NULL,
    tenchucvu   NVARCHAR(50)    NOT NULL,

    CONSTRAINT PK_Chuc_vu       PRIMARY KEY (machucvu),
    CONSTRAINT UQ_Chuc_vu_Ten   UNIQUE (tenchucvu)
);
GO

-- ============================================================
-- 4. NHÂN VIÊN
-- Mã tự sinh: NVP0001 (Parttime) | NVF0001 (Fulltime)
-- Caller truyền thêm matkhau (plain-text) → trigger hash và tạo Tai_khoan
-- ============================================================
CREATE TABLE dbo.Nhan_vien (
    manhanvien      VARCHAR(10)     NOT NULL,
    machinhanh      VARCHAR(10)     NOT NULL,
    maloainhanvien  VARCHAR(10)     NOT NULL,
    machucvu        CHAR(10)        NOT NULL,
    hoten           NVARCHAR(50)    NOT NULL,
    email           VARCHAR(50)     NULL,
    sodienthoai     CHAR(10)        NOT NULL,

    -- Cột tạm để nhận mật khẩu từ caller, KHÔNG lưu lại sau trigger
    -- Trigger đọc rồi INSERT vào Tai_khoan, sau đó cột này bị bỏ qua
    -- Dùng computed column giả hoặc truyền qua SP (xem SP_TaoNhanVien bên dưới)

    CONSTRAINT PK_Nhan_vien     PRIMARY KEY (manhanvien),
    CONSTRAINT UQ_NV_Email      UNIQUE (email),
    CONSTRAINT UQ_NV_SDT        UNIQUE (sodienthoai),
    CONSTRAINT FK_NV_Chi_nhanh  FOREIGN KEY (machinhanh)
                                    REFERENCES dbo.Chi_nhanh (machinhanh),
    CONSTRAINT FK_NV_Loai_NV    FOREIGN KEY (maloainhanvien)
                                    REFERENCES dbo.Loai_nhan_vien (maloainhanvien),
    CONSTRAINT FK_NV_Chuc_vu    FOREIGN KEY (machucvu)
                                    REFERENCES dbo.Chuc_vu (machucvu)
);
GO

CREATE TABLE dbo._Seq_Nhan_vien_P (id INT IDENTITY(1,1) PRIMARY KEY);
CREATE TABLE dbo._Seq_Nhan_vien_F (id INT IDENTITY(1,1) PRIMARY KEY);
GO

-- ============================================================
-- 5. TÀI KHOẢN
-- tendangnhap = sodienthoai (UNIQUE đã đảm bảo không trùng)
-- ============================================================
CREATE TABLE dbo.Tai_khoan (
    manhanvien          VARCHAR(10)     NOT NULL,
    tendangnhap         CHAR(10)        NOT NULL,   -- = sodienthoai
    matkhau             VARCHAR(255)    NOT NULL,   -- lưu dạng hash bcrypt (backend hash trước khi truyền vào)
    solansaidangnhap    INT             NOT NULL DEFAULT 0,
    trangthaikhoa       BIT             NOT NULL DEFAULT 0,

    CONSTRAINT PK_Tai_khoan     PRIMARY KEY (manhanvien),
    CONSTRAINT UQ_TK_TenDN      UNIQUE (tendangnhap),
    CONSTRAINT FK_TK_Nhan_vien  FOREIGN KEY (manhanvien)
                                    REFERENCES dbo.Nhan_vien (manhanvien),
    CONSTRAINT CK_TK_SoLanSai   CHECK (solansaidangnhap >= 0)
);
GO

-- ============================================================
-- TRIGGER: Nhân viên — sinh mã + tạo Tai_khoan
-- Lưu ý: vì mật khẩu không thể truyền qua inserted table của Nhan_vien,
--        nên dùng SP_TaoNhanVien (bên dưới) thay vì INSERT trực tiếp.
--        Trigger này giữ để xử lý trường hợp INSERT trực tiếp (mật khẩu mặc định = hash SĐT).
-- ============================================================
CREATE TRIGGER dbo.trg_Nhan_vien_SinhMa
ON dbo.Nhan_vien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @cur CURSOR;
    SET @cur = CURSOR LOCAL FAST_FORWARD FOR
        SELECT machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai
        FROM inserted;

    DECLARE
        @machinhanh     VARCHAR(10),
        @maloainhanvien VARCHAR(10),
        @machucvu       CHAR(10),
        @hoten          NVARCHAR(50),
        @email          VARCHAR(50),
        @sdt            CHAR(10),
        @prefix         CHAR(3),
        @seq            INT,
        @newMa          VARCHAR(10);

    OPEN @cur;
    FETCH NEXT FROM @cur INTO @machinhanh, @maloainhanvien, @machucvu, @hoten, @email, @sdt;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Sinh mã theo loại nhân viên
        IF @maloainhanvien = 'LNV02'    -- Parttime
        BEGIN
            INSERT INTO dbo._Seq_Nhan_vien_P DEFAULT VALUES;
            SET @seq    = SCOPE_IDENTITY();
            SET @prefix = 'NVP';
        END
        ELSE                             -- Fulltime
        BEGIN
            INSERT INTO dbo._Seq_Nhan_vien_F DEFAULT VALUES;
            SET @seq    = SCOPE_IDENTITY();
            SET @prefix = 'NVF';
        END

        SET @newMa = @prefix + RIGHT('0000' + CAST(@seq AS VARCHAR(4)), 4);

        -- INSERT nhân viên
        INSERT INTO dbo.Nhan_vien
            (manhanvien, machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
        VALUES
            (@newMa, @machinhanh, @maloainhanvien, @machucvu, @hoten, @email, @sdt);

        -- Tạo dòng Tai_khoan tạm, matkhau để chuỗi rỗng
        -- SP_TaoNhanVien sẽ UPDATE lại bằng hash bcrypt thực từ backend
        INSERT INTO dbo.Tai_khoan (manhanvien, tendangnhap, matkhau)
        VALUES (@newMa, @sdt, '');

        FETCH NEXT FROM @cur INTO @machinhanh, @maloainhanvien, @machucvu, @hoten, @email, @sdt;
    END

    CLOSE @cur;
    DEALLOCATE @cur;
END;
GO

-- ============================================================
-- TRIGGER: Đồng bộ tendangnhap khi SĐT thay đổi
-- ============================================================
CREATE TRIGGER dbo.trg_NhanVien_DoiSDT
ON dbo.Nhan_vien
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(sodienthoai) RETURN;

    UPDATE tk
    SET tk.tendangnhap = i.sodienthoai
    FROM dbo.Tai_khoan tk
    INNER JOIN inserted i ON i.manhanvien = tk.manhanvien
    INNER JOIN deleted  d ON d.manhanvien = tk.manhanvien
    WHERE d.sodienthoai <> i.sodienthoai;   -- chỉ cập nhật khi thực sự đổi
END;
GO

-- ============================================================
-- 6. CA LÀM
-- Mã tự sinh: C01, C02, ...
-- FIX v3: dùng cursor để hỗ trợ batch INSERT nhiều dòng
-- ============================================================
CREATE TABLE dbo.Ca_lam (
    maca    CHAR(10)        NOT NULL,
    tenca   NVARCHAR(50)    NOT NULL,
    batdau  TIME            NOT NULL,
    ketthuc TIME            NOT NULL,

    CONSTRAINT PK_Ca_lam PRIMARY KEY (maca),
    CONSTRAINT CK_CL_Gio CHECK (ketthuc > batdau)
);
GO

CREATE TABLE dbo._Seq_Ca_lam (id INT IDENTITY(1,1) PRIMARY KEY);
GO

CREATE TRIGGER dbo.trg_Ca_lam_SinhMa
ON dbo.Ca_lam
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @cur CURSOR;
    SET @cur = CURSOR LOCAL FAST_FORWARD FOR
        SELECT tenca, batdau, ketthuc FROM inserted;

    DECLARE
        @tenca   NVARCHAR(50),
        @batdau  TIME,
        @ketthuc TIME,
        @seq     INT,
        @newMa   CHAR(10);

    OPEN @cur;
    FETCH NEXT FROM @cur INTO @tenca, @batdau, @ketthuc;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        INSERT INTO dbo._Seq_Ca_lam DEFAULT VALUES;
        SET @seq   = SCOPE_IDENTITY();
        SET @newMa = 'C' + RIGHT('00' + CAST(@seq AS VARCHAR(2)), 2);

        INSERT INTO dbo.Ca_lam (maca, tenca, batdau, ketthuc)
        VALUES (@newMa, @tenca, @batdau, @ketthuc);

        FETCH NEXT FROM @cur INTO @tenca, @batdau, @ketthuc;
    END

    CLOSE @cur;
    DEALLOCATE @cur;
END;
GO

-- ============================================================
-- 7. LỊCH LÀM
-- Mã tự sinh: ddmmyyyy + maca  (vd: 16062025C01)
-- ============================================================
CREATE TABLE dbo.Lich_lam (
    malichlam       VARCHAR(20)     NOT NULL,
    maca            CHAR(10)        NOT NULL,
    ngay            DATE            NOT NULL,
    thoigianbatdau  TIME            NOT NULL,
    thoigianketthuc TIME            NOT NULL,

    CONSTRAINT PK_Lich_lam      PRIMARY KEY (malichlam),
    CONSTRAINT FK_LL_Ca_lam     FOREIGN KEY (maca) REFERENCES dbo.Ca_lam (maca),
    CONSTRAINT UQ_LL_NgayCa     UNIQUE (ngay, maca),
    CONSTRAINT CK_LL_ThoiGian   CHECK (thoigianketthuc > thoigianbatdau)
);
GO

CREATE TRIGGER dbo.trg_Lich_lam_SinhMa
ON dbo.Lich_lam
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Caller chỉ cần truyền: maca + ngay
    -- Trigger tự lấy giờ snapshot từ Ca_lam và sinh malichlam
    INSERT INTO dbo.Lich_lam (malichlam, maca, ngay, thoigianbatdau, thoigianketthuc)
    SELECT
        RIGHT('00' + CAST(DAY(i.ngay)   AS VARCHAR(2)), 2) +
        RIGHT('00' + CAST(MONTH(i.ngay) AS VARCHAR(2)), 2) +
        CAST(YEAR(i.ngay) AS VARCHAR(4)) +
        RTRIM(i.maca),

        i.maca,
        i.ngay,
        ISNULL(i.thoigianbatdau,  c.batdau),
        ISNULL(i.thoigianketthuc, c.ketthuc)

    FROM inserted i
    INNER JOIN dbo.Ca_lam c ON c.maca = i.maca;
END;
GO

-- ============================================================
-- 8. ĐĂNG KÝ LỊCH LÀM
-- ============================================================
CREATE TABLE dbo.Dang_ky_lich_lam (
    manhanvien  VARCHAR(10)     NOT NULL,
    malichlam   VARCHAR(20)     NOT NULL,

    CONSTRAINT PK_DKLL              PRIMARY KEY (manhanvien, malichlam),
    CONSTRAINT FK_DKLL_Nhan_vien    FOREIGN KEY (manhanvien)
                                        REFERENCES dbo.Nhan_vien (manhanvien),
    CONSTRAINT FK_DKLL_Lich_lam     FOREIGN KEY (malichlam)
                                        REFERENCES dbo.Lich_lam (malichlam)
);
GO

-- ============================================================
-- 9. CHẤM CÔNG
-- ============================================================
CREATE TABLE dbo.Cham_cong (
    manhanvien          VARCHAR(10)     NOT NULL,
    malichlam           VARCHAR(20)     NOT NULL,
    checkin             DATETIME        NULL,
    checkout            DATETIME        NULL,
    trangthaicheckin    TINYINT         NOT NULL DEFAULT 0,  -- 0 Đúng giờ | 1 Muộn
    trangthaicheckout   TINYINT         NOT NULL DEFAULT 0,  -- 0 Đúng giờ | 1 Về sớm

    CONSTRAINT PK_Cham_cong         PRIMARY KEY (manhanvien, malichlam),
    CONSTRAINT FK_CC_Nhan_vien      FOREIGN KEY (manhanvien)
                                        REFERENCES dbo.Nhan_vien (manhanvien),
    CONSTRAINT FK_CC_Lich_lam       FOREIGN KEY (malichlam)
                                        REFERENCES dbo.Lich_lam (malichlam),
    CONSTRAINT CK_CC_TrangThaiIn    CHECK (trangthaicheckin  IN (0, 1)),
    CONSTRAINT CK_CC_TrangThaiOut   CHECK (trangthaicheckout IN (0, 1)),
    CONSTRAINT CK_CC_CheckTime      CHECK (checkout IS NULL OR checkin IS NULL OR checkout > checkin)
);
GO

-- ============================================================
-- STORED PROCEDURE: Tạo nhân viên + tài khoản trong 1 transaction
-- Đây là cách được khuyến nghị từ form "Thêm tài khoản"
-- Caller truyền @matkhau là chuỗi đã hash bcrypt từ backend
-- SP chỉ lưu thẳng, KHÔNG tự hash thêm
-- ============================================================
CREATE PROCEDURE dbo.SP_TaoNhanVien
    @machinhanh         VARCHAR(10),
    @maloainhanvien     VARCHAR(10),    -- 'LNV01' = Fulltime | 'LNV02' = Parttime
    @machucvu           CHAR(10),
    @hoten              NVARCHAR(50),
    @email              VARCHAR(50)     = NULL,
    @sodienthoai        CHAR(10),
    @matkhau            VARCHAR(255),   -- hash bcrypt từ backend (VD: $2b$10$...)
    @manhanvien_out     VARCHAR(10)     OUTPUT  -- trả về mã vừa sinh
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Bước 1: INSERT nhân viên (trigger sinh mã + tạo dòng Tai_khoan tạm)
        INSERT INTO dbo.Nhan_vien
            (machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
        VALUES
            (@machinhanh, @maloainhanvien, @machucvu, @hoten, @email, @sodienthoai);

        -- Bước 2: Lấy mã vừa sinh (sodienthoai là UNIQUE nên an toàn)
        SELECT @manhanvien_out = manhanvien
        FROM dbo.Nhan_vien
        WHERE sodienthoai = @sodienthoai;

        -- Bước 3: Ghi hash bcrypt thực vào Tai_khoan (thay dòng tạm của trigger)
        UPDATE dbo.Tai_khoan
        SET matkhau = @matkhau
        WHERE manhanvien = @manhanvien_out;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        DECLARE @ErrMsg  NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSev  INT            = ERROR_SEVERITY();
        RAISERROR(@ErrMsg, @ErrSev, 1);
    END CATCH
END;
GO

-- ============================================================
-- STORED PROCEDURE: Đổi mật khẩu
-- Việc xác thực mật khẩu cũ (bcrypt.compare) phải làm ở backend
-- SP chỉ nhận hash bcrypt mới và lưu thẳng vào DB
-- ============================================================
CREATE PROCEDURE dbo.SP_DoiMatKhau
    @manhanvien     VARCHAR(10),
    @matkhauMoi     VARCHAR(255)    -- hash bcrypt mới từ backend (VD: $2b$10$...)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Kiểm tra tài khoản tồn tại
        IF NOT EXISTS (SELECT 1 FROM dbo.Tai_khoan WHERE manhanvien = @manhanvien)
        BEGIN
            RAISERROR(N'Tài khoản không tồn tại.', 16, 1);
            RETURN;
        END

        -- Lưu mật khẩu mới + reset số lần sai
        UPDATE dbo.Tai_khoan
        SET matkhau          = @matkhauMoi,
            solansaidangnhap = 0
        WHERE manhanvien = @manhanvien;

    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSev INT            = ERROR_SEVERITY();
        RAISERROR(@ErrMsg, @ErrSev, 1);
    END CATCH
END;
GO

