// Sign-in with Google/GitHub uses PKCE: a random secret (verifier) whose SHA-256 goes out with the request.
// supabase-js reads both from the Web Crypto API, which React Native's engine doesn't have, so it fell back
// to Math.random and sent the secret in plain ("WebCrypto API is not supported" warning). expo-crypto
// fills in the two functions it needs from the phone's secure random source and native SHA-256.
import * as ExpoCrypto from 'expo-crypto';

const c = globalThis.crypto || (globalThis.crypto = {});
if (typeof c.getRandomValues !== 'function') {
  c.getRandomValues = (array) => ExpoCrypto.getRandomValues(array);
}
if (!c.subtle) {
  c.subtle = {
    digest: (algorithm, data) => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
      if (name !== 'SHA-256') return Promise.reject(new Error(`digest ${name} is not available`));
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
    },
  };
}
