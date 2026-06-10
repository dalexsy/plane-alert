import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration, Location } from '../types';
import { DEVICE_COLLECTION } from '../constants';
import { sanitizeDeviceName, inferDeviceName } from '../utils';

export type CheckDeviceEntry = {
  deviceId: string;
  deviceName: string;
  platform?: string;
  config: {
    radiusKm?: number;
    distanceUnit?: 'km' | 'miles';
    notifyProximity?: boolean;
    ignoredTypes?: string[];
    location?: Location;
    createdAt?: any;
    updatedAt?: any;
  };
};

export async function fetchDeviceDocsForUserKey(
  db: admin.firestore.Firestore,
  pushoverUserKey: string,
): Promise<Map<string, FirebaseFirestore.DocumentSnapshot>> {
  const collectionRef = db.collection(DEVICE_COLLECTION);
  const prefix = `${pushoverUserKey}__`;
  const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

  const [fieldMatchSnapshot, prefixSnapshot, legacyDoc] = await Promise.all([
    collectionRef.where('pushoverUserKey', '==', pushoverUserKey).get(),
    collectionRef
      .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
      .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
      .get(),
    collectionRef.doc(pushoverUserKey).get(),
  ]);

  const snapshotDocs = new Map<string, FirebaseFirestore.DocumentSnapshot>();

  for (const doc of fieldMatchSnapshot.docs) {
    snapshotDocs.set(doc.id, doc);
  }

  for (const doc of prefixSnapshot.docs) {
    snapshotDocs.set(doc.id, doc);
  }

  if (legacyDoc.exists) {
    snapshotDocs.set(legacyDoc.id, legacyDoc);
  }

  return snapshotDocs;
}

async function backfillDeviceMetadata(
  doc: FirebaseFirestore.DocumentSnapshot,
  data: DeviceRegistration,
  options?: { fireAndForget?: boolean },
): Promise<string> {
  const deviceName = inferDeviceName(doc.id, data);

  if (!data.deviceName || data.deviceName !== deviceName) {
    const update = {
      deviceName,
      deviceSlug: sanitizeDeviceName(deviceName),
    };

    if (options?.fireAndForget) {
      doc.ref.set(update, { merge: true }).catch((error: any) =>
        logger.warn('Failed to backfill device metadata', {
          docId: doc.id,
          error: error?.message,
        }),
      );
    } else {
      await doc.ref.set(update, { merge: true });
    }
  }

  return deviceName;
}

export async function buildCheckDeviceEntries(
  snapshotDocs: Map<string, FirebaseFirestore.DocumentSnapshot>,
): Promise<CheckDeviceEntry[]> {
  const deviceEntries: CheckDeviceEntry[] = [];

  for (const doc of snapshotDocs.values()) {
    const data = doc.data() as DeviceRegistration;
    const deviceName = await backfillDeviceMetadata(doc, data);

    deviceEntries.push({
      deviceId: doc.id,
      deviceName,
      platform: data.platform,
      config: {
        radiusKm: data.radiusKm,
        distanceUnit: data.distanceUnit,
        notifyProximity: data.notifyProximity,
        ignoredTypes: data.ignoredTypes,
        location: data.location || (data as any).home, // Support legacy 'home' field
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  return deviceEntries;
}

export function markPushoverRegistration(
  deviceEntries: CheckDeviceEntry[],
  pushoverDeviceNames: string[],
): string[] {
  const pushoverDevices = new Set<string>(
    pushoverDeviceNames
      .filter(
        (name): name is string =>
          typeof name === 'string' && name.trim().length > 0,
      )
      .map((name) => name.trim().toLowerCase()),
  );

  for (const entry of deviceEntries) {
    (entry as any).isRegisteredInPushover = pushoverDevices.has(
      entry.deviceName.toLowerCase(),
    );
  }

  return pushoverDeviceNames
    .filter(
      (name): name is string =>
        typeof name === 'string' && name.trim().length > 0,
    )
    .map((name) => name.trim())
    .sort((a, b) => a.localeCompare(b));
}

export async function formatListAllDeviceEntry(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  data: DeviceRegistration,
) {
  const deviceName = await backfillDeviceMetadata(doc, data, {
    fireAndForget: true,
  });

  const keySource = data.pushoverUserKey || doc.id;
  const maskedKey =
    keySource.length > 12
      ? `${keySource.substring(0, 8)}...${keySource.substring(
          keySource.length - 4,
        )}`
      : keySource;

  // Support both new 'location' and legacy 'home' field
  const deviceLocation = data.location || (data as any).home;
  const hasLocation =
    deviceLocation &&
    typeof deviceLocation.lat === 'number' &&
    typeof deviceLocation.lon === 'number';

  let location = 'Unknown';
  if (hasLocation) {
    const lat = Number(deviceLocation?.lat ?? 0);
    const lon = Number(deviceLocation?.lon ?? 0);
    location = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  return {
    id: doc.id,
    deviceName,
    deviceSlug: data.deviceSlug || sanitizeDeviceName(deviceName),
    pushoverUserKey: maskedKey,
    platform: data.platform || 'unknown',
    distanceUnit: data.distanceUnit || 'km',
    radiusKm: data.radiusKm || 100,
    notifyProximity: data.notifyProximity || false,
    location,
    address: deviceLocation?.address || '',
    ignoredTypesCount: data.ignoredTypes?.length || 0,
    specialIcaosCount: data.specialIcaos?.length || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
