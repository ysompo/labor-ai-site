export type ModuleId = 'ideation' | 'data-explorer' | 'lit-search' | 'stats' | 'manuscript' | 'schedule';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Project {
  id: number;
  user_id: number;
  title: string;
  status: 'draft' | 'active' | 'irb-submitted' | 'completed' | 'archived';
  pico: PicoData | null;
  design_decisions: Record<string, unknown> | null;
  analysis_plan: Record<string, unknown> | null;
  language: 'he' | 'en';
  created_at: string;
  updated_at: string;
}

export interface PicoData {
  population?: string;
  intervention?: string;
  comparison?: string;
  outcome?: string;
  secondaryOutcomes?: string;
  researchQuestion?: string;
}

export interface CatalogCategory {
  id: number;
  name: string;
  display_order: number;
  description?: string;
}

export interface CatalogVariable {
  id: number;
  category_id: number;
  variable_name: string;
  display_name?: string;
  description?: string;
  variable_type: 'continuous' | 'categorical' | 'binary' | 'date' | 'text';
  sample_values?: string;
  unit?: string;
  coverage_start?: number;
  coverage_end?: number;
  notes?: string;
  source?: string;
  service_panel?: string;
  is_active: boolean;
  display_order: number;
}

export interface ResearchTask {
  id: number;
  project_id: number;
  user_id: number;
  title: string;
  description?: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  due_date?: string;
  completed_at?: string;
  is_ai_suggested: boolean;
  display_order: number;
}

export const MODULE_META: Record<ModuleId, { label: string; labelHe: string; icon: string; description: string }> = {
  'ideation':      { label: 'Ideation',    labelHe: 'גיבוש רעיון',   icon: '💡', description: 'From clinical observation to formal research proposal' },
  'data-explorer': { label: 'Data',        labelHe: 'נתונים',         icon: '📊', description: 'Browse variable catalog and upload your own data' },
  'lit-search':    { label: 'Literature',  labelHe: 'ספרות',          icon: '📚', description: 'PubMed queries, abstract screening, critical appraisal' },
  'stats':         { label: 'Statistics',  labelHe: 'סטטיסטיקה',      icon: '📈', description: 'Analysis plans, code generation, power calculations' },
  'manuscript':    { label: 'Manuscript',  labelHe: 'מאמר',           icon: '✍️', description: 'Abstracts, manuscripts, reviewer responses' },
  'schedule':      { label: 'Schedule',    labelHe: 'לוח זמנים',      icon: '📅', description: 'AI-suggested research milestones and task manager' },
};

export const PHASE_LABELS: Record<number, string> = {
  1: 'רעיון וסקר ספרות',
  2: 'פרוטוקול ואישור אתי',
  3: 'איסוף נתונים',
  4: 'ניתוח נתונים',
  5: 'כתיבה והגשה',
  6: 'תיקונים ופרסום',
};
