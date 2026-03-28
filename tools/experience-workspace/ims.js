/*
 * IMS Authentication Module
 * Uses Adobe IMS (same pattern as da.live / AEM Coder)
 * Client ID: darkalley
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
  if (!window.adobeIMS) return null;
  const t = window.adobeIMS.getAccessToken();
  return t?.token || null;
}

export function getProfile() {
  return profile;
}

export function isSignedIn() {
  return !!getToken();
}

export function signIn() {
  localStorage.setItem('ew-ims', 'true');
  if (window.adobeIMS) {
    window.adobeIMS.signIn({
      redirect_uri: `${window.location.origin}${window.location.pathname}`,
    });
  }
}

export function signOut() {
  localStorage.removeItem('ew-ims');
  profile = null;
  if (window.adobeIMS) {
    window.adobeIMS.signOut();
  }
}

export async function loadIms() {
  if (imsReady) return imsReady;

  imsReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn('IMS timeout — continuing without auth');
      resolve({ anonymous: true });
    }, IMS_TIMEOUT);

    // Redirect back to THIS page after sign-in (not da.live)
    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    window.adobeid = {
      client_id: IMS_CLIENT_ID,
      scope: IMS_SCOPE,
      locale: 'en_US',
      autoValidateToken: true,
      environment: IMS_ENV,
      useLocalStorage: true,
      redirect_uri: redirectUri,
      onReady: async () => {
        clearTimeout(timeout);
        const accessToken = window.adobeIMS.getAccessToken();
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
          localStorage.removeItem('ew-ims');
          resolve({ anonymous: true });
        }
      },
      onError: (err) => {
        clearTimeout(timeout);
        console.error('IMS error:', err);
        resolve({ anonymous: true, error: err });
      },
    };

    loadScript(IMS_LIB_URL).catch(() => {
      clearTimeout(timeout);
      console.warn('Failed to load IMS library');
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
