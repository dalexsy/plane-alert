import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPushoverSendEnabled } from './pushover-send-gate';

describe('pushover send gate', () => {
  it('allows prod host when flag unset', () => {
    assert.equal(isPushoverSendEnabled({}, 'dryl-prod'), true);
  });

  it('blocks staging hostname even when env flag is on', () => {
    assert.equal(isPushoverSendEnabled({}, 'dryl-staging'), false);
    assert.equal(
      isPushoverSendEnabled({ PLANES_API_PUSHOVER_ENABLED: '1' }, 'dryl-staging'),
      false,
      'hostname staging always wins — rsynced prod .env must not re-arm phones',
    );
  });

  it('respects explicit disable flag', () => {
    assert.equal(
      isPushoverSendEnabled({ PLANES_API_PUSHOVER_ENABLED: '0' }, 'dryl-prod'),
      false,
    );
  });

  it('blocks when DRYL_ENV is staging', () => {
    assert.equal(isPushoverSendEnabled({ DRYL_ENV: 'staging' }, 'dryl-prod'), false);
  });
});
