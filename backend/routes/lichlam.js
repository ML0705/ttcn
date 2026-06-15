const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');

// Lưu trạng thái chốt lịch tạm trong memory
const trangThaiStore = {};

// ═══════════════════════════════════════════════════
// HELPER — Tính thứ 2 (Monday) của tuần chứa ngày dStr
// Nhận / trả về string 'yyyy-mm-dd' — KHÔNG dùng Date object
// để tránh lệch timezone khi parse/format qua lại.
// ═══════════════════════════════════════════════════
function getMondayOfDateStr(dStr) {
  // Parse 'yyyy-mm-dd' thành các thành phần riêng, dựng Date ở UTC
  // để getDay() không bị ảnh hưởng bởi timezone local của server.
  const [y, m, d] = dStr.split('-').map(Number);
  const utcDate   = new Date(Date.UTC(y, m - 1, d));
  const day       = utcDate.getUTCDay(); // 0 = CN
  const diff      = day === 0 ? 6 : day - 1;
  utcDate.setUTCDate(utcDate.getUTCDate() - diff);
  return fmtDateUTC(utcDate);
}

// ═══════════════════════════════════════════════════
// HELPER — Cộng n ngày vào string 'yyyy-mm-dd', trả về string
// Dùng UTC nội bộ để tránh lệch timezone.
// ═══════════════════════════════════════════════════
function addDaysStr(dStr, n) {
  const [y, m, d] = dStr.split('-').map(Number);
  const utcDate   = new Date(Date.UTC(y, m - 1, d));
  utcDate.setUTCDate(utcDate.getUTCDate() + n);
  return fmtDateUTC(utcDate);
}

