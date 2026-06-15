/* ===================================================================
   HYGGE – shared.js (dùng chung cho mọi trang frontend)

   GHI CHÚ KIẾN TRÚC
   - Dự án dùng nhiều trang HTML riêng (MPA), KHÔNG phải SPA.
   - Hàm navigate() kiểu cũ (ẩn/hiện .page-view trong 1 trang) đã bị
     loại bỏ vì không còn phù hợp. Điều hướng giữa các trang = link
     <a href="..."> hoặc location.href tới đúng file .html.
   - File này chỉ còn nhiệm vụ:
       1) Dựng sidebar + header dùng chung từ MENU_CONFIG
       2) Kiểm tra đăng nhập / phân quyền trước khi hiển thị trang
       3) Gọi API có gắn token (apiFetch)
       4) Các helper UI dùng chung: modal, toast, confirm, side panel,
          week navigator, mobile sidebar
   - GIẢ ĐỊNH: server Node.js phục vụ thư mục frontend/ làm static
     root (xem ghi chú server.js ở cuối file).
=================================================================== */


/* ---------------- 0. API BASE + apiFetch ---------------- */

const API_BASE = 'http://localhost:3000/api';

/**
 * Gọi API backend có gắn sẵn token (Authorization: Bearer ...).
 *
 * @param {string} path   ví dụ '/calm', '/lichlam/tuan?start=2026-06-15'
 * @param {string} method 'GET' | 'POST' | 'PUT' | 'DELETE' (default 'GET')
 * @param {object} body   object sẽ JSON.stringify (bỏ qua nếu GET/DELETE không có body)
 * @returns {Promise<any>} dữ liệu JSON trả về từ server
 * @throws {Error} nếu response không ok — error.message = message từ server (hoặc text mặc định)
 *                  error.status = HTTP status code
 *                  Riêng 401 (token hết hạn) -> tự logout + chuyển về /login.html
 */
async function apiFetch(path, method = 'GET', body = null) {
  const token = localStorage.getItem('token');

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('Không thể kết nối server');
  }

  // Token hết hạn / không hợp lệ -> đăng xuất luôn
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
    throw new Error('Phiên đăng nhập đã hết hạn');
  }

  // Không có nội dung trả về (ví dụ DELETE 204)
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(data?.message || 'Có lỗi xảy ra');
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}


/* ---------------- 1. CẤU HÌNH MENU DÙNG CHUNG CHO 2 ROLE ---------------- */

const MENU_CONFIG = [
  {
    group: 'Cá nhân',
    items: [
      { href: '/employee/dashboard.html', label: 'Dashboard',          icon: '📊', roles: ['nhanvien'] },
      { href: '/employee/dangky.html',    label: 'Đăng ký ca làm',     icon: '📅', roles: ['nhanvien'] },
      { href: '/employee/chamcong.html',  label: 'Chấm công',          icon: '🕐', roles: ['nhanvien'] },
      { href: '/employee/lichsu.html',    label: 'Lịch sử chấm công',  icon: '📋', roles: ['nhanvien'] },
    ],
  },
  {
    group: 'Quản lý',
    items: [
      { href: '/manager/lichlam.html',  label: 'Điều phối lịch làm', icon: '🗂️', roles: ['quanly'] },
      { href: '/manager/chamcong.html', label: 'Quản lý chấm công',  icon: '⏱️', roles: ['quanly'] },
    ],
  },
  {
    group: 'Hệ thống',
    items: [
      { href: '/manager/chinhanh.html', label: 'Quản lý chi nhánh', icon: '🏬', roles: ['quanly'] },
      { href: '/manager/taikhoan.html', label: 'Quản lý tài khoản', icon: '👥', roles: ['quanly'] },
      { href: '/manager/calam.html',     label: 'Quản lý ca làm',    icon: '🗓️', roles: ['quanly'] },
    ],
  },
];

/* Tiêu đề header tương ứng từng trang (key = pathname) */
const PAGE_TITLES = {
  '/employee/dashboard.html': 'Dashboard cá nhân',
  '/employee/dangky.html':    'Đăng ký ca làm',
  '/employee/chamcong.html':  'Chấm công',
  '/employee/lichsu.html':    'Lịch sử chấm công',
  '/manager/lichlam.html':    'Điều phối lịch làm',
  '/manager/chamcong.html':   'Quản lý chấm công',
  '/manager/chinhanh.html':   'Quản lý chi nhánh',
  '/manager/taikhoan.html':   'Quản lý tài khoản',
  '/manager/calam.html':       'Quản lý ca làm',
};

