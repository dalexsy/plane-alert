export interface ViewConeConfig {
  startAngle: number;
  endAngle: number;
  label: string;
}

export const DEFAULT_VIEW_CONES: ViewConeConfig[] = [
  { startAngle: 75, endAngle: 190, label: 'Balcony' },
  { startAngle: 245, endAngle: 345, label: 'Streetside' },
];
