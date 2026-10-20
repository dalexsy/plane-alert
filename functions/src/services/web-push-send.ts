import webpush from 'web-push';
import { logger } from '../pi-logger';
import type { WebPushSubscription } from '../types';
import { applyPlanesVapidDetails } from './planes-vapid';
import { isWebPushSendEnabled } from './web-push-gate';

export type PlanesWebPushPayload = {
  title: string;
  body: string;
  url: string;
  icon?: string;
  image?: string;
  tag?: string;
};

export function isExpiredSubscriptionError(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404 || status === 410;
}

export async function sendPlanesWebPush(
  subscription: WebPushSubscription,
  payload: PlanesWebPushPayload,
): Promise<boolean> {
  if (!isWebPushSendEnabled()) {
    logger.info('Web push send skipped — disabled on this host');
    return false;
  }
  if (!applyPlanesVapidDetails()) {
    logger.warn('Web push send skipped — VAPID not configured');
    return false;
  }
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  };
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: payload.icon,
    image: payload.image,
    tag: payload.tag || payload.url,
  });
  try {
    await webpush.sendNotification(pushSubscription, body);
    return true;
  } catch (error) {
    if (isExpiredSubscriptionError(error)) {
      throw error;
    }
    logger.warn('Web push send failed', {
      endpoint: subscription.endpoint.slice(0, 48),
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
