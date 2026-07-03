export const NORMAL_RANGES: Record<string, [number, number]> = {
  // CBC
  wbc: [4.0, 11.0],
  rbc: [3.5, 5.5],
  hgb: [11.0, 16.0],
  hct: [33, 44],
  plt: [150, 400],
  mcv: [80, 100],
  mch: [27, 33],
  mchc: [32, 36],
  mpv: [7.5, 12.0],
  rdw: [11.5, 14.5],
  // Chemistry
  na: [135, 145],
  k: [3.5, 5.0],
  cl: [98, 106],
  glu: [70, 140],
  bun: [7, 20],
  cre: [0.4, 0.9],
  ast: [0, 35],
  alt: [0, 35],
  alb: [3.5, 5.0],
  ldh: [0, 250],
  alk_p: [44, 147],
  ggtp: [0, 40],
  t_bil: [0.1, 1.2],
  d_bil: [0, 0.3],
  mg: [1.7, 2.4],
  ur_ac: [2.0, 6.0],
  ca: [8.5, 10.5],
  p: [2.5, 4.5],
  tp: [6.3, 8.2],
  // Coagulation
  pt_pct: [70, 130],
  inr: [0.8, 1.2],
  ptt: [25, 35],
  fib: [200, 600],
  d_dimer: [0, 0.5],
  tt: [14, 21],
  bt: [2, 9],
  // Other
  crp: [0, 0.5],
  protein_creatinine_ratio: [0, 150],
};

export function isAbnormal(field: string, value: number): boolean {
  const range = NORMAL_RANGES[field.toLowerCase()];
  if (!range) return false;
  return value < range[0] || value > range[1];
}

/**
 * Walks all numeric lab values in a CardLabs object and returns the keys
 * whose values fall outside NORMAL_RANGES. Non-numeric fields (blood_type)
 * are skipped. Used by the scenario editor and the live labs-push panel.
 */
export function computeAbnormalFields(labs: import('./simulatorTypes').CardLabs): string[] {
  const flagged: string[] = [];
  for (const group of [labs.cbc, labs.chemistry, labs.coagulation, labs.other]) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      if (isAbnormal(key, value)) flagged.push(key);
    }
  }
  return flagged;
}
