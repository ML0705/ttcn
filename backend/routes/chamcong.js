const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');
const { getGPSChiNhanh, tinhKhoangCach } = require('./utils/geocode');

const BAN_KINH_METER = 100; // Cho phép trong vòng 100m so với chi nhánh

// ═══════════════════════════════════════════════════
// HELPER — Lấy chi nhánh + địa chỉ của nhân viên
// ═══════════════════════════════════════════════════
async function getChiNhanhNV(manhanvien) {
  await poolConnect;
  const r = await pool.request()
    .input('manhanvien', sql.VarChar, manhanvien)
    .query(`
      SELECT nv.machinhanh, cn.diachi
      FROM Nhan_vien nv
      JOIN Chi_nhanh cn ON cn.machinhanh = nv.machinhanh
      WHERE nv.manhanvien = @manhanvien
    `);
  return r.recordset[0] || null;
}

// ═══════════════════════════════════════════════════
// HELPER — Kiểm tra GPS có trong bán kính chi nhánh không
// Trả về null nếu OK, trả về message lỗi nếu sai
// ═══════════════════════════════════════════════════
async function kiemTraGPS(manhanvien, latitude, longitude) {
  // Không gửi GPS → bỏ qua kiểm tra
  if (!latitude || !longitude) return null;

  const chiNhanh = await getChiNhanhNV(manhanvien);
  if (!chiNhanh) return 'Không tìm thấy chi nhánh của nhân viên';

  const gps = await getGPSChiNhanh(chiNhanh.machinhanh, chiNhanh.diachi);
  const khoangCach = tinhKhoangCach(latitude, longitude, gps.lat, gps.lng);

  console.log(`📏 Khoảng cách tới chi nhánh: ${Math.round(khoangCach)}m`);

  if (khoangCach > BAN_KINH_METER) {
    return `Thất bại — bạn cách chi nhánh ${Math.round(khoangCach)}m (tối đa ${BAN_KINH_METER}m)`;
  }

  return null; // OK
}

