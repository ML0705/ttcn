const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');

// Lưu trạng thái chốt lịch tạm trong memory
const trangThaiStore = {};

// ═══════════════════════════════════════════════════
// HELPER — Tính thứ 2 của tuần chứa ngày d
// ═══════════════════════════════════════════════════
function getMondayOfDate(d) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

// ═══════════════════════════════════════════════════
// HELPER — Tự động tạo Lich_lam cho 1 tuần
// Chỉ tạo cho tuần SAU tuần hiện tại trở đi
// Với mỗi ngày × mỗi ca → nếu chưa có thì INSERT
// ═══════════════════════════════════════════════════
async function autoTaoLichTuan(weekStart) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thuHienTai = getMondayOfDate(today);

  // Không tạo cho tuần hiện tại hoặc quá khứ
  if (weekStart <= thuHienTai) return;

  // Lấy tất cả ca làm hiện tại
  const caResult = await pool.request().query(`
    SELECT RTRIM(maca) AS maca FROM Ca_lam
  `);
  const danhSachCa = caResult.recordset.map(r => r.maca);

  if (danhSachCa.length === 0) return;

  // Với mỗi ngày trong tuần × mỗi ca → tạo nếu chưa có
  for (let i = 0; i < 7; i++) {
    const ngay = new Date(weekStart);
    ngay.setDate(weekStart.getDate() + i);
    const ngayStr = ngay.toISOString().slice(0, 10);

    for (const maca of danhSachCa) {
      try {
        await pool.request()
          .input('maca', sql.Char,    maca)
          .input('ngay', sql.Date,    ngayStr)
          .query(`
            IF NOT EXISTS (
              SELECT 1 FROM Lich_lam
              WHERE maca = @maca AND ngay = @ngay
            )
            INSERT INTO Lich_lam (maca, ngay)
            VALUES (@maca, @ngay)
          `);
      } catch {
        // Bỏ qua nếu trigger báo lỗi trùng
      }
    }
  }

  console.log(`✅ Auto-tạo lịch tuần ${weekStart.toISOString().slice(0,10)}`);
}

