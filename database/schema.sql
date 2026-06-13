-- ============================================================
-- HYGGE - HỆ THỐNG QUẢN LÝ CA LÀM & CHẤM CÔNG
-- FILE: schema_v2.sql  (có trigger sinh mã tự động)
-- DBMS: SQL Server (T-SQL)
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

-- Dọn trigger nếu chạy lại
IF OBJECT_ID('dbo.trg_Chi_nhanh_SinhMa',       'TR') IS NOT NULL DROP TRIGGER dbo.trg_Chi_nhanh_SinhMa;
IF OBJECT_ID('dbo.trg_Nhan_vien_SinhMa',        'TR') IS NOT NULL DROP TRIGGER dbo.trg_Nhan_vien_SinhMa;
IF OBJECT_ID('dbo.trg_Ca_lam_SinhMa',           'TR') IS NOT NULL DROP TRIGGER dbo.trg_Ca_lam_SinhMa;
IF OBJECT_ID('dbo.trg_Lich_lam_SinhMa',         'TR') IS NOT NULL DROP TRIGGER dbo.trg_Lich_lam_SinhMa;
GO

-- ============================================================
-- 1. CHI NHÁNH
-- Mã tự sinh: CN01, CN02, ...
-- Cột machinhanh để NULL khi INSERT → trigger điền vào
-- ============================================================
CREATE TABLE dbo.Chi_nhanh (
    machinhanh      VARCHAR(10)     NOT NULL,
    tenchinhanh     NVARCHAR(50)    NOT NULL,
    diachi          NVARCHAR(100)   NOT NULL,
    sdtcn           CHAR(10)        NULL,
    giomocua        TIME            NOT NULL,
    giodongcua      TIME            NOT NULL,
    trangthai       BIT             NOT NULL DEFAULT 1,

    CONSTRAINT PK_Chi_nhanh     PRIMARY KEY (machinhanh),
    CONSTRAINT CK_CN_Gio        CHECK (giodongcua > giomocua)
);
GO

-- Bảng đếm riêng để tránh race condition khi nhiều user INSERT cùng lúc
-- (thay vì MAX + 1 trên bảng chính — dễ bị duplicate khi concurrent)
CREATE TABLE dbo._Seq_Chi_nhanh (
    id INT IDENTITY(1,1) PRIMARY KEY
);
GO

CREATE TRIGGER dbo.trg_Chi_nhanh_SinhMa
ON dbo.Chi_nhanh
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Với mỗi dòng được INSERT, lấy 1 sequence number mới
    -- IDENTITY đảm bảo không bao giờ trùng dù nhiều session cùng INSERT
    DECLARE @rows TABLE (
        tenchinhanh  NVARCHAR(50),
        diachi       NVARCHAR(100),
        sdtcn        CHAR(10),
        giomocua     TIME,
        giodongcua   TIME,
        trangthai    BIT,
        seq          INT
    );

    -- Chèn vào bảng đếm để lấy IDENTITY
    INSERT INTO dbo._Seq_Chi_nhanh DEFAULT VALUES;

    INSERT INTO @rows (tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai, seq)
    SELECT
        i.tenchinhanh, i.diachi, i.sdtcn, i.giomocua, i.giodongcua,
        ISNULL(i.trangthai, 1),
        SCOPE_IDENTITY()   -- lấy giá trị IDENTITY vừa sinh
    FROM inserted i;

    INSERT INTO dbo.Chi_nhanh (machinhanh, tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai)
    SELECT
        'CN' + RIGHT('00' + CAST(seq AS VARCHAR(2)), 2),
        tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai
    FROM @rows;
END;
GO

