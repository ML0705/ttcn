const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');

// Middleware dùng chung: chỉ manager mới vào được
const chiManager = (req, res, next) => {
  if (req.user.vaiTro !== 'manager') {
    return res.status(403).json({ message: 'Chỉ quản lý mới có quyền này' });
  }
  next();
};

// ═══════════════════════════════════════════════════
// GET /api/taikhoan
// Quản lý xem danh sách toàn bộ nhân viên chi nhánh mình
// ═══════════════════════════════════════════════════
router.get('/', auth, chiManager, async (req, res) => {
  try {
    await poolConnect;

    const result = await pool.request()
      .input('machinhanh', sql.VarChar, req.user.machinhanh)
      .query(`
        SELECT
          nv.manhanvien,
          nv.hoten,
          nv.sodienthoai,
          nv.email,
          nv.machinhanh,
          RTRIM(cn.tenchinhanh)        AS tenchinhanh,
          RTRIM(cv.tenchucvu)          AS tenchucvu,
          RTRIM(lnv.tenloainhanvien)   AS tenloainhanvien,
          RTRIM(nv.machucvu)           AS machucvu,
          RTRIM(nv.maloainhanvien)     AS maloainhanvien,
          tk.trangthaikhoa
        FROM Nhan_vien nv
        JOIN Tai_khoan      tk  ON tk.manhanvien      = nv.manhanvien
        JOIN Chi_nhanh      cn  ON cn.machinhanh      = nv.machinhanh
        JOIN Chuc_vu        cv  ON cv.machucvu        = nv.machucvu
        JOIN Loai_nhan_vien lnv ON lnv.maloainhanvien = nv.maloainhanvien
        WHERE nv.machinhanh = @machinhanh
        ORDER BY nv.manhanvien
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET taikhoan:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/taikhoan — Thêm nhân viên mới
// Gọi SP_TaoNhanVien, backend hash mật khẩu trước
// Body: { hoten, sodienthoai, email, matkhau, machinhanh, machucvu, maloainhanvien }
// ═══════════════════════════════════════════════════
router.post('/', auth, chiManager, async (req, res) => {
  const {
    hoten, sodienthoai, email, matkhau,
    machinhanh, machucvu, maloainhanvien
  } = req.body;

  if (!hoten || !sodienthoai || !matkhau || !machinhanh || !machucvu || !maloainhanvien) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  try {
    // Hash mật khẩu trước khi đẩy vào SP
    const hash = await bcrypt.hash(matkhau, 10);

    await poolConnect;

    const result = await pool.request()
      .input('machinhanh',      sql.VarChar,  machinhanh)
      .input('maloainhanvien',  sql.VarChar,  maloainhanvien)
      .input('machucvu',        sql.Char,     machucvu)
      .input('hoten',           sql.NVarChar, hoten)
      .input('email',           sql.VarChar,  email || null)
      .input('sodienthoai',     sql.Char,     sodienthoai)
      .input('matkhau',         sql.VarChar,  hash)
      .output('manhanvien_out', sql.VarChar(10))
      .execute('SP_TaoNhanVien');

    res.status(201).json({
      message:    'Tạo nhân viên thành công',
      manhanvien: result.output.manhanvien_out
    });

  } catch (err) {
    console.error('❌ POST taikhoan:', err.message);

    if (err.message.includes('UQ_NV_SDT')) {
      return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
    }
    if (err.message.includes('UQ_NV_Email')) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// PUT /api/taikhoan/:id — Sửa thông tin nhân viên
// Gọi SP_CapNhatNhanVien
// Body: { hoten, sodienthoai, email, machinhanh, machucvu, maloainhanvien, matkhauMoi? }
// matkhauMoi bỏ trống hoặc không gửi → SP giữ nguyên mật khẩu cũ
// ═══════════════════════════════════════════════════
router.put('/:id', auth, chiManager, async (req, res) => {
  const manhanvien = req.params.id;
  const {
    hoten, sodienthoai, email,
    machinhanh, machucvu, maloainhanvien,
    matkhauMoi
  } = req.body;

  try {
    // Hash mật khẩu mới nếu có, không thì truyền null → SP không đổi
    let hashMoi = null;
    if (matkhauMoi && matkhauMoi.trim() !== '') {
      hashMoi = await bcrypt.hash(matkhauMoi, 10);
    }

    await poolConnect;

    await pool.request()
      .input('manhanvien',     sql.VarChar,  manhanvien)
      .input('machinhanh',     sql.VarChar,  machinhanh)
      .input('maloainhanvien', sql.VarChar,  maloainhanvien)
      .input('machucvu',       sql.Char,     machucvu)
      .input('hoten',          sql.NVarChar, hoten)
      .input('email',          sql.VarChar,  email || null)
      .input('sodienthoai',    sql.Char,     sodienthoai)
      .input('matkhauMoi',     sql.VarChar,  hashMoi)
      .execute('SP_CapNhatNhanVien');

    res.json({ message: 'Cập nhật nhân viên thành công' });

  } catch (err) {
    console.error('❌ PUT taikhoan:', err.message);

    if (err.message.includes('không tồn tại')) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại' });
    }
    if (err.message.includes('UQ_NV_SDT')) {
      return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
    }

    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// DELETE /api/taikhoan/:id — Xóa nhân viên
// Gọi SP_XoaNhanVien
// Cascade tự xóa: Tai_khoan, Dang_ky_lich_lam, Cham_cong
// ═══════════════════════════════════════════════════
router.delete('/:id', auth, chiManager, async (req, res) => {
  const manhanvien = req.params.id;

  // Không cho xóa chính mình
  if (req.user.manhanvien === manhanvien) {
    return res.status(400).json({ message: 'Không thể xóa tài khoản đang đăng nhập' });
  }

  try {
    await poolConnect;

    await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .execute('SP_XoaNhanVien');

    res.json({ message: 'Xóa nhân viên thành công' });

  } catch (err) {
    console.error('❌ DELETE taikhoan:', err.message);

    if (err.message.includes('không tồn tại')) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại' });
    }

    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;