const ICON_SVG = {
  '📊': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  '📅': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  '🕐': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  '📋': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 9h6M9 13h6M9 17h4"/></svg>`,
  '🗂️': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M9 16l2 2 4-4"/></svg>`,
  '⏱️': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-5"/></svg>`,
  '🏬': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M3 9l1-5h16l1 5"/><path d="M3 9v10h18V9"/><path d="M9 21v-6h6v6"/></svg>`,
  '👥': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="17" cy="8" r="2.5"/><path d="M22 20c0-2.6-1.9-4.8-4.5-5.6"/></svg>`,
  '🗓️': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
};

/* ---------------- 2. DỰNG SIDEBAR ---------------- */

function renderSidebar(role) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;

  const currentPath = window.location.pathname;
  let html = `
    <div class="sidebar-logo">
      <div class="brand">HYGGE <span class="brand-accent">HR</span></div>
      <div class="sub" id="role-badge"></div>
    </div>
    <nav class="sidebar-menu">`;

  MENU_CONFIG.forEach(group => {
    const items = group.items.filter(i => i.roles.includes(role));
    if (items.length === 0) return; // ẩn cả nhóm nếu role không có quyền nào trong nhóm

    html += `<div class="sidebar-section-label">${group.group}</div>`;
    items.forEach(item => {
      const active = currentPath === item.href ? ' active' : '';
      html += `
        <a class="sidebar-item${active}" href="${item.href}">
          <span class="sidebar-icon">${ICON_SVG[item.icon] || ''}</span>
          <span>${item.label}</span>
        </a>`;
    });
  });

  html += `</nav>`;
  root.innerHTML = html;
}


/* ---------------- 3. DỰNG HEADER (tiêu đề trang + chuông + avatar) ---------------- */

function renderHeader(role, user) {
  const root = document.getElementById('header-root');
  if (!root) return;

  const title = PAGE_TITLES[window.location.pathname] || '';
  const initials = (user?.hoten || 'NV')
    .split(' ')
    .map(w => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  const notifCount = 0; // TODO: thay bằng số thông báo chưa đọc thật
  root.innerHTML = `
    <button class="header-menu-btn" onclick="toggleMobileSidebar()">☰</button>
    <div class="header-title">${title}</div>
    <div class="header-right">
      <div class="notif-wrap">
        <button class="notif-btn" onclick="toggleDropdown('notif-dropdown')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
           <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
         </svg>
  ${notifCount > 0 ? `<span class="notif-badge" id="notif-count">${notifCount}</span>` : ''}
</button>
        <div class="notif-dropdown" id="notif-dropdown">
          <div class="notif-header"><span>Thông báo</span></div>
          <div class="notif-list" id="notif-list"></div>
          <div class="notif-footer">Xem tất cả</div>
        </div>
      </div>
      <!-- Avatar: bấm vào để xem thông tin cá nhân + đăng xuất -->
      <div class="notif-wrap">
        <div class="header-avatar" title="${user?.hoten || ''}" onclick="toggleDropdown('user-dropdown')">${initials}</div>
        <div class="notif-dropdown" id="user-dropdown" style="width: 260px;">
          <div class="notif-header"><span>Thông tin cá nhân</span></div>
          <div class="notif-list">
            <div style="padding: 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border);">
              <div class="header-avatar" style="width: 40px; height: 40px; font-size: 14px; cursor: default;">${initials}</div>
              <div>
                <div style="font-weight: 700; font-size: 13px;">${user?.hoten || ''}</div>
                <div class="text-sm text-muted">${user?.tenchucvu || (role === 'quanly' ? 'Quản lý' : 'Nhân viên')}</div>
              </div>
            </div>
            <div style="padding: 12px 14px; font-size: 12px; color: var(--ink-soft); line-height: 2;">
              <div> Mã NV: <strong>${user?.manhanvien || '--'}</strong></div>
              <div> SĐT: <strong>${user?.sodienthoai || '--'}</strong></div>
              <div> Email: <strong>${user?.email || '--'}</strong></div>
              <div> Chi nhánh: <strong>${user?.tenchinhanh || '--'}</strong></div>
              <div> Loại NV: <strong>${user?.tenloainhanvien || '--'}</strong></div>
            </div>
          </div>
          <div class="notif-footer" style="text-align: left; color: var(--red);" onclick="logout()">🚪 Đăng xuất</div>
        </div>
      </div>
    </div>`;

  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.textContent =
      (role === 'quanly' ? 'Quản lý' : 'Nhân viên') +
      (user?.tenchinhanh ? ' · ' + user.tenchinhanh : '');
  }
}


/* ---------------- 4. ĐĂNG NHẬP / PHÂN QUYỀN ----------------
   - login.html lưu vào localStorage: token, vaiTro ('manager'|'employee'),
     hoten, machinhanh, manhanvien (xem login.html).
   - getCurrentUser() gọi GET /api/auth/me (gắn token) để lấy đầy đủ
     thông tin (email, sodienthoai, tenchinhanh, tenloainhanvien...)
     và field "role" ('quanly'|'nhanvien') dùng cho MENU_CONFIG.
------------------------------------------------------------- */

async function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const user = await apiFetch('/auth/me');
    // user = { manhanvien, hoten, email, sodienthoai, machinhanh,
    //          tenchinhanh, maloainhanvien, tenloainhanvien,
    //          tenchucvu, vaiTro, role }
    return user;
  } catch (err) {
    // Token hết hạn -> apiFetch đã tự logout + redirect, không cần làm thêm
    // Lỗi khác (server lỗi, mất mạng) -> coi như chưa đăng nhập
    return null;
  }
}

/**
 * Gọi ở đầu mỗi trang (trừ login.html).
 * - Chưa đăng nhập      -> chuyển về /login.html
 * - Sai role yêu cầu    -> chuyển về trang chủ tương ứng role thật
 * - Hợp lệ              -> dựng sidebar + header, trả về user
 *
 * @param {string[]} requiredRoles ví dụ ['nhanvien'] hoặc ['quanly']
 */
async function initLayout(requiredRoles) {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    window.location.href =
      user.role === 'quanly' ? '/manager/lichlam.html' : '/employee/dashboard.html';
    return null;
  }

  renderSidebar(user.role);
  renderHeader(user.role, user);
  return user;
}


/* ---------------- 5. MODAL ---------------- */

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}


/* ---------------- 6. NOTIFICATION DROPDOWN ---------------- */

/**
 * Mở/đóng 1 dropdown theo id, tự đóng các dropdown khác đang mở.
 * Dùng cho cả #notif-dropdown (chuông) và #user-dropdown (avatar).
 */
function toggleDropdown(id) {
  document.querySelectorAll('.notif-dropdown').forEach(dd => {
    if (dd.id !== id) dd.classList.remove('open');
  });
  document.getElementById(id)?.classList.toggle('open');
}

// Đóng dropdown khi bấm ra ngoài
document.addEventListener('click', e => {
  document.querySelectorAll('.notif-wrap').forEach(wrap => {
    if (!wrap.contains(e.target)) {
      wrap.querySelector('.notif-dropdown')?.classList.remove('open');
    }
  });
});
function logout() {
  localStorage.clear();
  window.location.href = '/login.html';
}

/* ---------------- 7. TOAST ---------------- */

function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      padding:10px 18px; border-radius:6px; font-size:13px; font-weight:500;
      color:#fff; box-shadow:0 4px 16px rgba(0,0,0,.15);
      transition:opacity .3s; opacity:0; pointer-events:none;
    `;
    document.body.appendChild(toast);
  }
  const bg = { success: '#27AE60', error: '#E74C3C', info: '#2980B9' };
  toast.style.background = bg[type] || bg.success;
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}