// ═══════════════════════════════════════════════════
// POST /api/chamcong/checkin
// Body: { latitude, longitude }   ← client gửi GPS lên
// ═══════════════════════════════════════════════════
router.post('/checkin', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const { latitude, longitude } = req.body;
  const now    = new Date();
  const homNay = now.toISOString().split('T')[0];

  try {
    await poolConnect;

    // 1. Kiểm tra GPS
    const gpsLoi = await kiemTraGPS(manhanvien, latitude, longitude);
    if (gpsLoi) {
      return res.status(400).json({ message: `Check-in ${gpsLoi}` });
    }

    // 2. Tìm lịch làm hôm nay
    const lichResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('homNay',     sql.Date,    homNay)
      .query(`
        SELECT
          RTRIM(ll.malichlam) AS malichlam,
          ll.thoigianbatdau,
          ll.thoigianketthuc
        FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien
          AND ll.ngay       = @homNay
      `);

    if (lichResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Bạn không có ca làm hôm nay' });
    }

    const lich      = lichResult.recordset[0];
    const malichlam = lich.malichlam;

    // 3. Kiểm tra đã check-in chưa
    const ccResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('malichlam',  sql.VarChar, malichlam)
      .query(`
        SELECT checkin FROM Cham_cong
        WHERE manhanvien = @manhanvien AND malichlam = @malichlam
      `);

    if (ccResult.recordset.length > 0 && ccResult.recordset[0].checkin !== null) {
      return res.status(400).json({ message: 'Bạn đã check-in rồi' });
    }

    // 4. Tính trễ
    const [gio, phut]      = lich.thoigianbatdau.toString().split(':').map(Number);
    const gioBD            = new Date(now);
    gioBD.setHours(gio, phut, 0, 0);
    const treSoPhut        = Math.floor((now - gioBD) / 60000);
    const trangthaicheckin = treSoPhut > 5 ? 1 : 0;

    // 5. Lưu chấm công
    await pool.request()
      .input('manhanvien',       sql.VarChar,  manhanvien)
      .input('malichlam',        sql.VarChar,  malichlam)
      .input('checkin',          sql.DateTime, now)
      .input('trangthaicheckin', sql.TinyInt,  trangthaicheckin)
      .query(`
        MERGE Cham_cong AS target
        USING (SELECT @manhanvien AS manhanvien, @malichlam AS malichlam) AS source
          ON target.manhanvien = source.manhanvien
         AND target.malichlam  = source.malichlam
        WHEN MATCHED THEN
          UPDATE SET checkin = @checkin, trangthaicheckin = @trangthaicheckin
        WHEN NOT MATCHED THEN
          INSERT (manhanvien, malichlam, checkin, trangthaicheckin)
          VALUES (@manhanvien, @malichlam, @checkin, @trangthaicheckin);
      `);

    const thongBao = trangthaicheckin === 1
      ? `Check-in thành công. Bạn đến muộn ${treSoPhut} phút.`
      : 'Check-in thành công. Đúng giờ!';

    res.json({ message: thongBao, trangthaicheckin, thoigianCheckin: now });

  } catch (err) {
    console.error('❌ POST checkin:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/chamcong/checkout
// Body: { latitude, longitude }
// ═══════════════════════════════════════════════════
router.post('/checkout', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const { latitude, longitude } = req.body;
  const now    = new Date();
  const homNay = now.toISOString().split('T')[0];

  try {
    await poolConnect;

    // 1. Kiểm tra GPS
    const gpsLoi = await kiemTraGPS(manhanvien, latitude, longitude);
    if (gpsLoi) {
      return res.status(400).json({ message: `Check-out ${gpsLoi}` });
    }

    // 2. Tìm bản ghi đã check-in, chưa checkout
    const ccResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('homNay',     sql.Date,    homNay)
      .query(`
        SELECT
          cc.malichlam,
          cc.checkin,
          ll.thoigianketthuc
        FROM Cham_cong cc
        JOIN Lich_lam ll ON ll.malichlam = cc.malichlam
        WHERE cc.manhanvien = @manhanvien
          AND ll.ngay       = @homNay
          AND cc.checkin    IS NOT NULL
          AND cc.checkout   IS NULL
      `);

    if (ccResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy ca cần checkout. Bạn đã check-out chưa?' });
    }

    const cc = ccResult.recordset[0];

    // 3. Tính về sớm
    const [gio, phut]       = cc.thoigianketthuc.toString().split(':').map(Number);
    const gioKT             = new Date(now);
    gioKT.setHours(gio, phut, 0, 0);
    const somPhut           = Math.floor((gioKT - now) / 60000);
    const trangthaicheckout = somPhut > 5 ? 1 : 0;

    // 4. Lưu checkout
    await pool.request()
      .input('manhanvien',        sql.VarChar,  manhanvien)
      .input('malichlam',         sql.VarChar,  cc.malichlam)
      .input('checkout',          sql.DateTime, now)
      .input('trangthaicheckout', sql.TinyInt,  trangthaicheckout)
      .query(`
        UPDATE Cham_cong
        SET checkout          = @checkout,
            trangthaicheckout = @trangthaicheckout
        WHERE manhanvien = @manhanvien
          AND malichlam  = @malichlam
      `);

    const thongBao = trangthaicheckout === 1
      ? `Check-out thành công. Bạn về sớm ${somPhut} phút.`
      : 'Check-out thành công. Đúng giờ!';

    res.json({ message: thongBao, trangthaicheckout, thoigianCheckout: now });

  } catch (err) {
    console.error('❌ POST checkout:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/chamcong — Quản lý xem danh sách chấm công
// Query: ?chinhanh=CN01&tuNgay=2025-06-16&denNgay=2025-06-20
// ═══════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
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
      .input('tuNgay',     sql.Date,    tuNgay  || '2025-01-01')
      .input('denNgay',    sql.Date,    denNgay || '2099-12-31')
      .query(`
        SELECT
          cc.manhanvien,
          nv.hoten,
          RTRIM(cl.tenca)       AS tenca,
          RTRIM(cc.malichlam)   AS malichlam,
          ll.ngay,
          ll.thoigianbatdau,
          ll.thoigianketthuc,
          cc.checkin,
          cc.checkout,
          cc.trangthaicheckin,
          cc.trangthaicheckout
        FROM Cham_cong cc
        JOIN Nhan_vien nv ON nv.manhanvien = cc.manhanvien
        JOIN Lich_lam  ll ON ll.malichlam  = cc.malichlam
        JOIN Ca_lam    cl ON cl.maca       = ll.maca
        WHERE nv.machinhanh = @machinhanh
          AND ll.ngay BETWEEN @tuNgay AND @denNgay
        ORDER BY ll.ngay DESC, nv.hoten
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET chamcong:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// PUT /api/chamcong/:manhanvien/:malichlam — Quản lý sửa giờ
// ═══════════════════════════════════════════════════
router.put('/:manhanvien/:malichlam', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager') {
    return res.status(403).json({ message: 'Không có quyền' });
  }

  const { manhanvien, malichlam } = req.params;
  const { checkin, checkout }     = req.body;

  try {
    await poolConnect;

    const lichResult = await pool.request()
      .input('malichlam', sql.VarChar, malichlam)
      .query(`
        SELECT thoigianbatdau, thoigianketthuc
        FROM Lich_lam
        WHERE malichlam = @malichlam
      `);

    if (lichResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy lịch làm' });
    }

    const lich  = lichResult.recordset[0];
    const tgIn  = new Date(checkin);
    const tgOut = checkout ? new Date(checkout) : null;

    const [gioBD, phutBD] = lich.thoigianbatdau.toString().split(':').map(Number);
    const [gioKT, phutKT] = lich.thoigianketthuc.toString().split(':').map(Number);

    const gioVaoCa = new Date(tgIn);
    gioVaoCa.setHours(gioBD, phutBD, 0, 0);

    const gioRaCa = tgOut ? new Date(tgOut) : null;
    if (gioRaCa) gioRaCa.setHours(gioKT, phutKT, 0, 0);

    const trangthaicheckin  = (tgIn - gioVaoCa) / 60000 > 5 ? 1 : 0;
    const trangthaicheckout = tgOut && gioRaCa
      ? (gioRaCa - tgOut) / 60000 > 5 ? 1 : 0
      : 0;

    await pool.request()
      .input('manhanvien',        sql.VarChar,  manhanvien)
      .input('malichlam',         sql.VarChar,  malichlam)
      .input('checkin',           sql.DateTime, tgIn)
      .input('checkout',          sql.DateTime, tgOut)
      .input('trangthaicheckin',  sql.TinyInt,  trangthaicheckin)
      .input('trangthaicheckout', sql.TinyInt,  trangthaicheckout)
      .query(`
        UPDATE Cham_cong
        SET checkin           = @checkin,
            checkout          = @checkout,
            trangthaicheckin  = @trangthaicheckin,
            trangthaicheckout = @trangthaicheckout
        WHERE manhanvien = @manhanvien
          AND malichlam  = @malichlam
      `);

    res.json({ message: 'Cập nhật chấm công thành công' });

  } catch (err) {
    console.error('❌ PUT chamcong:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/chamcong/lichsu — Nhân viên xem lịch sử của mình
// ═══════════════════════════════════════════════════
router.get('/lichsu', auth, async (req, res) => {
  const { manhanvien } = req.user;

  try {
    await poolConnect;

    const result = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .query(`
        SELECT
          RTRIM(cl.tenca)   AS tenca,
          ll.ngay,
          ll.thoigianbatdau,
          ll.thoigianketthuc,
          cc.checkin,
          cc.checkout,
          cc.trangthaicheckin,
          cc.trangthaicheckout
        FROM Cham_cong cc
        JOIN Lich_lam ll ON ll.malichlam = cc.malichlam
        JOIN Ca_lam   cl ON cl.maca      = ll.maca
        WHERE cc.manhanvien = @manhanvien
        ORDER BY ll.ngay DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET lichsu:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;