export interface ViewConeConfig {
  startAngle: number;
  endAngle: number;
  label: string;
}

export interface PracticalVisibilityBand {
  innerKm: number;
  outerKm: number;
  practicalAltM: number;
  color?: string;
}

export interface ConeArcElements {
  path: SVGPathElement;
  textGroup: SVGElement;
}

export interface ConeDrawContext {
  map: import('leaflet').Map;
  lat: number;
  lon: number;
  opacity: number;
  viewCones: ViewConeConfig[];
  visualCones: import('leaflet').Polygon[];
  arcElements: ConeArcElements[];
  getFillColor: (altM: number) => string;
}
