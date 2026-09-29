// Makes the key pair that signs subscription passes.
// The private key goes into the Worker as a secret; the public key goes into web/config.js.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);

console.log('1) PRIVATE key — keep secret. Run `npx wrangler secret put SIGNING_KEY_JWK` and paste:\n');
console.log(JSON.stringify(priv));
console.log('\n2) PUBLIC key — paste into web/config.js as PUBLIC_KEY_JWK:\n');
console.log(JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
