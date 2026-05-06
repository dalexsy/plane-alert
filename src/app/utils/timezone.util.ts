export interface ResolvedTimezoneData {
  timezone: string;
  utcOffset: number;
  dst: boolean;
}

const TIMEZONE_LOOKUP_TIMEOUT_MS = 5000;

interface TimezoneOffsetParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getTimezoneParts(
  date: Date,
  timeZone: string,
): TimezoneOffsetParts | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number | null => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  if (
    year === null ||
    month === null ||
    day === null ||
    hour === null ||
    minute === null ||
    second === null
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour: hour === 24 ? 0 : hour,
    minute,
    second,
  };
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date): number | null {
  const parts = getTimezoneParts(date, timeZone);
  if (!parts) {
    return null;
  }

  const zonedUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const actualUtcMs = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );

  return Math.round((zonedUtcMs - actualUtcMs) / 60000);
}

function isDstActive(timeZone: string, currentOffsetMinutes: number): boolean {
  const currentYear = new Date().getUTCFullYear();
  const januaryOffset = getTimezoneOffsetMinutes(
    timeZone,
    new Date(Date.UTC(currentYear, 0, 1, 12, 0, 0)),
  );
  const julyOffset = getTimezoneOffsetMinutes(
    timeZone,
    new Date(Date.UTC(currentYear, 6, 1, 12, 0, 0)),
  );

  if (januaryOffset === null || julyOffset === null) {
    return false;
  }

  const standardOffset = Math.min(januaryOffset, julyOffset);
  return currentOffsetMinutes !== standardOffset;
}

export async function resolveTimezoneForCoordinates(
  lat: number,
  lon: number,
): Promise<ResolvedTimezoneData | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    TIMEZONE_LOOKUP_TIMEOUT_MS,
  );

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m&forecast_days=1&timezone=auto';

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const timezone =
      typeof data?.timezone === 'string' && data.timezone.includes('/')
        ? data.timezone
        : null;

    if (!timezone) {
      return null;
    }

    const offsetSeconds = Number(data?.utc_offset_seconds);
    const offsetMinutes = Number.isFinite(offsetSeconds)
      ? Math.round(offsetSeconds / 60)
      : getTimezoneOffsetMinutes(timezone, new Date());

    if (offsetMinutes === null) {
      return null;
    }

    return {
      timezone,
      utcOffset: offsetMinutes / 60,
      dst: isDstActive(timezone, offsetMinutes),
    };
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.warn('Timezone lookup failed:', error);
    }
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}