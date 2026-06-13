/* =============================================================
   calm.js — Quản lý ca làm
   Phụ thuộc: shared.js (load trước)
   KHI BACKEND XONG: thay các khối TODO bằng apiFetch(...)
   ============================================================= */

/* ── Mock data (đồng bộ với seed.sql) ── */
let mockCaLam = [
  {
    maca: 'C01', tenca: 'Ca sáng',
    batdau: '08:00', ketthuc: '12:00',
    loai: 'parttime',   // phù hợp loại NV
    solichdangdung: 5,
  },
  {
    maca: 'C02', tenca: 'Ca chiều',
    batdau: '13:00', ketthuc: '17:00',
    loai: 'parttime',
    solichdangdung: 4,
  },
  {
    maca: 'C03', tenca: 'Ca tối',
    batdau: '17:00', ketthuc: '21:00',
    loai: 'parttime',
    solichangdung: 2,
  },
];

/* ── State ── */
let _editingMa  = null;   // null = thêm mới
let _tkCbCalm   = null;   // local confirm callback (tránh xung đột shared.js)

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function initCaLam() {
  renderStats();
  renderList();
  bindPanelEvents();
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function renderStats() {
  const total    = mockCaLam.length;
  const parttime = mockCaLam.filter(c => c.loai === 'parttime' || c.loai === 'both').length;
  const fulltime = mockCaLam.filter(c => c.loai === 'fulltime' || c.loai === 'both').length;

  document.getElementById('st-total').textContent    = total;
  document.getElementById('st-parttime').textContent = parttime;
  document.getElementById('st-fulltime').textContent = fulltime;
}

/* ══════════════════════════════════════════
   RENDER DANH SÁCH
══════════════════════════════════════════ */
function renderList() {
  const container = document.getElementById('ca-list');
  const empty     = document.getElementById('ca-empty');

  if (mockCaLam.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = mockCaLam.map(ca => buildCard(ca)).join('');
}

function buildCard(ca) {
  const dur     = calcDuration(ca.batdau, ca.ketthuc);
  const loaiChip = loaiToChip(ca.loai);
  const usage   = ca.solichangdung ?? ca.solichangdung ?? ca.solichangdung;
  const usageNum = ca.solichangdung ?? ca.solichangdung ?? 0;

  // Đếm số lịch đang dùng (mock: lấy từ field)
  const solich = typeof ca.solichangdung === 'number'
    ? ca.solichangdung
    : (typeof ca.solichangdung === 'number' ? ca.solichangdung : 0);

  const usageCls  = solich > 0 ? '' : 'empty';
  const usageTxt  = solich > 0
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${solich} lịch đang dùng`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg> Chưa có lịch`;

  return `
  <div class="ca-card" id="card-${ca.maca}">
    <div class="ca-time-col">
      <div class="ca-time-range">${ca.batdau} – ${ca.ketthuc}</div>
      <div class="ca-duration">${dur}</div>
    </div>
    <div class="ca-info-col">
      <div class="ca-name-row">
        <span class="ca-name">${ca.tenca}</span>
        <span class="ca-code">${ca.maca}</span>
        ${loaiChip}
      </div>
      <div class="ca-meta">
        <div class="ca-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          Bắt đầu: <strong>${ca.batdau}</strong>
        </div>
        <div class="ca-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          Kết thúc: <strong>${ca.ketthuc}</strong>
        </div>
        <div class="ca-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Phù hợp: <strong>${loaiLabel(ca.loai)}</strong>
        </div>
      </div>
    </div>
    <div class="ca-usage-col">
      <div class="usage-chip ${usageCls}">${usageTxt}</div>
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
function calcDuration(batdau, ketthuc) {
  const [h1, m1] = batdau.split(':').map(Number);
  const [h2, m2] = ketthuc.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h} tiếng ${m} phút` : `${h} tiếng`;
}

function loaiLabel(loai) {
  return loai === 'fulltime' ? 'Full-time'
       : loai === 'parttime' ? 'Part-time'
       : 'Cả hai';
}

function loaiToChip(loai) {
  if (loai === 'fulltime') return `<span class="type-chip fulltime">Full-time</span>`;
  if (loai === 'parttime') return `<span class="type-chip parttime">Part-time</span>`;
  return `<span class="type-chip both">Cả hai</span>`;
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
  const ca = mockCaLam.find(c => c.maca === maca);
  if (!ca) return;
  _editingMa = maca;
  document.getElementById('panel-title').textContent = 'Chỉnh sửa ca làm';

  document.getElementById('f-tenca').value   = ca.tenca;
  document.getElementById('f-batdau').value  = ca.batdau;
  document.getElementById('f-ketthuc').value = ca.ketthuc;

  // Chọn loại
  setLoaiOption(ca.loai);
  updatePreview();

  clearErrors();
  openSidePanel('ca-panel');
}

function clearPanelForm() {
  document.getElementById('f-tenca').value   = '';
  document.getElementById('f-batdau').value  = '';
  document.getElementById('f-ketthuc').value = '';
  setLoaiOption('parttime');
  updatePreview();
  clearErrors();
}

function clearErrors() {
  ['e-tenca', 'e-batdau', 'e-ketthuc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function setLoaiOption(val) {
  document.querySelectorAll('.loai-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.val === val);
    const input = opt.querySelector('input');
    if (input) input.checked = opt.dataset.val === val;
  });
}

function getLoaiSelected() {
  const sel = document.querySelector('.loai-option.selected');
  return sel ? sel.dataset.val : 'parttime';
}

function bindPanelEvents() {
  // Chọn loại
  document.querySelectorAll('.loai-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setLoaiOption(opt.dataset.val);
    });
  });

  // Preview thời gian khi nhập
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
  const tenca  = document.getElementById('f-tenca').value.trim();
  const batdau = document.getElementById('f-batdau').value;
  const ketthuc= document.getElementById('f-ketthuc').value;

  if (!tenca) { setE('e-tenca',  'Vui lòng nhập tên ca'); ok = false; }
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

