/* =============================================================
   lichlam.js — Điều phối lịch làm (Quản lý)
   Phụ thuộc: shared.js (load trước)
   KHI BACKEND XONG: thay các khối TODO bằng apiFetch(...)
   ============================================================= */

/* ── Mock data ── */

// Danh sách ca làm trong ngày (đồng bộ với seed.sql)
const MOCK_SHIFTS = [
  { maca: 'C01', tenca: 'Ca sáng',  batdau: '08:00', ketthuc: '12:00'},
  { maca: 'C02', tenca: 'Ca chiều', batdau: '13:00', ketthuc: '17:00'},
  { maca: 'C03', tenca: 'Ca tối',   batdau: '17:00', ketthuc: '21:00'},
];

// Toàn bộ nhân viên của chi nhánh
const MOCK_NHANVIEN = [
  { manv: 'NVP0001', hoten: 'Nguyễn Mỹ Hạnh', loai: 'Part-time' },
  { manv: 'NVP0002', hoten: 'Trần Minh Tú',   loai: 'Part-time' },
  { manv: 'NVF0001', hoten: 'Tạ Mai Phương',  loai: 'Full-time' },
  { manv: 'NVP0003', hoten: 'Phạm Gia Dũng',  loai: 'Part-time' },
  { manv: 'NVP0004', hoten: 'Lê Thị Bình',    loai: 'Part-time' },
  { manv: 'NVF0002', hoten: 'Đoàn Lan Anh',   loai: 'Full-time' },
  { manv: 'NVP0005', hoten: 'Vũ Quốc Huy',    loai: 'Part-time' },
  { manv: 'NVP0006', hoten: 'Bùi Thu Hằng',   loai: 'Part-time' },
];

// Đăng ký theo (ngày, maca) -> danh sách manv
// key dạng "2026-06-15_C01"
let mockDangKy = {
  '2026-06-15_C01': ['NVP0001', 'NVF0001', 'NVP0002', 'NVP0005'],
  '2026-06-15_C02': ['NVP0003', 'NVF0002', 'NVP0004'],
  '2026-06-15_C03': ['NVP0006', 'NVP0002'],

  '2026-06-16_C01': ['NVP0001', 'NVF0001', 'NVP0002'],
  '2026-06-16_C02': ['NVF0002', 'NVP0004', 'NVP0003'],
  '2026-06-16_C03': ['NVP0005'],

  '2026-06-17_C01': ['NVF0001', 'NVP0002', 'NVP0005'],
  '2026-06-17_C02': ['NVP0003', 'NVF0002'],
  '2026-06-17_C03': ['NVP0006', 'NVP0001'],

  '2026-06-18_C01': ['NVP0001', 'NVP0002'],
  '2026-06-18_C02': ['NVF0002', 'NVP0004', 'NVP0003', 'NVF0001'],
  '2026-06-18_C03': [],

  '2026-06-19_C01': ['NVF0001', 'NVP0001', 'NVP0005'],
  '2026-06-19_C02': ['NVP0003', 'NVF0002', 'NVP0004'],
  '2026-06-19_C03': ['NVP0002', 'NVP0006'],

  '2026-06-20_C01': ['NVP0002', 'NVP0005'],
  '2026-06-20_C02': ['NVF0001', 'NVP0003'],
  '2026-06-20_C03': [],

  '2026-06-21_C01': [],
  '2026-06-21_C02': [],
  '2026-06-21_C03': [],
};

// Trạng thái chốt theo tuần: key = ngày thứ 2 đầu tuần (yyyy-mm-dd)
let mockTrangThaiTuan = {
  '2026-06-15': 'draft', // 'draft' | 'locked'
};

/* ── State ── */
let currentWeekStart = null; // Date object — thứ 2 của tuần hiện tại
let _dpContext = null;       // { ngay, maca } đang mở trong modal điều phối

