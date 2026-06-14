/* =====================================================
   chinhanh.js — logic trang Quản lý chi nhánh
   Phụ thuộc: shared.js (đã load trước)

   DỮ LIỆU:
   - Hiện tại dùng mockData để test giao diện
   - Khi backend xong: thay các hàm fetchXxx() bằng
     fetch('/api/chinhanh/...') tương ứng
===================================================== */

/* ── Mock data (xóa khi có API) ── */
let mockBranches = [
  {
    machinhanh: 'CN01',
    tenchinhanh: 'Chi nhánh Hai Bà Trưng',
    diachi: '12 Chùa Bộc, Hai Bà Trưng, Hà Nội',
    sdtcn: '0241000001',
    giomocua: '07:00',
    giodongcua: '22:00',
    trangthai: 1,
    sonhanvien: 5,
    soca: 4,
  },
  {
    machinhanh: 'CN02',
    tenchinhanh: 'Chi nhánh Hoàn Kiếm',
    diachi: '45 Hàng Bài, Hoàn Kiếm, Hà Nội',
    sdtcn: '0241000002',
    giomocua: '07:00',
    giodongcua: '22:00',
    trangthai: 1,
    sonhanvien: 4,
    soca: 3,
  },
  {
    machinhanh: 'CN03',
    tenchinhanh: 'Chi nhánh Cầu Giấy',
    diachi: '102 Xuân Thủy, Cầu Giấy, Hà Nội',
    sdtcn: '0241000003',
    giomocua: '08:00',
    giodongcua: '21:00',
    trangthai: 0,
    sonhanvien: 1,
    soca: 0,
  },
];

