import type { DeviceRegistration } from './types';
import { sanitizeDeviceName } from './utils';
import { buildLocationKey } from './military-history-cooldown.util';
import type {
  LocationGroup,
  MilitaryHistorySighting,
  NotificationCooldownRecord,
} from './military-history.types';

export function buildMilitaryHistoryFromCooldowns(
  cooldownsByIcao: Map<string, NotificationCooldownRecord[]>,
  historyByIcao: Map<string, MilitaryHistorySighting>,
  deviceBySlug: Map<string, DeviceRegistration>,
): MilitaryHistorySighting[] {
  return Array.from(cooldownsByIcao.entries()).map(([icao, cooldowns]) => {
    const matchingHistory = historyByIcao.get(icao);
    const locationGroups = new Map<string, LocationGroup>();

    for (const cooldown of cooldowns) {
      const matchingDevice = cooldown.deviceName
        ? deviceBySlug.get(sanitizeDeviceName(cooldown.deviceName))
        : undefined;
      const location = matchingDevice?.location;
      const groupKey = buildLocationKey(location, cooldown.deviceName);
      const existingGroup = locationGroups.get(groupKey);

      if (existingGroup) {
        existingGroup.lastSent = Math.max(
          existingGroup.lastSent,
          cooldown.lastSent,
        );
        if (cooldown.deviceName) {
          existingGroup.deviceNames.add(cooldown.deviceName);
        }
        if (!existingGroup.location && location) {
          existingGroup.location = {
            lat: location.lat,
            lon: location.lon,
            ...(location.address && { address: location.address }),
          };
        }
        continue;
      }

      locationGroups.set(groupKey, {
        key: groupKey,
        lastSent: cooldown.lastSent,
        deviceNames: new Set(
          cooldown.deviceName ? [cooldown.deviceName] : [],
        ),
        location: location
          ? {
              lat: location.lat,
              lon: location.lon,
              ...(location.address && { address: location.address }),
            }
          : undefined,
      });
    }

    const sortedGroups = Array.from(locationGroups.values()).sort(
      (a, b) => b.lastSent - a.lastSent,
    );
    const latestGroup = sortedGroups[0];
    const matchingLocation =
      matchingHistory?.notificationLocation || latestGroup?.location;
    const groupedDeviceNames = latestGroup
      ? Array.from(latestGroup.deviceNames).sort((a, b) =>
          a.localeCompare(b),
        )
      : [];

    return {
      icao,
      firstSeen:
        matchingHistory?.firstSeen ||
        sortedGroups[sortedGroups.length - 1].lastSent,
      lastSeen: latestGroup?.lastSent || matchingHistory?.lastSeen || 0,
      sightingCount: sortedGroups.length,
      notificationDelivered: true,
      notifiedDeviceName:
        groupedDeviceNames.length === 1
          ? groupedDeviceNames[0]
          : groupedDeviceNames.length === 0
            ? matchingHistory?.notifiedDeviceName
            : undefined,
      notifiedDeviceCount: groupedDeviceNames.length || undefined,
      ...(groupedDeviceNames.length > 0 && {
        notifiedDeviceNames: groupedDeviceNames,
      }),
      ...(matchingLocation && {
        notificationLocation: {
          lat: matchingLocation.lat,
          lon: matchingLocation.lon,
          ...(matchingLocation.address && {
            address: matchingLocation.address,
          }),
        },
      }),
      ...(matchingHistory?.callsign && {
        callsign: matchingHistory.callsign,
      }),
      ...(matchingHistory?.model && { model: matchingHistory.model }),
      ...(matchingHistory?.operator && {
        operator: matchingHistory.operator,
      }),
      ...(matchingHistory?.country && {
        country: matchingHistory.country,
      }),
      ...(matchingHistory?.registration && {
        registration: matchingHistory.registration,
      }),
      ...(matchingHistory?.lat != null && { lat: matchingHistory.lat }),
      ...(matchingHistory?.lon != null && { lon: matchingHistory.lon }),
      ...(matchingHistory?.altitude != null && {
        altitude: matchingHistory.altitude,
      }),
      ...(matchingHistory?.bearing != null && {
        bearing: matchingHistory.bearing,
      }),
      ...(matchingHistory?.cardinal && {
        cardinal: matchingHistory.cardinal,
      }),
    } as unknown as MilitaryHistorySighting;
  });
}