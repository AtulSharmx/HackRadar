// Sign-in with Google/GitHub uses PKCE: a random secret (verifier) whose SHA-256 goes out with the request.
// supabase-js reads both from the Web Crypto API, which React Native's engine doesn't have, so it fell back
// to Math.random and sent the secret in plain ("WebCrypto API is not supported" warning). expo-crypto
// fills in the two functions it needs from the phone's secure random source and native SHA-256.
// A build made before expo-crypto was added has no native module: then nothing is filled in (the old
// behaviour, with the warning) instead of crashing at start.
let ExpoCrypto = null;
try {
  ExpoCrypto = require('expo-crypto'); // eslint-disable-line global-require
  ExpoCrypto.getRandomValues(new Uint8Array(1)); // throws here when the native side is missing
} catch {
  ExpoCrypto = null;
}

const c = globalThis.crypto || {};
if (ExpoCrypto && typeof c.getRandomValues !== 'function') {
  c.getRandomValues = (array) => ExpoCrypto.getRandomValues(array);
}
if (ExpoCrypto && !c.subtle) {
  c.subtle = {
    digest: (algorithm, data) => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
      if (name !== 'SHA-256') return Promise.reject(new Error(`digest ${name} is not available`));
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
    },
  };
}
if (ExpoCrypto && !globalThis.crypto) globalThis.crypto = c;