/* =============================================================
   HELPERS
   ============================================================= */

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = CN
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDayMonth(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtRangeLabel(start) {
  const end = addDays(start, 6);
  return `${fmtDayMonth(start)} – ${fmtDayMonth(end)}/${end.getFullYear()}`;
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() &&
         d.getMonth() === t.getMonth() &&
         d.getDate() === t.getDate();
}

function avatarColor(code) {
  const colors = ['#1D9E75', '#2980B9', '#8E44AD', '#E67E22', '#C0392B', '#16A085', '#D35400', '#2C3E50'];
  return colors[code.charCodeAt(code.length - 1) % colors.length];
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
}

function getNhanVien(manv) {
  return MOCK_NHANVIEN.find(n => n.manv === manv);
}

function getDangKy(ngay, maca) {
  const key = `${ngay}_${maca}`;
  return mockDangKy[key] || [];
}

function setDangKy(ngay, maca, list) {
  mockDangKy[`${ngay}_${maca}`] = list;
}

/* =============================================================
   LOAD DỮ LIỆU (TODO: thay bằng API)
   ============================================================= */

async function loadShifts() {
  // TODO: const res = await apiFetch('/api/calm');
  // return res;
  return MOCK_SHIFTS;
}

async function loadWeekData(weekStart) {
  // TODO: const res = await apiFetch(`/api/lichlam/tuan?start=${ymd(weekStart)}`);
  // return res;
  await new Promise(r => setTimeout(r, 250));
  return null; // dùng mock global trực tiếp
}

/* =============================================================
   RENDER BẢNG LƯỚI TUẦN
   ============================================================= */

async function renderWeek() {
  document.getElementById('week-label').textContent = fmtRangeLabel(currentWeekStart);

  await loadWeekData(currentWeekStart);

  const shifts = await loadShifts();
  const days   = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  renderTableHead(days);
  renderTableBody(shifts, days);
  renderStatusPill();
}

function renderTableHead(days) {
  const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const thead = document.getElementById('sched-thead');

  let html = `<th class="shift-label-cell" style="background:var(--surface-2);">Ca làm</th>`;
  days.forEach((d, i) => {
    const todayCls = isToday(d) ? ' today' : '';
    html += `<th class="${todayCls.trim()}">
      <div class="th-day">${dayNames[i]}</div>
      <div class="th-date">${fmtDayMonth(d)}</div>
    </th>`;
  });
  thead.innerHTML = html;
}

function renderTableBody(shifts, days) {
  const tbody = document.getElementById('sched-tbody');

  tbody.innerHTML = shifts.map(shift => {
    let row = `
      <td class="shift-label-cell">
        <div class="sl-name">${shift.tenca}</div>
        <div class="sl-time">${shift.batdau} – ${shift.ketthuc}</div>
      </td>`;

    days.forEach(d => {
        const ngay  = ymd(d);
        const dangKy = getDangKy(ngay, shift.maca);
        const count  = dangKy.length;

        let cls = count > 0 ? 'status-filled' : 'status-empty';

        row += `<td class="sched-cell">
            <button class="sched-chip ${cls}" onclick="openDieuPhoi('${ngay}','${shift.maca}')">
                <span class="chip-count">${count} NV</span>
                <span class="chip-label">${count > 0 ? 'đã đăng ký' : 'chưa có ai'}</span>
            </button>
        </td>`;
    });

    return `<tr>${row}</tr>`;
  }).join('');
}

function renderStatusPill() {
  const key = ymd(currentWeekStart);
  const status = mockTrangThaiTuan[key] || 'draft';
  const pill = document.getElementById('status-pill');
  const btnLock = document.getElementById('btn-chot-lich');

  if (status === 'locked') {
    pill.className = 'status-pill locked';
    pill.innerHTML = `<i class="pill-ic">🔒</i> Đã chốt lịch`;
    btnLock.disabled = true;
    btnLock.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Đã chốt`;
  } else {
    pill.className = 'status-pill draft';
    pill.innerHTML = `<i class="pill-ic">📝</i> Bản nháp — chưa chốt`;
    btnLock.disabled = false;
    btnLock.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Chốt lịch`;
  }
}

/* =============================================================
   ĐIỀU HƯỚNG TUẦN
   ============================================================= */

function shiftWeek(delta) {
  currentWeekStart = addDays(currentWeekStart, delta * 7);
  renderWeek();
}

/* =============================================================
   MODAL ĐIỀU PHỐI NHÂN SỰ
   ============================================================= */

async function openDieuPhoi(ngay, maca) {
  const shift = MOCK_SHIFTS.find(s => s.maca === maca);
  if (!shift) return;

  _dpContext = { ngay, maca };

  // Header info
  const d = new Date(ngay);
  const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
  document.getElementById('dp-ngay').textContent  = `${dayNames[d.getDay()]}, ${fmtDayMonth(d)}/${d.getFullYear()}`;
  document.getElementById('dp-ca').textContent    = shift.tenca;
  document.getElementById('dp-gio').textContent   = `${shift.batdau} – ${shift.ketthuc}`;

  renderDPList();
  renderDPAddSelect();

  openModal('modal-dieuphoi');
}

function renderDPList() {
  const { ngay, maca } = _dpContext;
  const dangKy = getDangKy(ngay, maca);
  const shift  = MOCK_SHIFTS.find(s => s.maca === maca);

  document.getElementById('dp-count-badge').textContent = `${dangKy.length} người`;

  const listEl = document.getElementById('dp-nv-list');

  if (dangKy.length === 0) {
    listEl.innerHTML = `<div class="dp-empty-list">Chưa có nhân viên nào đăng ký ca này</div>`;
  } else {
    listEl.innerHTML = dangKy.map(manv => {
      const nv = getNhanVien(manv);
      if (!nv) return '';
      return `
        <div class="dp-nv-item">
          <div class="dp-nv-avatar" style="background:${avatarColor(manv)}">${initials(nv.hoten)}</div>
          <div class="dp-nv-info">
            <div class="dp-nv-name">${nv.hoten}</div>
            <div class="dp-nv-meta">${nv.manv} · ${nv.loai}</div>
          </div>
          <button class="dp-nv-remove" title="Xóa khỏi ca" onclick="askRemoveNV('${manv}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>`;
    }).join('');
  }

}

function renderDPAddSelect() {
  const { ngay, maca } = _dpContext;
  const dangKy = getDangKy(ngay, maca);
  const sel = document.getElementById('dp-add-select');

  const available = MOCK_NHANVIEN.filter(nv => !dangKy.includes(nv.manv));

  if (available.length === 0) {
    sel.innerHTML = `<option value="">Tất cả nhân viên đã có trong ca</option>`;
    sel.disabled = true;
    document.getElementById('btn-dp-add').disabled = true;
  } else {
    sel.disabled = false;
    document.getElementById('btn-dp-add').disabled = false;
    sel.innerHTML = `<option value="">— Chọn nhân viên để thêm —</option>` +
      available.map(nv => `<option value="${nv.manv}">${nv.hoten} (${nv.manv} · ${nv.loai})</option>`).join('');
  }
}

function addNVToShift() {
  const sel = document.getElementById('dp-add-select');
  const manv = sel.value;
  if (!manv) return;

  const { ngay, maca } = _dpContext;
  const dangKy = getDangKy(ngay, maca);

  if (dangKy.includes(manv)) {
    showToast('Nhân viên đã có trong ca này', 'error');
    return;
  }

  setDangKy(ngay, maca, [...dangKy, manv]);
  /* TODO: await apiFetch('/api/lichlam/dieuphoi', 'POST', { ngay, maca, manv, action: 'add' }) */

  renderDPList();
  renderDPAddSelect();
  renderWeek();

  const nv = getNhanVien(manv);
  showToast(`Đã thêm ${nv.hoten} vào ca`, 'success');
}

function askRemoveNV(manv) {
  const nv = getNhanVien(manv);
  if (!nv) return;

  document.getElementById('confirm-icon').textContent  = '⚠️';
  document.getElementById('confirm-title').textContent = `Xóa ${nv.hoten}?`;
  document.getElementById('confirm-text').textContent  =
    `Nhân viên sẽ bị loại khỏi ca này và nhận được thông báo khi đăng nhập lần tiếp theo.`;

  _confirmCb = () => removeNVFromShift(manv);
  openModal('confirm-modal');
}

function removeNVFromShift(manv) {
  const { ngay, maca } = _dpContext;
  const dangKy = getDangKy(ngay, maca);

  setDangKy(ngay, maca, dangKy.filter(m => m !== manv));
  /* TODO: await apiFetch('/api/lichlam/dieuphoi', 'POST', { ngay, maca, manv, action: 'remove' }) */

  renderDPList();
  renderDPAddSelect();
  renderWeek();

  const nv = getNhanVien(manv);
  showToast(`Đã xóa ${nv.hoten} khỏi ca — thông báo sẽ được gửi`, 'success');
}

/* =============================================================
   CHỐT LỊCH
   ============================================================= */

function askChotLich() {
  const key = ymd(currentWeekStart);
  if (mockTrangThaiTuan[key] === 'locked') return;

  document.getElementById('confirm-icon').textContent  = '✅';
  document.getElementById('confirm-title').textContent = 'Chốt lịch tuần này?';
  document.getElementById('confirm-text').textContent  =
    `Lịch làm tuần ${fmtRangeLabel(currentWeekStart)} sẽ được chốt chính thức. Toàn bộ nhân viên trong tuần sẽ nhận thông báo lịch đã chốt.`;

  _confirmCb = () => chotLich();
  openModal('confirm-modal');
}

function chotLich() {
  const key = ymd(currentWeekStart);
  mockTrangThaiTuan[key] = 'locked';
  /* TODO: await apiFetch('/api/lichlam/chot', 'POST', { tuan: key }) */

  renderStatusPill();
  showToast('Đã chốt lịch — thông báo sẽ được gửi tới nhân viên', 'success');
}

/* =============================================================
   INIT
   ============================================================= */

initLayout(['quanly']).then(async user => {
  if (!user) return;

  currentWeekStart = getMondayOf(new Date('2026-06-15'));
  // Trong thực tế: currentWeekStart = getMondayOf(new Date());

  await renderWeek();

  document.getElementById('btn-prev-week').addEventListener('click', () => shiftWeek(-1));
  document.getElementById('btn-next-week').addEventListener('click', () => shiftWeek(1));
  document.getElementById('btn-chot-lich').addEventListener('click', askChotLich);
  document.getElementById('btn-dp-add').addEventListener('click', addNVToShift);

  document.getElementById('modal-dieuphoi').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-dieuphoi')) closeModal('modal-dieuphoi');
  });
});