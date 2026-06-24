export function catmullRomPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const lat =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const lon =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  return [lat, lon];
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function smoothTrailPoints(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    let latSum = 0,
      lonSum = 0,
      count = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(points.length - 1, i + 1); j++) {
      if (typeof points[j]?.[0] === 'number' && typeof points[j]?.[1] === 'number') {
        latSum += points[j][0];
        lonSum += points[j][1];
        count++;
      }
    }
    if (count > 0) out.push([latSum / count, lonSum / count]);
  }
  return out;
}

function advancePoint(
  lat: number,
  lon: number,
  headingDeg: number,
  distanceKm: number
): [number, number] {
  const brng = (headingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const angDist = distanceKm / 6371;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

export function generateCurvedPath(
  lat: number,
  lon: number,
  track: number,
  velocity: number,
  minutesAhead: number,
  turnRatePerMin: number
): [number, number][] {
  const points: [number, number][] = [];
  const pointsCount = 12;
  const timeStep = minutesAhead / pointsCount;
  const dampedTurnRate = turnRatePerMin * 0.7;
  let curLat = lat;
  let curLon = lon;
  let curHeading = track;
  for (let i = 1; i <= pointsCount; i++) {
    curHeading = (((curHeading + dampedTurnRate * timeStep) % 360) + 360) % 360;
    const distanceKm = ((velocity * 1.852) * timeStep) / 60;
    [curLat, curLon] = advancePoint(curLat, curLon, curHeading, distanceKm);
    points.push([curLat, curLon]);
  }
  return points;
}

export function generateStraightPath(
  lat: number,
  lon: number,
  track: number,
  velocity: number,
  minutesAhead: number
): [number, number][] {
  const points: [number, number][] = [];
  const pointsCount = 6;
  const timeStep = minutesAhead / pointsCount;
  for (let i = 1; i <= pointsCount; i++) {
    const distanceKm = ((velocity * 1.852) * timeStep * i) / 60;
    points.push(advancePoint(lat, lon, track, distanceKm));
  }
  return points;
}

export function processPathPoints(
  pathPoints: [number, number][],
  usesTurnRate: boolean
): [number, number][] {
  if (usesTurnRate && pathPoints.length >= 4) {
    try {
      const smoothed: [number, number][] = [pathPoints[0]];
      for (let i = 1; i < pathPoints.length - 1; i++) {
        const prev = pathPoints[i - 1];
        const curr = pathPoints[i];
        const next = pathPoints[i + 1];
        smoothed.push([(prev[0] + curr[0] + next[0]) / 3, (prev[1] + curr[1] + next[1]) / 3]);
      }
      smoothed.push(pathPoints[pathPoints.length - 1]);
      pathPoints = smoothed;
    } catch {
      /* keep original */
    }
  }
  pathPoints = pathPoints.filter((pt, index) => {
    if (index === 0) return true;
    return haversineDistanceKm(pathPoints[0][0], pathPoints[0][1], pt[0], pt[1]) <= 25;
  });
  const filtered: [number, number][] = [pathPoints[0]];
  for (let i = 1; i < pathPoints.length; i++) {
    const last = filtered[filtered.length - 1];
    const cur = pathPoints[i];
    if (haversineDistanceKm(last[0], last[1], cur[0], cur[1]) >= 0.5) filtered.push(cur);
  }
  return filtered;
}
