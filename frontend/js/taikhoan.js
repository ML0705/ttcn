/* =====================================================
   taikhoan.js — logic trang Quản lý tài khoản
   Phụ thuộc: shared.js (đã load trước, chứa apiFetch, showToast, openModal, v.v.)
===================================================== */

/* ── Cấu hình màu sắc avatar ── */
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
  return (name||'?').split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase();
}

/* ── State ── */
let currentAccounts = [];
let danhSachChiNhanh = [];
let danhSachChucVu = [];
let danhSachLoaiNV = [];

let _activeTab  = 'all';
let _editingId  = null;
let _actionCb   = null;  

/* ══════════════════════════════════════════
   FETCH DATA TỰ ĐỘNG TỪ API DANH MỤC DB
══════════════════════════════════════════ */
async function loadChiNhanh() {
  try {
    const res = await apiFetch('/chinhanh');
    danhSachChiNhanh = res.data || res || []; 
    populateChinhhanhSelects();
  } catch (err) {
    console.error('Lỗi load chi nhánh:', err);
  }
}

async function loadChucVu() {
  try {
    const res = await apiFetch('/taikhoan/chucvu');
    danhSachChucVu = res.data || res || [];
    populateChucVuSelects();
  } catch (err) {
    console.error('Lỗi load chức vụ:', err);
  }
}

async function loadLoaiNhanVien() {
  try {
    const res = await apiFetch('/taikhoan/loainhanvien');
    danhSachLoaiNV = res.data || res || [];
    populateLoaiNVSelects();
  } catch (err) {
    console.error('Lỗi load loại NV:', err);
  }
}

async function loadAccounts() {
  try {
    const res = await apiFetch('/taikhoan');
    currentAccounts = res.data || res || [];
    renderAll();
  } catch (err) {
    console.error('Lỗi load tài khoản:', err);
    showToast('Không thể tải danh sách tài khoản', 'error');
  }
}

/* ══════════════════════════════════════════
   POPULATE OPTIONS VÀO HTML
══════════════════════════════════════════ */
function populateChinhhanhSelects() {
  // Bây giờ chỉ còn đổ dữ liệu vào ô Chọn chi nhánh trong Form thêm/sửa
  const el = document.getElementById('f-chinhanh');
  if (!el) return;
  el.innerHTML = '<option value="">-- Chọn chi nhánh --</option>' + 
    danhSachChiNhanh.map(cn => `<option value="${cn.machinhanh}">${cn.tenchinhanh}</option>`).join('');
}

function populateChucVuSelects() {
  const el = document.getElementById('f-chucvu');
  if (!el) return;
  el.innerHTML = danhSachChucVu.map(cv => 
    `<option value="${cv.machucvu}">${cv.tenchucvu}</option>`
  ).join('');
}

function populateLoaiNVSelects() {
  const formEl = document.getElementById('f-loai');
  if (formEl) {
    formEl.innerHTML = danhSachLoaiNV.map(l => 
      `<option value="${l.maloainhanvien}">${l.tenloainhanvien}</option>`
    ).join('');
  }
}

/* ══════════════════════════════════════════
   RENDER VÀ LỌC DỮ LIỆU ĐỘNG
══════════════════════════════════════════ */
function renderAll() {
  applyFilters();
}

function updateStats(list) {
  const total    = list.length;
  const fulltime = list.filter(a => a.maloainhanvien === 'LNV01').length;
  const parttime = list.filter(a => a.maloainhanvien === 'LNV02').length;
  
  const elTotal = document.getElementById('s-total');
  const elFull  = document.getElementById('s-fulltime');
  const elPart  = document.getElementById('s-parttime');

  if (elTotal) elTotal.textContent = total;
  if (elFull)  elFull.textContent  = fulltime;
  if (elPart)  elPart.textContent  = parttime;
}

