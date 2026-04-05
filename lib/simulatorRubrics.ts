export interface RubricItem { id: string; text: string; }

export const RESIDENT_RUBRIC_ITEMS: RubricItem[] = [
  { id: 'clin_1',  text: 'זיהוי מצב קליני ומצב חירום' },
  { id: 'dec_1',   text: 'קבלת החלטות בזמן וזיהוי נקודת הסלמה' },
  { id: 'dec_2',   text: 'עצירה בזמן ומעבר לח.נ.' },
  { id: 'lead_1',  text: 'הכרזה ברורה' },
  { id: 'lead_2',  text: 'קריאה מוקדמת לעזרה' },
  { id: 'lead_3',  text: 'חלוקת תפקידים וניהול אירוע' },
  { id: 'lead_4',  text: 'תקשורת עם היולדת' },
];

export const MIDWIFE_RUBRIC_ITEMS: RubricItem[] = [
  { id: 'id_1',   text: 'זיהוי מצב קליני' },
  { id: 'prot_1', text: 'הכרות עם פרוטוקולים' },
  { id: 'prot_2', text: 'היכרות עם מינוני תרופות ואופן הכנה' },
  { id: 'lead_1', text: 'קריאה מוקדמת לעזרה' },
  { id: 'lead_2', text: 'דיווח מדויק לאחראית/רופא' },
  { id: 'lead_4', text: 'תקשורת עם היולדת' },
];

export function getRubricItems(formType: string): RubricItem[] {
  if (formType === 'resident') return RESIDENT_RUBRIC_ITEMS;
  if (formType === 'midwife')  return MIDWIFE_RUBRIC_ITEMS;
  return []; // resident_junior has no rubric items
}
