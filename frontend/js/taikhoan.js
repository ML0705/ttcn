/* =====================================================
   taikhoan.js — logic trang Quản lý tài khoản
   Phụ thuộc: shared.js (đã load trước)

   KHI BACKEND XONG: thay các khối "TODO (backend)"
   bằng fetch('/api/taikhoan/...') tương ứng.
===================================================== */

/* ── Màu avatar theo tên ── */
const AVATAR_COLORS = [
  '#1D9E75','#2980B9','#8B5CF6','#E74C3C',
  '#F39C12','#16A085','#D35400','#2C3E50',
];
function avatarColor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase();
}

/* ── Mock branches (đồng bộ với chinhanh.js nếu dùng chung) ── */
const mockChinhanh = [
  { machinhanh: 'CN01', tenchinhanh: 'Chi nhánh Hai Bà Trưng' },
  { machinhanh: 'CN02', tenchinhanh: 'Chi nhánh Hoàn Kiếm' },
  { machinhanh: 'CN03', tenchinhanh: 'Chi nhánh Cầu Giấy' },
];

/* ── Mock accounts ── */
let mockAccounts = [
  { manhanvien:'NVF0001', hoten:'Nguyễn Văn An',   email:'an.nv@hygge.vn',   sodienthoai:'0901000001', loai:'fulltime', machinhanh:'CN01', tenchinhanh:'Hai Bà Trưng', chucvu:'Quản lý',           trangthaikhoa:0 },
  { manhanvien:'NVF0002', hoten:'Trần Thị Bình',   email:'binh.tt@hygge.vn', sodienthoai:'0901000002', loai:'fulltime', machinhanh:'CN01', tenchinhanh:'Hai Bà Trưng', chucvu:'Thu ngân',           trangthaikhoa:0 },
  { manhanvien:'NVP0001', hoten:'Hoàng Văn Cường', email:'cuong.hv@hygge.vn',sodienthoai:'0901000003', loai:'parttime', machinhanh:'CN01', tenchinhanh:'Hai Bà Trưng', chucvu:'Nhân viên bán hàng', trangthaikhoa:0 },
  { manhanvien:'NVP0002', hoten:'Ngô Văn Minh',    email:'minh.nv@hygge.vn', sodienthoai:'0901000004', loai:'parttime', machinhanh:'CN03', tenchinhanh:'Cầu Giấy',     chucvu:'Nhân viên bán hàng', trangthaikhoa:1 },
  { manhanvien:'NVF0003', hoten:'Lê Thị Dung',     email:'dung.lt@hygge.vn', sodienthoai:'0901000005', loai:'fulltime', machinhanh:'CN02', tenchinhanh:'Hoàn Kiếm',    chucvu:'Trưởng ca',          trangthaikhoa:0 },
  { manhanvien:'NVP0003', hoten:'Phạm Gia Dũng',   email:'dung.pg@hygge.vn', sodienthoai:'0901000006', loai:'parttime', machinhanh:'CN02', tenchinhanh:'Hoàn Kiếm',    chucvu:'Nhân viên bán hàng', trangthaikhoa:0 },
];

/* ── State ── */
let _activeTab  = 'all';
let _editingId  = null;
let _tkCb  = null;  

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function initTaiKhoan() {
  populateChinhhanhSelects();
  renderAll();
}

function populateChinhhanhSelects() {
  ['filter-cn', 'f-chinhanh'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = id === 'filter-cn';
    const placeholder = isFilter
      ? '<option value="">Chi nhánh: Tất cả</option>'
      : '<option value="">-- Chọn chi nhánh --</option>';
    el.innerHTML = placeholder +
      mockChinhanh.map(cn =>
        `<option value="${cn.machinhanh}">${cn.tenchinhanh}</option>`
      ).join('');
  });
  /* TODO (backend): fetch GET /api/chinhanh → populate */
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function renderAll() {
  updateStats();
  updateTabCounts();
  applyFilters();
}

function updateStats() {
  const total    = mockAccounts.length;
  const fulltime = mockAccounts.filter(a => a.loai === 'fulltime').length;
  const parttime = mockAccounts.filter(a => a.loai === 'parttime').length;
  const locked   = mockAccounts.filter(a => a.trangthaikhoa === 1).length;
  document.getElementById('s-total').textContent    = total;
  document.getElementById('s-fulltime').textContent = fulltime;
  document.getElementById('s-parttime').textContent = parttime;
  document.getElementById('s-locked').textContent   = locked;
}

function updateTabCounts() {
  const all      = mockAccounts.length;
  const fulltime = mockAccounts.filter(a => a.loai === 'fulltime').length;
  const parttime = mockAccounts.filter(a => a.loai === 'parttime').length;
  const locked   = mockAccounts.filter(a => a.trangthaikhoa === 1).length;
  document.getElementById('tc-all').textContent      = all;
  document.getElementById('tc-fulltime').textContent = fulltime;
  document.getElementById('tc-parttime').textContent = parttime;
  document.getElementById('tc-locked').textContent   = locked;
}

