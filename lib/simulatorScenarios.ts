import type { SimScenario } from './simulatorTypes';

/**
 * 8 pre-seeded obstetric emergency scenarios with full structured data.
 * Used to seed the database and as fallback when DB is not configured.
 */
export const SEEDED_SCENARIOS: SimScenario[] = [

  // ─── 1. PPH ──────────────────────────────────────────────────────────────
  {
    name: 'PPH — דימום אחרי לידה',
    case_story: 'רחל כהן, 32, G2P2 שבוע 39+4. לידה בואקום עקב עצירת ירידה. שליה שלמה. מיד לאחר הלידה דימום גינקולוגי מוגבר עם רחם אטוני.',
    expected_actions: 'עיסוי רחם · אוקסיטוצין IV/IM · הערכת שליה · עירוי נוזלים · ספירת דם + קרישה · קריאה לצוות בכיר · שיקול מיזופרוסטול/טרנקסמיק · הכנה לחדר ניתוח',
    phases: 'שלב 1: אטוניה ראשונית | שלב 2: אין תגובה לטיפול ראשוני | שלב 3: דימום המוני | שלב 4: DIC מתפתח',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — מצב ראשוני',
        clinical_description: 'מיד לאחר לידת ואקום. דימום מוגבר, רחם אטוני. מצב המודינמי יציב.',
        structured_data: {
          patient: { name: 'רחל כהן', age: 32, gravida: 2, para: 2, gestational_weeks: 39, gestational_days: 4, blood_type: 'O+', allergies: 'ללא', history: 'לידה קודמת תקינה' },
          ctg: { fhr_baseline: 138, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 92, bp_systolic: 120, bp_diastolic: 78, spo2: 99, temp: 36.8 },
          labs: { cbc: { wbc: 10.2, rbc: 3.88, hgb: 11.2, hct: 34.2, plt: 245, mcv: 91, mch: 32.7, mchc: 35.8, rdw: 12.6 }, chemistry: { na: 136, k: 4.2, cre: 0.64, alt: 19, ast: 25, alb: 3.6, glu: 98 }, coagulation: { pt_pct: 100, inr: 1.00, ptt: 24.0, fib: 412 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — אטוניה, אין תגובה ראשונית',
        clinical_description: 'רחם ממשיך אטוני למרות עיסוי ואוקסיטוצין. דימום נמשך. דחיפות מוגברת.',
        structured_data: {
          ctg: { fhr_baseline: 145, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 109, bp_systolic: 111, bp_diastolic: 68, spo2: 98, temp: 36.9 },
          labs: { cbc: { wbc: 11.8, hgb: 10.1, hct: 30.5, plt: 228, rdw: 13.0 }, coagulation: { inr: 1.15, ptt: 26.5, fib: 380 } },
          abnormal_fields: ['hgb', 'hct'],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — דימום נמשך, אי-יציבות',
        clinical_description: 'ללא תגובה לאוקסיטוצין ומיזופרוסטול. טכיקרדיה. יל"ד יורד. דימום ג\'ני מוגבר.',
        structured_data: {
          ctg: { fhr_baseline: 152, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 1, contraction_intensity: 'mild', special: 'tachycardia' },
          vitals: { hr: 122, bp_systolic: 94, bp_diastolic: 62, spo2: 97, temp: 37.0 },
          labs: { cbc: { hgb: 9.9, hct: 29.8, plt: 205 }, coagulation: { inr: 1.40, ptt: 29.5, fib: 310 }, other: { crp: 1.85 } },
          abnormal_fields: ['hgb', 'hct', 'inr', 'fib', 'crp'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — דימום המוני',
        clinical_description: 'דימום המוני (>1.5L). שוק היפווולמי. DIC מתפתח.',
        structured_data: {
          ctg: { fhr_baseline: 162, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 1, contraction_intensity: 'mild', special: 'tachycardia' },
          vitals: { hr: 132, bp_systolic: 87, bp_diastolic: 49, spo2: 95, temp: 37.1 },
          labs: { cbc: { hgb: 8.1, hct: 24.3, plt: 142 }, coagulation: { inr: 1.90, ptt: 38.0, fib: 195, d_dimer: 2.8 } },
          abnormal_fields: ['hgb', 'hct', 'plt', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
      {
        card_number: 5,
        title: 'כרטיס 5 — חדר ניתוח, DIC',
        clinical_description: 'בחדר ניתוח. עירויי דם מרובים. DIC מלא. מצב קריטי אך מנוהל.',
        structured_data: {
          ctg: { fhr_baseline: 155, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'tachycardia' },
          vitals: { hr: 142, bp_systolic: 94, bp_diastolic: 58, spo2: 96, temp: 36.5 },
          labs: { cbc: { hgb: 6.4, hct: 19.2, plt: 88 }, coagulation: { inr: 2.30, ptt: 52.0, fib: 115, d_dimer: 5.2 } },
          abnormal_fields: ['hgb', 'hct', 'plt', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
    ],
  },

  // ─── 2. Shoulder Dystocia ─────────────────────────────────────────────────
  {
    name: 'פרע כתפיים — Shoulder Dystocia',
    case_story: 'שירה לוי, 34, G3P2, שבוע 40+2. סוכרת הריון A1, BMI 35, EFW 3930 גרם. בלידה נרתיקית, לאחר לידת הראש — עצירת כתפיים.',
    expected_actions: 'McRoberts + לחץ סופרה-פובי · Rubin II / Woods · Zavanelli כמוצא אחרון · קריאה לניאונטולוג + עזרה · תיעוד זמנים · לחץ מינימלי על הראש',
    phases: 'שלב 1: טרם הלידה | שלב 2: תסמין הצב, עצירת כתפיים | שלב 3: >1 דקה, ברדיקרדיה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לפני הלידה',
        clinical_description: 'שירה בשלב שני. רחוס מלא. EFM תקין. מוכנה ללידה.',
        structured_data: {
          patient: { name: 'שירה לוי', age: 34, gravida: 3, para: 2, gestational_weeks: 40, gestational_days: 2, blood_type: 'A+', allergies: 'ללא', history: 'GDM A1, BMI 35, EFW 3930g' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 92, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 36.7 },
          labs: { cbc: { hgb: 12.1, plt: 268 }, chemistry: { glu: 108 }, coagulation: { inr: 1.00 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פרע כתפיים, תסמין הצב',
        clinical_description: 'לאחר לידת הראש — סיבוב חיצוני נעדר. ראש שוקע חזרה. תסמין הצב. ברדיקרדיה עוברית 90.',
        structured_data: {
          ctg: { fhr_baseline: 90, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'prolonged', deceleration_depth: 50, contraction_frequency: 5, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 98, bp_systolic: 124, bp_diastolic: 78, spo2: 99, temp: 36.7 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — >1 דקה, מצוקה עוברית',
        clinical_description: 'יותר מ-1 דקה מאז לידת הראש. ברדיקרדיה קשה. דחיפות מקסימלית.',
        structured_data: {
          ctg: { fhr_baseline: 72, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', deceleration_depth: 70, contraction_frequency: 5, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 105, bp_systolic: 130, bp_diastolic: 82, spo2: 99, temp: 36.7 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 3. Vacuum Delivery ───────────────────────────────────────────────────
  {
    name: 'ואקום — Vacuum Delivery',
    case_story: 'נעמה ברגר, 30, G1P0, שבוע 40+3. לידה ממושכת שלב שני >2 שעות. אפידורל. גובה ראש +1. לידת ואקום.',
    expected_actions: 'אינדיקציות ואקום · הדבקה ומשיכה עם צירים · בדיקת ירידה אחרי כל משיכה · הגבלה ל-3 פופ-אוף · הכנה לניתוח קיסרי',
    phases: 'שלב 1: הערכה לואקום | שלב 2: אין התקדמות 30 דק | שלב 3: 2 משיכות ללא ירידה | שלב 4: פופ-אוף שני',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — הערכה ראשונית',
        clinical_description: 'גובה ראש +1, פתיחה מלאה, מחיקה 100%. דיצלרציות משתנות קלות. הכנה לאינסטרומנטציה.',
        structured_data: {
          patient: { name: 'נעמה ברגר', age: 30, gravida: 1, para: 0, gestational_weeks: 40, gestational_days: 3, blood_type: 'B+', allergies: 'ללא', history: 'G1P0, אפידורל, שלב שני ממושך' },
          ctg: { fhr_baseline: 142, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'variable_mild', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 88, bp_systolic: 116, bp_diastolic: 72, spo2: 99, temp: 37.0 },
          labs: { cbc: { hgb: 11.8, plt: 255 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — אין התקדמות 30 דקות',
        clinical_description: 'דיצלרציות משתנות מתגברות. ראש לא יורד. קאפוט.',
        structured_data: {
          ctg: { fhr_baseline: 138, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_moderate', deceleration_depth: 40, contraction_frequency: 4, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 94, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — 2 משיכות, ללא ירידה',
        clinical_description: 'שתי משיכות תקינות ללא ירידה. קאפוט גדול. דיצלרציות קשות.',
        structured_data: {
          ctg: { fhr_baseline: 132, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_severe', deceleration_depth: 65, contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 100, bp_systolic: 120, bp_diastolic: 76, spo2: 98, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — פופ-אוף שני, מצוקה',
        clinical_description: 'פופ-אוף שני. דיצלרציות קשות ממושכות. מצוקה עוברית. קיסרי דחוף.',
        structured_data: {
          ctg: { fhr_baseline: 95, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', deceleration_depth: 50, contraction_frequency: 5, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 108, bp_systolic: 125, bp_diastolic: 80, spo2: 98, temp: 37.2 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 4. Eclampsia ─────────────────────────────────────────────────────────
  {
    name: 'אקלמפסיה + יל"ד חמור',
    case_story: 'מיכל שמיר, 27, G1P0, שבוע 36+6. כאב ראש קשה, ראייה מטושטשת. יל"ד מסכן חיים. פרכוס.',
    expected_actions: 'MgSO4 IV · לברטלול/ניפדיפין · כרית ואוויר פתוח · מיגון מפרכוסים · ניטור עובר · הכנה ללידה דחופה · נפרולוגיה/נוירולוגיה',
    phases: 'שלב 1: יל"ד קשה, HELLP | שלב 2: פרכוס | שלב 3: לאחר פרכוס | שלב 4: התאוששות',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — יל"ד קשה, HELLP מתחיל',
        clinical_description: 'BP 172/112. כאב ראש + ראייה מטושטשת. טסיות יורדות. אנזימי כבד מוגברים.',
        structured_data: {
          patient: { name: 'מיכל שמיר', age: 27, gravida: 1, para: 0, gestational_weeks: 36, gestational_days: 6, blood_type: 'AB+', allergies: 'ללא', history: 'G1P0, כאב ראש, ראייה מטושטשת' },
          ctg: { fhr_baseline: 145, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 96, bp_systolic: 172, bp_diastolic: 112, spo2: 98, temp: 37.0 },
          labs: { cbc: { plt: 135, hgb: 11.8 }, chemistry: { ast: 85, alt: 92, ldh: 380, alb: 3.4, cre: 0.82 }, coagulation: { inr: 1.05 }, other: { crp: 1.2, protein_creatinine_ratio: 420 } },
          abnormal_fields: ['bp_systolic', 'bp_diastolic', 'ast', 'alt', 'ldh', 'protein_creatinine_ratio'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פרכוס',
        clinical_description: 'פרכוס טוניקו-קלוני. BP 185/118. SpO2 יורד. ברדיקרדיה עוברית.',
        structured_data: {
          ctg: { fhr_baseline: 80, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'bradycardia' },
          vitals: { hr: 118, bp_systolic: 185, bp_diastolic: 118, spo2: 86, temp: 37.2 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — פוסט-איקטלי',
        clinical_description: 'לאחר פרכוס. BP ירד מעט. SpO2 משתפר. HELLP מחמיר.',
        structured_data: {
          ctg: { fhr_baseline: 138, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'late', deceleration_depth: 20, contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 104, bp_systolic: 178, bp_diastolic: 108, spo2: 95, temp: 37.4 },
          labs: { cbc: { plt: 110, hgb: 11.2 }, chemistry: { ast: 130, alt: 150, ldh: 520 }, coagulation: { inr: 1.15 } },
          abnormal_fields: ['plt', 'ast', 'alt', 'ldh'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — התאוששות לאחר טיפול',
        clinical_description: 'MgSO4 + לברטלול. BP מתייצב. עובר מתאושש.',
        structured_data: {
          ctg: { fhr_baseline: 142, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 92, bp_systolic: 154, bp_diastolic: 95, spo2: 98, temp: 37.3 },
          labs: { cbc: { plt: 98 }, chemistry: { ast: 115, alt: 132 } },
          abnormal_fields: ['plt', 'ast', 'alt'],
        },
      },
    ],
  },

  // ─── 5. Uterine Rupture ───────────────────────────────────────────────────
  {
    name: 'קרע ברחם — Uterine Rupture',
    case_story: 'פאטמה חסן, 35, G8P7CS1VBAC4, שבוע 39+1. TOLAC. כאב פתאומי על צלקת. דימום בינוני. ראש העובר מתרחק.',
    expected_actions: 'ניתוח קיסרי דחוף · IV access + נוזלים · צלב-התאמה דם · הכנה לניתוח · קריאה לצוות ניתוח',
    phases: 'שלב 1: לידה תקינה | שלב 2: כאב + דיצלרציות | שלב 3: קרע — שוק',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לידה תקינה, פתיחה 7 ס"מ',
        clinical_description: 'TOLAC מתקדם. פתיחה 7 ס"מ. EFM תקין.',
        structured_data: {
          patient: { name: 'פאטמה חסן', age: 35, gravida: 8, para: 7, gestational_weeks: 39, gestational_days: 1, blood_type: 'O-', allergies: 'ללא', history: 'G8P7, CS1, VBAC×4, TOLAC' },
          ctg: { fhr_baseline: 138, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 84, bp_systolic: 118, bp_diastolic: 72, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 11.5, plt: 245 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — כאב על צלקת, דיצלרציות',
        clinical_description: 'כאב חריף על צלקת הקיסרי. דימום קל מהנרתיק. פתיחה 9 ס"מ. דיצלרציות משתנות.',
        structured_data: {
          ctg: { fhr_baseline: 140, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_moderate', deceleration_depth: 45, contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 106, bp_systolic: 108, bp_diastolic: 68, spo2: 98, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — קרע ברחם, שוק',
        clinical_description: 'כאב חריף. ראש מתרחק. שוק היפווולמי. ברדיקרדיה עוברית.',
        structured_data: {
          ctg: { fhr_baseline: 68, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 0, contraction_intensity: 'mild', special: 'bradycardia' },
          vitals: { hr: 125, bp_systolic: 92, bp_diastolic: 58, spo2: 96, temp: 37.0 },
          labs: { cbc: { hgb: 9.8, hct: 29.5, plt: 215 }, coagulation: { inr: 1.10 } },
          abnormal_fields: ['hgb', 'hct'],
        },
      },
    ],
  },

  // ─── 6. Preterm 26w ───────────────────────────────────────────────────────
  {
    name: 'לידה מוקדמת 26 שבועות',
    case_story: 'יעל דוד, 29, G2P1, שבוע 26+2. צירים סדירים. צוואר 23 מ"מ. תנועות עובר תקינות.',
    expected_actions: 'סטרואידים (בטמתזון) · מגנזיום נוירו-פרוטקטיבי · טוקוליזה · העברה לרמה 3 · ניאונטולוגיה/NICU · תיעוד הורים',
    phases: 'שלב 1: צווארון 23 מ"מ, צירים | שלב 2: 3 ס"מ, 80% | שלב 3: פקיעת ממברנות | שלב 4: פתיחה מלאה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — צירים מוקדמים',
        structured_data: {
          patient: { name: 'יעל דוד', age: 29, gravida: 2, para: 1, gestational_weeks: 26, gestational_days: 2, blood_type: 'A-', allergies: 'ללא', history: 'G2P1, לידה קודמת 36w' },
          ctg: { fhr_baseline: 152, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'mild', special: 'tachycardia' },
          vitals: { hr: 92, bp_systolic: 112, bp_diastolic: 70, spo2: 99, temp: 37.0 },
          labs: { cbc: { wbc: 11.2, hgb: 11.4, plt: 265 }, chemistry: { cre: 0.58 }, other: { crp: 0.8 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פתיחה 3 ס"מ',
        structured_data: {
          ctg: { fhr_baseline: 154, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'tachycardia' },
          vitals: { hr: 96, bp_systolic: 115, bp_diastolic: 72, spo2: 99, temp: 37.2 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — פקיעת ממברנות, זיהום',
        structured_data: {
          ctg: { fhr_baseline: 162, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 5, contraction_intensity: 'moderate', special: 'tachycardia' },
          vitals: { hr: 108, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 38.4 },
          labs: { cbc: { wbc: 17.0, hgb: 10.8 }, other: { crp: 32.0 } },
          abnormal_fields: ['wbc', 'crp', 'temp'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — פתיחה מלאה, דיצלרציות',
        structured_data: {
          ctg: { fhr_baseline: 158, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_moderate', contraction_frequency: 6, contraction_intensity: 'strong', special: 'tachycardia' },
          vitals: { hr: 112, bp_systolic: 122, bp_diastolic: 76, spo2: 98, temp: 38.6 },
          labs: { cbc: { wbc: 19.5 }, other: { crp: 60.0 } },
          abnormal_fields: ['wbc', 'crp'],
        },
      },
    ],
  },

  // ─── 7. Fetal Bradycardia ─────────────────────────────────────────────────
  {
    name: 'ברדיקרדיה עוברית',
    case_story: 'הדס אהרון, 33, G8P6, שבוע 40+1. לידה פעילה, פתיחה 6-7 ס"מ. אפידורל הוזמן. ברדיקרדיה פתאומית לאחר האפידורל.',
    expected_actions: 'שינוי תנוחה · עצור אוקסיטוצין · טרבוטלין למאחד ייתר · O2 · IV bolus · בדיקת צניחת חבל · הכנה לקיסרי דחוף',
    phases: 'שלב 1: FHR תקין | שלב 2: ברדיקרדיה >3 דקות | שלב 3: ללא התאוששות',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לידה תקינה',
        structured_data: {
          patient: { name: 'הדס אהרון', age: 33, gravida: 8, para: 6, gestational_weeks: 40, gestational_days: 1, blood_type: 'B-', allergies: 'ללא', history: 'G8P6, לידות קודמות תקינות' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 86, bp_systolic: 118, bp_diastolic: 72, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 12.2, plt: 280 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — ברדיקרדיה פתאומית, >3 דקות',
        clinical_description: 'לאחר מינון אפידורל. ברדיקרדיה פתאומית 70-80 bpm. טכיסיסטולה. >3 דקות.',
        structured_data: {
          ctg: { fhr_baseline: 75, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', deceleration_depth: 65, contraction_frequency: 8, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 92, bp_systolic: 88, bp_diastolic: 54, spo2: 98, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — ללא התאוששות, קיסרי דחוף',
        clinical_description: 'ללא שינוי לאחר התערבויות. ברדיקרדיה קשה ממשיכה. וריאביליות נעדרת.',
        structured_data: {
          ctg: { fhr_baseline: 68, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'prolonged', deceleration_depth: 72, contraction_frequency: 8, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 96, bp_systolic: 92, bp_diastolic: 56, spo2: 97, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 8. AFE / Maternal Resuscitation ─────────────────────────────────────
  {
    name: 'החייאה אמהית — AFE',
    case_story: 'סמירה ג\'אסם, 41, G10P9, שבוע 39+0. פתיחה מלאה. פתאום קוצר נשימה, ירידת לחץ דם, אובדן הכרה.',
    expected_actions: 'קריאה לצוות · ACLS בהריון · תנוחת שמאל 30° · קיסרי PMCD תוך 5 דקות · מזרק אדרנלין · ECMO שיקול',
    phases: 'שלב 1: קריסה המודינמית | שלב 2: ללא דופק (PEA) | שלב 3: CPR 4 דקות | שלב 4: לאחר קיסרי, DIC',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — קריסה ראשונית',
        structured_data: {
          patient: { name: 'סמירה ג\'אסם', age: 41, gravida: 10, para: 9, gestational_weeks: 39, gestational_days: 0, blood_type: 'O+', allergies: 'ללא', history: 'G10P9, פתיחה מלאה' },
          ctg: { fhr_baseline: 172, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'late', deceleration_depth: 35, contraction_frequency: 3, contraction_intensity: 'moderate', special: 'tachycardia' },
          vitals: { hr: 130, bp_systolic: 88, bp_diastolic: 54, spo2: 85, temp: 37.1 },
          labs: { cbc: { hgb: 11.8, plt: 245 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — ללא דופק (PEA)',
        clinical_description: 'ללא דופק. SpO2 לא ניתן למדידה. ברדיקרדיה עוברית קשה.',
        structured_data: {
          ctg: { fhr_baseline: 60, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 0, contraction_intensity: 'mild', special: 'bradycardia' },
          vitals: { hr: 0, bp_systolic: 0, bp_diastolic: 0, spo2: 60, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — CPR 4 דקות, PMCD',
        clinical_description: 'CPR פעיל 4 דקות. הכנה ל-PMCD. קיסרי על מיטת ה-CPR.',
        structured_data: {
          ctg: { fhr_baseline: 60, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 0, contraction_intensity: 'mild', special: 'bradycardia' },
          vitals: { hr: 0, bp_systolic: 40, bp_diastolic: 20, spo2: 72, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — לאחר PMCD, DIC',
        clinical_description: 'לאחר PMCD וחידוש זרימה ספונטנית. DIC מלא.',
        structured_data: {
          ctg: { fhr_baseline: 0, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 118, bp_systolic: 82, bp_diastolic: 50, spo2: 90, temp: 36.2 },
          labs: { cbc: { hgb: 8.2, plt: 85 }, coagulation: { inr: 2.10, ptt: 48.0, fib: 90, d_dimer: 8.5 } },
          abnormal_fields: ['hgb', 'plt', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
    ],
  },
];

/** Helper: get scenario by index (0-based) */
export function getScenario(index: number): SimScenario {
  return SEEDED_SCENARIOS[index] ?? SEEDED_SCENARIOS[0];
}