function updateTabCounts(list) {
  const tcAll  = document.getElementById('tc-all');
  const tcFull = document.getElementById('tc-fulltime');
  const tcPart = document.getElementById('tc-parttime');

  if (tcAll)  tcAll.textContent  = list.length;
  if (tcFull) tcFull.textContent = list.filter(a => a.maloainhanvien === 'LNV01').length;
  if (tcPart) tcPart.textContent = list.filter(a => a.maloainhanvien === 'LNV02').length;
}

function applyFilters() {
  const q  = document.getElementById('search-input').value.toLowerCase().trim();

  // B1: Lọc nền tảng (bây giờ chỉ còn lọc theo ô Tìm kiếm)
  let baseList = currentAccounts.filter(a => {
    return !q || (a.hoten && a.hoten.toLowerCase().includes(q)) || (a.manhanvien && a.manhanvien.toLowerCase().includes(q));
  });

  // B2: Cập nhật con số hiển thị động
  updateStats(baseList);
  updateTabCounts(baseList);

  // B3: Lọc chi tiết theo Tab hiện tại để in ra bảng
  let tableList = baseList;
  if (_activeTab === 'fulltime') tableList = baseList.filter(a => a.maloainhanvien === 'LNV01');
  if (_activeTab === 'parttime') tableList = baseList.filter(a => a.maloainhanvien === 'LNV02');

  renderTable(tableList);
}