-- ============================================================
-- 2. LOẠI NHÂN VIÊN  (dữ liệu tĩnh, không cần trigger)
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
-- 3. CHỨC VỤ  (dữ liệu tĩnh, không cần trigger)
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
-- Caller KHÔNG truyền manhanvien — trigger tự điền
-- ============================================================
CREATE TABLE dbo.Nhan_vien (
    manhanvien      VARCHAR(10)     NOT NULL,
    machinhanh      VARCHAR(10)     NOT NULL,
    maloainhanvien  VARCHAR(10)     NOT NULL,
    machucvu        CHAR(10)        NOT NULL,
    hoten           NVARCHAR(50)    NOT NULL,
    email           VARCHAR(50)     NULL,
    sodienthoai     CHAR(10)        NOT NULL,

    CONSTRAINT PK_Nhan_vien         PRIMARY KEY (manhanvien),
    CONSTRAINT UQ_NV_Email          UNIQUE (email),
    CONSTRAINT UQ_NV_SDT            UNIQUE (sodienthoai),
    CONSTRAINT FK_NV_Chi_nhanh      FOREIGN KEY (machinhanh)
                                        REFERENCES dbo.Chi_nhanh (machinhanh),
    CONSTRAINT FK_NV_Loai_NV        FOREIGN KEY (maloainhanvien)
                                        REFERENCES dbo.Loai_nhan_vien (maloainhanvien),
    CONSTRAINT FK_NV_Chuc_vu        FOREIGN KEY (machucvu)
                                        REFERENCES dbo.Chuc_vu (machucvu)
);
GO

-- Bảng đếm riêng theo từng loại (P / F)
CREATE TABLE dbo._Seq_Nhan_vien_P (id INT IDENTITY(1,1) PRIMARY KEY);
CREATE TABLE dbo._Seq_Nhan_vien_F (id INT IDENTITY(1,1) PRIMARY KEY);
GO

CREATE TRIGGER dbo.trg_Nhan_vien_SinhMa
ON dbo.Nhan_vien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Xử lý từng dòng inserted (đề tài thường INSERT 1 dòng / lần)
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
        -- Xác định prefix và bảng đếm theo loại
        IF @maloainhanvien = 'LNV02'   -- Parttime
        BEGIN
            INSERT INTO dbo._Seq_Nhan_vien_P DEFAULT VALUES;
            SET @seq    = SCOPE_IDENTITY();
            SET @prefix = 'NVP';
        END
        ELSE                            -- Fulltime
        BEGIN
            INSERT INTO dbo._Seq_Nhan_vien_F DEFAULT VALUES;
            SET @seq    = SCOPE_IDENTITY();
            SET @prefix = 'NVF';
        END

        SET @newMa = @prefix + RIGHT('0000' + CAST(@seq AS VARCHAR(4)), 4);

        INSERT INTO dbo.Nhan_vien
            (manhanvien, machinhanh, maloainhanvien, machucvu, hoten, email, sodienthoai)
        VALUES
            (@newMa, @machinhanh, @maloainhanvien, @machucvu, @hoten, @email, @sdt);

        FETCH NEXT FROM @cur INTO @machinhanh, @maloainhanvien, @machucvu, @hoten, @email, @sdt;
    END

    CLOSE @cur;
    DEALLOCATE @cur;
END;
GO

-- ============================================================
-- 5. TÀI KHOẢN  (không cần trigger — PK = manhanvien)
-- ============================================================
CREATE TABLE dbo.Tai_khoan (
    manhanvien          VARCHAR(10)     NOT NULL,
    tendangnhap         CHAR(10)        NOT NULL,
    matkhau             VARCHAR(255)    NOT NULL,
    solansaidangnhap    INT             NOT NULL DEFAULT 0,
    trangthaikhoa       BIT             NOT NULL DEFAULT 0,

    CONSTRAINT PK_Tai_khoan         PRIMARY KEY (manhanvien),
    CONSTRAINT UQ_TK_TenDN          UNIQUE (tendangnhap),
    CONSTRAINT FK_TK_Nhan_vien      FOREIGN KEY (manhanvien)
                                        REFERENCES dbo.Nhan_vien (manhanvien),
    CONSTRAINT CK_TK_SoLanSai       CHECK (solansaidangnhap >= 0)
);
GO

