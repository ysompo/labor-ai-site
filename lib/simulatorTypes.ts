// TypeScript interfaces for the Labor-AI Delivery Room Simulator

export type FHRVariability = 'normal' | 'reduced' | 'minimal' | 'absent' | 'saltatory';
export type DecelerationType =
  | 'none'
  | 'early'
  | 'variable_mild'
  | 'variable_moderate'
  | 'variable_severe'
  | 'late'
  | 'prolonged';
export type ContractionIntensity = 'mild' | 'moderate' | 'strong';
export type CTGSpecial = 'bradycardia' | 'tachycardia' | 'sinusoidal' | 'none';

export interface CTGParams {
  fhr_baseline: number;
  fhr_variability: FHRVariability;
  accelerations: 'present' | 'absent';
  decelerations: DecelerationType;
  deceleration_depth?: number;
  deceleration_duration?: number;
  contraction_frequency: number; // contractions per 10 min
  contraction_intensity: ContractionIntensity;
  special?: CTGSpecial;
}

export interface VitalSigns {
  hr: number;          // maternal HR bpm
  bp_systolic: number;
  bp_diastolic: number;
  spo2: number;        // %
  temp: number;        // °C
  rr?: number;         // respiratory rate
}

export interface LiveOverrideParams {
  fhr_baseline?: number;
  fhr_variability?: FHRVariability;
  accelerations?: 'present' | 'absent';
  decelerations?: DecelerationType;
  contraction_frequency?: number;
  hr?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  spo2?: number;
  trigger_alarm?: boolean;
  custom_message?: string;
}

export interface PatientInfo {
  name: string;
  age: number;
  gravida: number;
  para: number;
  gestational_weeks: number;
  gestational_days: number;
  blood_type?: string;
  allergies?: string;
  history?: string;
}

export interface LabsCBC {
  wbc?: number;
  rbc?: number;
  hgb?: number;
  hct?: number;
  plt?: number;
  mcv?: number;
  mch?: number;
  mchc?: number;
  mpv?: number;
  rdw?: number;
}

export interface LabsChemistry {
  na?: number;
  k?: number;
  cl?: number;
  glu?: number;
  bun?: number;
  cre?: number;
  ast?: number;
  alt?: number;
  alb?: number;
  ldh?: number;
  alk_p?: number;
  ggtp?: number;
  t_bil?: number;
  d_bil?: number;
  mg?: number;
  ur_ac?: number;
  ca?: number;
  p?: number;
  tp?: number;
}

export interface LabsCoagulation {
  pt_pct?: number;
  inr?: number;
  ptt?: number;
  fib?: number;
  d_dimer?: number;
  tt?: number;
  bt?: number;
}

export interface LabsOther {
  crp?: number;
  protein_creatinine_ratio?: number;
  blood_type?: string;
}

export interface CardLabs {
  cbc?: LabsCBC;
  chemistry?: LabsChemistry;
  coagulation?: LabsCoagulation;
  other?: LabsOther;
}

export interface CardStructuredData {
  ctg: CTGParams;
  vitals: VitalSigns;
  labs: CardLabs;
  abnormal_fields: string[];
  patient?: PatientInfo;
}

export interface SimCard {
  id?: number;
  card_number: number;
  title: string;
  clinical_description?: string;
  structured_data?: CardStructuredData;
}

export interface SimScenario {
  id?: number;
  name: string;
  case_story?: string;
  expected_actions?: string;
  phases?: string;
  cards: SimCard[];
}

export type SessionRole = 'instructor' | 'midwife_supervisor' | 'display';

export interface SimSession {
  id?: number;
  session_code: string;
  scenario_id: number;
  instructor_name: string;
  status: 'setup' | 'running' | 'debrief' | 'completed';
  started_at?: string;
  ended_at?: string;
}

export interface SimNote {
  id?: number;
  session_id: number;
  author_id?: number;
  sim_time_seconds: number;
  note_type: 'text' | 'quick_tag' | 'debrief';
  tag_type?: string;
  content: string;
  phase: 'simulation' | 'debrief';
}
