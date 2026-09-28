import { config } from '../config.js';

/*
 * "Sign in with Google / GitHub" (OAuth 2 authorization code flow, no SDK).
 * Each provider turns a code into a verified email and a name.
 */
// Tenant id of personal Microsoft accounts (outlook.com, hotmail.com…), whose email is verified by Microsoft
const MICROSOFT_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

export const redirectUri = (provider) => `${config.apiUrl}/api/auth/oauth/${provider}/callback`;

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error_description || body.error || `HTTP ${res.status}`);
  return body;
}

export const providers = {
  google: {
    enabled: () => Boolean(config.oauth.google),
    authorizeUrl: (state) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: config.oauth.google.clientId,
        redirect_uri: redirectUri('google'),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      })}`,
    async profile(code) {
      const { access_token: token } = await json(
        await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.oauth.google.clientId,
            client_secret: config.oauth.google.clientSecret,
            redirect_uri: redirectUri('google'),
            grant_type: 'authorization_code',
          }),
        })
      );
      const info = await json(await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${token}` } }));
      return { id: info.sub, email: info.email_verified ? info.email : null, name: info.name || info.email };
    },
  },
  github: {
    enabled: () => Boolean(config.oauth.github),
    authorizeUrl: (state) =>
      `https://github.com/login/oauth/authorize?${new URLSearchParams({
        client_id: config.oauth.github.clientId,
        redirect_uri: redirectUri('github'),
        scope: 'read:user user:email',
        state,
      })}`,
    async profile(code) {
      const { access_token: token } = await json(
        await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ client_id: config.oauth.github.clientId, client_secret: config.oauth.github.clientSecret, code, redirect_uri: redirectUri('github') }),
        })
      );
      const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'ScrumFlow' };
      const [user, emails] = await Promise.all([
        json(await fetch('https://api.github.com/user', { headers })),
        json(await fetch('https://api.github.com/user/emails', { headers })),
      ]);
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      return { id: String(user.id), email: primary?.email ?? null, name: user.name || user.login };
    },
  },
  gitlab: {
    enabled: () => Boolean(config.oauth.gitlab),
    authorizeUrl: (state) =>
      `${config.gitlabUrl}/oauth/authorize?${new URLSearchParams({
        client_id: config.oauth.gitlab.clientId,
        redirect_uri: redirectUri('gitlab'),
        response_type: 'code',
        scope: 'read_user',
        state,
      })}`,
    async profile(code) {
      const { access_token: token } = await json(
        await fetch(`${config.gitlabUrl}/oauth/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            client_id: config.oauth.gitlab.clientId,
            client_secret: config.oauth.gitlab.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri('gitlab'),
          }),
        })
      );
      const user = await json(await fetch(`${config.gitlabUrl}/api/v4/user`, { headers: { authorization: `Bearer ${token}` } }));
      // GitLab only fills confirmed_at once the primary email is confirmed
      return { id: String(user.id), email: user.confirmed_at ? user.email : null, name: user.name || user.username };
    },
  },
  bitbucket: {
    enabled: () => Boolean(config.oauth.bitbucket),
    // Bitbucket uses the callback URL and the permissions set on the OAuth consumer
    authorizeUrl: (state) =>
      `https://bitbucket.org/site/oauth2/authorize?${new URLSearchParams({ client_id: config.oauth.bitbucket.clientId, response_type: 'code', state })}`,
    async profile(code) {
      const basic = Buffer.from(`${config.oauth.bitbucket.clientId}:${config.oauth.bitbucket.clientSecret}`).toString('base64');
      const { access_token: token } = await json(
        await fetch('https://bitbucket.org/site/oauth2/access_token', {
          method: 'POST',
          headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code }),
        })
      );
      const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };
      const [user, emails] = await Promise.all([
        json(await fetch('https://api.bitbucket.org/2.0/user', { headers })),
        json(await fetch('https://api.bitbucket.org/2.0/user/emails', { headers })),
      ]);
      const list = emails.values ?? [];
      const primary = list.find((e) => e.is_primary && e.is_confirmed) ?? list.find((e) => e.is_confirmed);
      return { id: String(user.account_id || user.uuid), email: primary?.email ?? null, name: user.display_name || user.nickname || user.username };
    },
  },
  microsoft: {
    enabled: () => Boolean(config.oauth.microsoft),
    // "common": personal Microsoft accounts and work or school accounts
    authorizeUrl: (state) =>
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
        client_id: config.oauth.microsoft.clientId,
        redirect_uri: redirectUri('microsoft'),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      })}`,
    async profile(code) {
      const { id_token: idToken } = await json(
        await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.oauth.microsoft.clientId,
            client_secret: config.oauth.microsoft.clientSecret,
            redirect_uri: redirectUri('microsoft'),
            grant_type: 'authorization_code',
            scope: 'openid email profile',
          }),
        })
      );
      // Received straight from Microsoft over TLS in exchange for the code, so its claims can be read as is
      const claims = JSON.parse(Buffer.from(String(idToken).split('.')[1] ?? '', 'base64url').toString('utf8') || '{}');
      const personal = claims.tid === MICROSOFT_PERSONAL_TENANT;
      /*
       * A work or school directory can set any address as "email" without
       * proving it. Accounts are matched by email, so only a verified one is
       * used: personal accounts, or the xms_edov claim (added in the app's
       * token configuration) for work accounts.
       */
      const verified = personal || claims.xms_edov === true || claims.xms_edov === 'true' || claims.xms_edov === 1;
      const email = claims.email || (personal ? claims.preferred_username : null);
      return { id: `${claims.tid}:${claims.oid || claims.sub}`, email: verified && email ? email : null, name: claims.name || email };
    },
  },
};

export const enabledProviders = () => Object.fromEntries(Object.entries(providers).map(([name, p]) => [name, p.enabled()]));
