import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import { fetchAircraftImage, downloadAndEncodeImage } from './image-fetcher';

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

export interface PushoverMessage {
  title: string;
  message: string;
  url?: string;
  url_title?: string;
  icon?: string;
  model?: string;
  operator?: string;
}

/**
 * Send a notification via Pushover API
 */
export async function sendPushoverNotification(
  userKey: string,
  deviceName: string,
  message: PushoverMessage,
  docId: string
): Promise<boolean> {
  try {
    logger.info('Sending Pushover notification', {
      docId,
      deviceName,
      userKey: userKey.slice(0, 8),
      message: message.message,
      model: message.model,
    });

    let attachmentBase64: string | null = null;
    if (message.model && message.model.trim()) {
      logger.info('Fetching aircraft image', {
        docId,
        model: message.model,
      });

      const imageUrl = await fetchAircraftImage(
        message.model,
        message.operator
      );
      if (imageUrl) {
        logger.info('Found image URL, downloading', {
          docId,
          url: imageUrl.substring(0, 100),
        });
        attachmentBase64 = await downloadAndEncodeImage(imageUrl);
        if (attachmentBase64) {
          logger.info('Image encoded successfully', {
            docId,
            size: attachmentBase64.length,
          });
        }
      }
    }

    // Target specific device if provided, otherwise send to all devices
    const params: Record<string, string> = {
      token: PUSHOVER_API_TOKEN || '',
      user: userKey,
      title: message.title,
      message: message.message,
      url: message.url || '',
      url_title: message.url_title || '',
      priority: '1',
      sound: 'none',
      icon: message.icon || '',
    };

    // Only add device parameter if a specific device is targeted
    if (deviceName) {
      params.device = deviceName;
    }

    if (attachmentBase64) {
      params.attachment_base64 = attachmentBase64;
      params.attachment_type = 'image/jpeg';
    }

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    } as any);

    const result: any = await response.json();

    if (response.ok && result.status === 1) {
      logger.info('Sent Pushover notification', {
        userKey: userKey.slice(0, 8),
        message: message.message,
        withImage: !!attachmentBase64,
      });
      return true;
    } else {
      logger.error('Pushover API error', {
        userKey: userKey.slice(0, 8),
        error: result,
      });
      return false;
    }
  } catch (error: any) {
    logger.error('Failed to send Pushover notification', {
      docId,
      userKey: userKey.slice(0, 8),
      error: error?.message,
    });
    return false;
  }
}

/**
 * Send multiple notifications via Pushover API
 */
export async function sendPushoverNotifications(
  userKey: string,
  deviceName: string,
  messages: PushoverMessage[],
  docId: string
): Promise<void> {
  for (const msg of messages) {
    await sendPushoverNotification(userKey, deviceName, msg, docId);
  }
}