function renderTable(list) {
  const tbody = document.getElementById('acc-tbody');
  const empty = document.getElementById('empty-state');

  if (list.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(a => {
    const color      = avatarColor(a.hoten);
    const ini        = initials(a.hoten);
    
    const loaiLabel  = a.tenloainhanvien || 'Không xác định';
    const chucvuTen  = a.tenchucvu || 'Chưa phân công';
    const tenCN      = a.tenchinhanh || 'Không xác định';
    const loaiCls    = a.maloainhanvien === 'LNV01' ? 'badge-fulltime' : 'badge-parttime';

    return `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="nv-avatar" style="background:${color}">${ini}</div>
          <div class="nv-info">
            <span class="nv-name">${a.hoten}</span>
            <span class="nv-role">${chucvuTen}</span>
          </div>
        </div>
      </td>
      <td style="font-family:var(--font-mono); font-size:12px; color:var(--ink-soft);">${a.manhanvien}</td>
      <td class="hide-mobile" style="font-size:12px; color:var(--ink-soft);">${tenCN}</td>
      <td><span class="badge ${loaiCls}">${loaiLabel}</span></td>
      <td>
        <div class="action-wrap" style="justify-content: flex-end;">
          <button class="btn-icon" title="Chỉnh sửa" onclick="openEditPanel('${a.manhanvien}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-danger" title="Xóa tài khoản" onclick="askDelete('${a.manhanvien}')" style="color: var(--danger-color);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── CHUYỂN TAB ── */
function switchTab(tab, btn) {
  _activeTab = tab;
  document.querySelectorAll('#tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

/* ── SIDE PANEL: THÊM / SỬA ── */
function openAddPanel() {
  _editingId = null;
  document.getElementById('panel-title').textContent = 'Thêm tài khoản';
  clearForm();
  document.getElementById('pw-group').style.display = '';
  document.getElementById('pw-hint').style.display  = 'none';
  openSidePanel('acc-panel');
}

function openEditPanel(id) {
  const a = currentAccounts.find(x => x.manhanvien === id);
  if (!a) return;
  _editingId = id;
  document.getElementById('panel-title').textContent = 'Chỉnh sửa tài khoản';
  clearForm();
  document.getElementById('f-hoten').value    = a.hoten;
  document.getElementById('f-sdt').value      = a.sodienthoai;
  document.getElementById('f-email').value    = a.email || '';
  document.getElementById('f-loai').value     = a.maloainhanvien;     
  document.getElementById('f-chucvu').value   = a.machucvu;   
  document.getElementById('f-chinhanh').value = a.machinhanh;
  
  document.getElementById('pw-group').style.display = '';
  document.getElementById('pw-hint').style.display  = 'block';
  openSidePanel('acc-panel');
}

function clearForm() {
  ['f-hoten','f-sdt','f-email','f-matkhau'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const elCn = document.getElementById('f-chinhanh');
  if (elCn) elCn.selectedIndex = 0;
  
  const elLoai = document.getElementById('f-loai');
  if (elLoai) elLoai.selectedIndex = 0;

  const elChucVu = document.getElementById('f-chucvu');
  if (elChucVu) elChucVu.selectedIndex = 0;

  ['e-hoten','e-sdt','e-email','e-matkhau','e-chinhanh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function togglePw() {
  const inp = document.getElementById('f-matkhau');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
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
    const dup = currentAccounts.find(a => a.sodienthoai === sdt && a.manhanvien !== _editingId);
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

async function saveAccount() {
  if (!validateForm()) return;

  const data = {
    hoten:          document.getElementById('f-hoten').value.trim(),
    sodienthoai:    document.getElementById('f-sdt').value.trim(),
    email:          document.getElementById('f-email').value.trim(),
    maloainhanvien: document.getElementById('f-loai').value,     
    machucvu:       document.getElementById('f-chucvu').value,   
    machinhanh:     document.getElementById('f-chinhanh').value,
  };

  const matkhauInp = document.getElementById('f-matkhau').value;

  try {
    if (_editingId) {
      if (matkhauInp) data.matkhauMoi = matkhauInp; 
      await apiFetch(`/taikhoan/${_editingId}`, 'PUT', data);
      showToast('Cập nhật tài khoản thành công', 'success');
    } else {
      data.matkhau = matkhauInp;
      await apiFetch('/taikhoan', 'POST', data);
      showToast('Thêm tài khoản thành công', 'success');
    }
    
    _editingId = null; 
    closeSidePanel('acc-panel');

    // Tự động xóa ô tìm kiếm để hiện bản ghi mới (không gây lỗi sập luồng)
    document.getElementById('search-input').value = '';
    
    // Đưa tab về lại Tất cả
    _activeTab = 'all';
    document.querySelectorAll('#tabs .tab-btn').forEach(b => {
      if(b.getAttribute('data-tab') === 'all') b.classList.add('active');
      else b.classList.remove('active');
    });

    await loadAccounts(); 
  } catch (err) {
    console.error('Lỗi lưu tài khoản:', err);
    showToast(err.message || 'Có lỗi xảy ra khi lưu dữ liệu', 'error');
  }
}

/* ── HÀNH ĐỘNG XÓA ── */
function askDelete(id) {
  const a = currentAccounts.find(x => x.manhanvien === id);
  if (!a) return;
  
  document.getElementById('confirm-icon').textContent  = '🗑️';
  document.getElementById('confirm-title').textContent = 'Xóa tài khoản?';
  document.getElementById('confirm-text').textContent  = 
    `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của "${a.hoten}"? Hành động này không thể hoàn tác.`;
  
  const btn = document.getElementById('confirm-ok-btn');
  btn.textContent = 'Xóa';
  btn.className   = 'btn btn-danger';

  _actionCb = () => deleteAccount(id);
  openModal('confirm-modal');
}

async function deleteAccount(id) {
  try {
    await apiFetch(`/taikhoan/${id}`, 'DELETE');
    showToast('Xóa tài khoản thành công', 'success');
    await loadAccounts();
  } catch (err) {
    console.error('Lỗi khi xóa tài khoản:', err);
    showToast(err.message || 'Có lỗi xảy ra khi xóa', 'error');
  }
}

function confirmOk() {
  closeModal('confirm-modal');
  if (_actionCb) { 
    _actionCb(); 
    _actionCb = null; 
  }
}

/* ══════════════════════════════════════════
   KHỞI TẠO TRANG
══════════════════════════════════════════ */
initLayout(['quanly']).then(async user => {
  if (!user) return; 
  try {
    await Promise.all([
      loadChiNhanh(),
      loadChucVu(),
      loadLoaiNhanVien(),
      loadAccounts()
    ]);
  } catch (err) {
    console.error("Lỗi khởi tạo:", err);
  }
});