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
       3) Các helper UI dùng chung: modal, toast, confirm, side panel,
          week navigator, mobile sidebar
   - GIẢ ĐỊNH: server Node.js phục vụ thư mục frontend/ làm static
     root (xem ghi chú server.js ở cuối file). Nhờ đó các đường dẫn
     "/employee/..." hay "/manager/..." trong MENU_CONFIG luôn đúng,
     bất kể trang hiện tại đang nằm ở thư mục nào.
=================================================================== */


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
      { href: '/manager/calm.html',     label: 'Quản lý ca làm',    icon: '🗓️', roles: ['quanly'] },
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
  '/manager/calm.html':       'Quản lý ca làm',
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
          <span>${item.icon}</span> ${item.label}
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

  root.innerHTML = `
    <button class="header-menu-btn" onclick="toggleMobileSidebar()">☰</button>
    <div class="header-title">${title}</div>
    <div class="header-right">
      <div class="notif-wrap">
        <button class="notif-btn" onclick="toggleNotif()">
          🔔<span class="notif-badge" id="notif-count">0</span>
        </button>
        <div class="notif-dropdown" id="notif-dropdown">
          <div class="notif-header"><span>Thông báo</span></div>
          <div class="notif-list" id="notif-list"></div>
          <div class="notif-footer">Xem tất cả</div>
        </div>
      </div>
      <div class="header-avatar" title="${user?.hoten || ''}">${initials}</div>
    </div>`;

  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.textContent =
      (role === 'quanly' ? 'Quản lý' : 'Nhân viên') +
      (user?.tenchinhanh ? ' · ' + user.tenchinhanh : '');
  }
}


/* ---------------- 4. ĐĂNG NHẬP / PHÂN QUYỀN ----------------
   Đây là điểm tích hợp API auth (Giai đoạn 3, bước 1).
   - Hiện tại: dùng "mockUser" trong localStorage để dựng & test
     sidebar/giao diện khi backend chưa xong.
   - Khi backend xong: xoá nhánh mockUser, bật đoạn fetch thật.
------------------------------------------------------------- */

async function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  /* --- TẠM THỜI (chưa có API /api/auth/me) --- */
  const mock = localStorage.getItem('mockUser');
  if (mock) return JSON.parse(mock);

  /* --- KHI BACKEND XONG: bỏ comment đoạn dưới, xoá đoạn mock trên --- */
  // try {
  //   const res = await fetch('/api/auth/me', {
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  //   if (!res.ok) return null;
  //   return await res.json();
  // } catch {
  //   return null;
  // }

  return null;
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

function toggleNotif() {
  document.getElementById('notif-dropdown')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap');
  const dd = document.getElementById('notif-dropdown');
  if (dd && wrap && !wrap.contains(e.target)) dd.classList.remove('open');
});


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