import { describe, it, expect } from 'vitest';
import { signSessionJwt, verifySessionJwt } from './jwt';

const SECRET = 'x'.repeat(40);

describe('session JWT', () => {
  it('round-trip podepíše a ověří claims', async () => {
    const jwt = await signSessionJwt(SECRET, { sid: 's1', jti: 't1' }, Date.now() + 60_000);
    expect(await verifySessionJwt(SECRET, jwt)).toEqual({ sid: 's1', jti: 't1' });
  });

  it('odmítne jiný secret', async () => {
    const jwt = await signSessionJwt(SECRET, { sid: 's1', jti: 't1' }, Date.now() + 60_000);
    expect(await verifySessionJwt('y'.repeat(40), jwt)).toBeNull();
  });

  it('odmítne expirovaný token', async () => {
    const jwt = await signSessionJwt(SECRET, { sid: 's1', jti: 't1' }, Date.now() - 1000);
    expect(await verifySessionJwt(SECRET, jwt)).toBeNull();
  });

  it('odmítne nesmysl', async () => {
    expect(await verifySessionJwt(SECRET, 'not.a.jwt')).toBeNull();
  });
});
