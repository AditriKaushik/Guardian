// Owner support tool: prints the restore code for one subscription, so you can help a
// parent who lost theirs. Find their subscription in the Razorpay dashboard first, then:
//
//   RESTORE_SECRET=... node restore-code.mjs sub_XXXXXXXXXXXX
//   (or: RESTORE_SECRET=... npm run restore-code -- sub_XXXXXXXXXXXX)
//
// Use the same RESTORE_SECRET the Worker has. If you never set one on the Worker, use
// RAZORPAY_KEY_SECRET instead (the Worker falls back to it).
//
// The secret is read only from the environment, never from the command line. To keep it
// out of your shell history, first run:  read -rs RESTORE_SECRET && export RESTORE_SECRET
//
// This must stay in step with restoreMac() in worker.js; worker.test.js checks that it does.

const SUB_ID = /^sub_[A-Za-z0-9]{6,40}$/;
const secret = process.env.RESTORE_SECRET || process.env.RAZORPAY_KEY_SECRET;
const args = process.argv.slice(2);

if (!secret) {
  console.error('Set RESTORE_SECRET (or RAZORPAY_KEY_SECRET) in the environment first (never pass it as an argument).');
  process.exit(1);
}
if (args.length !== 1 || !SUB_ID.test(args[0])) {
  console.error('Usage: RESTORE_SECRET=... node restore-code.mjs sub_XXXXXXXXXXXX');
  process.exit(1);
}

const subId = args[0];
const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('nanha-restore|' + subId));
console.log(`${subId}.${Buffer.from(mac).toString('base64url').slice(0, 16)}`);
