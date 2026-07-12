import { FollowMode } from '../plane-follow/plane-follow.service';
import { FollowModeState } from './follow-coordinator.service';

export function syncFollowModeState(
  mode: FollowMode,
  currentModes: FollowModeState,
): FollowModeState {
  switch (mode) {
    case FollowMode.SHUFFLE:
      return { shuffle: true, nearest: false, manual: false };
    case FollowMode.NEAREST:
      return { shuffle: false, nearest: true, manual: false };
    case FollowMode.MANUAL:
      return { shuffle: false, nearest: false, manual: true };
    case FollowMode.NONE:
    default:
      return { shuffle: false, nearest: false, manual: false };
  }
}
