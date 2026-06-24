export interface SwallowBird {
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  controlX1: number;
  controlY1: number;
  controlX2: number;
  controlY2: number;
  endX: number;
  endY: number;
  progress: number;
  speed: number;
  scale: number;
  delay: number;
  flapOffset: number;
  flapDelay: number;
  direction: number;
  opacity: number;
  altitude: number;
}

export interface SwallowConfig {
  birdCount: number;
  baseSpeed: number;
  speedVariation: number;
  sizeVariation: number;
  duration: number;
  spawnDelay: number;
  intensity: number;
}

export const DEFAULT_SWALLOW_CONFIG: SwallowConfig = {
  birdCount: 12,
  baseSpeed: 0.1,
  speedVariation: 0.4,
  sizeVariation: 0.3,
  duration: 8000,
  spawnDelay: 400,
  intensity: 1.0,
};

export function calculateConfigFromPressure(
  base: SwallowConfig = DEFAULT_SWALLOW_CONFIG
): SwallowConfig {
  return {
    ...base,
    intensity: 1.0,
    birdCount: 8,
    baseSpeed: 0.3,
    spawnDelay: 1200,
    duration: 8000,
  };
}

export function createSwallow(config: SwallowConfig): SwallowBird {
  const yPosition = 10 + Math.random() * 80;
  const altitude = Math.floor(((100 - yPosition) / 100) * 20000);
  const swallow: SwallowBird = {
    id: `swallow-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    startX: -5,
    startY: yPosition,
    x: -5,
    y: yPosition,
    controlX1: 30,
    controlY1: 10 + Math.random() * 80,
    controlX2: 70,
    controlY2: 10 + Math.random() * 80,
    endX: 105,
    endY: 10 + Math.random() * 80,
    progress: 0,
    speed: config.baseSpeed * (0.8 + Math.random() * 0.4),
    scale: 0.8 + Math.random() * 0.4,
    delay: 0,
    flapOffset: Math.random() * Math.PI * 2,
    flapDelay: Math.random() * 0.3,
    direction: 1,
    opacity: 1,
    altitude,
  };
  return swallow;
}

export function updateSwallowPosition(swallow: SwallowBird, t: number): void {
  const invT = 1 - t;
  const invT2 = invT * invT;
  const invT3 = invT2 * invT;
  const t2 = t * t;
  const t3 = t2 * t;
  swallow.x =
    invT3 * swallow.startX +
    3 * invT2 * t * swallow.controlX1 +
    3 * invT * t2 * swallow.controlX2 +
    t3 * swallow.endX;
  swallow.y =
    invT3 * swallow.startY +
    3 * invT2 * t * swallow.controlY1 +
    3 * invT * t2 * swallow.controlY2 +
    t3 * swallow.endY;
}

export function resetSwallowForNewCycle(swallow: SwallowBird): void {
  swallow.progress = 0;
  swallow.startX = -5 + Math.random() * 5;
  swallow.startY = 10 + Math.random() * 80;
  swallow.endX = 105 + Math.random() * 5;
  swallow.endY = 10 + Math.random() * 80;
  swallow.controlX1 = 25 + Math.random() * 10;
  swallow.controlY1 = 10 + Math.random() * 80;
  swallow.controlX2 = 65 + Math.random() * 10;
  swallow.controlY2 = 10 + Math.random() * 80;
  swallow.speed = swallow.speed * (0.9 + Math.random() * 0.2);
  const averageY =
    (swallow.startY + swallow.endY + swallow.controlY1 + swallow.controlY2) / 4;
  swallow.altitude = Math.floor(((100 - averageY) / 100) * 20000);
  swallow.x = swallow.startX;
  swallow.y = swallow.startY;
}

export function tickSwallows(swallows: SwallowBird[], deltaTime: number): SwallowBird[] {
  const simpleSpeed = 0.00002;
  return swallows.map((swallow) => {
    swallow.progress += simpleSpeed * deltaTime;
    updateSwallowPosition(swallow, Math.min(swallow.progress, 1));
    if (swallow.progress >= 1) resetSwallowForNewCycle(swallow);
    swallow.opacity = 1;
    return swallow;
  });
}

export function getSwallowPositionStyles(swallow: SwallowBird): Record<string, string> {
  return {
    left: `${swallow.x}%`,
    top: `${swallow.y}%`,
    opacity: swallow.opacity.toString(),
  };
}

export function getSwallowTransform(swallow: SwallowBird): string {
  return `scale(${swallow.scale})`;
}

export function getSwallowAltitudeColor(
  swallow: SwallowBird,
  getFillColor: (altM: number) => string
): string {
  const currentAltitude = Math.floor(((100 - swallow.y) / 100) * 20000);
  return getFillColor(currentAltitude);
}