function applyFilters() {
  const q    = document.getElementById('search-input').value.toLowerCase().trim();
  const loai = document.getElementById('filter-loai').value;
  const cn   = document.getElementById('filter-cn').value;

  let list = mockAccounts.filter(a => {
    const matchQ  = !q || a.hoten.toLowerCase().includes(q) || a.manhanvien.toLowerCase().includes(q);
    const matchL  = !loai || a.loai === loai;
    const matchCN = !cn   || a.machinhanh === cn;
    return matchQ && matchL && matchCN;
  });

  // Tab filter (nhân với filter trên)
  if (_activeTab === 'fulltime') list = list.filter(a => a.loai === 'fulltime');
  if (_activeTab === 'parttime') list = list.filter(a => a.loai === 'parttime');
  if (_activeTab === 'locked')   list = list.filter(a => a.trangthaikhoa === 1);

  renderTable(list);
}

function renderTable(list) {
  const tbody = document.getElementById('acc-tbody');
  const empty = document.getElementById('empty-state');

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = list.map(a => {
    const color      = avatarColor(a.hoten);
    const ini        = initials(a.hoten);
    const isLocked   = a.trangthaikhoa === 1;
    const loaiLabel  = a.loai === 'fulltime' ? 'Full-time' : 'Part-time';
    const loaiCls    = a.loai === 'fulltime' ? 'badge-fulltime' : 'badge-parttime';
    const statusCls  = isLocked ? 'badge-locked' : 'badge-ok';
    const statusText = isLocked ? 'Bị khóa' : 'Bình thường';
    const lockTitle  = isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản';
    const lockCls    = isLocked ? 'is-locked' : '';
    const lockIcon   = isLocked
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

    return `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="nv-avatar" style="background:${color}">${ini}</div>
          <div class="nv-info">
            <span class="nv-name">${a.hoten}</span>
            <span class="nv-role">${a.chucvu}</span>
          </div>
        </div>
      </td>
      <td style="font-family:var(--font-mono); font-size:12px; color:var(--ink-soft);">${a.manhanvien}</td>
      <td class="hide-mobile" style="font-size:12px; color:var(--ink-soft);">${a.tenchinhanh}</td>
      <td><span class="badge ${loaiCls}">${loaiLabel}</span></td>
      <td><span class="badge ${statusCls}">${statusText}</span></td>
      <td>
        <div class="action-wrap">
          <button class="btn-icon" title="Chỉnh sửa" onclick="openEditPanel('${a.manhanvien}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-lock ${lockCls}" title="${lockTitle}" onclick="askToggleLock('${a.manhanvien}')">
            ${lockIcon}
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════
   TABS
══════════════════════════════════════════ */
function switchTab(tab, btn) {
  _activeTab = tab;
  document.querySelectorAll('#tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

/* ══════════════════════════════════════════
   SIDE PANEL: Thêm / Sửa
══════════════════════════════════════════ */
function openAddPanel() {
  _editingId = null;
  document.getElementById('panel-title').textContent = 'Thêm tài khoản';
  clearForm();
  document.getElementById('pw-group').style.display = '';
  document.getElementById('pw-hint').style.display  = 'none';
  openSidePanel('acc-panel');
}

function openEditPanel(id) {
  const a = mockAccounts.find(x => x.manhanvien === id);
  if (!a) return;
  _editingId = id;
  document.getElementById('panel-title').textContent = 'Chỉnh sửa tài khoản';
  clearForm();
  document.getElementById('f-hoten').value    = a.hoten;
  document.getElementById('f-sdt').value      = a.sodienthoai;
  document.getElementById('f-email').value    = a.email;
  document.getElementById('f-loai').value     = a.loai;
  document.getElementById('f-chinhanh').value = a.machinhanh;
  document.getElementById('f-chucvu').value   = a.chucvu;
  document.getElementById('pw-group').style.display = '';
  document.getElementById('pw-hint').style.display  = 'block';
  openSidePanel('acc-panel');
}

function clearForm() {
  ['f-hoten','f-sdt','f-email','f-matkhau'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['e-hoten','e-sdt','e-email','e-matkhau','e-chinhanh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function togglePw() {
  const inp = document.getElementById('f-matkhau');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function validateForm() {
  let ok = true;
  const hoten    = document.getElementById('f-hoten').value.trim();
  const sdt      = document.getElementById('f-sdt').value.trim();
  const email    = document.getElementById('f-email').value.trim();
  const chinhanh = document.getElementById('f-chinhanh').value;
  const matkhau  = document.getElementById('f-matkhau').value;
  const isEdit   = !!_editingId;

  if (!hoten) { setErr('e-hoten','Vui lòng nhập họ tên'); ok = false; }
  else setErr('e-hoten','');

  if (!/^\d{10}$/.test(sdt)) { setErr('e-sdt','Số điện thoại phải gồm đúng 10 chữ số'); ok = false; }
  else {
    const dup = mockAccounts.find(a => a.sodienthoai === sdt && a.manhanvien !== _editingId);
    if (dup) { setErr('e-sdt','Số điện thoại đã được dùng bởi tài khoản khác'); ok = false; }
    else setErr('e-sdt','');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr('e-email','Email không đúng định dạng'); ok = false;
  } else setErr('e-email','');

  if (!chinhanh) { setErr('e-chinhanh','Vui lòng chọn chi nhánh'); ok = false; }
  else setErr('e-chinhanh','');

  if (!isEdit && (!matkhau || matkhau.length < 8 || !/[a-zA-Z]/.test(matkhau) || !/\d/.test(matkhau))) {
    setErr('e-matkhau','Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số'); ok = false;
  } else if (isEdit && matkhau && (matkhau.length < 8 || !/[a-zA-Z]/.test(matkhau) || !/\d/.test(matkhau))) {
    setErr('e-matkhau','Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số'); ok = false;
  } else setErr('e-matkhau','');

  return ok;
}

function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function saveAccount() {
  if (!validateForm()) return;

  const cnEl  = document.getElementById('f-chinhanh');
  const cnTen = cnEl.options[cnEl.selectedIndex]?.text || '';

  const data = {
    hoten:        document.getElementById('f-hoten').value.trim(),
    sodienthoai:  document.getElementById('f-sdt').value.trim(),
    email:        document.getElementById('f-email').value.trim(),
    loai:         document.getElementById('f-loai').value,
    machinhanh:   document.getElementById('f-chinhanh').value,
    tenchinhanh:  cnTen,
    chucvu:       document.getElementById('f-chucvu').value,
  };

  if (_editingId) {
    const idx = mockAccounts.findIndex(a => a.manhanvien === _editingId);
    if (idx !== -1) mockAccounts[idx] = { ...mockAccounts[idx], ...data };
    showToast('Cập nhật tài khoản thành công', 'success');
    /* TODO (backend): fetch PUT /api/taikhoan/:id, body = data */
  } else {
    const isFulltime = data.loai === 'fulltime';
    const prefix     = isFulltime ? 'NVF' : 'NVP';
    const sameType   = mockAccounts.filter(a => a.loai === data.loai).length;
    const newId      = prefix + String(sameType + 1).padStart(4, '0');
    mockAccounts.push({ manhanvien: newId, trangthaikhoa: 0, ...data });
    showToast('Thêm tài khoản thành công', 'success');
    /* TODO (backend): fetch POST /api/taikhoan, body = data */
  }

  closeSidePanel('acc-panel');
  renderAll();
}

/* ══════════════════════════════════════════
   KHÓA / MỞ KHÓA
══════════════════════════════════════════ */
function askToggleLock(id) {
  const a = mockAccounts.find(x => x.manhanvien === id);
  if (!a) return;
  const isLocked = a.trangthaikhoa === 1;
  const action   = isLocked ? 'Mở khóa' : 'Khóa';
  const icon     = isLocked ? '🔓' : '🔒';

  document.getElementById('confirm-icon').textContent  = icon;
  document.getElementById('confirm-title').textContent = `${action} tài khoản?`;
  document.getElementById('confirm-text').textContent  =
    `Bạn có chắc muốn ${action.toLowerCase()} tài khoản của "${a.hoten}"?`;
  document.getElementById('confirm-ok-btn').textContent = action;
  document.getElementById('confirm-ok-btn').className   =
    isLocked ? 'btn btn-success' : 'btn btn-danger';

  _tkCb = () => toggleLock(id);
  openModal('confirm-modal');
}

function toggleLock(id) {
  const a = mockAccounts.find(x => x.manhanvien === id);
  if (!a) return;
  a.trangthaikhoa = a.trangthaikhoa === 1 ? 0 : 1;
  const action = a.trangthaikhoa === 1 ? 'Đã khóa' : 'Đã mở khóa';
  showToast(`${action} tài khoản ${a.hoten}`, a.trangthaikhoa === 1 ? 'error' : 'success');
  renderAll();
  /* TODO (backend): fetch PATCH /api/taikhoan/:id/lock, body = { trangthaikhoa } */
}

/* Override confirmOk của shared.js để dùng _tkCb cục bộ */
function confirmOk() {
  closeModal('confirm-modal');
  if (_tkCb) { _tkCb(); _tkCb = null; }
}