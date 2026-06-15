console.log("🔥 Đã chạy file db.js");
const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

const serverName = process.env.DB_SERVER || 'DESKTOP-48HRFI4\\SQLEXPRESS01';
const dbName = process.env.DB_NAME || 'HyggeDB';

const config = {
  connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${serverName},1433;Database=${dbName};Trusted_Connection=yes;`
};

console.log("⏳ Bắt đầu connect...");

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect
  .then(() => console.log(`✅ Kết nối SQL Server (${serverName}) thành công!`))
  .catch(err => console.error('❌ Lỗi kết nối:', err.message));

module.exports = { sql, pool, poolConnect };