let _editingId = null; // null = thêm mới, string = mã chi nhánh đang sửa

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function initChinhanh() {
  renderAll();
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function renderAll() {
  updateStats();
  renderGrid(mockBranches);
}

function updateStats() {
  const total    = mockBranches.length;
  const active   = mockBranches.filter(b => b.trangthai === 1).length;
  const inactive = total - active;
  const staff    = mockBranches.reduce((s, b) => s + (b.sonhanvien || 0), 0);

  document.getElementById('s-total').textContent    = total;
  document.getElementById('s-active').textContent   = active;
  document.getElementById('s-inactive').textContent = inactive;
  document.getElementById('s-staff').textContent    = staff;
}

function renderGrid(list) {
  const grid  = document.getElementById('branch-grid');
  const empty = document.getElementById('empty-state');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = list.map(b => cardHTML(b)).join('');
}

function cardHTML(b) {
  const isActive   = b.trangthai === 1;
  const statusCls  = isActive ? 'active' : 'inactive';
  const statusText = isActive ? 'Đang hoạt động' : 'Ngừng hoạt động';

  return `
  <div class="branch-card" id="card-${b.machinhanh}">
    <div class="branch-card-header">
      <div class="branch-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <path d="M3 9l1-5h16l1 5"/>
          <path d="M3 9v10h18V9"/>
          <path d="M9 21v-6h6v6"/>
        </svg>
      </div>
      <div class="branch-name-wrap">
        <div class="branch-name" title="${b.tenchinhanh}">${b.tenchinhanh}</div>
        <div class="branch-code">${b.machinhanh}</div>
      </div>
      <div class="branch-actions">
        <button class="btn-icon" title="Chỉnh sửa" onclick="openEditPanel('${b.machinhanh}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon" title="Xóa" style="color:var(--red);" onclick="askDelete('${b.machinhanh}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="branch-divider"></div>

    <div class="branch-meta">
      <div class="branch-meta-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>${b.diachi}</span>
      </div>
      <div class="branch-meta-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.05 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.17a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15z"/>
        </svg>
        <span>${b.sdtcn}</span>
      </div>
      <div class="branch-meta-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v5l3 3"/>
        </svg>
        <span>${b.giomocua} – ${b.giodongcua} &nbsp;·&nbsp; Giờ mở cửa</span>
      </div>
    </div>

    <div class="branch-footer">
      <div class="branch-stats">
        <div class="branch-stat">
          <span class="branch-stat-val">${b.sonhanvien ?? '–'}</span>
          <span class="branch-stat-lbl">Nhân viên</span>
        </div>
        <div class="branch-stat">
          <span class="branch-stat-val">${b.soca ?? '–'}</span>
          <span class="branch-stat-lbl">Ca / ngày</span>
        </div>
      </div>
      <span class="status-dot ${statusCls}">${statusText}</span>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════
   FILTER / SEARCH
══════════════════════════════════════════ */
function filterBranches() {
  const q      = document.getElementById('search-input').value.toLowerCase().trim();
  const status = document.getElementById('filter-status').value;

  const filtered = mockBranches.filter(b => {
    const matchQ = !q ||
      b.tenchinhanh.toLowerCase().includes(q) ||
      b.diachi.toLowerCase().includes(q) ||
      b.machinhanh.toLowerCase().includes(q);
    const matchS = status === '' || String(b.trangthai) === status;
    return matchQ && matchS;
  });

  renderGrid(filtered);
}

/* ══════════════════════════════════════════
   SIDE PANEL: Thêm / Sửa
══════════════════════════════════════════ */
function openAddPanel() {
  _editingId = null;
  document.getElementById('panel-title').textContent = 'Thêm chi nhánh';
  clearForm();
  document.getElementById('f-trangthai').value = '1'; // mặc định hoạt động
  openSidePanel('branch-panel');
}

function openEditPanel(id) {
  const b = mockBranches.find(x => x.machinhanh === id);
  if (!b) return;
  _editingId = id;
  document.getElementById('panel-title').textContent = 'Chỉnh sửa chi nhánh';
  clearForm();
  document.getElementById('f-ten').value        = b.tenchinhanh;
  document.getElementById('f-diachi').value     = b.diachi;
  document.getElementById('f-sdt').value        = b.sdtcn;
  document.getElementById('f-mo').value         = b.giomocua;
  document.getElementById('f-dong').value       = b.giodongcua;
  document.getElementById('f-trangthai').value  = String(b.trangthai);
  openSidePanel('branch-panel');
}

function clearForm() {
  ['f-ten','f-diachi','f-sdt','f-mo','f-dong'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['e-ten','e-diachi','e-sdt','e-gio'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
}

function validateForm() {
  let ok = true;
  const ten    = document.getElementById('f-ten').value.trim();
  const diachi = document.getElementById('f-diachi').value.trim();
  const sdt    = document.getElementById('f-sdt').value.trim();
  const mo     = document.getElementById('f-mo').value;
  const dong   = document.getElementById('f-dong').value;

  if (!ten)   { setErr('e-ten',   'Vui lòng nhập tên chi nhánh'); ok = false; }
  else          setErr('e-ten', '');

  if (!diachi){ setErr('e-diachi','Vui lòng nhập địa chỉ'); ok = false; }
  else          setErr('e-diachi','');

  if (!/^\d{10}$/.test(sdt)) {
    setErr('e-sdt', 'Số điện thoại phải gồm đúng 10 chữ số'); ok = false;
  } else setErr('e-sdt', '');

  if (!mo || !dong) {
    setErr('e-gio', 'Vui lòng chọn giờ mở và đóng cửa'); ok = false;
  } else if (mo >= dong) {
    setErr('e-gio', 'Giờ mở cửa phải nhỏ hơn giờ đóng cửa'); ok = false;
  } else setErr('e-gio', '');

  return ok;
}

function setErr(id, msg) {
  document.getElementById(id).textContent = msg;
}

function saveBranch() {
  if (!validateForm()) return;

  const data = {
    tenchinhanh: document.getElementById('f-ten').value.trim(),
    diachi:      document.getElementById('f-diachi').value.trim(),
    sdtcn:       document.getElementById('f-sdt').value.trim(),
    giomocua:    document.getElementById('f-mo').value,
    giodongcua:  document.getElementById('f-dong').value,
    trangthai:   Number(document.getElementById('f-trangthai').value),
  };

  if (_editingId) {
    /* ── Sửa ── */
    const idx = mockBranches.findIndex(b => b.machinhanh === _editingId);
    if (idx !== -1) mockBranches[idx] = { ...mockBranches[idx], ...data };
    showToast('Chỉnh sửa chi nhánh thành công', 'success');

    /* TODO (backend): fetch PUT /api/chinhanh/:id, body = data */
  } else {
    /* ── Thêm mới ── */
    const newId = 'CN' + String(mockBranches.length + 1).padStart(2, '0');
    mockBranches.push({ machinhanh: newId, sonhanvien: 0, soca: 0, ...data });
    showToast('Thêm chi nhánh thành công', 'success');

    /* TODO (backend): fetch POST /api/chinhanh, body = data */
  }

  closeSidePanel('branch-panel');
  renderAll();
  filterBranches(); // giữ nguyên filter hiện tại
}

/* ══════════════════════════════════════════
   XÓA
══════════════════════════════════════════ */
function askDelete(id) {
  const b = mockBranches.find(x => x.machinhanh === id);
  if (!b) return;
  showConfirm(
    'Xóa chi nhánh?',
    `Bạn có chắc chắn muốn xóa "${b.tenchinhanh}"? Thao tác này không thể hoàn tác.`,
    () => deleteBranch(id)
  );
}

function deleteBranch(id) {
  mockBranches = mockBranches.filter(b => b.machinhanh !== id);
  showToast('Đã xóa chi nhánh', 'success');
  renderAll();
  filterBranches();

  /* TODO (backend): fetch DELETE /api/chinhanh/:id */
}

/* ── confirmOk đã được khai báo trong shared.js ── */
initLayout(['quanly']).then(user => {
  if (!user) return;
  initChinhanh();
});