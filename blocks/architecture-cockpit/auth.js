const IMS_AUTH_URL = 'https://ims-na1.adobelogin.com/ims/authorize/v2';
const IMS_USERINFO_URL = 'https://ims-na1.adobelogin.com/ims/userinfo/v2';
const IMS_LOGOUT_URL = 'https://ims-na1.adobelogin.com/ims/logout/v1';

// Replace with your Adobe Developer Console OAuth credentials
const CLIENT_ID = '0528c17ab5194ac19806eb9550b0b1cb';
const SCOPE = 'openid,AdobeID';

const TOKEN_KEY = 'ims.access_token';
const EXPIRY_KEY = 'ims.expires_at';
const STATE_KEY = 'ims.oauth_state';
const PROFILE_KEY = 'ims.profile';

function redirectUri() {
  const { origin, pathname } = window.location;
  return origin + pathname;
}

function generateNonce() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function storeToken(token, expiresIn) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}

export function getStoredToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRY_KEY));
  if (!token || Date.now() >= expiresAt) {
    clearToken();
    return null;
  }
  return token;
}

export function isAuthenticated() {
  return getStoredToken() !== null;
}

export function parseTokenFromHash() {
  const { hash } = window.location;
  if (!hash || !hash.includes('access_token')) return;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const state = params.get('state');

  const savedState = sessionStorage.getItem(STATE_KEY);
  if (!accessToken || !state || state !== savedState) return;

  storeToken(accessToken, Number(expiresIn) || 3600);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function login() {
  const state = generateNonce();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPE,
    response_type: 'token',
    state,
  });

  window.location.href = `${IMS_AUTH_URL}?${params.toString()}`;
}

export function logout() {
  const token = getStoredToken();
  clearToken();

  if (token) {
    const params = new URLSearchParams({
      access_token: token,
      redirect_uri: redirectUri(),
    });
    window.location.href = `${IMS_LOGOUT_URL}?${params.toString()}`;
  } else {
    window.location.reload();
  }
}

export async function fetchUserProfile(token) {
  const cached = sessionStorage.getItem(PROFILE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through */ }
  }

  try {
    const res = await fetch(IMS_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) clearToken();
      return null;
    }
    const profile = await res.json();
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    return null;
  }
}