-- ============================================================
-- 6. CA LÀM
-- Mã tự sinh: C01, C02, ...
-- ============================================================
CREATE TABLE dbo.Ca_lam (
    maca    CHAR(10)        NOT NULL,
    tenca   NVARCHAR(50)    NOT NULL,
    batdau  TIME            NOT NULL,
    ketthuc TIME            NOT NULL,

    CONSTRAINT PK_Ca_lam    PRIMARY KEY (maca),
    CONSTRAINT CK_CL_Gio    CHECK (ketthuc > batdau)
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

    INSERT INTO dbo._Seq_Ca_lam DEFAULT VALUES;

    INSERT INTO dbo.Ca_lam (maca, tenca, batdau, ketthuc)
    SELECT
        'C' + RIGHT('00' + CAST(SCOPE_IDENTITY() AS VARCHAR(2)), 2),
        i.tenca, i.batdau, i.ketthuc
    FROM inserted i;
END;
GO

-- ============================================================
-- 7. LỊCH LÀM
-- Mã tự sinh: ddmmyyyy + maca  (vd: 16062025C01)
-- Snapshot thời gian từ Ca_lam
-- ============================================================
CREATE TABLE dbo.Lich_lam (
    malichlam       VARCHAR(20)     NOT NULL,
    maca            CHAR(10)        NOT NULL,
    ngay            DATE            NOT NULL,
    thoigianbatdau  TIME            NOT NULL,
    thoigianketthuc TIME            NOT NULL,

    CONSTRAINT PK_Lich_lam          PRIMARY KEY (malichlam),
    CONSTRAINT FK_LL_Ca_lam         FOREIGN KEY (maca)
                                        REFERENCES dbo.Ca_lam (maca),
    CONSTRAINT UQ_LL_NgayCa         UNIQUE (ngay, maca),
    CONSTRAINT CK_LL_ThoiGian       CHECK (thoigianketthuc > thoigianbatdau)
);
GO

CREATE TRIGGER dbo.trg_Lich_lam_SinhMa
ON dbo.Lich_lam
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Lấy snapshot giờ từ Ca_lam, sinh mã tự động
    -- Caller chỉ cần truyền: maca + ngay  (không cần malichlam, thoigianbatdau, thoigianketthuc)
    INSERT INTO dbo.Lich_lam (malichlam, maca, ngay, thoigianbatdau, thoigianketthuc)
    SELECT
        -- Sinh mã: ddmmyyyy + maca
        RIGHT('00' + CAST(DAY(i.ngay)   AS VARCHAR(2)), 2) +
        RIGHT('00' + CAST(MONTH(i.ngay) AS VARCHAR(2)), 2) +
        CAST(YEAR(i.ngay) AS VARCHAR(4)) +
        RTRIM(i.maca),

        i.maca,
        i.ngay,

        -- Snapshot từ Ca_lam (ưu tiên giá trị caller truyền nếu có, không thì lấy từ Ca_lam)
        ISNULL(i.thoigianbatdau,  c.batdau),
        ISNULL(i.thoigianketthuc, c.ketthuc)

    FROM inserted i
    INNER JOIN dbo.Ca_lam c ON c.maca = i.maca;
END;
GO

-- ============================================================
-- 8. ĐĂNG KÝ LỊCH LÀM  (không cần trigger — PK ghép)
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
-- 9. CHẤM CÔNG  (không cần trigger)
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
    CONSTRAINT CK_CC_TrangThaiIn    CHECK (trangthaicheckin    IN (0, 1)),
    CONSTRAINT CK_CC_TrangThaiOut   CHECK (trangthaicheckout   IN (0, 1)),
    CONSTRAINT CK_CC_CheckTime      CHECK (checkout IS NULL OR checkin IS NULL OR checkout > checkin)
);
GO

PRINT N'Schema v2 (có trigger) tạo thành công — HyggeDB';
GO