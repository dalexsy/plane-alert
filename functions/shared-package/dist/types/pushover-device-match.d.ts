/** Pushover browser client — unreliable Web Push; never auto-target. */
export declare const PUSHOVER_UNRELIABLE_DEVICE_NAMES: Set<string>;
export interface PushoverDeviceMatchInput {
    userAgent: string;
    model?: string;
    pushoverDevices: string[];
}
/** Infer which Pushover device this client is from UA / model hints. */
export declare function autoMatchPushoverDevice(input: PushoverDeviceMatchInput): string | null;
export declare function matchPushoverDeviceName(requestedName: string, pushoverDevices: string[]): string | null;
/** Resolve Firestore registration to a Pushover delivery target (never broadcast). */
export declare function resolvePushoverDeliveryTarget(deviceName: string, platform: string | undefined, pushoverDevices: string[]): string | null;
/** True when this Firestore row maps to a live Pushover device. */
export declare function isValidDeviceRegistration(deviceName: string, platform: string | undefined, pushoverDevices: string[]): boolean;
//# sourceMappingURL=pushover-device-match.d.ts.map