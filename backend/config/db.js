const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

const config = {
  connectionString: 'Driver={SQL Server};Server=DESKTOP-FU4M18N\\SQLEXPRESS02;Database=HyggeDB;Trusted_Connection=yes;'
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect
  .then(() => console.log('Kết nối SQL Server thành công'))
  .catch(err => console.error('Lỗi kết nối:', err.message));

module.exports = { sql, pool, poolConnect };