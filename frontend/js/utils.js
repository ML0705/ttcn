/* ===== HYGGE – utils.js ===== */

// ---- API fetch ----
const BASE = 'http://localhost:3000/api';

async function apiFetch(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${endpoint}`, opts);
    if (res.status === 401) {
      localStorage.clear();
      location.href = '/login.html';
      return;
    }
    return await res.json();
  } catch (err) {
    showToast('Lỗi kết nối server', 'error');
    throw err;
  }
}

// ---- Auth helpers ----
function requireAuth(role) {
  const token    = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  if (!token) return location.href = '/login.html';
  if (role && userRole !== role) return location.href = '/login.html';
}

function getCurrentUser() {
  return {
    id:    localStorage.getItem('userId'),
    name:  localStorage.getItem('userName'),
    role:  localStorage.getItem('role'),
    token: localStorage.getItem('token')
  };
}

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}