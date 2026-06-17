/** Pushover browser client — unreliable Web Push; never auto-target. */
export const PUSHOVER_UNRELIABLE_DEVICE_NAMES = new Set(['desktop']);
function eligibleDevices(devices) {
    return devices.filter((name) => name && !PUSHOVER_UNRELIABLE_DEVICE_NAMES.has(name.toLowerCase()));
}
function findDevice(devices, predicate) {
    return devices.find((name) => predicate(name.toLowerCase())) ?? null;
}
/** Infer which Pushover device this client is from UA / model hints. */
export function autoMatchPushoverDevice(input) {
    const devices = eligibleDevices(input.pushoverDevices.filter(Boolean));
    if (!devices.length) {
        return null;
    }
    const ua = (input.userAgent ?? '').toLowerCase();
    const model = (input.model ?? '').toLowerCase();
    const haystack = `${ua} ${model}`.trim();
    if (/pixel/i.test(haystack)) {
        const match = findDevice(devices, (name) => name.includes('pixel'));
        if (match) {
            return match;
        }
    }
    if (/samsung|sm-[a-z]\d|galaxy/i.test(haystack)) {
        const match = findDevice(devices, (name) => name.includes('galaxy') || name.includes('samsung'));
        if (match) {
            return match;
        }
    }
    const isAndroidMobile = /android/i.test(ua) && /mobile/i.test(ua);
    if (isAndroidMobile) {
        const mobileDevices = devices.filter((name) => {
            const lower = name.toLowerCase();
            return (lower.includes('pixel') ||
                lower.includes('galaxy') ||
                lower.includes('samsung') ||
                lower.includes('phone') ||
                lower.includes('android'));
        });
        if (mobileDevices.length === 1) {
            return mobileDevices[0];
        }
    }
    if (/iphone|ipad|ipod/i.test(ua)) {
        const iosDevices = devices.filter((name) => {
            const lower = name.toLowerCase();
            return (lower.includes('iphone') ||
                lower.includes('ipad') ||
                lower.includes('ios') ||
                lower.includes('phone'));
        });
        if (iosDevices.length === 1) {
            return iosDevices[0];
        }
    }
    if (/macintosh|mac os x/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)) {
        const macDevices = devices.filter((name) => {
            const lower = name.toLowerCase();
            return lower.includes('mac') || lower.includes('macbook');
        });
        if (macDevices.length === 1) {
            return macDevices[0];
        }
    }
    if (/windows/i.test(ua)) {
        const windowsDevices = devices.filter((name) => {
            const lower = name.toLowerCase();
            return (lower.includes('windows') ||
                lower.includes('pc') ||
                lower.includes('laptop'));
        });
        if (windowsDevices.length === 1) {
            return windowsDevices[0];
        }
    }
    if (devices.length === 1) {
        return devices[0];
    }
    return null;
}
export function matchPushoverDeviceName(requestedName, pushoverDevices) {
    const normalized = requestedName.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    return (pushoverDevices.find((name) => name.toLowerCase() === normalized) ?? null);
}
/** Resolve Firestore registration to a Pushover delivery target (never broadcast). */
export function resolvePushoverDeliveryTarget(deviceName, platform, pushoverDevices) {
    const devices = pushoverDevices.filter(Boolean);
    if (!devices.length) {
        return null;
    }
    const exact = matchPushoverDeviceName(deviceName, devices);
    if (exact && !PUSHOVER_UNRELIABLE_DEVICE_NAMES.has(exact.toLowerCase())) {
        return exact;
    }
    const fromName = autoMatchPushoverDevice({
        userAgent: deviceName,
        pushoverDevices: devices,
    });
    if (fromName) {
        return fromName;
    }
    if (platform?.trim()) {
        return autoMatchPushoverDevice({
            userAgent: platform,
            pushoverDevices: devices,
        });
    }
    return null;
}
/** True when this Firestore row maps to a live Pushover device. */
export function isValidDeviceRegistration(deviceName, platform, pushoverDevices) {
    return (resolvePushoverDeliveryTarget(deviceName, platform, pushoverDevices) !== null);
}
//# sourceMappingURL=pushover-device-match.js.map