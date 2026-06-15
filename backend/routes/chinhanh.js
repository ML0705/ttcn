const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sql, pool, poolConnect } = require('../config/db');

const chiManager = (req, res, next) => {
  if (req.user.vaiTro !== 'manager') {
    return res.status(403).json({ message: 'Chỉ quản lý mới có quyền này' });
  }
  next();
};

// ═══════════════════════════════════════════════════
// GET /api/chinhanh — Danh sách chi nhánh
// ═══════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT
        RTRIM(machinhanh)   AS machinhanh,
        tenchinhanh,
        diachi,
        sdtcn,
        giomocua,
        giodongcua,
        trangthai
      FROM Chi_nhanh
      ORDER BY machinhanh
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET chinhanh:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/chinhanh — Thêm chi nhánh mới
// Trigger DB tự sinh mã CN01, CN02...
// Body: { tenchinhanh, diachi, sdtcn, giomocua, giodongcua }
// ═══════════════════════════════════════════════════
router.post('/', auth, chiManager, async (req, res) => {
  const { tenchinhanh, diachi, sdtcn, giomocua, giodongcua } = req.body;

  if (!tenchinhanh || !diachi || !giomocua || !giodongcua) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  try {
    await poolConnect;

    await pool.request()
      .input('tenchinhanh', sql.NVarChar, tenchinhanh)
      .input('diachi',      sql.NVarChar, diachi)
      .input('sdtcn',       sql.Char,     sdtcn || null)
      .input('giomocua',    sql.VarChar,  giomocua)
      .input('giodongcua',  sql.VarChar,  giodongcua)
      .query(`
        INSERT INTO Chi_nhanh (tenchinhanh, diachi, sdtcn, giomocua, giodongcua)
        VALUES (@tenchinhanh, @diachi, @sdtcn, @giomocua, @giodongcua)
      `);

    const r = await pool.request()
      .input('tenchinhanh', sql.NVarChar, tenchinhanh)
      .query(`
        SELECT RTRIM(machinhanh) AS machinhanh
        FROM Chi_nhanh
        WHERE tenchinhanh = @tenchinhanh
      `);

    res.status(201).json({
      message:    'Tạo chi nhánh thành công',
      machinhanh: r.recordset[0]?.machinhanh
    });

  } catch (err) {
    console.error('❌ POST chinhanh:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// PUT /api/chinhanh/:id — Sửa chi nhánh
// Body: { tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai }
// ═══════════════════════════════════════════════════
router.put('/:id', auth, chiManager, async (req, res) => {
  const machinhanh = req.params.id;
  const { tenchinhanh, diachi, sdtcn, giomocua, giodongcua, trangthai } = req.body;

  try {
    await poolConnect;

    await pool.request()
      .input('machinhanh',  sql.VarChar,  machinhanh)
      .input('tenchinhanh', sql.NVarChar, tenchinhanh)
      .input('diachi',      sql.NVarChar, diachi)
      .input('sdtcn',       sql.Char,     sdtcn || null)
      .input('giomocua',    sql.VarChar,  giomocua)
      .input('giodongcua',  sql.VarChar,  giodongcua)
      .input('trangthai',   sql.Bit,      trangthai ? 1 : 0)
      .query(`
        UPDATE Chi_nhanh
        SET tenchinhanh = @tenchinhanh,
            diachi      = @diachi,
            sdtcn       = @sdtcn,
            giomocua    = @giomocua,
            giodongcua  = @giodongcua,
            trangthai   = @trangthai
        WHERE machinhanh = @machinhanh
      `);

    res.json({ message: 'Cập nhật chi nhánh thành công' });

  } catch (err) {
    console.error('❌ PUT chinhanh:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// DELETE /api/chinhanh/:id — Xóa chi nhánh
// Chặn nếu còn nhân viên — không cascade vì nguy hiểm
// ═══════════════════════════════════════════════════
router.delete('/:id', auth, chiManager, async (req, res) => {
  const machinhanh = req.params.id;

  try {
    await poolConnect;

    const check = await pool.request()
      .input('machinhanh', sql.VarChar, machinhanh)
      .query(`
        SELECT COUNT(*) AS soNV
        FROM Nhan_vien
        WHERE machinhanh = @machinhanh
      `);

    if (check.recordset[0].soNV > 0) {
      return res.status(400).json({
        message: `Không thể xóa — chi nhánh còn ${check.recordset[0].soNV} nhân viên`
      });
    }

    await pool.request()
      .input('machinhanh', sql.VarChar, machinhanh)
      .query('DELETE FROM Chi_nhanh WHERE machinhanh = @machinhanh');

    res.json({ message: 'Xóa chi nhánh thành công' });

  } catch (err) {
    console.error('❌ DELETE chinhanh:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;