const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');
const { getGPSChiNhanh, tinhKhoangCach } = require('./utils/geocode');

const BAN_KINH_METER = 100;

// ═══════════════════════════════════════════════════
// HELPER: Ép chuẩn giờ Việt Nam (UTC+7)
// ═══════════════════════════════════════════════════
function getVnTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
}

function toSqlString(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getHomNayStr(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
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

async function kiemTraGPS(manhanvien, latitude, longitude) {
  if (!latitude || !longitude) return null;
  const chiNhanh = await getChiNhanhNV(manhanvien);
  if (!chiNhanh) return 'Không tìm thấy chi nhánh của nhân viên';
  const gps = await getGPSChiNhanh(chiNhanh.machinhanh, chiNhanh.diachi);
  const khoangCach = tinhKhoangCach(latitude, longitude, gps.lat, gps.lng);
  console.log(`📏 Khoảng cách tới chi nhánh: ${Math.round(khoangCach)}m`);
  if (khoangCach > BAN_KINH_METER) {
    return `Thất bại — bạn cách chi nhánh ${Math.round(khoangCach)}m (tối đa ${BAN_KINH_METER}m)`;
  }
  return null;
}

// ═══════════════════════════════════════════════════
// GET /api/chamcong/homnay
// ═══════════════════════════════════════════════════
router.get('/homnay', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const now    = getVnTime();
  const homNay = getHomNayStr(now);
  const thang  = now.getMonth() + 1;
  const nam    = now.getFullYear();
  const dauThang  = `${nam}-${String(thang).padStart(2,'0')}-01`;
  const cuoiThang = new Date(nam, thang, 0); 
  const cuoiThangStr = `${nam}-${String(thang).padStart(2,'0')}-${String(cuoiThang.getDate()).padStart(2,'0')}`;

  try {
    await poolConnect;

    // Ca làm hôm nay
    const lichResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('homNay',     sql.Date,    homNay)
      .query(`
        SELECT
          RTRIM(ll.malichlam) AS malichlam,
          RTRIM(cl.tenca)     AS tenca,
          -- Ép kiểu giờ về dạng chuỗi HH:mm để không bị lỗi múi giờ
          CONVERT(VARCHAR(5), ll.thoigianbatdau, 108) AS batdau,
          CONVERT(VARCHAR(5), ll.thoigianketthuc, 108) AS ketthuc
        FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        JOIN Ca_lam   cl ON cl.maca      = ll.maca
        WHERE dk.manhanvien = @manhanvien
          AND ll.ngay       = @homNay
      `);
    // Chấm công hôm nay
    let ccHomNay = null;
    if (lichResult.recordset.length > 0) {
      const malichlam = lichResult.recordset[0].malichlam;
      const ccResult = await pool.request()
        .input('manhanvien', sql.VarChar, manhanvien)
        .input('malichlam',  sql.VarChar, malichlam)
        .query(`
          SELECT checkin, checkout, trangthaicheckin, trangthaicheckout
          FROM Cham_cong
          WHERE manhanvien = @manhanvien AND malichlam = @malichlam
        `);
      ccHomNay = ccResult.recordset[0] || null;
    }

    // Thống kê tháng
    const tkResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('dauThang',   sql.Date,    dauThang)
      .input('cuoiThang',  sql.Date,    cuoiThangStr)
      .query(`
        SELECT
          COUNT(DISTINCT ll.ngay) AS soNgayLam,
          SUM(DATEDIFF(MINUTE,
            CAST(ll.thoigianbatdau AS DATETIME),
            CAST(ll.thoigianketthuc AS DATETIME)
          ) / 60.0) AS tongGioLam,
          SUM(CASE WHEN cc.trangthaicheckin = 1 THEN 1 ELSE 0 END) AS soLanDiMuon
        FROM Cham_cong cc
        JOIN Lich_lam ll ON ll.malichlam = cc.malichlam
        WHERE cc.manhanvien = @manhanvien
          AND ll.ngay BETWEEN @dauThang AND @cuoiThang
          AND cc.checkin IS NOT NULL
      `);

    const duKienResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('dauThang',   sql.Date,    dauThang)
      .input('cuoiThang',  sql.Date,    cuoiThangStr)
      .query(`
        SELECT COUNT(*) AS soNgayDuKien
        FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien
          AND ll.ngay BETWEEN @dauThang AND @cuoiThang
      `);

    const tk = tkResult.recordset[0];

    res.json({
      caHomNay: lichResult.recordset[0] || null,
      chamCong: ccHomNay,
      thongKe: {
        soNgayLam:    tk.soNgayLam    || 0,
        soNgayDuKien: duKienResult.recordset[0].soNgayDuKien || 0,
        tongGioLam:   Math.round((tk.tongGioLam || 0) * 10) / 10,
        soLanDiMuon:  tk.soLanDiMuon || 0
      }
    });

  } catch (err) {
    console.error('❌ GET chamcong/homnay:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/chamcong/checkin
// ═══════════════════════════════════════════════════
router.post('/checkin', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const { latitude, longitude } = req.body;
  const now    = getVnTime();
  const homNay = getHomNayStr(now);

  try {
    await poolConnect;

    const gpsLoi = await kiemTraGPS(manhanvien, latitude, longitude);
    if (gpsLoi) return res.status(400).json({ message: `Check-in ${gpsLoi}` });

    const lichResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('homNay',     sql.Date,    homNay)
      .query(`
        SELECT RTRIM(ll.malichlam) AS malichlam, ll.thoigianbatdau
        FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien AND ll.ngay = @homNay
      `);

    if (lichResult.recordset.length === 0)
      return res.status(400).json({ message: 'Bạn không có ca làm hôm nay' });

    const lich      = lichResult.recordset[0];
    const malichlam = lich.malichlam;

    const ccResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('malichlam',  sql.VarChar, malichlam)
      .query(`SELECT checkin FROM Cham_cong WHERE manhanvien=@manhanvien AND malichlam=@malichlam`);

    if (ccResult.recordset.length > 0 && ccResult.recordset[0].checkin !== null)
      return res.status(400).json({ message: 'Bạn đã check-in rồi' });

    const [gio, phut]      = lich.thoigianbatdau.toString().split(':').map(Number);
    const gioBD            = new Date(now); gioBD.setHours(gio, phut, 0, 0);
    const treSoPhut        = Math.floor((now.getTime() - gioBD.getTime()) / 60000);
    
    // SỬA: Lớn hơn 0 phút là tính đi muộn
    const trangthaicheckin = treSoPhut > 0 ? 1 : 0; 

    const sqlNow = toSqlString(now);

    await pool.request()
      .input('manhanvien',       sql.VarChar,  manhanvien)
      .input('malichlam',        sql.VarChar,  malichlam)
      .input('checkin',          sql.DateTime, sqlNow) 
      .input('trangthaicheckin', sql.TinyInt,  trangthaicheckin)
      .query(`
        MERGE Cham_cong AS target
        USING (SELECT @manhanvien AS manhanvien, @malichlam AS malichlam) AS source
          ON target.manhanvien = source.manhanvien AND target.malichlam = source.malichlam
        WHEN MATCHED THEN
          UPDATE SET checkin=@checkin, trangthaicheckin=@trangthaicheckin
        WHEN NOT MATCHED THEN
          INSERT (manhanvien,malichlam,checkin,trangthaicheckin)
          VALUES (@manhanvien,@malichlam,@checkin,@trangthaicheckin);
      `);

    const thongBao = trangthaicheckin === 1
      ? `Check-in thành công. Bạn đến muộn ${treSoPhut} phút.`
      : 'Check-in thành công. Đúng giờ!';

    res.json({ message: thongBao, trangthaicheckin, thoigianCheckin: sqlNow });

  } catch (err) {
    console.error('❌ POST checkin:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/chamcong/checkout
// ═══════════════════════════════════════════════════
router.post('/checkout', auth, async (req, res) => {
  const { manhanvien } = req.user;
  const { latitude, longitude } = req.body;
  const now    = getVnTime();
  const homNay = getHomNayStr(now);

  try {
    await poolConnect;

    const gpsLoi = await kiemTraGPS(manhanvien, latitude, longitude);
    if (gpsLoi) return res.status(400).json({ message: `Check-out ${gpsLoi}` });

    const ccResult = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .input('homNay',     sql.Date,    homNay)
      .query(`
        SELECT cc.malichlam, cc.checkin, ll.thoigianketthuc
        FROM Cham_cong cc
        JOIN Lich_lam ll ON ll.malichlam = cc.malichlam
        WHERE cc.manhanvien=@manhanvien AND ll.ngay=@homNay
          AND cc.checkin IS NOT NULL AND cc.checkout IS NULL
      `);

    if (ccResult.recordset.length === 0)
      return res.status(400).json({ message: 'Không tìm thấy ca cần checkout. Bạn đã check-out chưa?' });

    const cc = ccResult.recordset[0];
    
    const [gio, phut]       = cc.thoigianketthuc.toString().split(':').map(Number);
    const gioKT             = new Date(now); gioKT.setHours(gio, phut, 0, 0);
    const somPhut           = Math.floor((gioKT.getTime() - now.getTime()) / 60000);
    
    // SỬA: Ra trước > 0 phút là tính về sớm
    const trangthaicheckout = somPhut > 0 ? 1 : 0; 

    const sqlNow = toSqlString(now);

    await pool.request()
      .input('manhanvien',        sql.VarChar,  manhanvien)
      .input('malichlam',         sql.VarChar,  cc.malichlam)
      .input('checkout',          sql.DateTime, sqlNow)
      .input('trangthaicheckout', sql.TinyInt,  trangthaicheckout)
      .query(`
        UPDATE Cham_cong
        SET checkout=@checkout, trangthaicheckout=@trangthaicheckout
        WHERE manhanvien=@manhanvien AND malichlam=@malichlam
      `);

    const thongBao = trangthaicheckout === 1
      ? `Check-out thành công. Bạn về sớm ${somPhut} phút.`
      : 'Check-out thành công. Đúng giờ!';

    res.json({ message: thongBao, trangthaicheckout, thoigianCheckout: sqlNow });

  } catch (err) {
    console.error('❌ POST checkout:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/chamcong — Quản lý xem danh sách
// ═══════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Chỉ quản lý mới xem được' });

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
        SELECT dk.manhanvien, nv.hoten, RTRIM(cl.tenca) AS tenca,
          RTRIM(dk.malichlam) AS malichlam, ll.ngay,
          -- Ép kiểu giờ về dạng chuỗi HH:mm để không bị lỗi múi giờ khi serialize JSON
          CONVERT(VARCHAR(5), ll.thoigianbatdau, 108) AS thoigianbatdau,
          CONVERT(VARCHAR(5), ll.thoigianketthuc, 108) AS thoigianketthuc,
          cc.checkin, cc.checkout, cc.trangthaicheckin, cc.trangthaicheckout
        FROM Dang_ky_lich_lam dk
        JOIN Nhan_vien nv ON nv.manhanvien = dk.manhanvien
        JOIN Lich_lam  ll ON ll.malichlam  = dk.malichlam
        JOIN Ca_lam    cl ON cl.maca       = ll.maca
        LEFT JOIN Cham_cong cc ON cc.manhanvien = dk.manhanvien AND cc.malichlam = dk.malichlam
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
  if (req.user.vaiTro !== 'manager')
    return res.status(403).json({ message: 'Không có quyền' });

  const { manhanvien, malichlam } = req.params;
  const { checkin, checkout }     = req.body;

  try {
    await poolConnect;

    const lichResult = await pool.request()
      .input('malichlam', sql.VarChar, malichlam)
      .query(`SELECT thoigianbatdau, thoigianketthuc FROM Lich_lam WHERE malichlam=@malichlam`);

    if (lichResult.recordset.length === 0)
      return res.status(404).json({ message: 'Không tìm thấy lịch làm' });

    const lich  = lichResult.recordset[0];
    const tgInStr  = checkin ? toSqlString(new Date(checkin)) : null;
    const tgOutStr = checkout ? toSqlString(new Date(checkout)) : null;

    const [gioBD, phutBD] = lich.thoigianbatdau.toString().split(':').map(Number);
    const [gioKT, phutKT] = lich.thoigianketthuc.toString().split(':').map(Number);

    const tgInObj = new Date(checkin);
    const gioVaoCa = new Date(tgInObj); gioVaoCa.setHours(gioBD, phutBD, 0, 0);
    const trangthaicheckin  = (tgInObj - gioVaoCa) / 60000 > 0 ? 1 : 0; // Sửa > 5 thành > 0

    let trangthaicheckout = 0;
    if (checkout) {
      const tgOutObj = new Date(checkout);
      const gioRaCa  = new Date(tgOutObj); gioRaCa.setHours(gioKT, phutKT, 0, 0);
      trangthaicheckout = (gioRaCa - tgOutObj) / 60000 > 0 ? 1 : 0; // Sửa > 5 thành > 0
    }

    await pool.request()
      .input('manhanvien',        sql.VarChar,  manhanvien)
      .input('malichlam',         sql.VarChar,  malichlam)
      .input('checkin',           sql.DateTime, tgInStr)
      .input('checkout',          sql.DateTime, tgOutStr)
      .input('trangthaicheckin',  sql.TinyInt,  trangthaicheckin)
      .input('trangthaicheckout', sql.TinyInt,  trangthaicheckout)
      .query(`
        UPDATE Cham_cong
        SET checkin=@checkin, checkout=@checkout,
            trangthaicheckin=@trangthaicheckin, trangthaicheckout=@trangthaicheckout
        WHERE manhanvien=@manhanvien AND malichlam=@malichlam
      `);

    res.json({ message: 'Cập nhật chấm công thành công' });
  } catch (err) {
    console.error('❌ PUT chamcong:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/chamcong/lichsu — Nhân viên xem lịch sử
// ═══════════════════════════════════════════════════
router.get('/lichsu', auth, async (req, res) => {
  const { manhanvien } = req.user;
  try {
    await poolConnect;
    const result = await pool.request()
      .input('manhanvien', sql.VarChar, manhanvien)
      .query(`
        SELECT RTRIM(cl.tenca) AS tenca, ll.ngay,
          CONVERT(VARCHAR(5), ll.thoigianbatdau, 108) AS thoigianbatdau,
          CONVERT(VARCHAR(5), ll.thoigianketthuc, 108) AS thoigianketthuc,
          cc.checkin, cc.checkout, cc.trangthaicheckin, cc.trangthaicheckout
        FROM Dang_ky_lich_lam dk
        JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
        JOIN Ca_lam   cl ON cl.maca      = ll.maca
        LEFT JOIN Cham_cong cc ON cc.manhanvien = dk.manhanvien AND cc.malichlam = dk.malichlam
        WHERE dk.manhanvien = @manhanvien
        ORDER BY ll.ngay DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET lichsu:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;