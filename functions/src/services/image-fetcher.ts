import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';

/**
 * Fetch aircraft image from Google Custom Search API
 */
export async function fetchAircraftImage(
  model: string,
  operator?: string
): Promise<string | null> {
  const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
  const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    logger.warn('Google Search API credentials not configured');
    return null;
  }

  try {
    // Match frontend search query format (no quotes for better results)
    let searchQuery = `${model} aircraft airplane photo`;
    if (operator) {
      const operatorShort = operator.split(' ')[0];
      searchQuery += ` ${operatorShort}`;
    }
    searchQuery +=
      ' site:planespotters.net OR site:airliners.net OR site:jetphotos.com';
    searchQuery +=
      ' -cartoon -drawing -model -toy -lego -illustration -diagram -youtube -thumbnail';

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', GOOGLE_API_KEY);
    url.searchParams.set('cx', GOOGLE_SEARCH_ENGINE_ID);
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', '1');
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');
    url.searchParams.set('safe', 'active');

    const response = await fetch(url.toString(), { timeout: 3000 } as any);

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();

    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return item.link || null;
    }

    return null;
  } catch (error: any) {
    logger.warn('Failed to fetch aircraft image', {
      model,
      error: error?.message,
    });
    return null;
  }
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
        'User-Agent':
          'Mozilla/5.0 (compatible; PlaneAlert/1.0; +https://plane-alert.surge.sh)',
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
