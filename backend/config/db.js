const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

// Ưu tiên đọc tên Server từ file .env.
// Nếu không có file .env, tự động lấy giá trị mặc định bên phải.
const serverName = process.env.DB_SERVER || 'DESKTOP-FU4M18N\\SQLEXPRESS02';
const dbName = process.env.DB_NAME || 'HyggeDB';

const config = {
  connectionString: `Driver={SQL Server};Server=${serverName};Database=${dbName};Trusted_Connection=yes;`
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect
  .then(() => console.log(`✅ Kết nối SQL Server (${serverName}) thành công!`))
  .catch(err => console.error('❌ Lỗi kết nối:', err.message));

module.exports = { sql, pool, poolConnect };