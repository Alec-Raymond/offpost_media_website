const bcrypt = require('bcrypt');

const passcode = process.argv[2];
if (!passcode) {
  console.error('Usage: node scripts/hash-passcode.js "your-passcode"');
  process.exit(1);
}

bcrypt.hash(passcode, 12).then(hash => {
  console.log('\nAdd this to your .env file:\n');
  console.log(`ADMIN_PASSCODE=${hash}`);
  console.log('');
});
