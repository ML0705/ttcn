/* =====================================================
   chinhanh.js — logic trang Quản lý Chi Nhánh
===================================================== */

let currentBranches = []; 
let _editingId = null;
let _deleteId = null;

async function initChinhanh() {
  await loadBranches();
}

async function loadBranches() {
  try {
    const res = await apiFetch('/chinhanh');
    currentBranches = res.data || res || [];
    renderAll();
  } catch (err) {
    console.error('Lỗi tải danh sách:', err);
    showToast('Không thể tải chi nhánh', 'error');
  }
}

// ═══════════════════════════════════════════════════
// HÀM XỬ LÝ CHUỖI THỜI GIAN TỪ SQL SERVER
// ═══════════════════════════════════════════════════
function formatTime(val) {
  if (!val) return '';
  // Nếu DB trả về dạng ISO DateTime (VD: 1970-01-01T07:30:00.000Z)
  if (val.includes('T')) {
    return val.split('T')[1].substring(0, 5); // Cắt lấy đúng 5 ký tự đầu sau chữ T (HH:mm)
  }
  // Nếu DB trả về dạng chuỗi thường (VD: 07:30:00)
  return val.substring(0, 5);
}
// ═══════════════════════════════════════════════════

function renderAll() {
  updateStats();
  renderGrid(currentBranches);
}

function updateStats() {
  const total    = currentBranches.length;
  const active   = currentBranches.filter(b => b.trangthai == 1).length;
  const inactive = total - active;
  
  document.getElementById('s-total').textContent    = total;
  document.getElementById('s-active').textContent   = active;
  document.getElementById('s-inactive').textContent = inactive;
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
  const isActive = (b.trangthai == 1);
  const statusCls = isActive ? 'active' : 'inactive';
  
  // Dùng hàm formatTime để in ra thẻ cho đẹp
  const gioMo = formatTime(b.giomocua) || '00:00';
  const gioDong = formatTime(b.giodongcua) || '00:00';

  return `
  <div class="branch-card">
    <div class="branch-card-header">
      <div class="branch-name"><strong>${b.tenchinhanh}</strong> (${b.machinhanh})</div>
      <div class="branch-actions">
        <button class="btn-icon" onclick="openEditPanel('${b.machinhanh}')">✏️</button>
        <button class="btn-icon" style="color:var(--red);" onclick="askDelete('${b.machinhanh}')">🗑️</button>
      </div>
    </div>
    <div class="branch-meta">
      <div>📍 ${b.diachi || '—'}</div>
      <div>📞 ${b.sdtcn || '—'}</div>
      <div>⏰ ${gioMo} - ${gioDong}</div>
      <div class="status-dot ${statusCls}">${isActive ? 'Hoạt động' : 'Ngừng'}</div>
    </div>
  </div>`;
}

function filterBranches() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const status = document.getElementById('filter-status').value;

  const filtered = currentBranches.filter(b => {
    const matchQ = !q || 
                   (b.tenchinhanh && b.tenchinhanh.toLowerCase().includes(q)) || 
                   (b.diachi && b.diachi.toLowerCase().includes(q)) || 
                   (b.machinhanh && b.machinhanh.toLowerCase().includes(q));
    
    const matchS = (status === '') || (String(b.trangthai ? "1" : "0") === status);
    
    return matchQ && matchS;
  });

  renderGrid(filtered);
}

async function saveBranch() {
  if (!validateForm()) return;

  const data = {
    tenchinhanh: document.getElementById('f-ten').value.trim(),
    diachi:      document.getElementById('f-diachi').value.trim(),
    sdtcn:       document.getElementById('f-sdt').value.trim(),
    giomocua:    document.getElementById('f-mo').value,
    giodongcua:  document.getElementById('f-dong').value,
    trangthai:   Number(document.getElementById('f-trangthai').value)
  };

  try {
    if (_editingId) {
      await apiFetch(`/chinhanh/${_editingId}`, 'PUT', data);
      showToast('Cập nhật thành công', 'success');
    } else {
      await apiFetch('/chinhanh', 'POST', data);
      showToast('Thêm chi nhánh thành công', 'success');
    }
    closeSidePanel('branch-panel');
    await loadBranches(); 
  } catch (err) {
    showToast(err.message || 'Lỗi server', 'error');
  }
}

function openAddPanel() {
  _editingId = null;
  document.getElementById('panel-title').textContent = 'Thêm chi nhánh';
  clearForm();
  document.getElementById('f-trangthai').value = '1';
  openSidePanel('branch-panel');
}

function openEditPanel(id) {
  const b = currentBranches.find(x => x.machinhanh === id);
  if (!b) return;
  _editingId = id;
  document.getElementById('panel-title').textContent = 'Chỉnh sửa chi nhánh';
  
  document.getElementById('f-ten').value = b.tenchinhanh;
  document.getElementById('f-diachi').value = b.diachi || '';
  document.getElementById('f-sdt').value = b.sdtcn || '';
  
  // Dùng hàm formatTime để cắt lấy chuẩn HH:mm ép vào thẻ input type="time"
  document.getElementById('f-mo').value = formatTime(b.giomocua);
  document.getElementById('f-dong').value = formatTime(b.giodongcua);
  
  document.getElementById('f-trangthai').value = b.trangthai ? "1" : "0";
  openSidePanel('branch-panel');
}

function clearForm() {
  ['f-ten','f-diachi','f-sdt','f-mo','f-dong'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function validateForm() {
  let ok = true;
  const ten = document.getElementById('f-ten').value.trim();
  const sdt = document.getElementById('f-sdt').value.trim();
  
  if (!ten) { document.getElementById('e-ten').textContent = 'Bắt buộc'; ok = false; }
  else { const el = document.getElementById('e-ten'); if(el) el.textContent = ''; }

  // Check SDT rỗng cũng ok, nhưng có nhập thì phải 10 số
  if (sdt && !/^\d{10}$/.test(sdt)) { 
    const el = document.getElementById('e-sdt'); if(el) el.textContent = 'SĐT sai'; ok = false; 
  } else { 
    const el = document.getElementById('e-sdt'); if(el) el.textContent = ''; 
  }

  return ok;
}

function askDelete(id) {
  _deleteId = id;
  document.getElementById('confirm-text').textContent = 'Bạn có chắc chắn muốn xóa chi nhánh này?';
  openModal('confirm-modal');
}

async function confirmOk() {
  try {
    await apiFetch(`/chinhanh/${_deleteId}`, 'DELETE');
    closeModal('confirm-modal');
    await loadBranches();
  } catch (err) {
    showToast(err.message, 'error');
  }
}