export interface FallLeaf {
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  swayRange: number;
  progress: number;
  speed: number;
  scale: number;
  currentScale: number;
  fallDelay: number;
  swayDelay: number;
  rotateDelay: number;
  colorType: 'red' | 'orange' | 'brown';
  opacity: number;
}

export interface FallLeavesConfig {
  leafCount: number;
  baseSpeed: number;
  speedVariation: number;
  sizeVariation: number;
  duration: number;
  spawnDelay: number;
  intensity: number;
}

export const DEFAULT_FALL_LEAVES_CONFIG: FallLeavesConfig = {
  leafCount: 15,
  baseSpeed: 0.03,
  speedVariation: 0.3,
  sizeVariation: 0.4,
  duration: 25000,
  spawnDelay: 1600,
  intensity: 1.0,
};

export function isHighWind(windStat: number): boolean {
  return windStat >= 3;
}

export function calculateLeafSpeed(windSpeed: number, baseSpeed: number): number {
  const windFactor = Math.min(windSpeed / 10, 1);
  const minSpeed = 0.01 + windFactor * 0.02;
  const maxSpeed = 0.02 + windFactor * 0.04;
  return minSpeed + Math.random() * (maxSpeed - minSpeed);
}

export function getRandomLeafColor(): 'red' | 'orange' | 'brown' {
  const colors: ('red' | 'orange' | 'brown')[] = ['red', 'orange', 'brown'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function createFallLeaf(windSpeed: number, config: FallLeavesConfig): FallLeaf {
  const leaf: FallLeaf = {
    id: `leaf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    startX: Math.random() * 120 - 10,
    startY: -10,
    x: 0,
    y: 0,
    swayRange: 5 + Math.random() * 10,
    progress: 0,
    speed: calculateLeafSpeed(windSpeed, config.baseSpeed),
    scale: 0.6 + Math.random() * 0.8,
    currentScale: 1,
    fallDelay: Math.random() * 2,
    swayDelay: Math.random() * 3,
    rotateDelay: Math.random() * 4,
    colorType: getRandomLeafColor(),
    opacity: 0,
  };
  leaf.x = leaf.startX;
  leaf.y = leaf.startY;
  return leaf;
}

export function resetLeafForNewCycle(leaf: FallLeaf): void {
  leaf.progress = 0;
  leaf.startX = Math.random() * 120 - 10;
  leaf.startY = -10;
  leaf.swayRange = 20 + Math.random() * 30;
  leaf.speed = leaf.speed * (0.8 + Math.random() * 0.4);
  leaf.fallDelay = Math.random() * 2;
  leaf.swayDelay = Math.random() * 3;
  leaf.rotateDelay = Math.random() * 4;
  leaf.colorType = getRandomLeafColor();
  leaf.currentScale = 1;
}

export function updateLeafPosition(leaf: FallLeaf): void {
  const t = leaf.progress;
  leaf.y = leaf.startY + t * 100;
  const swayOffset = Math.sin(t * Math.PI * 2 + leaf.swayDelay) * leaf.swayRange;
  leaf.x = leaf.startX + swayOffset;
}

export function tickLeaves(leaves: FallLeaf[]): FallLeaf[] {
  return leaves.map((leaf) => {
    leaf.progress += leaf.speed * 0.016;
    if (leaf.progress >= 1) resetLeafForNewCycle(leaf);
    updateLeafPosition(leaf);
    if (leaf.progress < 0.1) {
      leaf.opacity = leaf.progress * 10;
      leaf.currentScale = 0.5 + leaf.progress * 5;
    } else if (leaf.progress > 0.9) {
      const fadeProgress = (leaf.progress - 0.9) / 0.1;
      leaf.opacity = (1 - fadeProgress) * 10;
      leaf.currentScale = Math.max(0.3, 1 - fadeProgress * 0.7);
    } else {
      leaf.opacity = 1;
      leaf.currentScale = 1;
    }
    return leaf;
  });
}

export function getLeafPositionStyles(leaf: FallLeaf): Record<string, string> {
  return {
    left: `${leaf.x}%`,
    top: `${leaf.y}%`,
    opacity: leaf.opacity.toString(),
    '--dynamic-scale': leaf.currentScale.toString(),
  };
}

export function getLeafSizeClass(leaf: FallLeaf): string {
  if (leaf.scale < 0.7) return 'small';
  if (leaf.scale > 1.0) return 'large';
  return 'medium';
}
