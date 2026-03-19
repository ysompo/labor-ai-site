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
    case_story: 'יולדת בת 34, G3P2, שבוע 40+2. סוכרת הריונית GDMA1, BMI 35, EFW 3930 גרם. שעתיים וחצי בפתיחה גמורה. לאחר לידת הראש — עצירת כתפיים.',
    expected_actions: 'McRoberts + לחץ סופרה-פובי · Rubin II / Woods · Zavanelli כמוצא אחרון · קריאה לניאונטולוג + עזרה · תיעוד זמנים · לחץ מינימלי על הראש',
    phases: 'שלב 1: טרם הלידה | שלב 2: תסמין הצב, עצירת כתפיים | שלב 3: >1 דקה, ברדיקרדיה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — שלב שני, ראש בספינה +2',
        clinical_description: 'יולדת בת 34, G3P2, שבוע 40+2. סוכרת הריונית, GDMA1, BMI 35. הערכת משקל אחרונה 3930 גרם. שעתיים וחצי בפתיחה גמורה. ראש בספינה +2.',
        structured_data: {
          patient: { name: 'יולדת', age: 34, gravida: 3, para: 2, gestational_weeks: 40, gestational_days: 2, blood_type: 'A+', allergies: 'ללא', history: 'G3P2, GDM A1, BMI 35, EFW 3930g' },
          ctg: { fhr_baseline: 145, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 92, bp_systolic: 126, bp_diastolic: 78, spo2: 99, temp: 36.6 },
          labs: { cbc: { hgb: 12.0, plt: 230 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פרע כתפיים, תסמין הצב',
        clinical_description: 'הראש נולד. בציר הבא אין התקדמות של הכתפיים. הראש נשאר צמוד לפרינאום. ברדיקרדיה ל-90.',
        structured_data: {
          ctg: { fhr_baseline: 90, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 5, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 110, bp_systolic: 132, bp_diastolic: 82, spo2: 98, temp: 36.7 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — >1 דקה, מצוקה עוברית',
        clinical_description: 'אין שחרור כתפיים לאחר ניסיון ראשוני. העובר במנח קבוע. זמן מאז לידת הראש – מעל דקה. ברדיקרדיה ממושכת 70–80.',
        structured_data: {
          ctg: { fhr_baseline: 75, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 5, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 118, bp_systolic: 140, bp_diastolic: 85, spo2: 97, temp: 36.7 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 3. Instrumental Delivery ─────────────────────────────────────────────
  {
    name: 'לידה מכשירנית — Instrumental Delivery',
    case_story: 'יולדת בת 30, G1P0, שבוע 40+3. שעה וחצי בפתיחה גמורה, ראש בספינה +1. הוחל בלידה מכשירנית (KIWI/סיליקון). שני ניתוקים ללא ירידה.',
    expected_actions: 'אינדיקציות ואקום · הדבקה ומשיכה עם צירים · בדיקת ירידה אחרי כל משיכה · הגבלה ל-3 פופ-אוף · הכנה לניתוח קיסרי',
    phases: 'שלב 1: הערכה ראשונית | שלב 2: אין התקדמות 30 דק | שלב 3: 2 משיכות ללא ירידה | שלב 4: ניתוק שני',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — הערכה ראשונית, פתיחה גמורה',
        clinical_description: 'תורן חדר לידה נקרא לחדר להעריך את היולדת. היולדת מותשת, משתפת פעולה. שעה וחצי בפתיחה גמורה, ראש בספינה +1.',
        structured_data: {
          patient: { name: 'יולדת', age: 30, gravida: 1, para: 0, gestational_weeks: 40, gestational_days: 3, blood_type: 'B+', allergies: 'ללא', history: 'G1P0, אפידורל, שלב שני ממושך' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 96, bp_systolic: 118, bp_diastolic: 72, spo2: 99, temp: 36.7 },
          labs: { cbc: { hgb: 11.5, plt: 210 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — אין התקדמות 30 דקות',
        clinical_description: 'אין התקדמות בירידת הראש מזה 30 דקות. היולדת מתקשה ללחוץ. בדיקה חוזרת – ראש בספינה +1 ללא שינוי.',
        structured_data: {
          ctg: { fhr_baseline: 150, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'variable_mild', contraction_frequency: 4, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 102, bp_systolic: 115, bp_diastolic: 70, spo2: 99, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — שתי משיכות ללא ירידה, קאפוט',
        clinical_description: 'הוחל בלידה מכשירנית (KIWI/סיליקון). לאחר שתי משיכות אין ירידה משמעותית של הראש. מתפתח קאפוט קל.',
        structured_data: {
          ctg: { fhr_baseline: 150, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_severe', contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 108, bp_systolic: 110, bp_diastolic: 68, spo2: 98, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — ניתוק שני, מצוקה עוברית',
        clinical_description: 'ניתוק שני של הוואקום. אין ירידת ראש נוספת. קאפוט משמעותי יותר במישוש.',
        structured_data: {
          ctg: { fhr_baseline: 170, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 115, bp_systolic: 105, bp_diastolic: 65, spo2: 98, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 4. Eclampsia ─────────────────────────────────────────────────────────
  {
    name: 'אקלמפסיה + יל"ד חמור',
    case_story: 'יולדת בת 27, G1P0, שבוע 36+6. כאבי ראש חזקים וטשטוש ראייה. כאב אפיגסטרי. יל"ד חמור. פרכוס טוני-קלוני.',
    expected_actions: 'MgSO4 IV · לברטלול/ניפדיפין · כרית ואוויר פתוח · מיגון מפרכוסים · ניטור עובר · הכנה ללידה דחופה · נפרולוגיה/נוירולוגיה',
    phases: 'שלב 1: יל"ד קשה, HELLP | שלב 2: פרכוס | שלב 3: פוסט-איקטלי | שלב 4: התאוששות',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — יל"ד קשה, HELLP מתחיל',
        clinical_description: 'יולדת בת 27, שבוע 36+6 להריונה הראשון. כאבי ראש חזקים וטשטוש ראייה ביממה האחרונה. מדווחת על כאב אפיגסטרי.',
        structured_data: {
          patient: { name: 'יולדת', age: 27, gravida: 1, para: 0, gestational_weeks: 36, gestational_days: 6, blood_type: 'AB+', allergies: 'ללא', history: 'G1P0, כאב ראש, טשטוש ראייה, כאב אפיגסטרי' },
          ctg: { fhr_baseline: 130, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 94, bp_systolic: 172, bp_diastolic: 112, spo2: 99, temp: 36.8 },
          labs: { cbc: { plt: 135, hgb: 11.0 }, chemistry: { ast: 85, alt: 92 } },
          abnormal_fields: ['bp_systolic', 'bp_diastolic', 'ast', 'alt'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פרכוס טוני-קלוני',
        clinical_description: 'פרכוס טוני-קלוני כללי. איבוד הכרה. קצף בפה. אובדן שליטה על סוגרים.',
        structured_data: {
          ctg: { fhr_baseline: 80, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'bradycardia' },
          vitals: { hr: 130, bp_systolic: 185, bp_diastolic: 118, spo2: 86, temp: 37.2 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — פוסט-איקטלי',
        clinical_description: 'מצב פוסט-איקטלי. אינה מגיבה לפקודות. לחץ דם עדיין גבוה.',
        structured_data: {
          ctg: { fhr_baseline: 130, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 115, bp_systolic: 178, bp_diastolic: 108, spo2: 94, temp: 37.4 },
          labs: { cbc: { plt: 110 }, chemistry: { ast: 130, alt: 150 } },
          abnormal_fields: ['plt', 'ast', 'alt'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — התאוששות לאחר טיפול',
        clinical_description: 'מגיבה לפקודות, מבולבלת.',
        structured_data: {
          ctg: { fhr_baseline: 130, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 115, bp_systolic: 154, bp_diastolic: 95, spo2: 99, temp: 37.3 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 5. Uterine Rupture ───────────────────────────────────────────────────
  {
    name: 'קרע ברחם — Uterine Rupture',
    case_story: 'יולדת בת 35, G8P7CS1VBAC4, שבוע 39+1. לידה פעילה, TOLAC. כאב בבטן תחתונה, רגישות על צלקת, דימום וגינלי קל. האטות משתנות עמוקות, שוק היפווולמי.',
    expected_actions: 'ניתוח קיסרי דחוף · IV access + נוזלים · צלב-התאמה דם · הכנה לניתוח · קריאה לצוות ניתוח',
    phases: 'שלב 1: לידה פעילה תקינה | שלב 2: כאב + האטות משתנות קלות | שלב 3: קרע — שוק + האטות עמוקות',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לידה פעילה, פתיחה 7 ס"מ',
        clinical_description: 'יולדת בת 35, G8P7CS1VBAC4, שבוע 39+1. לידה פעילה, פתיחה 7 ס"מ.',
        structured_data: {
          patient: { name: 'יולדת', age: 35, gravida: 8, para: 7, gestational_weeks: 39, gestational_days: 1, blood_type: 'O-', allergies: 'ללא', history: 'G8P7, CS1, VBAC×4, TOLAC' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 88, bp_systolic: 122, bp_diastolic: 74, spo2: 99, temp: 36.7 },
          labs: { cbc: { hgb: 11.8, plt: 205 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — כאב על צלקת, האטות משתנות קלות',
        clinical_description: 'היולדת מדווחת על צירים חזקים וכאבים בבטן תחתונה — 10 דק׳ אחרי ביצוע אפידורל. רגישות קלה על פני הצלקת. דימום וגינלי קל. פתיחה 9 ס"מ, ראש בספינה ויורד לספינה +1 בזמן ציר.',
        structured_data: {
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'variable_mild', contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 105, bp_systolic: 110, bp_diastolic: 68, spo2: 98, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — קרע ברחם, שוק',
        clinical_description: 'כאב חזק בבטן תחתונה. רגישות על פני הצלקת. פתיחה 9 ס"מ, ראש בספינה -1.',
        structured_data: {
          ctg: { fhr_baseline: 85, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 4, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 125, bp_systolic: 92, bp_diastolic: 58, spo2: 96, temp: 37.0 },
          labs: { cbc: { hgb: 9.8 } },
          abnormal_fields: ['hgb'],
        },
      },
    ],
  },

  // ─── 6. Preterm 26w ───────────────────────────────────────────────────────
  {
    name: 'לידה מוקדמת 26 שבועות',
    case_story: 'יולדת בת 29, G2P1, שבוע 26+2. צירים סדירים מזה 3 שעות, ללא PPROM. צוואר 23 מ"מ. ירידת מים, פתיחה מתקדמת, סימני זיהום.',
    expected_actions: 'סטרואידים (בטמתזון) · מגנזיום נוירו-פרוטקטיבי · טוקוליזה · העברה לרמה 3 · ניאונטולוגיה/NICU · תיעוד הורים',
    phases: 'שלב 1: צווארון 23 מ"מ, צירים | שלב 2: 3 ס"מ, 80% | שלב 3: פקיעת ממברנות | שלב 4: פתיחה מלאה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — צירים מוקדמים',
        clinical_description: 'יולדת בת 29, G2P1, שבוע 26+2. צירים סדירים מזה 3 שעות. ללא PPROM. US – צוואר 23 מ"מ.',
        structured_data: {
          patient: { name: 'יולדת', age: 29, gravida: 2, para: 1, gestational_weeks: 26, gestational_days: 2, blood_type: 'A-', allergies: 'ללא', history: 'G2P1, לידה קודמת 36w' },
          ctg: { fhr_baseline: 155, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 96, bp_systolic: 118, bp_diastolic: 70, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 11.4, plt: 220 }, other: { crp: 0.8 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פתיחה 3 ס"מ, מחיקה 80%',
        clinical_description: 'פתיחה 3 ס"מ, מחיקה 80%. צירים תכופים יותר. כאובה.',
        structured_data: {
          ctg: { fhr_baseline: 160, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'tachycardia' },
          vitals: { hr: 104, bp_systolic: 120, bp_diastolic: 75, spo2: 99, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — ירידת מים, פתיחה 6 ס"מ',
        clinical_description: 'ירידת מים, מים נקיים. פתיחה 6 ס"מ.',
        structured_data: {
          ctg: { fhr_baseline: 162, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 5, contraction_intensity: 'moderate', special: 'tachycardia' },
          vitals: { hr: 120, bp_systolic: 115, bp_diastolic: 70, spo2: 98, temp: 37.3 },
          labs: { cbc: { wbc: 17.0 }, other: { crp: 32.0 } },
          abnormal_fields: ['wbc', 'crp'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — פתיחה מלאה, האטות משתנות',
        clinical_description: 'פתיחה מלאה. לידה מתקדמת במהירות.',
        structured_data: {
          ctg: { fhr_baseline: 158, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_moderate', contraction_frequency: 6, contraction_intensity: 'strong', special: 'tachycardia' },
          vitals: { hr: 118, bp_systolic: 110, bp_diastolic: 68, spo2: 98, temp: 37.8 },
          labs: { other: { crp: 60.0 } },
          abnormal_fields: ['crp'],
        },
      },
    ],
  },

  // ─── 7. Fetal Bradycardia ─────────────────────────────────────────────────
  {
    name: 'ברדיקרדיה עוברית',
    case_story: 'יולדת בת 33, שבוע 40+1, לידה שניה. פתיחה 6–7 ס"מ. אפידורל הוזמן. ברדיקרדיה פתאומית ל-70–80 לאחר האפידורל, נמשכת מעל 3 דקות, ללא התאוששות.',
    expected_actions: 'שינוי תנוחה · עצור אוקסיטוצין · טרבוטלין למאחד ייתר · O2 · IV bolus · בדיקת צניחת חבל · הכנה לקיסרי דחוף',
    phases: 'שלב 1: FHR תקין | שלב 2: ברדיקרדיה >3 דקות | שלב 3: ללא התאוששות',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לידה תקינה',
        clinical_description: 'יולדת בת 33, שבוע 40+1, לידה שניה. פתיחה 6–7 ס"מ. לידה מתקדמת. הוזמן מרדים לאפידורל.',
        structured_data: {
          patient: { name: 'יולדת', age: 33, gravida: 2, para: 1, gestational_weeks: 40, gestational_days: 1, blood_type: 'B-', allergies: 'ללא', history: 'G2P1, לידה קודמת תקינה' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 95, bp_systolic: 118, bp_diastolic: 72, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 12.2, plt: 280 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — ברדיקרדיה פתאומית, >3 דקות',
        clinical_description: 'האטה פתאומית ל-70–80. נמשכת מעל 3 דקות. 10 דק׳ אחרי אפידורל. פעילות רחמית 7–8 צירים ב-10 דק׳.',
        structured_data: {
          ctg: { fhr_baseline: 75, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 8, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 105, bp_systolic: 120, bp_diastolic: 75, spo2: 98, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — ללא התאוששות, קיסרי דחוף',
        clinical_description: 'אין התאוששות של הדופק העוברי. וריאביליות מינימלית.',
        structured_data: {
          ctg: { fhr_baseline: 70, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 8, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 110, bp_systolic: 122, bp_diastolic: 76, spo2: 98, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 8. AFE / Maternal Resuscitation ─────────────────────────────────────
  {
    name: 'החייאה אמהית — AFE',
    case_story: 'יולדת בת 41, G10P9, שבוע 39. לידה עשירית. בפתיחה מלאה — קוצר נשימה, קריסה המודינמית, אובדן הכרה ואין דופק. BLS ללא חידוש דופק. DIC לאחר ההחייאה.',
    expected_actions: 'קריאה לצוות · ACLS בהריון · תנוחת שמאל 30° · קיסרי PMCD תוך 5 דקות · מזרק אדרנלין · ECMO שיקול',
    phases: 'שלב 1: קריסה המודינמית | שלב 2: ללא דופק (PEA) | שלב 3: BLS 4 דקות | שלב 4: לאחר החייאה, DIC',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — קריסה ראשונית',
        clinical_description: 'יולדת בת 41, שבוע 39. לידה עשירית. התקבלה לחדר לידה עם צירים בלידה פעילה. בפתיחה מלאה הופעה של קוצר נשימה.',
        structured_data: {
          patient: { name: 'יולדת', age: 41, gravida: 10, para: 9, gestational_weeks: 39, gestational_days: 0, blood_type: 'O+', allergies: 'ללא', history: 'G10P9, פתיחה מלאה' },
          ctg: { fhr_baseline: 172, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_moderate', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'tachycardia' },
          vitals: { hr: 130, bp_systolic: 88, bp_diastolic: 54, spo2: 85, temp: 37.1 },
          labs: { cbc: { hgb: 11.6, plt: 200 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — ללא דופק (PEA)',
        clinical_description: 'איבוד הכרה פתאומי. אין דופק נמוש. פתיחה מלאה, ראש בספינות. ברדיקרדיה קשה.',
        structured_data: {
          ctg: { fhr_baseline: 60, fhr_variability: 'absent', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 0, contraction_intensity: 'mild', special: 'bradycardia' },
          vitals: { hr: 0, bp_systolic: 0, bp_diastolic: 0, spo2: 60, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — BLS 4 דקות, ללא חידוש דופק',
        clinical_description: 'הוחל במאמצי BLS, ללא חזרה של דופק אימהי לאחר 4 דק׳. דופק לא נימוש, אין נשימה ספונטנית. דופק עוברי לא נשמע.',
        structured_data: {
          vitals: { hr: 0, bp_systolic: 40, bp_diastolic: 20, spo2: 60, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — לאחר החייאה, DIC',
        clinical_description: 'לאחר החייאה — דימום מפצעי החתך ומהנרתיק.',
        structured_data: {
          vitals: { hr: 120, bp_systolic: 90, bp_diastolic: 60, spo2: 90, temp: 36.2 },
          labs: { cbc: { plt: 85 }, coagulation: { inr: 2.10, fib: 90 } },
          abnormal_fields: ['plt', 'inr', 'fib'],
        },
      },
    ],
  },
];

/** Helper: get scenario by index (0-based) */
export function getScenario(index: number): SimScenario {
  return SEEDED_SCENARIOS[index] ?? SEEDED_SCENARIOS[0];
}