/* ---------------- 8. CONFIRM POPUP ---------------- */

let _confirmCb = null;
function showConfirm(title, text, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  _confirmCb = cb;
  openModal('confirm-modal');
}
function confirmOk() {
  closeModal('confirm-modal');
  if (_confirmCb) { _confirmCb(); _confirmCb = null; }
}


/* ---------------- 9. SIDE PANEL (form thêm/sửa dạng trượt) ---------------- */

function openSidePanel(panelId) {
  document.getElementById(panelId)?.classList.add('open');
  document.getElementById('side-overlay')?.classList.add('open');
}
function closeSidePanel(panelId) {
  document.getElementById(panelId)?.classList.remove('open');
  document.getElementById('side-overlay')?.classList.remove('open');
}


/* ---------------- 10. WEEK NAVIGATOR (dùng cho đăng ký ca / điều phối) ---------------- */

const DAYS_VN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 = CN
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}


/* ---------------- 11. MOBILE SIDEBAR ---------------- */

function toggleMobileSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
  document.querySelector('.mobile-overlay')?.classList.toggle('open');
}
function closeMobileSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.querySelector('.mobile-overlay')?.classList.remove('open');
}


/* ===================================================================
   GHI CHÚ server.js (để mọi đường dẫn "/employee/..", "/manager/.."
   trong MENU_CONFIG hoạt động đúng):

     const path = require('path');
     app.use(express.static(path.join(__dirname, '../frontend')));

   -> Cần đưa login.html (và index.html nếu có) vào trong frontend/
      để cùng được phục vụ từ static root này, tránh phải khai báo
      route riêng cho từng file lẻ.
=================================================================== */