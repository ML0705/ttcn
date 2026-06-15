/* =============================================================
   lichlam.js — Điều phối lịch làm (Quản lý)
   ============================================================= */

let currentWeekStart = null;
let _dpContext       = null;
let shiftList        = [];
let nhanVienList     = [];
let weekData         = {};
let malichlamMap     = {};
let trangThaiTuan    = {};

/* ── Helpers ngày tháng (không bị lệch timezone) ── */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(date, n) {
  // Dùng getFullYear/Month/Date để tránh DST/timezone
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  return d;
}

function getMondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=CN, 1=T2...
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function fmtDayMonth(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function fmtRangeLabel(start) {
  const end = addDays(start, 6);
  return `${fmtDayMonth(start)} – ${fmtDayMonth(end)}/${end.getFullYear()}`;
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear()===t.getFullYear() &&
         d.getMonth()===t.getMonth() &&
         d.getDate()===t.getDate();
}

function avatarColor(code) {
  const colors = ['#1D9E75','#2980B9','#8E44AD','#E67E22','#C0392B','#16A085','#D35400','#2C3E50'];
  return colors[(code||'').charCodeAt((code||'').length-1) % colors.length];
}

function initials(name) {
  return (name||'?').split(' ').map(w=>w[0]).slice(-2).join('').toUpperCase();
}

function formatTime(val) {
  if (!val) return '';
  if (val.includes('T')) return val.split('T')[1].substring(0, 5);
  return val.substring(0, 5);
}

/* ── Load dữ liệu ── */
async function loadShifts() {
  shiftList = await apiFetch('/calam');
}

async function loadNhanVien() {
  nhanVienList = await apiFetch('/taikhoan');
}

async function loadWeekData(weekStart) {
  const tuNgay  = ymd(weekStart);
  const denNgay = ymd(addDays(weekStart, 6));

  weekData     = {};
  malichlamMap = {};

  // 1. Lấy tất cả slot lịch trong tuần (kể cả chưa có ai đăng ký)
  try {
    const slots = await apiFetch(`/lichlam/slots?tuNgay=${tuNgay}&denNgay=${denNgay}`);
    slots.forEach(s => {
      const ngay = s.ngay.slice(0, 10);
      const key  = `${ngay}_${s.maca}`;
      malichlamMap[key] = s.malichlam;
      if (!weekData[key]) weekData[key] = [];
    });
  } catch (err) {
    console.warn('Không lấy được slots:', err.message);
  }

  // 2. Lấy danh sách NV đã đăng ký, gắn vào đúng slot
  try {
    const rows = await apiFetch(`/lichlam/quanly?tuNgay=${tuNgay}&denNgay=${denNgay}`);
    rows.forEach(r => {
      const ngay = r.ngay.slice(0, 10);
      const key  = `${ngay}_${r.maca}`;
      if (!weekData[key]) weekData[key] = [];
      if (!malichlamMap[key]) malichlamMap[key] = r.malichlam;
      if (!weekData[key].find(n => n.manhanvien === r.manhanvien)) {
        weekData[key].push(r);
      }
    });
  } catch (err) {
    console.warn('Không lấy được đăng ký:', err.message);
  }
}

function getDangKy(ngay, maca) {
  return weekData[`${ngay}_${maca}`] || [];
}

/* ── Render bảng tuần ── */
async function renderWeek() {
  document.getElementById('week-label').textContent = fmtRangeLabel(currentWeekStart);

  try {
    await loadWeekData(currentWeekStart);
  } catch (err) {
    showToast('Không thể tải lịch tuần: ' + err.message, 'error');
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  renderTableHead(days);
  renderTableBody(days);
  renderStatusPill();
}

function renderTableHead(days) {
  const dayNames = ['T2','T3','T4','T5','T6','T7','CN'];
  let html = `<th class="shift-label-cell" style="background:var(--surface-2);">Ca làm</th>`;
  days.forEach((d, i) => {
    const todayCls = isToday(d) ? 'today' : '';
    html += `<th class="${todayCls}">
      <div class="th-day">${dayNames[i]}</div>
      <div class="th-date">${fmtDayMonth(d)}</div>
    </th>`;
  });
  document.getElementById('sched-thead').innerHTML = html;
}

function renderTableBody(days) {
  const tbody = document.getElementById('sched-tbody');
  if (!shiftList.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--ink-muted)">Chưa có ca làm nào</td></tr>`;
    return;
  }

  tbody.innerHTML = shiftList.map(shift => {
    let row = `<td class="shift-label-cell">
      <div class="sl-name">${shift.tenca}</div>
      <div class="sl-time">${formatTime(shift.batdau)} – ${formatTime(shift.ketthuc)}</div>
    </td>`;

    days.forEach(d => {
      const ngay   = ymd(d);
      const dangKy = getDangKy(ngay, shift.maca);
      const count  = dangKy.length;
      const cls    = count > 0 ? 'status-filled' : 'status-empty';

      row += `<td class="sched-cell">
        <button class="sched-chip ${cls}"
                onclick="openDieuPhoi('${ngay}','${shift.maca}')">
          <span class="chip-count">${count} NV</span>
          <span class="chip-label">${count > 0 ? 'đã đăng ký' : 'chưa có ai'}</span>
        </button>
      </td>`;
    });

    return `<tr>${row}</tr>`;
  }).join('');
}

// ── ĐÃ SỬA: Biến nút thành công tắc Chốt / Mở chốt ──
function renderStatusPill() {
  const key    = ymd(currentWeekStart);
  const status = trangThaiTuan[key] || 'draft';
  const pill   = document.getElementById('status-pill');
  const btn    = document.getElementById('btn-chot-lich');

  // Clone lại nút để xóa sạch các sự kiện click cũ
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  if (status === 'locked') {
    pill.className = 'status-pill locked';
    pill.innerHTML = `<i class="pill-ic">🔒</i> Đã chốt lịch`;
    
    // Nút biến thành Mở chốt
    newBtn.disabled   = false;
    newBtn.className  = 'btn btn-outline'; 
    newBtn.innerHTML  = `🔓 Mở chốt lịch`;
    newBtn.addEventListener('click', askMoChotLich);
  } else {
    pill.className = 'status-pill draft';
    pill.innerHTML = `<i class="pill-ic">📝</i> Bản nháp — chưa chốt`;
    
    // Nút biến thành Chốt lịch
    newBtn.disabled   = false;
    newBtn.className  = 'btn btn-primary';
    newBtn.innerHTML  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Chốt lịch`;
    newBtn.addEventListener('click', askChotLich);
  }
}

/* ── Điều hướng tuần ── */
function shiftWeek(delta) {
  currentWeekStart = addDays(currentWeekStart, delta * 7);
  renderWeek();
}

/* ── Modal điều phối ── */
async function openDieuPhoi(ngay, maca) {
  // ── ĐÃ SỬA: Chặn không cho mở Modal nếu lịch đã khóa ──
  const weekKey = ymd(currentWeekStart);
  if (trangThaiTuan[weekKey] === 'locked') {
    showToast('Lịch tuần này đã chốt. Vui lòng Mở chốt trước khi chỉnh sửa!', 'warning');
    return;
  }

  const shift = shiftList.find(s => s.maca === maca);
  if (!shift) return;

  let malichlam = malichlamMap[`${ngay}_${maca}`];
  if (!malichlam) {
    try {
      const r = await apiFetch('/lichlam/taolich', 'POST', { maca, ngay });
      malichlam = r.malichlam;
      malichlamMap[`${ngay}_${maca}`] = malichlam;
      if (!weekData[`${ngay}_${maca}`]) weekData[`${ngay}_${maca}`] = [];
    } catch (err) {
      if (err.message.includes('đã có lịch')) {
        await loadWeekData(currentWeekStart);
        malichlam = malichlamMap[`${ngay}_${maca}`];
      }
      if (!malichlam) {
        showToast('Không thể lấy thông tin lịch: ' + err.message, 'error');
        return;
      }
    }
  }

  _dpContext = { ngay, maca, malichlam };

  // Fix timezone khi parse ngày từ string
  const parts = ngay.split('-');
  const d = new Date(+parts[0], +parts[1]-1, +parts[2]);
  const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
  document.getElementById('dp-ngay').textContent = `${dayNames[d.getDay()]}, ${fmtDayMonth(d)}/${d.getFullYear()}`;
  document.getElementById('dp-ca').textContent   = shift.tenca;
  document.getElementById('dp-gio').textContent  = `${formatTime(shift.batdau)} – ${formatTime(shift.ketthuc)}`;

  renderDPList();
  renderDPAddSelect();
  openModal('modal-dieuphoi');
}

function renderDPList() {
  const { ngay, maca } = _dpContext;
  const dangKy = getDangKy(ngay, maca);

  document.getElementById('dp-count-badge').textContent = `${dangKy.length} người`;

  const listEl = document.getElementById('dp-nv-list');
  if (dangKy.length === 0) {
    listEl.innerHTML = `<div class="dp-empty-list">Chưa có nhân viên nào đăng ký ca này</div>`;
    return;
  }

  listEl.innerHTML = dangKy.map(nv => `
    <div class="dp-nv-item">
      <div class="dp-nv-avatar" style="background:${avatarColor(nv.manhanvien)}">
        ${initials(nv.hoten)}
      </div>
      <div class="dp-nv-info">
        <div class="dp-nv-name">${nv.hoten}</div>
        <div class="dp-nv-meta">${nv.manhanvien}</div>
      </div>
      <button class="dp-nv-remove" title="Xóa khỏi ca"
              onclick="askRemoveNV('${nv.manhanvien}','${nv.hoten}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>`).join('');
}

function renderDPAddSelect() {
  const { ngay, maca } = _dpContext;
  const dangKy    = getDangKy(ngay, maca);
  const dangKyIds = dangKy.map(n => n.manhanvien);
  const available = nhanVienList.filter(nv => !dangKyIds.includes(nv.manhanvien));
  const sel       = document.getElementById('dp-add-select');
  const btn       = document.getElementById('btn-dp-add');

  if (available.length === 0) {
    sel.innerHTML = `<option value="">Tất cả nhân viên đã có trong ca</option>`;
    sel.disabled  = true;
    btn.disabled  = true;
  } else {
    sel.disabled  = false;
    btn.disabled  = false;
    sel.innerHTML = `<option value="">— Chọn nhân viên để thêm —</option>` +
      available.map(nv =>
        `<option value="${nv.manhanvien}">${nv.hoten} (${nv.manhanvien})</option>`
      ).join('');
  }
}

async function addNVToShift() {
  const sel        = document.getElementById('dp-add-select');
  const manhanvien = sel.value;
  if (!manhanvien) return;

  const { malichlam, ngay, maca } = _dpContext;
  const btn = document.getElementById('btn-dp-add');
  btn.disabled = true;

  try {
    await apiFetch('/lichlam/dieuphoi', 'POST', { malichlam, manhanvien, action: 'add' });

    const nv  = nhanVienList.find(n => n.manhanvien === manhanvien);
    const key = `${ngay}_${maca}`;
    if (!weekData[key]) weekData[key] = [];
    weekData[key].push({ manhanvien, hoten: nv?.hoten || manhanvien, malichlam });

    renderDPList();
    renderDPAddSelect();
    renderTableBody(Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)));
    showToast(`Đã thêm ${nv?.hoten || manhanvien} vào ca`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function askRemoveNV(manhanvien, hoten) {
  document.getElementById('confirm-icon').textContent  = '⚠️';
  document.getElementById('confirm-title').textContent = `Xóa ${hoten}?`;
  document.getElementById('confirm-text').textContent  = 'Nhân viên sẽ bị loại khỏi ca này.';
  _confirmCb = () => removeNVFromShift(manhanvien, hoten);
  openModal('confirm-modal');
}

async function removeNVFromShift(manhanvien, hoten) {
  const { malichlam, ngay, maca } = _dpContext;

  try {
    await apiFetch('/lichlam/dieuphoi', 'POST', { malichlam, manhanvien, action: 'remove' });

    const key = `${ngay}_${maca}`;
    if (weekData[key]) weekData[key] = weekData[key].filter(n => n.manhanvien !== manhanvien);

    renderDPList();
    renderDPAddSelect();
    renderTableBody(Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)));
    showToast(`Đã xóa ${hoten} khỏi ca`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Chốt lịch ── */
function askChotLich() {
  const key = ymd(currentWeekStart);
  if (trangThaiTuan[key] === 'locked') return;

  document.getElementById('confirm-icon').textContent  = '✅';
  document.getElementById('confirm-title').textContent = 'Chốt lịch tuần này?';
  document.getElementById('confirm-text').textContent  =
    `Lịch tuần ${fmtRangeLabel(currentWeekStart)} sẽ được chốt chính thức.`;

  _confirmCb = () => chotLich();
  openModal('confirm-modal');
}

async function chotLich() {
  const key = ymd(currentWeekStart);
  try {
    await apiFetch('/lichlam/chot', 'POST', { tuan: key });
    trangThaiTuan[key] = 'locked';
    renderStatusPill();
    showToast('Đã chốt lịch thành công', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── ĐÃ SỬA: Thêm cụm hàm Mở Chốt ──
function askMoChotLich() {
  document.getElementById('confirm-icon').textContent  = '🔓';
  document.getElementById('confirm-title').textContent = 'Mở chốt lịch tuần này?';
  document.getElementById('confirm-text').textContent  = 'Lịch sẽ được chuyển về dạng bản nháp để bạn có thể thêm/xóa nhân viên.';

  _confirmCb = () => moChotLich();
  openModal('confirm-modal');
}

async function moChotLich() {
  const key = ymd(currentWeekStart);
  try {
    await apiFetch('/lichlam/mochot', 'POST', { tuan: key });
    trangThaiTuan[key] = 'draft';
    renderStatusPill();
    showToast('Đã mở chốt lịch thành công', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Init ── */
initLayout(['quanly']).then(async user => {
  if (!user) return;

  try {
    await Promise.all([loadShifts(), loadNhanVien()]);
  } catch (err) {
    showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
    return;
  }

  // Fix timezone: dùng new Date(y, m, d) thay vì new Date()
  const now = new Date();
  currentWeekStart = getMondayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  await renderWeek();

  document.getElementById('btn-prev-week').addEventListener('click', () => shiftWeek(-1));
  document.getElementById('btn-next-week').addEventListener('click', () => shiftWeek(1));
  
  // (Đã xóa dòng gán sự kiện cho btn-chot-lich ở đây vì renderStatusPill đã đảm nhiệm)
  document.getElementById('btn-dp-add').addEventListener('click', addNVToShift);
  document.getElementById('modal-dieuphoi').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-dieuphoi')) closeModal('modal-dieuphoi');
  });
});