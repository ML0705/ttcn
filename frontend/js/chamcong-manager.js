/* ==========================================================
   manager/chamcong — Page controller
   Tách từ inline script trong chamcong.html
   Khi kết nối API: chỉ cần thay 3 chỗ TODO, xoá MOCK_*
========================================================== */

/* ---------- STATE ---------- */
let currentDate  = todayStr();
let currentPage  = 1;
const PAGE_SIZE  = 10;
let allRows      = [];
let filteredRows = [];
let editingRow   = null;
let caList       = [];

/* ---------- MOCK DATA (xoá khi có API) ---------- */
const MOCK_CA = [
  { maca: 'C01', tenca: 'Ca sáng',  batdau: '08:00', ketthuc: '12:00' },
  { maca: 'C02', tenca: 'Ca chiều', batdau: '13:00', ketthuc: '17:00' },
  { maca: 'C03', tenca: 'Ca tối',   batdau: '17:00', ketthuc: '21:00' },
];
const MOCK_DATA = [
  { id:1, manv:'NVP0001', hoten:'Nguyễn Mỹ Hạnh',  loai:'Part-time', maca:'C01', tenca:'Ca sáng',  batdau:'08:00', ketthuc:'12:00', checkin:'07:04', checkout:'12:01', muon:0, vesom:0 },
  { id:2, manv:'NVP0002', hoten:'Trần Minh Tú',    loai:'Part-time', maca:'C01', tenca:'Ca sáng',  batdau:'08:00', ketthuc:'12:00', checkin:'06:58', checkout:'12:00', muon:0, vesom:0 },
  { id:3, manv:'NVF0001', hoten:'Tạ Mai Phương',   loai:'Full-time', maca:'C01', tenca:'Ca sáng',  batdau:'08:00', ketthuc:'12:00', checkin:'08:17', checkout:'12:05', muon:1, vesom:0 },
  { id:4, manv:'NVP0003', hoten:'Phạm Gia Dũng',   loai:'Part-time', maca:'C02', tenca:'Ca chiều', batdau:'13:00', ketthuc:'17:00', checkin:null,    checkout:null,    muon:0, vesom:0 },
  { id:5, manv:'NVP0004', hoten:'Lê Thị Bình',     loai:'Part-time', maca:'C02', tenca:'Ca chiều', batdau:'13:00', ketthuc:'17:00', checkin:'13:02', checkout:'16:35', muon:0, vesom:1 },
  { id:6, manv:'NVF0002', hoten:'Đoàn Lan Anh',    loai:'Full-time', maca:'C02', tenca:'Ca chiều', batdau:'13:00', ketthuc:'17:00', checkin:'13:00', checkout:'17:00', muon:0, vesom:0 },
  { id:7, manv:'NVP0005', hoten:'Vũ Quốc Huy',     loai:'Part-time', maca:'C03', tenca:'Ca tối',   batdau:'17:00', ketthuc:'21:00', checkin:'17:03', checkout:'21:00', muon:0, vesom:0 },
  { id:8, manv:'NVP0006', hoten:'Bùi Thu Hằng',    loai:'Part-time', maca:'C03', tenca:'Ca tối',   batdau:'17:00', ketthuc:'21:00', checkin:null,    checkout:null,    muon:0, vesom:0 },
];

