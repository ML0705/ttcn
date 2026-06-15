/* ==========================================================
   manager/chamcong — Page controller
   Dùng apiFetch từ shared.js — không định nghĩa lại
========================================================== */

/* ---------- STATE ---------- */
let currentDate  = todayStr();
let currentPage  = 1;
const PAGE_SIZE  = 10;
let allRows      = [];
let filteredRows = [];
let editingRow   = null;


/* ---------- HELPERS ---------- */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateVN(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function fmtTime(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('T')) {
    return new Date(val).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh'
    });
  }
  return val.substring(0, 5);
}

function calcDuration(ci, co) {
  if (!ci || !co) return null;
  const t1 = fmtTime(ci), t2 = fmtTime(co);
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}p`;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
}

function avatarColor(code) {
  const colors = ['#1D9E75','#2980B9','#8E44AD','#E67E22','#C0392B','#16A085','#D35400','#2C3E50'];
  return colors[(code || '').charCodeAt((code || '').length - 1) % colors.length];
}

function getStatus(row) {
  if (!row.checkin)
    return { label: 'Vắng', cls: 'badge-red', code: 'vang' };

  if (row.trangthaicheckin && row.trangthaicheckout)
    return { label: 'Muộn & Về sớm', cls: 'badge-amber', code: 'muon' };

  if (row.trangthaicheckin)
    return { label: 'Đi muộn', cls: 'badge-amber', code: 'muon' };

  if (row.trangthaicheckout)
    return { label: 'Về sớm', cls: 'badge-amber', code: 'vesom' };

  if (row.checkin && !row.checkout)
    return { label: 'Chưa check-out', cls: 'badge-blue', code: 'chuacheckin' };

  return { label: 'Đúng giờ', cls: 'badge-green', code: 'dunggio' };
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------- LOAD DATA ---------- */
async function loadData() {
  showLoading(true);
  try {
    const rows = await apiFetch(`/chamcong?tuNgay=${currentDate}&denNgay=${currentDate}`);

    allRows = rows.map(r => ({
      ...r,
      checkin:  r.checkin  ? fmtTime(r.checkin)  : null,
      checkout: r.checkout ? fmtTime(r.checkout) : null,
      batdau:   fmtTime(r.thoigianbatdau),
      ketthuc:  fmtTime(r.thoigianketthuc),
    }));
  } catch (err) {
    showToast(err.message || 'Không thể tải dữ liệu', 'error');
    allRows = [];
  }finally {
  showLoading(false);
  updateStats();
  updateTableHeading();
  applyFilters();
}
}


/* ---------- FILTERS ---------- */
function applyFilters() {
  const search = document.getElementById('filter-search').value.trim().toLowerCase();

  filteredRows = allRows.filter(r => {
    if (search &&
        !r.hoten.toLowerCase().includes(search) &&
        !(r.manhanvien || '').toLowerCase().includes(search)) return false;
    return true;
  });

  currentPage = 1;
  renderTable();
}

/* ---------- STATS ---------- */
function updateStats() {
  document.getElementById('stat-total').textContent  = allRows.length;
  document.getElementById('stat-ok').textContent     = allRows.filter(r => getStatus(r).code === 'dunggio').length;
  document.getElementById('stat-late').textContent   = allRows.filter(r => r.trangthaicheckin || r.trangthaicheckout).length;
  document.getElementById('stat-absent').textContent = allRows.filter(r => !r.checkin).length;
}

function updateTableHeading() {
  document.getElementById('table-heading').textContent = `Chấm công ngày ${fmtDateVN(currentDate)}`;
}

/* ---------- RENDER TABLE ---------- */
function renderTable() {
  const tbody = document.getElementById('cc-tbody');
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredRows.slice(start, start + PAGE_SIZE);

  document.getElementById('table-count').textContent =
    filteredRows.length ? `${filteredRows.length} bản ghi` : '';

  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">
      <div class="empty-icon-wrap">📭</div>
      <div>Không có dữ liệu phù hợp</div>
    </td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = page.map(row => {
    const st  = getStatus(row);
    const dur = calcDuration(row.checkin, row.checkout);
    const av  = initials(row.hoten);
    const bg  = avatarColor(row.manhanvien);

    const ciHtml = row.checkin
      ? `<span class="${row.trangthaicheckin ? 'time-warn' : 'time-ok'}">${row.checkin}</span>`
      : `<span class="time-miss">—</span>`;

    const coHtml = row.checkout
      ? `<span class="${row.trangthaicheckout ? 'time-warn' : ''}">${row.checkout}</span>`
      : row.checkin
        ? `<span class="time-miss">Chưa check-out</span>`
        : `<span class="time-miss">—</span>`;

    return `<tr data-id="${row.malichlam}">
      <td>
        <div class="nv-cell">
          <div class="nv-av" style="background:${bg}">${av}</div>
          <div class="nv-info">
            <div class="nv-name">${row.hoten}</div>
            <div class="nv-meta">${row.manhanvien}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="ca-name">${row.tenca}</div>
        <div class="ca-time">${row.batdau}–${row.ketthuc}</div>
      </td>
      <td class="time-cell">${ciHtml}</td>
      <td class="time-cell">${coHtml}</td>
      <td class="time-cell hide-sm">
        ${dur ? `<span class="dur-pill">${dur}</span>` : '<span class="time-miss">—</span>'}
      </td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td class="action-cell">
        <button class="btn-row-edit"
          onclick="openEdit('${row.manhanvien}','${row.malichlam}')"
          title="Chỉnh sửa">✏️ Sửa</button>
      </td>
    </tr>`;
  }).join('');

  renderPagination();
}

/* ---------- PAGINATION ---------- */
function renderPagination() {
  const total = filteredRows.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const start = Math.min((currentPage - 1) * PAGE_SIZE + 1, total);
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  document.getElementById('page-info').textContent =
    total ? `Hiển thị ${start}–${end} / ${total}` : '';

  const pg = document.getElementById('pagination');
  if (pages <= 1) { pg.innerHTML = ''; return; }
  pg.innerHTML = Array.from({ length: pages }, (_, i) =>
    `<button class="page-btn ${i + 1 === currentPage ? 'active' : ''}"
       onclick="goPage(${i + 1})">${i + 1}</button>`
  ).join('');
}

function goPage(p) { currentPage = p; renderTable(); }

/* ---------- LOADING ---------- */
function showLoading(on) {
  document.getElementById('tbl-loading').style.display = on ? 'inline-flex' : 'none';
}

/* ---------- EDIT MODAL ---------- */
function openEdit(manhanvien, malichlam) {
  editingRow = allRows.find(r => r.manhanvien === manhanvien && r.malichlam === malichlam);
  if (!editingRow) return;

  document.getElementById('edit-nv-name').textContent = editingRow.hoten;
  document.getElementById('edit-ca-name').textContent = editingRow.tenca;
  document.getElementById('edit-ngay').textContent    = fmtDateVN(currentDate);
  document.getElementById('edit-quydinh-text').textContent =
    `${editingRow.tenca} · ${editingRow.batdau} – ${editingRow.ketthuc}`;

  document.getElementById('edit-checkin').value  = editingRow.checkin  || '';
  document.getElementById('edit-checkout').value = editingRow.checkout || '';

  ['err-checkin','err-checkout'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  openModal('modal-edit');
}

function validateEdit() {
  let ok = true;
  const ci = document.getElementById('edit-checkin').value;
  const co = document.getElementById('edit-checkout').value;

  ['err-checkin','err-checkout'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  if (!ci) {
    document.getElementById('err-checkin').textContent = 'Vui lòng nhập giờ check-in';
    ok = false;
  }
  if (ci && co && co <= ci) {
    document.getElementById('err-checkout').textContent = 'Giờ check-out phải sau giờ check-in';
    ok = false;
  }
  return ok;
}

async function saveEdit() {
  if (!validateEdit() || !editingRow) return;

  const btn = document.getElementById('btn-save-edit');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu…';

  const ci   = document.getElementById('edit-checkin').value;
  const co   = document.getElementById('edit-checkout').value || null;
  const ngay = currentDate;

  const checkinISO  = ci ? `${ngay}T${ci}:00` : null;
  const checkoutISO = co ? `${ngay}T${co}:00` : null;

  try {
    await apiFetch(
      `/chamcong/${editingRow.manhanvien}/${editingRow.malichlam}`,
      'PUT',
      { checkin: checkinISO, checkout: checkoutISO }
    );

    closeModal('modal-edit');
    showToast(`Đã cập nhật chấm công — ${editingRow.hoten}`, 'success');
    await loadData();
  } catch (err) {
    showToast(err.message || 'Lưu thất bại', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = 'Lưu thay đổi';
  }
}

/* ---------- DATE NAV ---------- */
function shiftDate(delta) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + delta);
  currentDate = d.toISOString().slice(0, 10);
  document.getElementById('filter-date').value = currentDate;
  loadData();
}

/* ---------- EXPORT ---------- */
function exportReport() {
  showToast('Tính năng xuất báo cáo sẽ có trong giai đoạn tiếp theo', 'info');
}

/* ---------- INIT ---------- */
initLayout(['quanly']).then(async user => {
  if (!user) return;

  document.getElementById('filter-date').value = currentDate;
 
  await loadData();

  document.getElementById('filter-date').addEventListener('change', e => {
    currentDate = e.target.value; loadData();
  });
  document.getElementById('btn-prev-day').addEventListener('click', () => shiftDate(-1));
  document.getElementById('btn-next-day').addEventListener('click', () => shiftDate(+1));
  document.getElementById('filter-search').addEventListener('input', debounce(applyFilters, 250));
  document.getElementById('modal-edit').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-edit')) closeModal('modal-edit');
  });
});