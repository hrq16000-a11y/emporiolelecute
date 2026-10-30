// Minimal Web Push (VAPID + aes128gcm) implementation using WebCrypto.
// Deno-native: no npm dependency, works inside Supabase Edge Functions.

const enc = new TextEncoder();

const b64urlToBytes = (input: string): Uint8Array => {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const concat = (...arrays: Uint8Array[]): Uint8Array => {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
};

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

async function importVapidKey(privateD: string, publicRaw: string): Promise<CryptoKey> {
  const raw = b64urlToBytes(publicRaw);
  const x = bytesToB64url(raw.slice(1, 33));
  const y = bytesToB64url(raw.slice(33, 65));
  return await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateD, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(audience: string, subject: string, privateD: string, publicRaw: string): Promise<string> {
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const unsigned = `${header}.${payload}`;
  const key = await importVapidKey(privateD, publicRaw);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)),
  );
  return `${unsigned}.${bytesToB64url(sig)}`;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushResult {
  ok: boolean;
  status: number;
  error?: string;
  /** Subscription is gone (404/410) and should be deleted. */
  expired?: boolean;
}

/** Send a Web Push message encrypted with aes128gcm. */
export async function sendWebPush(
  sub: PushSubscriptionRecord,
  payload: string,
  vapid: { publicKey: string; privateKey: string; subject: string },
  ttl = 3600,
): Promise<WebPushResult> {
  try {
    const clientPublic = b64urlToBytes(sub.p256dh);
    const authSecret = b64urlToBytes(sub.auth);

    // Ephemeral ECDH key pair
    const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const localPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));

    const clientKey = await crypto.subtle.importKey(
      "raw",
      clientPublic,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, localKeys.privateKey, 256),
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));

    const keyInfo = concat(
      enc.encode("WebPush: info\0"),
      clientPublic,
      localPublicRaw,
    );
    const ikm = await hkdf(authSecret, shared, keyInfo, 32);
    const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

    const plaintext = concat(enc.encode(payload), new Uint8Array([2]));
    const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, plaintext),
    );

    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, 4096);
    const body = concat(
      salt,
      recordSize,
      new Uint8Array([localPublicRaw.length]),
      localPublicRaw,
      ciphertext,
    );

    const url = new URL(sub.endpoint);
    const jwt = await buildVapidJwt(`${url.protocol}//${url.host}`, vapid.subject, vapid.privateKey, vapid.publicKey);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttl),
        Urgency: "normal",
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body,
    });

    if (res.ok) return { ok: true, status: res.status };
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 300),
      expired: res.status === 404 || res.status === 410,
    };
  } catch (e) {
    return { ok: false, status: 0, error: String((e as Error).message || e).slice(0, 300) };
  }
}
