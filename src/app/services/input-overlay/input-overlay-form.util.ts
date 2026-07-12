import type { BrightnessState } from '../brightness/brightness.service';

export function inputOverlayBrightnessIcon(state: BrightnessState | null): string {
  if (!state) return 'brightness_empty';
  if (state.mode === 'auto') {
    if (state.sunElevation > 0) return 'brightness_5';
    if (state.sunElevation > -6) return 'brightness_6';
    if (state.sunElevation > -12) return 'brightness_7';
    return 'brightness_4';
  }
  return state.brightness > 0.7 ? 'brightness_auto' : 'brightness_auto';
}

export function inputOverlaySunStatusTooltip(state: BrightnessState | null): string {
  if (!state) return 'Toggle map brightness';
  const enableDisable =
    state.mode === 'auto' ? 'Disable auto-dimming' : 'Enable auto-dimming';
  const sunStatus =
    state.sunElevation > 0
      ? 'Daytime'
      : state.sunElevation > -6
        ? 'Civil twilight'
        : state.sunElevation > -12
          ? 'Nautical twilight'
          : 'Night';
  return `${enableDisable} - ${sunStatus}`;
}

export function formatScanCountdown(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function normalizeRadiusInputValue(value: string): string {
  return value.replace(/,/g, '.');
}

export function handleRadiusKeydown(event: KeyboardEvent): void {
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
  ];
  if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
  if (event.key === ',') {
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const pos = input.selectionStart || 0;
    if (!input.value.includes('.')) {
      input.value = input.value.slice(0, pos) + '.' + input.value.slice(pos);
      input.setSelectionRange(pos + 1, pos + 1);
    }
    return;
  }
  if (/^[0-9]$/.test(event.key)) return;
  if (event.key === '.' && !(event.target as HTMLInputElement).value.includes('.')) return;
  event.preventDefault();
}
