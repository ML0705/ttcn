
const express = require('express');
const cors = require('cors');
const path = require('path'); // ← thêm dòng này
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
// Kết nối DB
require('./config/db');

// ── Routes (thêm dần từng cái khi đã tạo file) ──
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/lichlam',  require('./routes/lichlam'));   // mở sau
app.use('/api/chamcong', require('./routes/chamcong'));  // mở sau
app.use('/api/taikhoan', require('./routes/taikhoan')); // mở sau
app.use('/api/chinhanh', require('./routes/chinhanh')); // mở sau
app.use('/api/calam',     require('./routes/calam'));      // mở sau

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});