const fetch = require('node-fetch');

// Cache tọa độ chi nhánh vào memory, tránh gọi API liên tục
// { 'CN01': { lat: 21.02, lng: 105.83 }, ... }
const gpsCache = {};

async function getGPSChiNhanh(machinhanh, diachi) {
  // Đã có cache → trả luôn
  if (gpsCache[machinhanh]) return gpsCache[machinhanh];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(diachi)}&format=json&limit=1`;

  const res  = await fetch(url, {
    headers: { 'User-Agent': 'HyggeApp/1.0' } // Nominatim bắt buộc
  });
  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error(`Không tìm thấy tọa độ cho: ${diachi}`);
  }

  const coords = {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };

  gpsCache[machinhanh] = coords;
  console.log(`📍 Cache GPS ${machinhanh} (${diachi}): ${coords.lat}, ${coords.lng}`);
  return coords;
}

// Công thức Haversine — tính khoảng cách 2 tọa độ (mét)
function tinhKhoangCach(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { getGPSChiNhanh, tinhKhoangCach };