// ═══════════════════════════════════════════════════
// HELPER — Format Date (UTC) -> 'yyyy-mm-dd'
// ═══════════════════════════════════════════════════
function fmtDateUTC(utcDate) {
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ═══════════════════════════════════════════════════
// HELPER — Lấy ngày hôm nay dạng 'yyyy-mm-dd' theo UTC
// (giữ cách tính nhất quán với getMondayOfDateStr/addDaysStr)
// ═══════════════════════════════════════════════════
function todayStr() {
  const now = new Date();
  return fmtDateUTC(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// ═══════════════════════════════════════════════════
// HELPER — Tự động tạo Lich_lam cho 1 tuần
// Chỉ tạo cho tuần SAU tuần hiện tại trở đi
// weekStartStr: 'yyyy-mm-dd' (thứ 2 đầu tuần) — STRING, không phải Date
// ═══════════════════════════════════════════════════
async function autoTaoLichTuan(weekStartStr) {
  const thuHienTaiStr = getMondayOfDateStr(todayStr());

  console.log('weekStart:', weekStartStr);
  console.log('thuHienTai:', thuHienTaiStr);
  console.log('weekStart < thuHienTai:', weekStartStr <= thuHienTaiStr);

  // So sánh string 'yyyy-mm-dd' theo thứ tự từ điển = đúng thứ tự thời gian
  // Không tạo cho tuần hiện tại hoặc quá khứ
  if (weekStartStr < thuHienTaiStr) return;

  const caResult = await pool.request().query(`
    SELECT RTRIM(maca) AS maca FROM Ca_lam
  `);
  const danhSachCa = caResult.recordset.map(r => r.maca);
  if (danhSachCa.length === 0) return;

  for (let i = 0; i < 7; i++) {
    const ngayStr = addDaysStr(weekStartStr, i);

    for (const maca of danhSachCa) {
      try {
        await pool.request()
          .input('maca', sql.VarChar(10), maca)
          .input('ngay', sql.Date, ngayStr)
          .query(`
            IF NOT EXISTS (
              SELECT 1 FROM Lich_lam
              WHERE maca = @maca AND ngay = @ngay
            )
            INSERT INTO Lich_lam (maca, ngay)
            VALUES (@maca, @ngay)
          `);
      } catch {
        // Bỏ qua nếu trùng
      }
    }
  }

  console.log(`✅ Auto-tạo lịch tuần ${weekStartStr}`);
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

    // Tự động tạo lịch nếu tuần tương lai chưa có
    // tuNgay đã là 'yyyy-mm-dd' từ query string -> dùng thẳng, không qua Date
    await autoTaoLichTuan(getMondayOfDateStr(tuNgay));

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

  let t2TuanToiStr;
  if (req.query.start) {
    // req.query.start là 'yyyy-mm-dd' -> quy về đúng thứ 2 của tuần đó
    t2TuanToiStr = getMondayOfDateStr(req.query.start);
  } else {
    // Mặc định: thứ 2 của tuần KẾ TIẾP (tuần sau tuần hiện tại)
    const thu2TuanNay = getMondayOfDateStr(todayStr());
    t2TuanToiStr      = addDaysStr(thu2TuanNay, 7);
  }

  const t8TuanToiStr = addDaysStr(t2TuanToiStr, 7);

  try {
    await poolConnect;

    // Tự động tạo lịch nếu tuần tương lai chưa có
    await autoTaoLichTuan(t2TuanToiStr);

    const result = await pool.request()
      .input('manhanvien', sql.VarChar(10), manhanvien)
      .input('tuDngay',    sql.Date,        t2TuanToiStr)
      .input('denNgay',    sql.Date,        t8TuanToiStr)
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

  // Chỉ cho đăng ký từ T2 đến T6 (theo giờ UTC, nhất quán với todayStr)
  const now = new Date();
  const thu = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).getUTCDay();
  if (thu === 0 || thu === 6)
    return res.status(400).json({ message: 'Đã hết hạn đăng ký. Chỉ đăng ký từ T2 đến T6.' });

  // Đăng ký cho tuần KẾ TIẾP (tuần sau tuần hiện tại)
  const thu2TuanNay = getMondayOfDateStr(todayStr());
  const t2TuanToiStr = addDaysStr(thu2TuanNay, 7);
  const t8TuanToiStr = addDaysStr(t2TuanToiStr, 7);

  try {
    await poolConnect;

    await pool.request()
      .input('manhanvien', sql.VarChar(10), manhanvien)
      .input('tuNgay',     sql.Date,        t2TuanToiStr)
      .input('denNgay',    sql.Date,        t8TuanToiStr)
      .query(`
        DELETE dk FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien
          AND ll.ngay >= @tuNgay AND ll.ngay < @denNgay
      `);

    for (const malichlam of danhSachMaLich) {
      await pool.request()
        .input('manhanvien', sql.VarChar(10), manhanvien)
        .input('malichlam',  sql.VarChar(20), malichlam)
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
// ═══════════════════════════════════════════════════
router.get('/quanly', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới xem được' });

  const machinhanh = req.query.chinhanh || req.user.machinhanh;
  const tuNgay     = req.query.tuNgay;
  const denNgay    = req.query.denNgay;

  if (!tuNgay || !denNgay)
    return res.status(400).json({ message: 'Thiếu tuNgay hoặc denNgay' });

  try {
    await poolConnect;

    // Tự động tạo lịch nếu tuần tương lai chưa có
    await autoTaoLichTuan(getMondayOfDateStr(tuNgay));

    const result = await pool.request()
      .input('machinhanh', sql.VarChar(10), machinhanh)
      .input('tuNgay',     sql.Date,        tuNgay)
      .input('denNgay',    sql.Date,        denNgay)
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
      .input('maca', sql.VarChar(10), maca)
      .input('ngay', sql.Date,        ngay)
      .query(`INSERT INTO Lich_lam (maca, ngay) VALUES (@maca, @ngay)`);

    const r = await pool.request()
      .input('maca', sql.VarChar(10), maca)
      .input('ngay', sql.Date,        ngay)
      .query(`
        SELECT RTRIM(malichlam) AS malichlam
        FROM Lich_lam WHERE maca=@maca AND ngay=@ngay
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
        .input('manhanvien', sql.VarChar(10), manhanvien)
        .input('malichlam',  sql.VarChar(20), malichlam)
        .query(`
          SELECT COUNT(*) AS so FROM Dang_ky_lich_lam
          WHERE manhanvien=@manhanvien AND malichlam=@malichlam
        `);

      if (check.recordset[0].so > 0)
        return res.status(409).json({ message: 'Nhân viên đã có trong ca này' });

      await pool.request()
        .input('manhanvien', sql.VarChar(10), manhanvien)
        .input('malichlam',  sql.VarChar(20), malichlam)
        .query(`
          INSERT INTO Dang_ky_lich_lam (manhanvien, malichlam)
          VALUES (@manhanvien, @malichlam)
        `);

      res.json({ message: 'Đã thêm nhân viên vào ca' });

    } else if (action === 'remove') {
      await pool.request()
        .input('manhanvien', sql.VarChar(10), manhanvien)
        .input('malichlam',  sql.VarChar(20), malichlam)
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

  trangThaiStore[tuan] = 'locked';
  res.json({ message: 'Đã chốt lịch tuần thành công', tuan, trangThai: 'locked' });
});

// POST /api/lichlam/mochot — Mở lại lịch đã chốt
// ═══════════════════════════════════════════════════
router.post('/mochot', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới mở chốt được lịch' });

  const { tuan } = req.body;
  if (!tuan) return res.status(400).json({ message: 'Thiếu tuan' });

  // Rollback trạng thái về nháp
  trangThaiStore[tuan] = 'draft';
  res.json({ message: 'Đã mở chốt lịch thành công', tuan, trangThai: 'draft' });
});
module.exports = router;