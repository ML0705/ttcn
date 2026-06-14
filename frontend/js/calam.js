/* =============================================================
   calam.js — Quản lý ca làm (Kết nối API thật)
   Phụ thuộc: shared.js (load trước) — dùng apiFetch, showToast,
              openModal/closeModal, openSidePanel/closeSidePanel,
              _confirmCb
   ============================================================= */

/* ── State ── */
let caLamList  = [];   // dữ liệu thật từ GET /api/calam
let _editingMa = null;  // null = thêm mới

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function initCaLam() {
  bindPanelEvents();
  await loadCaLam();
}

/* ══════════════════════════════════════════
   LOAD DỮ LIỆU
══════════════════════════════════════════ */
async function loadCaLam() {
  try {
    caLamList = await apiFetch('/calam');
  } catch (err) {
    showToast(err.message || 'Không thể tải danh sách ca làm', 'error');
    caLamList = [];
  }
  renderStats();
  renderList();
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function renderStats() {
  document.getElementById('st-total').textContent = caLamList.length;
}

/* ══════════════════════════════════════════
   RENDER DANH SÁCH
══════════════════════════════════════════ */
function renderList() {
  const container = document.getElementById('ca-list');
  const empty     = document.getElementById('ca-empty');

  if (caLamList.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = caLamList.map(ca => buildCard(ca)).join('');
}

function buildCard(ca) {
  const dur = calcDuration(ca.batdau, ca.ketthuc);

  return `
  <div class="ca-card" id="card-${ca.maca}">
    <div class="ca-time-col">
      <div class="ca-time-range">${fmtTime(ca.batdau)} – ${fmtTime(ca.ketthuc)}</div>
      <div class="ca-duration">${dur}</div>
    </div>
    <div class="ca-info-col">
      <div class="ca-name-row">
        <span class="ca-name">${ca.tenca}</span>
        <span class="ca-code">${ca.maca}</span>
      </div>
      <div class="ca-meta">
        <div class="ca-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          Bắt đầu: <strong>${fmtTime(ca.batdau)}</strong>
        </div>
        <div class="ca-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          Kết thúc: <strong>${fmtTime(ca.ketthuc)}</strong>
        </div>
      </div>
    </div>
    <div class="ca-action-col">
      <button class="btn-ca-action edit" title="Chỉnh sửa ca" onclick="openEdit('${ca.maca}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-ca-action del" title="Xóa ca" onclick="askDelete('${ca.maca}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  </div>`;
}

/* ── Helpers ── */

// Backend trả batdau/ketthuc dạng TIME của SQL Server qua driver mssql
// -> JS Date object dạng '1970-01-01THH:MM:SS.000Z' (epoch + giờ UTC).
// KHÔNG dùng toLocaleTimeString vì nó áp timezone máy (VN=UTC+7),
// gây lệch +7h. Phải đọc UTC hours/minutes trực tiếp.
function fmtTime(val) {
  if (!val) return '--:--';

  if (typeof val === 'string') {
    // Dạng 'HH:MM:SS' thuần (hiếm khi xảy ra với driver mssql, nhưng phòng hờ)
    if (!val.includes('T') && val.includes(':')) return val.substring(0, 5);
    val = new Date(val);
  }

  const d = val instanceof Date ? val : new Date(val);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function calcDuration(batdauRaw, ketthucRaw) {
  const batdau  = fmtTime(batdauRaw);
  const ketthuc = fmtTime(ketthucRaw);
  const [h1, m1] = batdau.split(':').map(Number);
  const [h2, m2] = ketthuc.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h} tiếng ${m} phút` : `${h} tiếng`;
}

/* ══════════════════════════════════════════
   SIDE PANEL: Thêm / Sửa
══════════════════════════════════════════ */
function openAdd() {
  _editingMa = null;
  document.getElementById('panel-title').textContent = 'Tạo ca mới';
  clearPanelForm();
  openSidePanel('ca-panel');
}

function openEdit(maca) {
  const ca = caLamList.find(c => c.maca === maca);
  if (!ca) return;
  _editingMa = maca;
  document.getElementById('panel-title').textContent = 'Chỉnh sửa ca làm';

  document.getElementById('f-tenca').value   = ca.tenca;
  document.getElementById('f-batdau').value  = fmtTime(ca.batdau);
  document.getElementById('f-ketthuc').value = fmtTime(ca.ketthuc);

  updatePreview();
  clearErrors();
  openSidePanel('ca-panel');
}

function clearPanelForm() {
  document.getElementById('f-tenca').value   = '';
  document.getElementById('f-batdau').value  = '';
  document.getElementById('f-ketthuc').value = '';
  updatePreview();
  clearErrors();
}

function clearErrors() {
  ['e-tenca', 'e-batdau', 'e-ketthuc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function bindPanelEvents() {
  ['f-batdau', 'f-ketthuc'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updatePreview);
  });
}

function updatePreview() {
  const bd  = document.getElementById('f-batdau').value;
  const kt  = document.getElementById('f-ketthuc').value;
  const bar = document.getElementById('preview-bar');
  if (!bd || !kt) { bar.classList.add('hidden'); return; }
  const dur = calcDuration(bd, kt);
  if (dur === '—') { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('preview-text').textContent = `${bd} – ${kt} · ${dur}`;
}

function validatePanel() {
  let ok = true;
  const tenca   = document.getElementById('f-tenca').value.trim();
  const batdau  = document.getElementById('f-batdau').value;
  const ketthuc = document.getElementById('f-ketthuc').value;

  if (!tenca) { setE('e-tenca', 'Vui lòng nhập tên ca'); ok = false; }
  else setE('e-tenca', '');

  if (!batdau) { setE('e-batdau', 'Vui lòng chọn giờ bắt đầu'); ok = false; }
  else setE('e-batdau', '');

  if (!ketthuc) { setE('e-ketthuc', 'Vui lòng chọn giờ kết thúc'); ok = false; }
  else if (batdau && ketthuc && ketthuc <= batdau) {
    setE('e-ketthuc', 'Giờ kết thúc phải sau giờ bắt đầu');
    ok = false;
  } else setE('e-ketthuc', '');

  return ok;
}

function setE(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/* ══════════════════════════════════════════
   LƯU (THÊM / SỬA)
══════════════════════════════════════════ */
async function saveCalam() {
  if (!validatePanel()) return;

  const data = {
    tenca:   document.getElementById('f-tenca').value.trim(),
    batdau:  document.getElementById('f-batdau').value,
    ketthuc: document.getElementById('f-ketthuc').value,
  };

  const btn = document.getElementById('btn-save-ca');
  btn.disabled = true;

  try {
    if (_editingMa) {
      await apiFetch(`/calam/${_editingMa}`, 'PUT', data);
      showToast(`Đã cập nhật ${data.tenca}`, 'success');
    } else {
      await apiFetch('/calam', 'POST', data);
      showToast(`Đã tạo ${data.tenca}`, 'success');
    }

    closeSidePanel('ca-panel');
    await loadCaLam();

  } catch (err) {
    // Lỗi validate giờ (CK_CL_Gio) -> hiện ngay dưới ô giờ kết thúc
    if ((err.message || '').includes('Giờ kết thúc phải sau giờ bắt đầu')) {
      setE('e-ketthuc', err.message);
    } else {
      showToast(err.message || 'Lưu thất bại', 'error');
    }
  } finally {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════
   XÓA CA — luồng 2 bước (409 -> force=true)
══════════════════════════════════════════ */
function askDelete(maca) {
  const ca = caLamList.find(c => c.maca === maca);
  if (!ca) return;

  document.getElementById('confirm-icon').textContent  = '🗑️';
  document.getElementById('confirm-title').textContent = `Xóa "${ca.tenca}"?`;
  document.getElementById('confirm-text').textContent  = 'Bạn có chắc muốn xóa ca làm này?';

  _confirmCb = () => deleteCalam(maca, false);
  openModal('confirm-modal');
}

async function deleteCalam(maca, force) {
  try {
    const path = force ? `/calam/${maca}?force=true` : `/calam/${maca}`;
    await apiFetch(path, 'DELETE');

    showToast('Đã xóa ca làm', 'success');
    await loadCaLam();

  } catch (err) {
    // 409: còn lịch làm liên quan -> hỏi xác nhận xóa cascade
    if (err.status === 409) {
      const soLich = err.data?.soLich ?? 0;

      document.getElementById('confirm-icon').textContent  = '⚠️';
      document.getElementById('confirm-title').textContent = 'Ca này đang được sử dụng';
      document.getElementById('confirm-text').textContent  =
        `Ca này đang có ${soLich} lịch làm liên kết. Xóa sẽ xóa luôn toàn bộ lịch làm, đăng ký và chấm công liên quan. Tiếp tục?`;

      _confirmCb = () => deleteCalam(maca, true);
      openModal('confirm-modal');
      return;
    }

    showToast(err.message || 'Xóa thất bại', 'error');
  }
}