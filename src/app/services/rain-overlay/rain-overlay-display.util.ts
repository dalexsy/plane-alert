import { RainConfiguration } from '../../services/rain/rain-types';
import { RainDrop } from '../../services/rain/rain-types';

export function getDropTransform(
  drop: RainDrop,
  config: RainConfiguration | null
): string {
  if (!config) return `scale(${drop.size})`;
  const windSkew = config.windAngle * 0.3;
  return `scale(${drop.size}) skewX(${windSkew}deg)`;
}

export function getRainOverlayClasses(
  config: RainConfiguration | null,
  isRaining: boolean
): string[] {
  const classes: string[] = [];
  if (!config || !isRaining) return classes;
  if (config.intensity > 0.8) classes.push('heavy');
  else if (config.intensity < 0.4) classes.push('light');
  if (Math.abs(config.windAngle) > 15) classes.push('wind-strong');
  if (config.windAngle > 10) classes.push('wind-right');
  else if (config.windAngle < -10) classes.push('wind-left');
  return classes;
}

export function getRainStyles(config: RainConfiguration | null): Record<string, string> {
  if (!config) return {};
  return {
    '--rain-color': config.color,
    '--rain-opacity': config.opacity.toString(),
    '--fall-speed': `${config.fallSpeed}ms`,
  };
}