/* ---------- HELPERS ---------- */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateVN(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function calcDuration(ci, co) {
  if (!ci || !co) return null;
  const [h1, m1] = ci.split(':').map(Number);
  const [h2, m2] = co.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}p`;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
}

function avatarColor(code) {
   const colors = ['#1D9E75','#2980B9','#8E44AD','#E67E22','#C0392B','#16A085','#D35400','#2C3E50'];
  return colors[code.charCodeAt(code.length - 1) % colors.length];
}

function getStatus(row) {
  if (!row.checkin)          return { label: 'Vắng',        cls: 'badge-red',   code: 'vang' };
  if (row.muon && row.vesom) return { label: 'Muộn & Về sớm', cls: 'badge-amber', code: 'muon' };
  if (row.muon)              return { label: 'Đi muộn',     cls: 'badge-amber', code: 'muon' };
  if (row.vesom)             return { label: 'Về sớm',      cls: 'badge-amber', code: 'vesom' };
  return                            { label: 'Đúng giờ',    cls: 'badge-green', code: 'dunggio' };
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------- LOAD DATA ---------- */
async function loadData() {
  showLoading(true);
  // TODO: const res = await apiFetch(`/api/chamcong?ngay=${currentDate}`);
  // allRows = res.data || [];
  await new Promise(r => setTimeout(r, 300));
  allRows = MOCK_DATA;
  showLoading(false);
  applyFilters();
  updateStats();
  updateTableHeading();
}

async function loadCaList() {
  // TODO: caList = await apiFetch('/api/calm');
  caList = MOCK_CA;
  const sel = document.getElementById('filter-ca');
  caList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.maca;
    opt.textContent = `${c.tenca} (${c.batdau}–${c.ketthuc})`;
    sel.appendChild(opt);
  });
}

/* ---------- FILTERS ---------- */
function applyFilters() {
  const ca     = document.getElementById('filter-ca').value;
  const tt     = document.getElementById('filter-tt').value;
  const search = document.getElementById('filter-search').value.trim().toLowerCase();

  filteredRows = allRows.filter(r => {
    if (ca && r.maca !== ca) return false;
    if (tt) {
      const st = getStatus(r).code;
      if (tt === 'chuacheckin') return !r.checkin;
      if (tt === 'muon'  && !r.muon)  return false;
      if (tt === 'vesom' && !r.vesom) return false;
      if (tt === 'dunggio' && st !== 'dunggio') return false;
      if (tt === 'vang'    && st !== 'vang')    return false;
    }
    if (search && !r.hoten.toLowerCase().includes(search) &&
        !r.manv.toLowerCase().includes(search)) return false;
    return true;
  });

  currentPage = 1;
  renderTable();
}

/* ---------- STATS ---------- */
function updateStats() {
  document.getElementById('stat-total').textContent  = allRows.length;
  document.getElementById('stat-ok').textContent     = allRows.filter(r => r.checkin && !r.muon && !r.vesom).length;
  document.getElementById('stat-late').textContent   = allRows.filter(r => r.muon || r.vesom).length;
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
    const bg  = avatarColor(row.manv);

    const ciHtml = row.checkin
      ? `<span class="${row.muon ? 'time-warn' : 'time-ok'}">${row.checkin}</span>`
      : `<span class="time-miss">—</span>`;

    const coHtml = row.checkout
      ? `<span class="${row.vesom ? 'time-warn' : ''}">${row.checkout}</span>`
      : row.checkin
        ? `<span class="time-miss">Chưa check-out</span>`
        : `<span class="time-miss">—</span>`;

    return `<tr data-id="${row.id}">
      <td>
        <div class="nv-cell">
          <div class="nv-av" style="background:${bg}">${av}</div>
          <div class="nv-info">
            <div class="nv-name">${row.hoten}</div>
            <div class="nv-meta">${row.manv} · ${row.loai}</div>
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
        <button class="btn-row-edit" onclick="openEdit(${row.id})" title="Chỉnh sửa">
          ✏️ Sửa
        </button>
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
function openEdit(id) {
  editingRow = allRows.find(r => r.id === id);
  if (!editingRow) return;

  document.getElementById('edit-nv-name').textContent  = editingRow.hoten;
  document.getElementById('edit-ca-name').textContent  = editingRow.tenca;
  document.getElementById('edit-ngay').textContent     = fmtDateVN(currentDate);
  document.getElementById('edit-quydinh-text').textContent =
    `${editingRow.tenca} · ${editingRow.batdau} – ${editingRow.ketthuc}`;

  document.getElementById('edit-checkin').value  = editingRow.checkin  || '';
  document.getElementById('edit-checkout').value = editingRow.checkout || '';
  document.getElementById('edit-lydo').value     = '';

  ['err-checkin', 'err-checkout', 'err-lydo'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  openModal('modal-edit');
}

function validateEdit() {
  let ok = true;
  const ci   = document.getElementById('edit-checkin').value;
  const co   = document.getElementById('edit-checkout').value;
  const lydo = document.getElementById('edit-lydo').value.trim();

  ['err-checkin', 'err-checkout', 'err-lydo'].forEach(id => {
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
  if (!lydo) {
    document.getElementById('err-lydo').textContent = 'Lý do chỉnh sửa là bắt buộc';
    ok = false;
  }
  return ok;
}

async function saveEdit() {
  if (!validateEdit() || !editingRow) return;

  const btn = document.getElementById('btn-save-edit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu…';

  const ci   = document.getElementById('edit-checkin').value;
  const co   = document.getElementById('edit-checkout').value;
  const lydo = document.getElementById('edit-lydo').value.trim();

  // TODO: await apiFetch(`/api/chamcong/${editingRow.manv}/${editingRow.maca}`, 'PUT', { checkin: ci, checkout: co, lydo });
  await new Promise(r => setTimeout(r, 500));

  const idx = allRows.findIndex(r => r.id === editingRow.id);
  if (idx !== -1) {
    allRows[idx].checkin  = ci;
    allRows[idx].checkout = co;
    const [bh, bm] = editingRow.batdau.split(':').map(Number);
    const [kh, km] = editingRow.ketthuc.split(':').map(Number);
    const [cih, cim] = ci.split(':').map(Number);
    const [coh, com] = co ? co.split(':').map(Number) : [0, 0];
    allRows[idx].muon  = (cih * 60 + cim) > (bh * 60 + bm) ? 1 : 0;
    allRows[idx].vesom = co ? (coh * 60 + com) < (kh * 60 + km) ? 1 : 0 : 0;
  }

  btn.disabled = false;
  btn.innerHTML = 'Lưu thay đổi';
  closeModal('modal-edit');
  applyFilters();
  updateStats();
  showToast(`Đã cập nhật chấm công — ${editingRow.hoten}`, 'success');
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
  await loadCaList();
  await loadData();

  document.getElementById('filter-date').addEventListener('change', e => {
    currentDate = e.target.value; loadData();
  });
  document.getElementById('btn-prev-day').addEventListener('click', () => shiftDate(-1));
  document.getElementById('btn-next-day').addEventListener('click', () => shiftDate(+1));
  document.getElementById('filter-ca').addEventListener('change', applyFilters);
  document.getElementById('filter-tt').addEventListener('change', applyFilters);
  document.getElementById('filter-search').addEventListener('input', debounce(applyFilters, 250));
  document.getElementById('btn-export').addEventListener('click', exportReport);
  document.getElementById('modal-edit').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-edit')) closeModal('modal-edit');
  });
});