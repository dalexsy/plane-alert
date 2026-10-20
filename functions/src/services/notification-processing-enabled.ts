import { isPushoverSendEnabled } from './pushover-send-gate';
import { isWebPushSendEnabled } from './web-push-gate';

/** One gate: run the same cron when any automatic transport is armed. */
export function isNotificationProcessingEnabled(): boolean {
  return isPushoverSendEnabled() || isWebPushSendEnabled();
}
