/* ===== HYGGE – Shared JS ===== */

// ---- Navigation ----
function navigate(page) {
  const pages = document.querySelectorAll('.page-view');
  pages.forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  // update sidebar active
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.toggle('active', i.dataset.page === page);
  });
  // update header title
  const titleMap = {
    'dashboard': 'Dashboard cá nhân',
    'attendance': 'Chấm công',
    'history': 'Lịch sử chấm công',
    'register': 'Đăng ký ca làm',
    'mgr-dashboard': 'Dashboard Quản lý',
    'branch': 'Quản lý chi nhánh',
    'accounts': 'Quản lý tài khoản',
    'shifts': 'Quản lý ca làm',
    'schedule': 'Quản lý chấm công',
  };
  const titleEl = document.getElementById('header-title');
  if (titleEl && titleMap[page]) titleEl.textContent = titleMap[page];
  closeMobileSidebar();
}

// ---- Modal helpers ----
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ---- Notification dropdown ----
function toggleNotif() {
  document.getElementById('notif-dropdown')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap');
  const dd   = document.getElementById('notif-dropdown');
  if (dd && wrap && !wrap.contains(e.target)) dd.classList.remove('open');
});

// ---- Toast ----
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

// ---- Confirm popup helper ----
let _confirmCb = null;
function showConfirm(title, text, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent  = text;
  _confirmCb = cb;
  openModal('confirm-modal');
}
function confirmOk() {
  closeModal('confirm-modal');
  if (_confirmCb) { _confirmCb(); _confirmCb = null; }
}

// ---- Form side panel ----
function openSidePanel(panelId) {
  document.getElementById(panelId)?.classList.add('open');
  document.getElementById('side-overlay')?.classList.add('open');
}
function closeSidePanel(panelId) {
  document.getElementById(panelId)?.classList.remove('open');
  document.getElementById('side-overlay')?.classList.remove('open');
}

// ---- Week navigator ----
const DAYS_VN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
function fmtDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ---- Mobile sidebar ----
function toggleMobileSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
  document.querySelector('.mobile-overlay')?.classList.toggle('open');
}
function closeMobileSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.querySelector('.mobile-overlay')?.classList.remove('open');
}