function saveCalm() {
  if (!validatePanel()) return;

  const data = {
    tenca:   document.getElementById('f-tenca').value.trim(),
    batdau:  document.getElementById('f-batdau').value,
    ketthuc: document.getElementById('f-ketthuc').value,
    loai:    getLoaiSelected(),
  };

  if (_editingMa) {
    // Cập nhật
    const idx = mockCaLam.findIndex(c => c.maca === _editingMa);
    if (idx !== -1) mockCaLam[idx] = { ...mockCaLam[idx], ...data };
    showToast(`Đã cập nhật ${data.tenca}`, 'success');
    /* TODO: await apiFetch(`/api/calm/${_editingMa}`, 'PUT', data) */
  } else {
    // Thêm mới
    const seq  = mockCaLam.length + 1;
    const maca = 'C' + String(seq).padStart(2, '0');
    mockCaLam.push({ maca, solichangdung: 0, ...data });
    showToast(`Đã tạo ${data.tenca}`, 'success');
    /* TODO: await apiFetch('/api/calm', 'POST', data) */
  }

  closeSidePanel('ca-panel');
  renderStats();
  renderList();
}

/* ══════════════════════════════════════════
   XÓA CA
══════════════════════════════════════════ */
function askDelete(maca) {
  const ca = mockCaLam.find(c => c.maca === maca);
  if (!ca) return;

  const hasUsage = (ca.solichangdung ?? 0) > 0;

  document.getElementById('confirm-icon').textContent  = hasUsage ? '⚠️' : '🗑️';
  document.getElementById('confirm-title').textContent = `Xóa "${ca.tenca}"?`;
  document.getElementById('confirm-text').textContent  = hasUsage
    ? `Ca này đang có ${ca.solichangdung} lịch làm liên kết. Xóa sẽ ảnh hưởng đến lịch của nhân viên.`
    : 'Bạn có chắc muốn xóa ca làm này?';

  _tkCbCalm = () => deleteCalm(maca);
  openModal('confirm-modal');
}

function deleteCalm(maca) {
  mockCaLam = mockCaLam.filter(c => c.maca !== maca);
  showToast('Đã xóa ca làm', 'success');
  renderStats();
  renderList();
  /* TODO: await apiFetch(`/api/calm/${maca}`, 'DELETE') */
}

/* Override confirmOk của shared.js */
function confirmOk() {
  closeModal('confirm-modal');
  if (_tkCbCalm) { _tkCbCalm(); _tkCbCalm = null; }
}