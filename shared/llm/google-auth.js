/**
 * Service account JSON → Google OAuth access token (browser / plugin).
 */

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function base64UrlEncode(bytes) {
  let str = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(obj) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

async function signJwt(unsigned, privateKeyPem) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = new TextEncoder().encode(unsigned);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  return base64UrlEncode(new Uint8Array(sig));
}

/**
 * @param {object} serviceAccount
 */
export async function getAccessTokenFromServiceAccount(serviceAccount) {
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error("invalid_service_account_json");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  };
  const unsigned = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claim)}`;
  const signature = await signJwt(unsigned, serviceAccount.private_key);
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "token_exchange_failed");
  }
  return data.access_token;
}

/**
 * @param {string} jsonText
 */
export async function getAccessTokenFromVertexJson(jsonText) {
  const sa = JSON.parse(jsonText);
  return getAccessTokenFromServiceAccount(sa);
}