// ═══════════════════════════════════════════════════
// GET /api/lichlam/cacalam
// ═══════════════════════════════════════════════════
router.get('/cacalam', auth, async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT RTRIM(maca) AS maca, RTRIM(tenca) AS tenca, batdau, ketthuc
      FROM Ca_lam ORDER BY batdau
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET cacalam:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/lichlam/slots — Tất cả slot lịch trong tuần
// Kể cả slot chưa có ai đăng ký — dùng cho quản lý
// ═══════════════════════════════════════════════════
router.get('/slots', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới xem được' });

  const tuNgay  = req.query.tuNgay;
  const denNgay = req.query.denNgay;

  if (!tuNgay || !denNgay)
    return res.status(400).json({ message: 'Thiếu tuNgay hoặc denNgay' });

  try {
    await poolConnect;
    const result = await pool.request()
      .input('tuNgay',  sql.Date, tuNgay)
      .input('denNgay', sql.Date, denNgay)
      .query(`
        SELECT
          RTRIM(ll.malichlam) AS malichlam,
          RTRIM(ll.maca)      AS maca,
          RTRIM(cl.tenca)     AS tenca,
          ll.ngay,
          ll.thoigianbatdau,
          ll.thoigianketthuc
        FROM Lich_lam ll
        JOIN Ca_lam cl ON cl.maca = ll.maca
        WHERE ll.ngay BETWEEN @tuNgay AND @denNgay
        ORDER BY ll.ngay, ll.thoigianbatdau
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET lichlam/slots:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/lichlam/trangthai?tuan=yyyy-mm-dd
// ═══════════════════════════════════════════════════
router.get('/trangthai', auth, async (req, res) => {
  const { tuan } = req.query;
  if (!tuan) return res.status(400).json({ message: 'Thiếu tuan' });
  res.json({ tuan, trangThai: trangThaiStore[tuan] || 'draft' });
});

// ═══════════════════════════════════════════════════
// GET /api/lichlam/tuan — Lịch tuần của NV
// Tự động tạo lịch nếu là tuần tương lai và chưa có
// ═══════════════════════════════════════════════════
router.get('/tuan', auth, async (req, res) => {
  const { manhanvien } = req.user;

  let t2TuanToi;
  if (req.query.start) {
    t2TuanToi = new Date(req.query.start);
    t2TuanToi.setHours(0, 0, 0, 0);
  } else {
    const today  = new Date();
    const thu    = today.getDay();
    const soNgay = thu === 0 ? 1 : 8 - thu;
    t2TuanToi    = new Date(today);
    t2TuanToi.setDate(today.getDate() + soNgay);
    t2TuanToi.setHours(0, 0, 0, 0);
  }

  const t8TuanToi = new Date(t2TuanToi);
  t8TuanToi.setDate(t2TuanToi.getDate() + 7);

  try {
    await poolConnect;

    // Tự động tạo lịch nếu tuần tương lai chưa có
    await autoTaoLichTuan(t2TuanToi);

    const result = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('tuDngay',    sql.Date,    t2TuanToi)
      .input('denNgay',    sql.Date,    t8TuanToi)
      .query(`
        SELECT
          RTRIM(ll.malichlam) AS malichlam,
          RTRIM(ll.maca)      AS maca,
          RTRIM(cl.tenca)     AS tenca,
          ll.ngay,
          ll.thoigianbatdau,
          ll.thoigianketthuc,
          CASE WHEN dk.manhanvien IS NOT NULL THEN 1 ELSE 0 END AS daDangKy
        FROM Lich_lam ll
        JOIN Ca_lam cl ON cl.maca = ll.maca
        LEFT JOIN Dang_ky_lich_lam dk
          ON dk.malichlam  = ll.malichlam
         AND dk.manhanvien = @manhanvien
        WHERE ll.ngay >= @tuDngay AND ll.ngay < @denNgay
        ORDER BY ll.ngay, ll.thoigianbatdau
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET lichlam/tuan:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/lichlam/dangky — NV đăng ký ca
// ═══════════════════════════════════════════════════
router.post('/dangky', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const { danhSachMaLich } = req.body;

  if (!Array.isArray(danhSachMaLich))
    return res.status(400).json({ message: 'danhSachMaLich phải là mảng' });

  const today = new Date();
  const thu   = today.getDay();
  if (thu === 0 || thu === 6)
    return res.status(400).json({ message: 'Đã hết hạn đăng ký. Chỉ đăng ký từ T2 đến T6.' });

  const soNgay    = thu === 0 ? 1 : 8 - thu;
  const t2TuanToi = new Date(today);
  t2TuanToi.setDate(today.getDate() + soNgay);
  t2TuanToi.setHours(0, 0, 0, 0);
  const t8TuanToi = new Date(t2TuanToi);
  t8TuanToi.setDate(t2TuanToi.getDate() + 7);

  try {
    await poolConnect;

    await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('tuNgay',     sql.Date,    t2TuanToi)
      .input('denNgay',    sql.Date,    t8TuanToi)
      .query(`
        DELETE dk FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien
          AND ll.ngay >= @tuNgay AND ll.ngay < @denNgay
      `);

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
// Tự động tạo lịch nếu là tuần tương lai và chưa có
// ═══════════════════════════════════════════════════
router.get('/quanly', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới xem được' });

  const machinhanh = req.query.chinhanh || req.user.machinhanh;
  const tuNgay     = req.query.tuNgay;
  const denNgay    = req.query.denNgay;

  try {
    await poolConnect;

    // Tự động tạo lịch nếu tuần tương lai chưa có
    const weekStart = new Date(tuNgay);
    weekStart.setHours(0, 0, 0, 0);
    await autoTaoLichTuan(weekStart);

    const result = await pool.request()
      .input('machinhanh', sql.VarChar, machinhanh)
      .input('tuNgay',     sql.Date,    tuNgay)
      .input('denNgay',    sql.Date,    denNgay)
      .query(`
        SELECT
          nv.manhanvien,
          nv.hoten,
          RTRIM(cl.tenca)     AS tenca,
          RTRIM(ll.maca)      AS maca,
          RTRIM(ll.malichlam) AS malichlam,
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
// ═══════════════════════════════════════════════════
router.post('/taolich', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới tạo được lịch' });

  const { maca, ngay } = req.body;
  if (!maca || !ngay)
    return res.status(400).json({ message: 'Thiếu maca hoặc ngay' });

  try {
    await poolConnect;
    await pool.request()
      .input('maca', sql.Char, maca)
      .input('ngay', sql.Date, ngay)
      .query(`INSERT INTO Lich_lam (maca, ngay) VALUES (@maca, @ngay)`);

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
    if (err.message.includes('UQ_LL_NgayCa'))
      return res.status(409).json({ message: 'Ca này ngày này đã có lịch rồi' });
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/lichlam/dieuphoi — Thêm / xóa NV khỏi ca
// Body: { malichlam, manhanvien, action: 'add' | 'remove' }
// ═══════════════════════════════════════════════════
router.post('/dieuphoi', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới điều phối được' });

  const { malichlam, manhanvien, action } = req.body;
  if (!malichlam || !manhanvien || !action)
    return res.status(400).json({ message: 'Thiếu thông tin' });

  try {
    await poolConnect;

    if (action === 'add') {
      const check = await pool.request()
        .input('manhanvien', sql.VarChar, manhanvien)
        .input('malichlam',  sql.VarChar, malichlam)
        .query(`
          SELECT COUNT(*) AS so FROM Dang_ky_lich_lam
          WHERE manhanvien=@manhanvien AND malichlam=@malichlam
        `);

      if (check.recordset[0].so > 0)
        return res.status(409).json({ message: 'Nhân viên đã có trong ca này' });

      await pool.request()
        .input('manhanvien', sql.VarChar, manhanvien)
        .input('malichlam',  sql.VarChar, malichlam)
        .query(`
          INSERT INTO Dang_ky_lich_lam (manhanvien, malichlam)
          VALUES (@manhanvien, @malichlam)
        `);

      res.json({ message: 'Đã thêm nhân viên vào ca' });

    } else if (action === 'remove') {
      await pool.request()
        .input('manhanvien', sql.VarChar, manhanvien)
        .input('malichlam',  sql.VarChar, malichlam)
        .query(`
          DELETE FROM Dang_ky_lich_lam
          WHERE manhanvien=@manhanvien AND malichlam=@malichlam
        `);

      res.json({ message: 'Đã xóa nhân viên khỏi ca' });

    } else {
      res.status(400).json({ message: 'action phải là add hoặc remove' });
    }

  } catch (err) {
    console.error('❌ POST dieuphoi:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/lichlam/chot — Chốt lịch tuần
// Body: { tuan: 'yyyy-mm-dd' } — ngày thứ 2 đầu tuần
// ═══════════════════════════════════════════════════
router.post('/chot', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới chốt được lịch' });

  const { tuan } = req.body;
  if (!tuan) return res.status(400).json({ message: 'Thiếu tuan' });

  // Lưu vào memory store
  trangThaiStore[tuan] = 'locked';

  res.json({ message: 'Đã chốt lịch tuần thành công', tuan, trangThai: 'locked' });
});

module.exports = router;