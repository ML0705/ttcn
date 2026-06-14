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
// GET /api/calm — Danh sách ca làm
// ═══════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT
        RTRIM(maca)  AS maca,
        RTRIM(tenca) AS tenca,
        batdau,
        ketthuc
      FROM Ca_lam
      ORDER BY batdau
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ GET calm:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/calm — Thêm ca làm mới
// Trigger DB tự sinh mã C01, C02...
// Body: { tenca, batdau, ketthuc }
// ═══════════════════════════════════════════════════
router.post('/', auth, chiManager, async (req, res) => {
  const { tenca, batdau, ketthuc } = req.body;

  if (!tenca || !batdau || !ketthuc) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  try {
    await poolConnect;

    await pool.request()
      .input('tenca',   sql.NVarChar, tenca)
      .input('batdau',  sql.VarChar,  batdau)
      .input('ketthuc', sql.VarChar,  ketthuc)
      .query(`
        INSERT INTO Ca_lam (tenca, batdau, ketthuc)
        VALUES (@tenca, @batdau, @ketthuc)
      `);

    const r = await pool.request()
      .input('tenca', sql.NVarChar, tenca)
      .query(`
        SELECT RTRIM(maca) AS maca
        FROM Ca_lam
        WHERE tenca = @tenca
      `);

    res.status(201).json({
      message: 'Tạo ca làm thành công',
      maca:    r.recordset[0]?.maca
    });

  } catch (err) {
    console.error('❌ POST calm:', err.message);

    if (err.message.includes('CK_CL_Gio')) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu' });
    }

    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// PUT /api/calm/:id — Sửa ca làm
// Body: { tenca, batdau, ketthuc }
// ═══════════════════════════════════════════════════
router.put('/:id', auth, chiManager, async (req, res) => {
  const maca = req.params.id;
  const { tenca, batdau, ketthuc } = req.body;

  try {
    await poolConnect;

    await pool.request()
      .input('maca',    sql.VarChar,     maca)
      .input('tenca',   sql.NVarChar, tenca)
      .input('batdau',  sql.VarChar,  batdau)
      .input('ketthuc', sql.VarChar,  ketthuc)
      .query(`
        UPDATE Ca_lam
        SET tenca   = @tenca,
            batdau  = @batdau,
            ketthuc = @ketthuc
        WHERE maca = @maca
      `);

    res.json({ message: 'Cập nhật ca làm thành công' });

  } catch (err) {
    console.error('❌ PUT calm:', err.message);

    if (err.message.includes('CK_CL_Gio')) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu' });
    }

    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ═══════════════════════════════════════════════════
// DELETE /api/calm/:id — Xóa ca làm
//
// Luồng 2 bước:
//   Bước 1 — DELETE /api/calm/C01
//     → Nếu còn lịch làm: trả 409 + số lượng để frontend hỏi xác nhận
//     → Nếu không còn:    xóa luôn, trả 200
//
//   Bước 2 (sau khi user xác nhận) — DELETE /api/calm/C01?force=true
//     → Xóa dây chuyền: Dang_ky_lich_lam → Cham_cong → Lich_lam → Ca_lam
// ═══════════════════════════════════════════════════
router.delete('/:id', auth, chiManager, async (req, res) => {
  const maca  = req.params.id;
  const force = req.query.force === 'true';

  try {
    await poolConnect;

    // Kiểm tra còn lịch làm dùng ca này không
    const check = await pool.request()
      .input('maca', sql.VarChar, maca)
      .query(`
        SELECT COUNT(*) AS soLich FROM Lich_lam WHERE maca = @maca
      `);

    const soLich = check.recordset[0].soLich;

    // Còn lịch làm nhưng chưa có force → trả 409 để frontend xác nhận
    if (soLich > 0 && !force) {
      return res.status(409).json({
        message: `Ca này đang có ${soLich} lịch làm. Xóa hết?`,
        soLich,
        confirm: 'Gửi lại với ?force=true để xác nhận xóa toàn bộ'
      });
    }

    // force=true → xóa dây chuyền thủ công theo đúng thứ tự FK
    if (soLich > 0 && force) {
      // 1. Xóa đăng ký lịch làm liên quan
      await pool.request()
        .input('maca', sql.VarChar, maca)
        .query(`
          DELETE dk
          FROM Dang_ky_lich_lam dk
          JOIN Lich_lam ll ON ll.malichlam = dk.malichlam
          WHERE ll.maca = @maca
        `);

      // 2. Xóa chấm công liên quan
      await pool.request()
        .input('maca', sql.VarChar, maca)
        .query(`
          DELETE cc
          FROM Cham_cong cc
          JOIN Lich_lam ll ON ll.malichlam = cc.malichlam
          WHERE ll.maca = @maca
        `);

      // 3. Xóa lịch làm
      await pool.request()
        .input('maca', sql.VarChar, maca)
        .query('DELETE FROM Lich_lam WHERE maca = @maca');
    }

    // Xóa ca làm
    await pool.request()
      .input('maca', sql.VarChar, maca)
      .query('DELETE FROM Ca_lam WHERE maca = @maca');

    res.json({ message: 'Xóa ca làm thành công' });

  } catch (err) {
    console.error('❌ DELETE calm:', err.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;