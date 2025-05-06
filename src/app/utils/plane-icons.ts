// Specific aircraft SVG paths (from prompt)
const A320_SVG =
  'm 32,1 2,1 2,3 0,18 4,1 0,-4 3,0 0,5 17,6 0,3 -15,-2 -9,0 0,12 -2,6 7,3 0,2 -8,-1 -1,2 -1,-2 -8,1 0,-2 7,-3 -2,-6 0,-12 -9,0 -15,2 0,-3 17,-6 0,-5 3,0 0,4 4,-1 0,-18 2,-3 2,-1z';
const B738_SVG =
  'm 32,61 -1,-1 -9,2 -2,1 0,-2 9,-6 1,-1 -1,-9 0,-11 -7,0 -1,1 0,-1 -3,1 -1,1 0,-1 -3,1 -9,3 -1,1 0,-2 1,-2 17,-9 1,-1 -1,-2 0,-3 1,-1 2,0 1,1 0,3 3,-2 0,-13 1,-5 1,-3 1,-1 1,1 1,3 1,5 0,13 3,2 0,-3 1,-1 2,0 1,1 0,3 -1,2 1,1 17,9 1,2 0,2 -1,-1 -9,-3 -3,-1 0,1 -1,-1 -3,-1 0,1 -1,-1 -7,0 0,11 -1,9 1,1 9,6 0,2 -2,-1 -9,-2 -1,1 z';
const B777_SVG =
  'm 32,1 2,1 1,2 0,20 4,4 0,-4 3,0 0,4 -1,2 17,12 0,2 -16,-5 -7,0 0,13 -1,5 7,5 0,2 -8,-2 -1,2 -1,-2 -8,2 0,-2 7,-5 -1,-5 0,-13 -7,0 -16,5 0,-2 17,-12 -1,-2 0,-4 3,0 0,4 4,-4 0,-20 1,-2 2,-1z';

export const BALLOON_SVG =
  'm 27,1 10,0 3,1 3,1 1,1 2,1 6,6 1,2 1,1 1,3 1,3 0,10 -1,3 -1,3 -1,1 -1,2 -6,6 -2,1 -1,1 -2,1 -2,1 -2,8 -1,0 2,-8 -3,1 -6,0 -3,-1 2,8 9,0 0,6 -10,0 0,-6 -2,-8 -2,-1 -2,-1 -1,-1 -2,-1 -6,-6 -1,-2 -1,-1 -1,-3 -1,-3 0,-10 1,-3 1,-3 1,-1 1,-2 6,-6 2,-1 1,-1 3,-1 3,-1 z';

export const TWIN_ENGINE_SVG = A320_SVG;
export const QUAD_ENGINE_SVG = B777_SVG;

const ENGINE_ICON_MAP: { [count: number]: string } = {
  1: TWIN_ENGINE_SVG,
  2: TWIN_ENGINE_SVG,
  4: QUAD_ENGINE_SVG,
};

export function getIconPathForModel(model: string): string {
  const m = model.toLowerCase();

  // Balloons are separate
  if (m.includes('balloon')) {
    return BALLOON_SVG;
  }

  const engineMappings = [
    { engines: 4, patterns: ['b747','b74','a380','a388','c130','c30j'] },
    { engines: 2, patterns: ['a320','a319','a321','b737','b738','b736','b777','b772','b773','b77w','dh8','dash8','q400','b200','be20','g650','glf5','glf6'] },
    { engines: 1, patterns: ['c172','cessna'] },
  ];
  for (const { engines, patterns } of engineMappings) {
    if (patterns.some(p => m.includes(p))) {
      return ENGINE_ICON_MAP[engines];
    }
  }
  // default to twin-engine icon
  return TWIN_ENGINE_SVG;
}
