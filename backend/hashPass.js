const bcrypt = require('bcryptjs');

async function main() {
  const phones = [
    '0901111111',
    '0902222222',
    '0903333333',
    '0904444444',
    '0905555555'
  ];
  for (const phone of phones) {
    const hash = await bcrypt.hash(phone, 10);
    console.log(`${phone}  →  '${hash}'`);
  }
}
main();