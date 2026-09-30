// Makes the key pair that signs subscription passes.
// The private key goes into the Worker as a secret; the public key goes into web/config.js
// (as a JWK) and into the Android app (as base64 SPKI DER).
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
const spki = await crypto.subtle.exportKey('spki', pair.publicKey);

console.log('1) PRIVATE key — keep secret. Run `npx wrangler secret put SIGNING_KEY_JWK` and paste:\n');
console.log(JSON.stringify(priv));
console.log('\n2) PUBLIC key — paste into web/config.js as PUBLIC_KEY_JWK:\n');
console.log(JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
console.log('\n3) PUBLIC key for the Android app — paste into Config.PUBLIC_KEY_SPKI:\n');
console.log(Buffer.from(spki).toString('base64'));
