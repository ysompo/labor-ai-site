import type { CTGParams, VitalSigns } from './simulatorTypes';

export interface CTGPreset {
  label: string;
  labelHe: string;
  description: string;
  ctg: CTGParams;
  vitals: VitalSigns;
}

export const CTG_PRESETS: Record<string, CTGPreset> = {
  normal: {
    label: 'Normal',
    labelHe: 'תקין',
    description: 'Baseline 140, normal variability, accelerations present',
    ctg: {
      fhr_baseline: 140,
      fhr_variability: 'normal',
      accelerations: 'present',
      decelerations: 'none',
      contraction_frequency: 3,
      contraction_intensity: 'moderate',
      special: 'none',
    },
    vitals: { hr: 88, bp_systolic: 120, bp_diastolic: 76, spo2: 99, temp: 36.8 },
  },

  tachycardia: {
    label: 'Tachycardia',
    labelHe: 'טכיקרדיה',
    description: 'Baseline 172, reduced variability, tachycardia',
    ctg: {
      fhr_baseline: 172,
      fhr_variability: 'reduced',
      accelerations: 'absent',
      decelerations: 'none',
      contraction_frequency: 3,
      contraction_intensity: 'moderate',
      special: 'tachycardia',
    },
    vitals: { hr: 96, bp_systolic: 125, bp_diastolic: 80, spo2: 98, temp: 37.6 },
  },

  bradycardia: {
    label: 'Bradycardia',
    labelHe: 'ברדיקרדיה',
    description: 'Sustained FHR drop to 70–80 bpm, minimal variability',
    ctg: {
      fhr_baseline: 75,
      fhr_variability: 'reduced',
      accelerations: 'absent',
      decelerations: 'none',
      contraction_frequency: 5,
      contraction_intensity: 'strong',
      special: 'bradycardia',
    },
    vitals: { hr: 105, bp_systolic: 95, bp_diastolic: 62, spo2: 96, temp: 37.1 },
  },

  late_decels: {
    label: 'Late Decels',
    labelHe: 'דיצלרציות מאוחרות',
    description: 'Late decelerations — uteroplacental insufficiency',
    ctg: {
      fhr_baseline: 138,
      fhr_variability: 'reduced',
      accelerations: 'absent',
      decelerations: 'late',
      deceleration_depth: 25,
      contraction_frequency: 3,
      contraction_intensity: 'moderate',
      special: 'none',
    },
    vitals: { hr: 92, bp_systolic: 168, bp_diastolic: 108, spo2: 98, temp: 37.2 },
  },

  variable_severe: {
    label: 'Severe Variable Decels',
    labelHe: 'דיצלרציות משתנות קשות',
    description: 'Severe variable decelerations — cord compression',
    ctg: {
      fhr_baseline: 145,
      fhr_variability: 'normal',
      accelerations: 'absent',
      decelerations: 'variable_severe',
      deceleration_depth: 70,
      contraction_frequency: 4,
      contraction_intensity: 'strong',
      special: 'none',
    },
    vitals: { hr: 98, bp_systolic: 132, bp_diastolic: 85, spo2: 97, temp: 37.0 },
  },

  sinusoidal: {
    label: 'Sinusoidal',
    labelHe: 'סינוסואידלי',
    description: 'Sinusoidal pattern — fetal anemia / severe asphyxia',
    ctg: {
      fhr_baseline: 140,
      fhr_variability: 'minimal',
      accelerations: 'absent',
      decelerations: 'none',
      contraction_frequency: 2,
      contraction_intensity: 'mild',
      special: 'sinusoidal',
    },
    vitals: { hr: 90, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 37.0 },
  },
};
