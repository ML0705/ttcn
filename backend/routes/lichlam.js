const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');

// ═══════════════════════════════════════════════════
// GET /api/lichlam/cacalam — Lấy danh sách ca làm
// Dùng cho dropdown khi nhân viên đăng ký ca
// ═══════════════════════════════════════════════════
router.get('/cacalam', auth, async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT RTRIM(maca) AS maca, RTRIM(tenca) AS tenca, batdau, ketthuc
      FROM Ca_lam
      ORDER BY batdau
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET cacalam:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/lichlam/tuan — Lịch tuần tới của NV đang đăng nhập
// Trả về: danh sách slot (ngày x ca) + đã đăng ký chưa
// ═══════════════════════════════════════════════════
router.get('/tuan', auth, async (req, res) => {
  const { manhanvien } = req.user;

  // Tính thứ 2 tuần tới
  const today       = new Date();
  const thu         = today.getDay(); // 0=CN, 1=T2,...,6=T7
  const soNgay      = thu === 0 ? 1 : 8 - thu; // số ngày đến T2 tuần tới
  const t2TuanToi   = new Date(today);
  t2TuanToi.setDate(today.getDate() + soNgay);
  t2TuanToi.setHours(0, 0, 0, 0);

  const t8TuanToi = new Date(t2TuanToi);
  t8TuanToi.setDate(t2TuanToi.getDate() + 7);

  try {
    await poolConnect;

    // Lấy tất cả Lich_lam tuần tới (quản lý đã tạo)
    // Kèm thông tin đã đăng ký chưa của NV hiện tại
    const result = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('tuDngay',    sql.Date,    t2TuanToi)
      .input('denNgay',    sql.Date,    t8TuanToi)
      .query(`
        SELECT
          RTRIM(ll.malichlam)       AS malichlam,
          RTRIM(ll.maca)            AS maca,
          RTRIM(cl.tenca)           AS tenca,
          ll.ngay,
          ll.thoigianbatdau,
          ll.thoigianketthuc,
          CASE WHEN dk.manhanvien IS NOT NULL THEN 1 ELSE 0 END AS daDangKy
        FROM Lich_lam ll
        JOIN Ca_lam   cl ON cl.maca = ll.maca
        LEFT JOIN Dang_ky_lich_lam dk
          ON dk.malichlam  = ll.malichlam
         AND dk.manhanvien = @manhanvien
        WHERE ll.ngay >= @tuDngay
          AND ll.ngay <  @denNgay
        ORDER BY ll.ngay, ll.thoigianbatdau
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET lichlam/tuan:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/lichlam/dangky — Nhân viên đăng ký ca
// Body: { danhSachMaLich: ['16062025C01', '17062025C02', ...] }
// Logic: xóa đăng ký cũ của tuần tới → chèn mới
// ═══════════════════════════════════════════════════
router.post('/dangky', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const { danhSachMaLich } = req.body; // mảng malichlam

  if (!Array.isArray(danhSachMaLich)) {
    return res.status(400).json({ message: 'danhSachMaLich phải là mảng' });
  }

  // Kiểm tra deadline: chỉ cho đăng ký đến hết thứ 6 tuần này
  const today = new Date();
  const thu   = today.getDay();
  if (thu === 0 || thu === 7) {
    return res.status(400).json({ message: 'Đã hết hạn đăng ký. Chỉ đăng ký từ T2 đến T6.' });
  }

  // Tính khoảng tuần tới để xóa đăng ký cũ
  const soNgay    = thu === 0 ? 1 : 8 - thu;
  const t2TuanToi = new Date(today);
  t2TuanToi.setDate(today.getDate() + soNgay);
  t2TuanToi.setHours(0, 0, 0, 0);
  const t8TuanToi = new Date(t2TuanToi);
  t8TuanToi.setDate(t2TuanToi.getDate() + 7);

  try {
    await poolConnect;

    // Bước 1: Xóa toàn bộ đăng ký cũ của NV trong tuần tới
    await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('tuNgay',     sql.Date,    t2TuanToi)
      .input('denNgay',    sql.Date,    t8TuanToi)
      .query(`
        DELETE dk
        FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien
          AND ll.ngay >= @tuNgay
          AND ll.ngay <  @denNgay
      `);

    // Bước 2: Chèn các ca mới (nếu mảng rỗng → chỉ xóa, không đăng ký gì)
    for (const malichlam of danhSachMaLich) {
      await pool.request()
        .input('manhanvien', sql.VarChar, manhanvien)
        .input('malichlam',  sql.VarChar, malichlam)
        .query(`
          INSERT INTO Dang_ky_lich_lam (manhanvien, malichlam)
          VALUES (@manhanvien, @malichlam)
        `);
    }

    res.json({
      message: `Đăng ký thành công ${danhSachMaLich.length} ca`,
      soCa:    danhSachMaLich.length
    });

  } catch (err) {
    console.error('❌ POST dangky:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/lichlam/quanly — Quản lý xem lịch toàn bộ NV
// Query: ?chinhanh=CN01&tuNgay=2025-06-16&denNgay=2025-06-20
// ═══════════════════════════════════════════════════
router.get('/quanly', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager') {
    return res.status(403).json({ message: 'Chỉ quản lý mới xem được' });
  }

  const machinhanh = req.query.chinhanh || req.user.machinhanh;
  const tuNgay     = req.query.tuNgay;
  const denNgay    = req.query.denNgay;

  try {
    await poolConnect;

    const result = await pool.request()
      .input('machinhanh', sql.VarChar, machinhanh)
      .input('tuNgay',     sql.Date,    tuNgay)
      .input('denNgay',    sql.Date,    denNgay)
      .query(`
        SELECT
          nv.manhanvien,
          nv.hoten,
          RTRIM(cl.tenca)           AS tenca,
          RTRIM(ll.malichlam)       AS malichlam,
          ll.ngay,
          ll.thoigianbatdau,
          ll.thoigianketthuc
        FROM Dang_ky_lich_lam dk
        JOIN Nhan_vien nv ON nv.manhanvien = dk.manhanvien
        JOIN Lich_lam  ll ON ll.malichlam  = dk.malichlam
        JOIN Ca_lam    cl ON cl.maca       = ll.maca
        WHERE nv.machinhanh = @machinhanh
          AND ll.ngay BETWEEN @tuNgay AND @denNgay
        ORDER BY ll.ngay, ll.thoigianbatdau, nv.hoten
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET lichlam/quanly:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/lichlam/taolich — Quản lý tạo lịch làm mới
// Body: { maca: 'C01', ngay: '2025-06-23' }
// Trigger DB tự sinh malichlam = ddmmyyyyCxx
// ═══════════════════════════════════════════════════
router.post('/taolich', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager') {
    return res.status(403).json({ message: 'Chỉ quản lý mới tạo được lịch' });
  }

  const { maca, ngay } = req.body;

  if (!maca || !ngay) {
    return res.status(400).json({ message: 'Thiếu maca hoặc ngay' });
  }

  try {
    await poolConnect;

    // Trigger DB tự sinh malichlam, không cần truyền
    await pool.request()
      .input('maca', sql.Char,  maca)
      .input('ngay', sql.Date,  ngay)
      .query(`
        INSERT INTO Lich_lam (maca, ngay)
        VALUES (@maca, @ngay)
      `);

    // Đọc lại mã vừa tạo để trả về frontend
    const r = await pool.request()
      .input('maca', sql.Char, maca)
      .input('ngay', sql.Date, ngay)
      .query(`
        SELECT RTRIM(malichlam) AS malichlam
        FROM Lich_lam
        WHERE maca = @maca AND ngay = @ngay
      `);

    res.status(201).json({
      message:   'Tạo lịch thành công',
      malichlam: r.recordset[0]?.malichlam
    });

  } catch (err) {
    console.error('❌ POST taolich:', err.message);

    if (err.message.includes('UQ_LL_NgayCa')) {
      return res.status(409).json({ message: 'Ca này ngày này đã có lịch rồi' });
    }

    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;