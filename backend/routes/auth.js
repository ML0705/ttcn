const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, pool, poolConnect } = require('../config/db');
const auth = require('../middleware/auth');

// Lưu OTP tạm trong memory { '0901111111': { otp: '123456', expires: Date } }
const otpStore = {};

// ═══════════════════════════════════════════════════
// POST /api/auth/login
// Body: { tendangnhap, matkhau }
// tendangnhap = số điện thoại
// ═══════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  const { tendangnhap, matkhau } = req.body;

  if (!tendangnhap || !matkhau) {
    return res.status(400).json({ message: 'Vui lòng nhập đủ thông tin' });
  }

  try {
    await poolConnect;

    const result = await pool.request()
      .input('tendangnhap', sql.Char(10), tendangnhap)
      .query(`
        SELECT
          tk.manhanvien,
          tk.matkhau,
          tk.solansaidangnhap,
          tk.trangthaikhoa,
          nv.hoten,
          nv.machinhanh,
          cv.tenchucvu
        FROM Tai_khoan tk
        JOIN Nhan_vien nv ON nv.manhanvien = tk.manhanvien
        JOIN Chuc_vu   cv ON cv.machucvu   = nv.machucvu
        WHERE tk.tendangnhap = @tendangnhap
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ message: 'Thông tin không chính xác' });
    }

    // Tài khoản bị khóa
    if (user.trangthaikhoa === true || user.trangthaikhoa === 1) {
      return res.status(403).json({
        message: 'Tài khoản của bạn đã bị khóa',
        bikikhoa: true,
        capLaiMatKhau: true
      });
    }

    // Sai mật khẩu
    const hopLe = await bcrypt.compare(matkhau, user.matkhau);
    if (!hopLe) {
      const soLanMoi = user.solansaidangnhap + 1;

      if (soLanMoi >= 5) {
        await pool.request()
          .input('tendangnhap', sql.Char(10), tendangnhap)
          .query(`
            UPDATE Tai_khoan
            SET solansaidangnhap = ${soLanMoi}, trangthaikhoa = 1
            WHERE tendangnhap = @tendangnhap
          `);
        return res.status(403).json({
          message: 'Tài khoản của bạn đã bị khóa',
          bikikhoa: true
        });
      }

      await pool.request()
        .input('tendangnhap', sql.Char(10), tendangnhap)
        .query(`
          UPDATE Tai_khoan
          SET solansaidangnhap = solansaidangnhap + 1
          WHERE tendangnhap = @tendangnhap
        `);

      return res.status(401).json({
        message: 'Thông tin không chính xác',
        conLai: 5 - soLanMoi
      });
    }

    // Đăng nhập thành công — reset đếm sai
    await pool.request()
      .input('tendangnhap', sql.Char(10), tendangnhap)
      .query(`
        UPDATE Tai_khoan
        SET solansaidangnhap = 0
        WHERE tendangnhap = @tendangnhap
      `);

    const vaiTro = user.tenchucvu === 'Quản lý' ? 'manager' : 'employee';

    const token = jwt.sign(
      { manhanvien: user.manhanvien, vaiTro, machinhanh: user.machinhanh },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      vaiTro,
      manhanvien: user.manhanvien,
      hoten:      user.hoten,
      machinhanh: user.machinhanh
    });

  } catch (err) {
    console.error('❌ Lỗi login:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/auth/me
// Header: Authorization: Bearer <token>
// Trả về thông tin đầy đủ của user hiện tại — dùng để
// dựng sidebar/header (shared.js -> getCurrentUser)
// ═══════════════════════════════════════════════════
router.get('/me', auth, async (req, res) => {
  try {
    await poolConnect;

    const result = await pool.request()
      .input('manhanvien', sql.VarChar(10), req.user.manhanvien)
      .query(`
        SELECT
          nv.manhanvien,
          nv.hoten,
          nv.email,
          nv.sodienthoai,
          nv.machinhanh,
          cn.tenchinhanh,
          nv.maloainhanvien,
          lnv.tenloainhanvien,
          cv.tenchucvu
        FROM Nhan_vien nv
        JOIN Chi_nhanh      cn  ON cn.machinhanh     = nv.machinhanh
        JOIN Loai_nhan_vien lnv ON lnv.maloainhanvien = nv.maloainhanvien
        JOIN Chuc_vu        cv  ON cv.machucvu        = nv.machucvu
        WHERE nv.manhanvien = @manhanvien
      `);

    const nv = result.recordset[0];

    if (!nv) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    // vaiTro lấy từ token (đã xác định lúc login: manager/employee)
    // role: map sang quy ước dùng trong shared.js / MENU_CONFIG
    const role = req.user.vaiTro === 'manager' ? 'quanly' : 'nhanvien';

    res.json({
      manhanvien:        nv.manhanvien,
      hoten:             nv.hoten,
      email:             nv.email,
      sodienthoai:       nv.sodienthoai,
      machinhanh:        nv.machinhanh,
      tenchinhanh:       nv.tenchinhanh,
      maloainhanvien:    nv.maloainhanvien,
      tenloainhanvien:   nv.tenloainhanvien,
      tenchucvu:         nv.tenchucvu,
      vaiTro:            req.user.vaiTro,  // 'manager' | 'employee'
      role                                 // 'quanly'  | 'nhanvien'
    });

  } catch (err) {
    console.error('❌ Lỗi /me:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/auth/forgot
// Body: { sdt }
// Kiểm tra SĐT tồn tại → sinh OTP → lưu memory
// ═══════════════════════════════════════════════════
router.post('/forgot', async (req, res) => {
  const { sdt } = req.body;

  if (!sdt) {
    return res.status(400).json({ message: 'Vui lòng nhập số điện thoại' });
  }

  try {
    await poolConnect;

    const result = await pool.request()
      .input('sdt', sql.Char(10), sdt)
      .query(`
        SELECT tk.manhanvien, tk.trangthaikhoa
        FROM Tai_khoan tk
        WHERE tk.tendangnhap = @sdt
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ message: 'Tài khoản không tồn tại' });
    }

    if (!user.trangthaikhoa) {
      return res.status(400).json({ message: 'Tài khoản chưa bị khóa' });
    }

    // OTP demo
    otpStore[sdt] = {
      otp: '123456',
      expires: Date.now() + 5 * 60 * 1000
    };

    console.log(`OTP ${sdt}: 123456`);

    res.json({ message: 'Đã gửi mã xác nhận' });

  } catch (err) {
    console.error('❌ Lỗi /forgot:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/auth/verify-otp
// Body: { sdt, otp }
// ═══════════════════════════════════════════════════
router.post('/verify-otp', async (req, res) => {
  const { sdt, otp } = req.body;
  if (!sdt || !otp) return res.status(400).json({ message: 'Thiếu thông tin' });

  const record = otpStore[sdt];

  if (!record) {
    return res.status(400).json({ message: 'OTP không hợp lệ hoặc chưa được gửi' });
  }
  if (Date.now() > record.expires) {
    delete otpStore[sdt];
    return res.status(400).json({ message: 'OTP đã hết hạn. Vui lòng gửi lại.' });
  }
  if (otp !== record.otp) {
    return res.status(400).json({ message: 'Mã xác nhận không chính xác' });
  }

  otpStore[sdt].verified = true;

  res.json({ message: 'Xác nhận OTP thành công' });
});

// ═══════════════════════════════════════════════════
// POST /api/auth/reset-password
// Body: { sdt, matkhauMoi }
// ═══════════════════════════════════════════════════
router.post('/reset-password', async (req, res) => {
  const { sdt, matkhauMoi } = req.body;
  if (!sdt || !matkhauMoi) return res.status(400).json({ message: 'Thiếu thông tin' });

  const record = otpStore[sdt];
  if (!record || !record.verified) {
    return res.status(403).json({ message: 'Chưa xác thực OTP. Vui lòng thực hiện lại.' });
  }

  if (matkhauMoi.length < 8 || !/[a-zA-Z]/.test(matkhauMoi) || !/[0-9]/.test(matkhauMoi)) {
    return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự gồm cả chữ và số' });
  }

  try {
    await poolConnect;

    const hash = await bcrypt.hash(matkhauMoi, 10);

    await pool.request()
      .input('sdt',  sql.Char(10), sdt)
      .input('hash', sql.NVarChar(255), hash)
      .query(`
        UPDATE Tai_khoan
        SET matkhau          = @hash,
            trangthaikhoa    = 0,
            solansaidangnhap = 0
        WHERE tendangnhap = @sdt
      `);

    delete otpStore[sdt];

    res.json({ message: 'Mở khóa tài khoản thành công' });

  } catch (err) {
    console.error('❌ Lỗi reset-password:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;