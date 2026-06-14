const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, pool, poolConnect } = require('../config/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    console.log('🔥 ROUTE LOGIN ĐƯỢC GỌI, body:', req.body);
    const { tendangnhap, matkhau } = req.body;
  // tendangnhap = số điện thoại (VD: '0901111111')

  if (!tendangnhap || !matkhau) {
    return res.status(400).json({ message: 'Vui lòng nhập đủ thông tin' });
  }

  try {
    await poolConnect;

    // JOIN để lấy đủ thông tin: tài khoản + nhân viên + chức vụ
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
    console.log('--- DEBUG ---');
    console.log('tendangnhap nhận từ Postman:', JSON.stringify(tendangnhap));
    console.log('user trả về từ DB:', user);
    console.log('-------------');
    // Không tìm thấy tài khoản
    if (!user) {
      return res.status(401).json({ message: 'Thông tin không chính xác' });
    }

    // Tài khoản bị khóa (trangthaikhoa = 1)
    if (user.trangthaikhoa === true || user.trangthaikhoa === 1) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Liên hệ quản lý.' });
    }

    // Sai mật khẩu
    const hopLe = await bcrypt.compare(matkhau, user.matkhau);
    if (!hopLe) {
      const soLanMoi = user.solansaidangnhap + 1;

      // Nếu sai đủ 5 lần → khóa tài khoản
      if (soLanMoi >= 5) {
        await pool.request()
          .input('tendangnhap', sql.Char(10), tendangnhap)
          .query(`
            UPDATE Tai_khoan
            SET solansaidangnhap = @soLan, trangthaikhoa = 1
            WHERE tendangnhap = @tendangnhap
          `.replace('@soLan', soLanMoi));
        return res.status(403).json({ message: 'Sai quá 5 lần. Tài khoản đã bị khóa.' });
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
        conLai: 5 - soLanMoi   // Trả về frontend để hiển thị "còn X lần"
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

    // Xác định vai trò: quản lý hay nhân viên
    const vaiTro = user.tenchucvu === 'Quản lý' ? 'manager' : 'employee';

    // Tạo JWT
    const token = jwt.sign(
      {
        manhanvien: user.manhanvien,
        vaiTro,
        machinhanh: user.machinhanh
      },
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

module.exports = router;
