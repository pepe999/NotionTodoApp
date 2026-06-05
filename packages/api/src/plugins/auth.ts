import fp from 'fastify-plugin';
import { randomBytes, createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';
import type { DB } from '../db/index';
import type { Env } from '../env';
import { getSecretKey } from '../auth/jwt';
import { establishSession, resolveSession, revokeSessionCookie } from '../auth/service';
import {
  isGoogleConfigured,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  verifyGoogleIdToken,
} from '../auth/google';
import {
  SESSION_COOKIE,
  OAUTH_TX_COOKIE,
  OAUTH_TX_PATH,
  oauthTxCookieOptions,
  clearCookieOptions,
} from '../auth/cookies';
import { safeEqual } from '../crypto/tokenCrypto';
import { recordAudit } from '../db/auditLog';

export interface AuthPluginOptions {
  db: DB;
  env: Env;
}

const base64url = (buf: Buffer): string => buf.toString('base64url');

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, opts) => {
  const { db, env } = opts;

  // preHandler pro chráněné routy.
  app.decorate('authenticate', async (req, reply) => {
    const resolved = await resolveSession(db, env, req.cookies[SESSION_COOKIE]);
    if (!resolved) {
      reply.clearCookie(SESSION_COOKIE, clearCookieOptions(env));
      reply.status(401).send({ error: 'Unauthorized', message: 'Nepřihlášeno.' });
      return;
    }
    req.user = resolved.user;
    req.sessionId = resolved.session.id;
  });

  // --- Start OAuth (redirect na Google) ---
  app.get('/auth/google', async (_req, reply) => {
    if (!isGoogleConfigured(env)) {
      reply
        .status(501)
        .send({ error: 'NotConfigured', message: 'Google OAuth není nakonfigurováno.' });
      return;
    }
    const state = base64url(randomBytes(16));
    const codeVerifier = base64url(randomBytes(32));
    const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());

    const tx = await new SignJWT({ state, codeVerifier })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(getSecretKey(env.JWT_SECRET));
    reply.setCookie(OAUTH_TX_COOKIE, tx, oauthTxCookieOptions(env));

    return reply.redirect(buildGoogleAuthUrl(env, { state, codeChallenge }));
  });

  // --- OAuth callback ---
  app.get('/auth/google/callback', async (req, reply) => {
    if (!isGoogleConfigured(env)) {
      reply.status(501).send({ error: 'NotConfigured' });
      return;
    }
    const query = req.query as { code?: string; state?: string; error?: string };
    const txCookie = req.cookies[OAUTH_TX_COOKIE];
    reply.clearCookie(OAUTH_TX_COOKIE, clearCookieOptions(env, OAUTH_TX_PATH));

    if (query.error) {
      reply.status(400).send({ error: 'OAuthError', message: query.error });
      return;
    }
    if (!txCookie || !query.code || !query.state) {
      reply.status(400).send({ error: 'InvalidRequest', message: 'Chybí state nebo code.' });
      return;
    }

    let stored: { state: string; codeVerifier: string };
    try {
      const { payload } = await jwtVerify(txCookie, getSecretKey(env.JWT_SECRET), {
        algorithms: ['HS256'],
      });
      if (typeof payload.state !== 'string' || typeof payload.codeVerifier !== 'string') {
        throw new Error('bad tx');
      }
      stored = { state: payload.state, codeVerifier: payload.codeVerifier };
    } catch {
      reply.status(400).send({ error: 'InvalidState', message: 'Neplatná OAuth transakce.' });
      return;
    }

    // CSRF: state z cookie musí odpovídat state z callbacku (konstantně-časově).
    if (!safeEqual(stored.state, query.state)) {
      reply.status(400).send({ error: 'StateMismatch', message: 'Neplatný state parametr.' });
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(env, query.code, stored.codeVerifier);
      const profile = await fetchGoogleUserInfo(tokens.access_token);
      const user = await establishSession(db, env, reply, profile);
      recordAudit(db, {
        userId: user.id,
        event: 'login',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (err) {
      req.log.error({ err }, 'OAuth callback selhal');
      recordAudit(db, { event: 'auth_failed', ip: req.ip, userAgent: req.headers['user-agent'] });
      reply.status(502).send({ error: 'OAuthExchangeFailed', message: 'Přihlášení selhalo.' });
      return;
    }
    return reply.redirect(env.FRONTEND_URL);
  });

  // --- iOS: výměna ověřeného Google id_token za session cookie ---
  app.post('/auth/mobile', async (req, reply) => {
    const audiences = [env.GOOGLE_IOS_CLIENT_ID, env.GOOGLE_CLIENT_ID].filter((a): a is string =>
      Boolean(a),
    );
    if (audiences.length === 0) {
      reply.status(501).send({ error: 'NotConfigured', message: 'Google client ID chybí.' });
      return;
    }
    const body = req.body as { id_token?: string } | undefined;
    if (!body?.id_token) {
      reply.status(400).send({ error: 'InvalidRequest', message: 'Chybí id_token.' });
      return;
    }

    try {
      const profile = await verifyGoogleIdToken(body.id_token, { audiences });
      const user = await establishSession(db, env, reply, profile);
      recordAudit(db, {
        userId: user.id,
        event: 'login',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return reply.send(user);
    } catch (err) {
      req.log.warn({ err }, 'Neplatný Google id_token');
      recordAudit(db, { event: 'auth_failed', ip: req.ip, userAgent: req.headers['user-agent'] });
      reply.status(401).send({ error: 'InvalidToken', message: 'Neplatný id_token.' });
      return;
    }
  });

  // --- Aktuální uživatel ---
  app.get('/auth/me', { preHandler: app.authenticate }, async (req) => req.user);

  // --- Logout (smaže session i bez platného cookie idempotentně) ---
  app.post('/auth/logout', async (req, reply) => {
    const resolved = await resolveSession(db, env, req.cookies[SESSION_COOKIE]);
    if (resolved) {
      recordAudit(db, {
        userId: resolved.user.id,
        event: 'logout',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    revokeSessionCookie(db, env, reply, resolved?.session.id);
    return reply.send({ ok: true });
  });
};

export default fp(authPlugin, { name: 'auth' });
