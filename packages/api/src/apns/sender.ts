import http2 from 'node:http2';
import type { ApnsConfig } from './token';
import { getProviderToken } from './token';

export interface ApnsPayload {
  title: string;
  body: string;
  taskId?: string;
}

export interface ApnsResult {
  ok: boolean;
  status: number;
  /** true → token je neplatný (410 / BadDeviceToken) a má se smazat z DB. */
  invalidToken: boolean;
}

export interface ApnsSender {
  send(deviceToken: string, payload: ApnsPayload): Promise<ApnsResult>;
}

/** Výchozí sender, když APNs není nakonfigurováno – nic neodesílá. */
export class NoopApnsSender implements ApnsSender {
  async send(): Promise<ApnsResult> {
    return { ok: false, status: 0, invalidToken: false };
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Reálný APNs sender přes HTTP/2 + token-based auth (PLAN.md 5.8).
 * Není pokryt unit testy (vyžaduje skutečné APNs spojení); aktivuje se jen
 * při kompletní APNs konfiguraci.
 */
export class Http2ApnsSender implements ApnsSender {
  constructor(private readonly config: ApnsConfig) {}

  async send(deviceToken: string, payload: ApnsPayload): Promise<ApnsResult> {
    const host = this.config.sandbox
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
    const jwt = await getProviderToken(this.config);
    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
      ...(payload.taskId ? { taskId: payload.taskId } : {}),
    });

    return new Promise<ApnsResult>((resolve) => {
      const client = http2.connect(host);
      const done = (r: ApnsResult): void => {
        client.close();
        resolve(r);
      };
      client.on('error', () => resolve({ ok: false, status: 0, invalidToken: false }));

      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': this.config.bundleId,
        'apns-push-type': 'alert',
      });
      req.setTimeout(REQUEST_TIMEOUT_MS, () => done({ ok: false, status: 0, invalidToken: false }));

      let status = 0;
      let data = '';
      req.on('response', (headers) => {
        status = Number(headers[':status'] ?? 0);
      });
      req.on('data', (chunk) => {
        data += String(chunk);
      });
      req.on('end', () =>
        done({
          ok: status === 200,
          status,
          invalidToken: status === 410 || (status === 400 && data.includes('BadDeviceToken')),
        }),
      );
      req.on('error', () => done({ ok: false, status: 0, invalidToken: false }));
      req.end(body);
    });
  }
}
