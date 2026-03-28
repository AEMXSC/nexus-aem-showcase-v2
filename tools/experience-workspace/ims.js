/*
 * IMS Authentication Module
 * Uses Adobe IMS (same pattern as da.live / AEM Coder)
 * Client ID: darkalley
 *
 * IMPORTANT: The darkalley client only has da.live as a registered redirect URI.
 * Any redirect-based sign-in will land on da.live, not Experience Workspace.
 * Sign-in uses a POPUP window to keep the main window intact.
 * The IMS library is loaded with autoValidateToken OFF to prevent any
 * automatic redirects during initialization.
 */

const IMS_CLIENT_ID = 'darkalley';
const IMS_SCOPE = 'ab.manage,AdobeID,gnav,openid,org.read,read_organizations,session,aem.frontend.all,additional_info.ownerOrg,additional_info.projectedProductContext,account_cluster.read';
const IMS_LIB_URL = 'https://auth.services.adobe.com/imslib/imslib.min.js';
const IMS_ENV = 'prod';
const IMS_ENDPOINT = 'ims-na1.adobelogin.com';
const IMS_TIMEOUT = 8000;

let imsReady = null;
let profile = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function getToken() {
  // Check our manual token storage first (from popup relay)
  const manual = localStorage.getItem('ew-ims-token');
  if (manual) return manual;
  // Then check the IMS library
  if (!window.adobeIMS) return null;
  try {
    const t = window.adobeIMS.getAccessToken();
    return t?.token || null;
  } catch {
    return null;
  }
}

export function getProfile() {
  return profile;
}

export function isSignedIn() {
  return !!getToken();
}

export function signIn() {
  localStorage.setItem('ew-ims', 'true');

  // Build IMS authorize URL manually.
  // redirect_uri MUST be da.live — it's the only URI registered for darkalley.
  // We open in a popup so Experience Workspace stays in the main window.
  const params = new URLSearchParams({
    client_id: IMS_CLIENT_ID,
    scope: IMS_SCOPE,
    response_type: 'token',
    redirect_uri: 'https://da.live/',
    locale: 'en_US',
  });
  const authUrl = `https://${IMS_ENDPOINT}/ims/authorize/v2?${params}`;

  const w = 600;
  const h = 700;
  const left = Math.round((screen.width - w) / 2);
  const top = Math.round((screen.height - h) / 2);
  const popup = window.open(
    authUrl,
    'adobeImsLogin',
    `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`,
  );

  if (!popup) {
    // Popup blocked — do NOT fall back to redirect (that sends users to da.live).
    // eslint-disable-next-line no-alert
    alert('Pop-up blocked — please allow pop-ups for this site, then click Sign In again.');
    return;
  }

  // Poll for popup close — when user finishes auth and closes, reload
  const pollTimer = setInterval(() => {
    // Try to detect if popup landed on da.live with a token hash
    try {
      const popupUrl = popup.location.href;
      if (popupUrl && popupUrl.includes('access_token=')) {
        const hash = new URL(popupUrl).hash;
        const tokenParams = new URLSearchParams(hash.slice(1));
        const token = tokenParams.get('access_token');
        if (token) {
          localStorage.setItem('ew-ims-token', token);
          clearInterval(pollTimer);
          popup.close();
          window.location.reload();
          return;
        }
      }
    } catch {
      // Cross-origin — expected when popup is on adobelogin.com or da.live
    }

    if (popup.closed) {
      clearInterval(pollTimer);
      // Reload to re-initialize IMS and check for session
      window.location.reload();
    }
  }, 500);
}

export function signOut() {
  localStorage.removeItem('ew-ims');
  localStorage.removeItem('ew-ims-token');
  profile = null;
  if (window.adobeIMS) {
    try { window.adobeIMS.signOut(); } catch { /* ignore */ }
  }
}

export async function loadIms() {
  if (imsReady) return imsReady;

  // Check if there's a manually-relayed access_token in the URL hash
  const hash = window.location.hash;
  if (hash.includes('access_token=')) {
    const tokenParams = new URLSearchParams(hash.slice(1));
    const token = tokenParams.get('access_token');
    if (token) {
      localStorage.setItem('ew-ims-token', token);
      localStorage.setItem('ew-ims', 'true');
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  imsReady = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('IMS timeout — continuing without auth');
      const manualToken = localStorage.getItem('ew-ims-token');
      resolve(manualToken ? { anonymous: false } : { anonymous: true });
    }, IMS_TIMEOUT);

    // autoValidateToken lets the IMS library detect existing sessions.
    // This does NOT cause redirects — only our signIn() call does that,
    // and that's only triggered by the user clicking Sign In.
    window.adobeid = {
      client_id: IMS_CLIENT_ID,
      scope: IMS_SCOPE,
      locale: 'en_US',
      autoValidateToken: true,
      environment: IMS_ENV,
      useLocalStorage: true,
      redirect_uri: window.location.href,
      onReady: async () => {
        clearTimeout(timeout);
        console.log('[IMS] onReady fired');
        let accessToken = null;
        try { accessToken = window.adobeIMS.getAccessToken(); } catch { /* ignore */ }
        if (accessToken) {
          localStorage.setItem('ew-ims', 'true');
          try {
            profile = await window.adobeIMS.getProfile();
            profile.accessToken = accessToken;
            resolve(profile);
          } catch {
            resolve({ accessToken, anonymous: false });
          }
        } else {
          const manualToken = localStorage.getItem('ew-ims-token');
          if (manualToken) {
            localStorage.setItem('ew-ims', 'true');
            resolve({ anonymous: false });
          } else {
            resolve({ anonymous: true });
          }
        }
      },
      onError: (err) => {
        clearTimeout(timeout);
        console.error('IMS error:', err);
        const manualToken = localStorage.getItem('ew-ims-token');
        resolve(manualToken ? { anonymous: false } : { anonymous: true, error: err });
      },
    };

    loadScript(IMS_LIB_URL).catch(() => {
      clearTimeout(timeout);
      console.warn('Failed to load IMS library — continuing without auth');
      resolve({ anonymous: true });
    });
  });

  return imsReady;
}

export async function fetchWithToken(url, opts = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const headers = {
    Authorization: `Bearer ${token}`,
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}
