import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import { ORIGIN_HEADER } from '../constants';

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    const possibleKeys = ['src', 'url', 'path'];
    for (const key of possibleKeys) {
      const nextValue = candidate[key];
      if (typeof nextValue === 'string' && nextValue.trim()) {
        return nextValue.trim();
      }
    }
  }

  return null;
}

/**
 * Fetch aircraft image from Planespotters.net API
 */
export async function fetchAircraftImage(
  registration?: string,
  hex?: string
): Promise<string | null> {
  // Try registration first, then hex
  const identifiers = [
    { type: 'reg', value: registration },
    { type: 'hex', value: hex },
  ].filter((id) => id.value && id.value.trim());

  for (const { type, value } of identifiers) {
    try {
      const url = `https://api.planespotters.net/pub/photos/${type}/${encodeURIComponent(
        value!.trim()
      )}`;

      const response = await fetch(url, { timeout: 3000 } as any);

      if (!response.ok) {
        continue; // Try next identifier
      }

      const data: any = await response.json();

      if (data.photos && data.photos.length > 0) {
        // Prefer large thumbnail or full photo
        const photo = data.photos[0];
        const imageUrl = normalizeImageUrl(
          photo.thumbnail_large || photo.photo || photo.thumbnail
        );
        if (imageUrl) {
          return imageUrl;
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to fetch from Planespotters ${type}`, {
        identifier: value,
        error: error?.message,
      });
    }
  }

  return null;
}

/**
 * Download image and convert to Base64
 */
export async function downloadAndEncodeImage(
  imageUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      timeout: 3000,
      headers: {
        'User-Agent': ORIGIN_HEADER,
      },
    } as any);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > 5 * 1024 * 1024) {
      logger.warn('Image too large', {
        url: imageUrl,
        size: buffer.byteLength,
      });
      return null;
    }

    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (error: any) {
    logger.warn('Failed to download image', {
      url: imageUrl,
      error: error?.message,
    });
    return null;
  }
}
