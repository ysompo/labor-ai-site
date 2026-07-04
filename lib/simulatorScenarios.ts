import type { SimScenario } from './simulatorTypes';

/**
 * 8 pre-seeded obstetric emergency scenarios with full structured data.
 * Used to seed the database and as fallback when DB is not configured.
 */
export const SEEDED_SCENARIOS: SimScenario[] = [

  // ─── 1. PPH ──────────────────────────────────────────────────────────────
  {
    name: 'PPH — דימום אחרי לידה',
    case_story: 'יולדת בת 39, G9P7, שבוע 39+4. לידה ספונטנית לאחר שלב שני ממושך עקב מצג OP. שליה שלמה. מיד לאחר הלידה דימום גינקולוגי מוגבר עם רחם אטוני.',
    expected_actions: 'עיסוי רחם · אוקסיטוצין IV/IM · הערכת שליה · עירוי נוזלים · ספירת דם + קרישה · קריאה לצוות בכיר · שיקול מיזופרוסטול/טרנקסמיק · הכנה לחדר ניתוח',
    phases: 'שלב 1: אטוניה ראשונית | שלב 2: אין תגובה לטיפול ראשוני | שלב 3: דימום המוני | שלב 4: DIC מתפתח',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — מצב ראשוני',
        clinical_description: 'יולדת בת 39, G9P7, שבוע 39+4. שלב שני ממושך עקב מצג OP, לידה ספונטנית. שליה שלמה. דימום מוגבר, רחם אטוני. מצב המודינמי יציב.',
        structured_data: {
          patient: { name: 'יולדת', age: 39, gravida: 9, para: 7, gestational_weeks: 39, gestational_days: 4, blood_type: 'O+', allergies: 'ללא', history: 'G9P7, מצג OP, שלב שני ממושך' },
          ctg: { postpartum: true, fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 92, bp_systolic: 120, bp_diastolic: 78, spo2: 99, temp: 36.8 },
          labs: { cbc: { wbc: 10.2, rbc: 3.88, hgb: 11.2, hct: 34.2, plt: 245, mcv: 91, mch: 32.7, mchc: 35.8, rdw: 12.6 }, chemistry: { na: 136, k: 4.2, cre: 0.64, alt: 19, ast: 25, alb: 3.6, glu: 98 }, coagulation: { pt_pct: 100, inr: 1.00, ptt: 24.0, fib: 412 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — אטוניה, אין תגובה ראשונית',
        clinical_description: '39 שנים, G9P7, 39+4 שב׳ — מצג OP, שלב שני ממושך, PPH\nרחם ממשיך אטוני למרות עיסוי ואוקסיטוצין. דימום נמשך. דחיפות מוגברת.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 109, bp_systolic: 111, bp_diastolic: 68, spo2: 98, temp: 36.9 },
          labs: { cbc: { wbc: 11.8, hgb: 10.1, hct: 30.5, plt: 228, rdw: 13.0 }, coagulation: { inr: 1.15, ptt: 26.5, fib: 380 } },
          abnormal_fields: ['hgb', 'hct'],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — דימום נמשך, אי-יציבות',
        clinical_description: '39 שנים, G9P7, 39+4 שב׳ — מצג OP, שלב שני ממושך, PPH\nללא תגובה לאוקסיטוצין ומיזופרוסטול. טכיקרדיה. יל"ד יורד. דימום ג\'ני מוגבר.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 122, bp_systolic: 94, bp_diastolic: 62, spo2: 97, temp: 37.0 },
          labs: { cbc: { hgb: 9.9, hct: 29.8, plt: 205 }, coagulation: { inr: 1.40, ptt: 29.5, fib: 310 }, other: { crp: 1.85 } },
          abnormal_fields: ['hgb', 'hct', 'inr', 'fib', 'crp'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — דימום המוני',
        clinical_description: '39 שנים, G9P7, 39+4 שב׳ — מצג OP, שלב שני ממושך, PPH\nדימום המוני (>1.5L). שוק היפווולמי. DIC מתפתח.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 132, bp_systolic: 87, bp_diastolic: 49, spo2: 95, temp: 37.1 },
          labs: { cbc: { hgb: 8.1, hct: 24.3, plt: 142 }, coagulation: { inr: 1.90, ptt: 38.0, fib: 195, d_dimer: 2.8 } },
          abnormal_fields: ['hgb', 'hct', 'plt', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
      {
        card_number: 5,
        title: 'כרטיס 5 — חדר ניתוח, DIC',
        clinical_description: '39 שנים, G9P7, 39+4 שב׳ — מצג OP, שלב שני ממושך, PPH\nבחדר ניתוח. עירויי דם מרובים. DIC מלא. מצב קריטי אך מנוהל.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
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
        clinical_description: '34 שנים, G3P2, 40+2 שב׳ — GDM A1, BMI 35, EFW 3930g\nהראש נולד. בציר הבא אין התקדמות של הכתפיים. הראש נשאר צמוד לפרינאום. ברדיקרדיה ל-90.',
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
        clinical_description: '34 שנים, G3P2, 40+2 שב׳ — GDM A1, BMI 35, EFW 3930g\nאין שחרור כתפיים לאחר ניסיון ראשוני. העובר במנח קבוע. זמן מאז לידת הראש – מעל דקה. ברדיקרדיה ממושכת 70–80.',
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
        clinical_description: '30 שנים, G1P0, 40+3 שב׳ — אפידורל, שלב שני ממושך, ואקום\nאין התקדמות בירידת הראש מזה 30 דקות. היולדת מתקשה ללחוץ. בדיקה חוזרת – ראש בספינה +1 ללא שינוי.',
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
        clinical_description: '30 שנים, G1P0, 40+3 שב׳ — אפידורל, שלב שני ממושך, ואקום\nהוחל בלידה מכשירנית (KIWI/סיליקון). לאחר שתי משיכות אין ירידה משמעותית של הראש. מתפתח קאפוט קל.',
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
        clinical_description: '30 שנים, G1P0, 40+3 שב׳ — אפידורל, שלב שני ממושך, ואקום\nניתוק שני של הוואקום. אין ירידת ראש נוספת. קאפוט משמעותי יותר במישוש.',
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
    name: 'רעלת הריון חמורה — ניהול שגרתי',
    slug: 'severe-preeclampsia-routine',
    case_story: 'יולדת בת 36, G1P0, שבוע 34+5. הופנתה ממרפאת הריון בסיכון בשל לחץ דם 165/110 וכאב ראש שאינו חולף. בבדיקת מקל — חלבון בשתן. ללא פרכוסים, ללא הפרעות ראייה בשלב זה.',
    expected_actions: 'אישוש מדידות ל"ד · פרוטוקול יל"ד חמור (לברטלול IV / ניפדיפין PO) · MgSO4 מניעתי · סטרואידים להבשלת ריאות · מעבדת רעלת מלאה (ספירה, כימיה, קרישה, יחס חלבון/קראטינין) · ניטור עוברי רציף · תכנון מועד ואופן יילוד',
    phases: 'שלב 1: קבלה והערכה | שלב 2: יל"ד חמור — טיפול תרופתי | שלב 3: תגובה לטיפול, מגנזיום אחזקה | שלב 4: התייצבות ותכנון יילוד',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — קבלה והערכה',
        clinical_description: 'יולדת בת 36, G1P0, שבוע 34+5. כאב ראש מתמשך, ל"ד בקבלה 158/105. בדיקת מקל שתן: חלבון +2. ללא כאב אפיגסטרי, ללא הפרעות ראייה. עובר במצג ראש, תנועות תקינות.',
        structured_data: {
          patient: { name: 'יולדת', age: 36, gravida: 1, para: 0, gestational_weeks: 34, gestational_days: 5, blood_type: 'A+', allergies: 'ללא', history: 'G1P0, יל"ד הריוני חדש, חלבון בשתן' },
          ctg: { fhr_baseline: 138, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 1, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 88, bp_systolic: 158, bp_diastolic: 105, spo2: 99, temp: 36.7 },
          labs: { cbc: { wbc: 9.8, hgb: 12.1, hct: 36.0, plt: 180 }, chemistry: { na: 138, k: 4.1, cre: 0.82, ast: 30, alt: 28, alb: 3.1, ldh: 240, ur_ac: 6.8, glu: 92 }, coagulation: { pt_pct: 98, inr: 1.02, ptt: 26.0, fib: 420 }, other: { protein_creatinine_ratio: 480 } },
          abnormal_fields: ['alb', 'ur_ac', 'protein_creatinine_ratio'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — יל"ד חמור, התחלת טיפול',
        clinical_description: '36 שנים, G1P0, 34+5 שב׳ — רעלת הריון חמורה\nל"ד עולה ל-172/115 בשתי מדידות. כאב ראש מחמיר והופעת הבזקי אור. נדרש: פרוטוקול יל"ד חמור (לברטלול IV), התחלת MgSO4 מניעתי, סטרואידים להבשלת ריאות.',
        structured_data: {
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 96, bp_systolic: 172, bp_diastolic: 115, spo2: 98, temp: 36.8 },
          labs: { cbc: { hgb: 12.0, plt: 165 }, chemistry: { ast: 42, alt: 38, ldh: 280, ur_ac: 7.1 }, coagulation: { inr: 1.05, fib: 410 } },
          abnormal_fields: ['ast', 'alt', 'ldh', 'ur_ac'],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — תגובה לטיפול, מגנזיום אחזקה',
        clinical_description: '36 שנים, G1P0, 34+5 שב׳ — רעלת הריון חמורה\nל"ד יורד ל-148/96 לאחר לברטלול. מגנזיום במינון אחזקה — רפלקסים שמורים, מתן שתן תקין. שינויים חולפים בווריאביליות של העובר (השפעת מגנזיום).',
        structured_data: {
          ctg: { fhr_baseline: 136, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 84, bp_systolic: 148, bp_diastolic: 96, spo2: 99, temp: 36.9 },
          labs: { cbc: { plt: 158 }, chemistry: { ast: 45, alt: 40, mg: 4.8 } },
          abnormal_fields: ['ast', 'alt', 'mg'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — התייצבות ותכנון יילוד',
        clinical_description: '36 שנים, G1P0, 34+5 שב׳ — רעלת הריון חמורה\nל"ד יציב 142/92 תחת טיפול. מעבדה יציבה. הושלם קורס סטרואידים ראשון. דיון: תזמון השראת לידה מול קיסרי, מקום ניטור (יולדות/היריון בסיכון), הנחיות המשך מגנזיום.',
        structured_data: {
          ctg: { fhr_baseline: 138, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 82, bp_systolic: 142, bp_diastolic: 92, spo2: 99, temp: 36.8 },
          labs: { cbc: { plt: 155 }, chemistry: { ast: 40, alt: 36, mg: 4.5, ur_ac: 7.0 } },
          abnormal_fields: ['ast', 'alt', 'mg', 'ur_ac'],
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
        clinical_description: '35 שנים, G8P7, 39+1 שב׳ — CS1, VBAC×4, TOLAC, לידה פעילה\nהיולדת מדווחת על צירים חזקים וכאבים בבטן תחתונה — 10 דק׳ אחרי ביצוע אפידורל. רגישות קלה על פני הצלקת. דימום וגינלי קל. פתיחה 9 ס"מ, ראש בספינה ויורד לספינה +1 בזמן ציר.',
        structured_data: {
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'variable_severe', contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 105, bp_systolic: 110, bp_diastolic: 68, spo2: 98, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — קרע ברחם, שוק',
        clinical_description: '35 שנים, G8P7, 39+1 שב׳ — CS1, VBAC×4, TOLAC, לידה פעילה\nכאב חזק בבטן תחתונה. רגישות על פני הצלקת. פתיחה 9 ס"מ, ראש בספינה -1.',
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
          patient: { name: 'יולדת', age: 29, gravida: 2, para: 1, gestational_weeks: 26, gestational_days: 2, blood_type: 'A-', allergies: 'ללא', history: 'G2P1, לידה קודמת 32w' },
          ctg: { fhr_baseline: 155, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 96, bp_systolic: 118, bp_diastolic: 70, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 11.4, plt: 220 }, other: { crp: 0.8 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פתיחה 3 ס"מ, מחיקה 80%',
        clinical_description: '29 שנים, G2P1, 26+2 שב׳ — לידה קודמת 32w, צירים מוקדמים\nפתיחה 3 ס"מ, מחיקה 80%. צירים תכופים יותר. כאובה.',
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
        clinical_description: '29 שנים, G2P1, 26+2 שב׳ — לידה קודמת 32w, צירים מוקדמים\nירידת מים, מים נקיים. פתיחה 6 ס"מ.',
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
        clinical_description: '29 שנים, G2P1, 26+2 שב׳ — לידה קודמת 32w, צירים מוקדמים\nפתיחה מלאה. לידה מתקדמת במהירות.',
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
    case_story: 'יולדת בת 33, שבוע 40+1, לידה שניה. פתיחה 6–7 ס"מ. אפידורל הוזמן. ברדיקרדיה פתאומית ל-70–80 וירידת מים מיידית לאחר האפידורל, נמשכת מעל 3 דקות, ללא התאוששות.',
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
        clinical_description: '33 שנים, G2P1, 40+1 שב׳ — פתיחה 6–7 ס"מ, לאחר אפידורל, ירידת מים\n10 דק׳ אחרי אפידורל — האטה פתאומית ל-70–80 וירידת מים מיידית. נמשכת מעל 3 דקות. פעילות רחמית 7–8 צירים ב-10 דק׳.',
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
        clinical_description: '33 שנים, G2P1, 40+1 שב׳ — פתיחה 6–7 ס"מ, לאחר אפידורל, ירידת מים\nאין התאוששות של הדופק העוברי. וריאביליות מינימלית.',
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
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 130, bp_systolic: 88, bp_diastolic: 54, spo2: 85, temp: 37.1 },
          labs: { cbc: { hgb: 11.6, plt: 200 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — ללא דופק (PEA)',
        clinical_description: '41 שנים, G10P9, 39 שב׳ — לידה עשירית, פתיחה מלאה\nאיבוד הכרה פתאומי. אין דופק נמוש. פתיחה מלאה, ראש בספינות. מבצעים החייאה.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 0, bp_systolic: 0, bp_diastolic: 0, spo2: 60, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — BLS 4 דקות, ללא חידוש דופק',
        clinical_description: '41 שנים, G10P9, 39 שב׳ — לידה עשירית, פתיחה מלאה\nהוחל במאמצי BLS, ללא חזרה של דופק אימהי לאחר 4 דק׳. דופק לא נימוש, אין נשימה ספונטנית.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 0, bp_systolic: 40, bp_diastolic: 20, spo2: 60, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — לאחר החייאה, DIC',
        clinical_description: '41 שנים, G10P9, 39 שב׳ — לידה עשירית, פתיחה מלאה\nלאחר החייאה — דימום מפצעי החתך ומהנרתיק.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 120, bp_systolic: 90, bp_diastolic: 60, spo2: 90, temp: 36.2 },
          labs: { cbc: { plt: 85 }, coagulation: { inr: 2.10, fib: 90 } },
          abnormal_fields: ['plt', 'inr', 'fib'],
        },
      },
    ],
  },

  // ─── 9. Complicated preeclampsia: seizure → Mg toxicity → liver rupture ────
  // NOTE: scenarios 9-16 are appended — never reorder ids 1-8 (DB overrides by id)
  {
    name: 'רעלת הריון מסובכת — פרכוס, הרעלת מגנזיום, קרע כבד',
    slug: 'eclampsia-complicated',
    case_story: 'יולדת בת 27, G1P0, שבוע 33+0. אושפזה עם רעלת הריון חמורה. בשעות האחרונות כאב אפיגסטרי מתגבר, היפרפלקסיה בבדיקה. מקבלת מגנזיום. הצוות נקרא לחדר בדחיפות.',
    expected_actions: 'ABC בזמן פרכוס · השכבה על צד ומיגון · MgSO4 העמסה + אחזקה · מעקב סימני הרעלת מגנזיום (נשימות, רפלקסים, תפוקת שתן) · קלציום גלוקונט · זיהוי HELLP/קרע כבד · פרוטוקול דימום מסיבי · יילוד דחוף',
    phases: 'שלב 1: רעלת חמורה + פרודרום | שלב 2: פרכוס אקלמפטי | שלב 3: הרעלת מגנזיום | שלב 4: קרע כבד — קריסה המודינמית',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — רעלת חמורה, סימני פרודרום',
        clinical_description: 'יולדת בת 27, G1P0, שבוע 33+0. רעלת הריון חמורה. כאב אפיגסטרי מתגבר, כאב ראש, היפרפלקסיה עם קלונוס. ל"ד 168/112 למרות טיפול פומי.',
        structured_data: {
          patient: { name: 'יולדת', age: 27, gravida: 1, para: 0, gestational_weeks: 33, gestational_days: 0, blood_type: 'AB+', allergies: 'ללא', history: 'G1P0, רעלת הריון חמורה, כאב אפיגסטרי, היפרפלקסיה' },
          ctg: { fhr_baseline: 134, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 96, bp_systolic: 168, bp_diastolic: 112, spo2: 98, temp: 36.9 },
          labs: { cbc: { wbc: 10.8, hgb: 12.4, hct: 37.0, plt: 130 }, chemistry: { ast: 68, alt: 72, ldh: 320, cre: 0.95, ur_ac: 7.4 }, coagulation: { inr: 1.05, ptt: 27.0, fib: 390 } },
          abnormal_fields: ['plt', 'ast', 'alt', 'ldh', 'cre', 'ur_ac'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — פרכוס אקלמפטי',
        clinical_description: '27 שנים, G1P0, 33+0 שב׳ — רעלת מסובכת\nפרכוס טוני-קלוני כללי. איבוד הכרה, קצף בפה. נדרש: ABC, השכבה על צד, מיגון, MgSO4 העמסה, הימנעות מריסון הגפיים. במוניטור — האטה ממושכת של העובר.',
        structured_data: {
          ctg: { fhr_baseline: 130, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 128, bp_systolic: 182, bp_diastolic: 120, spo2: 88, temp: 37.2, rr: 24 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — הרעלת מגנזיום',
        clinical_description: '27 שנים, G1P0, 33+0 שב׳ — רעלת מסובכת\nלאחר העמסה ואחזקה — ישנוניות מעמיקה, נשימות 7 לדקה, רפלקסים פיקתיים נעדרים, תפוקת שתן ירודה. נדרש: הפסקת עירוי מגנזיום, קלציום גלוקונט 1g IV, תמיכה נשימתית.',
        structured_data: {
          ctg: { fhr_baseline: 132, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 2, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 68, bp_systolic: 145, bp_diastolic: 90, spo2: 90, temp: 36.8, rr: 7 },
          labs: { chemistry: { mg: 9.2, cre: 1.1 } },
          abnormal_fields: ['mg', 'cre'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — קרע כבד, קריסה המודינמית',
        clinical_description: '27 שנים, G1P0, 33+0 שב׳ — רעלת מסובכת\nכאב חד פתאומי ברום הבטן מימין, כתף ימין. ל"ד צונח, טכיקרדיה, בטן רגישה ותפוחה. חשד להמטומה/קרע כבד על רקע HELLP. נדרש: חדר ניתוח מיידי, פרוטוקול דימום מסיבי, כירורג כללי.',
        structured_data: {
          ctg: { fhr_baseline: 95, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 2, contraction_intensity: 'mild', special: 'bradycardia' },
          vitals: { hr: 138, bp_systolic: 85, bp_diastolic: 50, spo2: 93, temp: 36.4, rr: 28 },
          labs: { cbc: { hgb: 8.2, hct: 24.5, plt: 46 }, chemistry: { ast: 410, alt: 380, ldh: 1450, t_bil: 2.4, glu: 62 }, coagulation: { inr: 1.60, ptt: 42.0, fib: 180, d_dimer: 3.5 } },
          abnormal_fields: ['hgb', 'hct', 'plt', 'ast', 'alt', 'ldh', 't_bil', 'glu', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
    ],
  },

  // ─── 10. Anaphylaxis in labor ───────────────────────────────────────────────
  {
    name: 'אנפילקסיס בלידה',
    slug: 'anaphylaxis-labor',
    case_story: 'יולדת בת 29, G2P1, שבוע 38+2. בלידה פעילה, פתיחה 5 ס"מ. GBS חיובי — מתחילים עירוי פניצילין. דקות ספורות לאחר תחילת העירוי מדווחת על גרד בכפות הידיים.',
    expected_actions: 'זיהוי מוקדם של אנפילקסיס · הפסקת התרופה מיידית · אדרנלין IM 0.5mg לירך · נוזלים בפתיחה רחבה · שכיבה על צד שמאל · חמצן · קריאה להרדמה וצוות בכיר · ניטור עוברי רציף · שקילת יילוד דחוף אם אין התאוששות',
    phases: 'שלב 1: תחילת אנטיביוטיקה | שלב 2: תגובה אלרגית מוקדמת | שלב 3: אנפילקסיס מלא + ברדיקרדיה עוברית | שלב 4: פוסט-אדרנלין',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לידה פעילה, תחילת פניצילין',
        clinical_description: 'יולדת בת 29, G2P1, שבוע 38+2. לידה פעילה, פתיחה 5 ס"מ. GBS חיובי — הוחל עירוי פניצילין IV לפי פרוטוקול. מהלך תקין עד כה.',
        structured_data: {
          patient: { name: 'יולדת', age: 29, gravida: 2, para: 1, gestational_weeks: 38, gestational_days: 2, blood_type: 'B+', allergies: 'לא ידועות', history: 'G2P1, GBS+, לידה קודמת תקינה' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 88, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 36.8 },
          labs: { cbc: { wbc: 11.5, hgb: 11.8, hct: 35.0, plt: 220 }, chemistry: { na: 137, k: 4.0, cre: 0.6, glu: 96 } },
          abnormal_fields: ['wbc'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — גרד ואורטיקריה',
        clinical_description: '29 שנים, G2P1, 38+2 שב׳ — GBS+, פניצילין IV\nמדווחת על גרד מתפשט, אי-שקט ותחושת חום. פריחה אורטיקריאלית בחזה ובזרועות. מוניטור עוברי תקין. נדרש: חשד גבוה, הערכת דרכי אוויר, שקילת הפסקת העירוי.',
        structured_data: {
          ctg: { fhr_baseline: 142, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 105, bp_systolic: 105, bp_diastolic: 65, spo2: 97, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — אנפילקסיס מלא, ברדיקרדיה עוברית',
        clinical_description: '29 שנים, G2P1, 38+2 שב׳ — GBS+, פניצילין IV\nצפצופים בנשימה, נפיחות שפתיים, תת-לחץ-דם עמוק. במוניטור — ברדיקרדיה עוברית. נדרש: אדרנלין IM מיידי, הפסקת העירוי, נוזלים, חמצן, שכיבה על צד שמאל, קריאה להרדמה.',
        structured_data: {
          ctg: { fhr_baseline: 90, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'bradycardia' },
          vitals: { hr: 135, bp_systolic: 72, bp_diastolic: 40, spo2: 87, temp: 36.9, rr: 30 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — פוסט-אדרנלין, החלטת המשך',
        clinical_description: '29 שנים, G2P1, 38+2 שב׳ — GBS+, אנפילקסיס לאחר אדרנלין\nל"ד מתאושש, צפצופים פוחתים. דופק עוברי חוזר לבסיס עם וריאביליות מופחתת. דיון: המשך לידה תחת ניטור צמוד מול קיסרי; החלפת אנטיביוטיקה; תיעוד התגובה ותיוג אלרגיה.',
        structured_data: {
          ctg: { fhr_baseline: 135, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_mild', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 110, bp_systolic: 100, bp_diastolic: 60, spo2: 95, temp: 37.0, rr: 22 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 11. Transfusion reaction — TRALI / pulmonary edema ────────────────────
  {
    name: 'תגובת עירוי — TRALI / בצקת ריאות',
    slug: 'transfusion-reaction-trali',
    case_story: 'יולדת בת 31 שעתיים לאחר לידה שהסתבכה בדימום. המוגלובין 7.8 — הוזמנה מנת דם. כ-20 דקות לאחר תחילת העירוי מתלוננת על קוצר נשימה מתגבר.',
    expected_actions: 'הפסקת העירוי מיידית · ABC וחמצן · אבחנה מבדלת: TRALI / TACO / תגובה המוליטית / אלרגית · דגימות לבנק דם + ספירה + קומבס · צילום חזה · תמיכה נשימתית (NIV) לפי צורך · דיווח המוויג׳ילנס',
    phases: 'שלב 1: תחילת עירוי | שלב 2: קוצר נשימה וחום | שלב 3: החמרה נשימתית | שלב 4: התייצבות תחת NIV',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לאחר PPH, תחילת עירוי',
        clinical_description: 'יולדת בת 31, שעתיים לאחר לידה עם דימום מוגבר (כ-1200 מ"ל). יציבה המודינמית. המוגלובין 7.8 — מתחילים מנת דם ראשונה לפי פרוטוקול.',
        structured_data: {
          patient: { name: 'יולדת', age: 31, gravida: 2, para: 2, gestational_weeks: 39, gestational_days: 0, blood_type: 'A-', allergies: 'ללא', history: 'G2P2, מצב אחרי PPH 1200 מ"ל, עירוי דם ראשון' },
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 96, bp_systolic: 110, bp_diastolic: 70, spo2: 98, temp: 36.9 },
          labs: { cbc: { wbc: 12.0, hgb: 7.8, hct: 23.5, plt: 190 }, coagulation: { inr: 1.10, ptt: 28.0, fib: 340 } },
          abnormal_fields: ['wbc', 'hgb', 'hct'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — קוצר נשימה וחום בזמן עירוי',
        clinical_description: '31 שנים, מצב אחרי PPH — מנת דם ראשונה\n20 דקות לתוך העירוי: קוצר נשימה, סטורציה יורדת, חום עולה. נדרש: הפסקת עירוי מיידית, חמצן, בדיקת פרטי המנה מול המטופלת, דגימות לבנק דם, אבחנה מבדלת TRALI/TACO/המוליטית.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 118, bp_systolic: 105, bp_diastolic: 65, spo2: 89, temp: 38.2, rr: 28 },
          labs: { cbc: { wbc: 14.5, hgb: 8.0, hct: 24.2, plt: 185 } },
          abnormal_fields: ['wbc', 'hgb', 'hct'],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — החמרה נשימתית, פצפוצים דו-צדדיים',
        clinical_description: '31 שנים, מצב אחרי PPH — חשד לתגובת עירוי\nמצוקה נשימתית: סטורציה 84% על מסכה, פצפוצים דו-צדדיים בהאזנה. קרישה תקינה — שוללת DIC. צילום חזה מדגים תסנינים דו-צדדיים ללא סימני גודש ורידי. נדרש: NIV, שקילת טיפול נמרץ.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 126, bp_systolic: 100, bp_diastolic: 62, spo2: 84, temp: 38.4, rr: 34 },
          labs: { cbc: { wbc: 15.2, hgb: 8.1, hct: 24.6, plt: 178 }, coagulation: { inr: 1.05, ptt: 27.0, fib: 350, d_dimer: 0.4 } },
          abnormal_fields: ['wbc', 'hgb', 'hct'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — התייצבות תחת NIV, דיווח',
        clinical_description: '31 שנים, מצב אחרי PPH — TRALI\nתחת NIV — סטורציה 93%, נשימות 24. ללא צורך באינטובציה בשלב זה. נדרש: המשך ניטור צמוד, השלמת בירור מול בנק הדם, דיווח המוויג׳ילנס, תיעוד מפורט ותדרוך המשפחה.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 108, bp_systolic: 108, bp_diastolic: 68, spo2: 93, temp: 37.6, rr: 24 },
          labs: { cbc: { wbc: 13.2, hgb: 8.4, hct: 25.4, plt: 182 } },
          abnormal_fields: ['wbc', 'hgb', 'hct'],
        },
      },
    ],
  },

  // ─── 12. Routine induction of labor (failed induction) ─────────────────────
  {
    name: 'השראת לידה — ניהול והחלטת Failed Induction',
    slug: 'induction-failed',
    case_story: 'יולדת בת 31, G1P0, שבוע 41+3. התקבלה להשראת לידה בשל הריון עודף. צוואר לא בשל — Bishop 3. מהלך ההשראה יחייב החלטות: הבשלה, אוקסיטוצין, טיפול בטכיסיסטוליה, ומתי מכריזים על כישלון השראה.',
    expected_actions: 'הערכת Bishop ובחירת שיטת הבשלה (PGE/בלון) · תזמון אוקסיטוצין ו-AROM · זיהוי וטיפול בטכיסיסטוליה (הפחתת פיטוצין, טוקוליזה) · הגדרת failed induction לפי קריטריונים · תקשורת ושיתוף היולדת · החלטה על ניתוח',
    phases: 'שלב 1: קבלה והבשלת צוואר | שלב 2: אוקסיטוצין + AROM | שלב 3: טכיסיסטוליה | שלב 4: עצירת התקדמות — החלטה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — קבלה והבשלת צוואר',
        clinical_description: 'יולדת בת 31, G1P0, שבוע 41+3. השראת לידה בשל הריון עודף. בדיקה: צוואר סגור, מחיקה 30%, ראש צף — Bishop 3. מתחילים הבשלת צוואר (PGE / בלון). מוניטור תקין.',
        structured_data: {
          patient: { name: 'יולדת', age: 31, gravida: 1, para: 0, gestational_weeks: 41, gestational_days: 3, blood_type: 'O+', allergies: 'ללא', history: 'G1P0, הריון עודף, Bishop 3' },
          ctg: { fhr_baseline: 138, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 1, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 82, bp_systolic: 116, bp_diastolic: 72, spo2: 99, temp: 36.7 },
          labs: { cbc: { wbc: 9.5, hgb: 12.2, hct: 36.5, plt: 240 }, chemistry: { na: 138, k: 4.2, cre: 0.62, glu: 88 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — אוקסיטוצין ו-AROM',
        clinical_description: '31 שנים, G1P0, 41+3 שב׳ — השראת לידה\nלאחר הבשלה: פתיחה 3-4 ס"מ, מחיקה 80%. בוצע AROM — מים צלולים. הוחל אוקסיטוצין במינון עולה. צירים 3 ל-10 דקות. מוניטור תקין.',
        structured_data: {
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 86, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — טכיסיסטוליה',
        clinical_description: '31 שנים, G1P0, 41+3 שב׳ — השראת לידה, אוקסיטוצין\nבמוניטור: 7 צירים ב-10 דקות עם טונוס רחמי מוגבר בין צירים, והאטות משתנות קלות. נדרש: הפחתה/הפסקת פיטוצין, שכיבה על צד שמאל, נוזלים, שקילת טוקוליזה (ניטרוגליצרין/טרבוטלין), הערכה מחדש.',
        structured_data: {
          ctg: { fhr_baseline: 150, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_mild', contraction_frequency: 7, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 98, bp_systolic: 120, bp_diastolic: 76, spo2: 98, temp: 37.0 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — עצירת התקדמות, החלטת Failed Induction',
        clinical_description: '31 שנים, G1P0, 41+3 שב׳ — השראת לידה\nלאחר ייצוב: צירים סדירים 3 ל-10 דקות, מוניטור תקין. אך — פתיחה 6 ס"מ ללא שינוי במשך 4 שעות עם צירים נאותים. דיון: קריטריונים ל-failed induction (משך אוקסיטוצין + קרע קרומים), כלים נוספים לקידום הלידה מול ניתוח קיסרי; שיתוף היולדת בהחלטה.',
        structured_data: {
          ctg: { fhr_baseline: 142, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 90, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 37.2 },
          labs: { cbc: { wbc: 12.8, hgb: 11.9 } },
          abnormal_fields: ['wbc'],
        },
      },
    ],
  },

  // ─── 13. Breech delivery ───────────────────────────────────────────────────
  {
    name: 'לידת עכוז — מנוברות וחילוצים',
    slug: 'breech-delivery',
    case_story: 'יולדת בת 27, G3P2, שבוע 37+5. הגיעה עם צירים תכופים. בבדיקה: פתיחה גמורה ומצג עכוז שלא אובחן קודם. העכוז יורד — אין זמן לניתוח. נערכים ללידת עכוז לידנית.',
    expected_actions: 'קריאה מיידית לצוות בכיר + ניאונטולוג · hands-off עד יציאת השכמות · Løvset לחילוץ זרועות · Mauriceau-Smellie-Veit לראש אחרון · McRoberts/חתך אם כליאת ראש · הימנעות ממשיכה על הגוף · תיעוד זמנים',
    phases: 'שלב 1: אבחון עכוז בפתיחה גמורה | שלב 2: ירידת העכוז עד השכמות | שלב 3: חילוץ זרועות וראש אחרון | שלב 4: לאחר החילוץ',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — אבחון עכוז בפתיחה גמורה',
        clinical_description: 'יולדת בת 27, G3P2, שבוע 37+5. פתיחה גמורה, מצג עכוז (frank breech) שלא היה ידוע. עכוז בגובה +1. דחף ללחוץ. נדרש: קריאה לצוות, החלטה מהירה — לידה לידנית מול ניתוח דחוף, הכנת חדר וציוד.',
        structured_data: {
          patient: { name: 'יולדת', age: 27, gravida: 3, para: 2, gestational_weeks: 37, gestational_days: 5, blood_type: 'B-', allergies: 'ללא', history: 'G3P2, שתי לידות ואגינליות תקינות, עכוז לא מאובחן' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'variable_mild', contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 92, bp_systolic: 122, bp_diastolic: 76, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 11.9, hct: 35.5, plt: 210 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — ירידת העכוז עד השכמות',
        clinical_description: '27 שנים, G3P2, 37+5 שב׳ — לידת עכוז\nהעכוז נולד עד גובה השכמות. גב קדמי. נדרש: hands-off — ללא משיכה, תמיכה בלבד; מתן אפשרות לירידה ספונטנית; שמירה על גב קדמי; ניאונטולוג בחדר.',
        structured_data: {
          ctg: { fhr_baseline: 135, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'variable_moderate', deceleration_depth: 40, contraction_frequency: 5, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 98, bp_systolic: 124, bp_diastolic: 78, spo2: 98, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — עצירת זרועות וראש אחרון',
        clinical_description: '27 שנים, G3P2, 37+5 שב׳ — לידת עכוז\nהזרועות אינן נולדות — זרוע מורמת. במוניטור ברדיקרדיה. נדרש: Løvset לחילוץ הזרועות, ואז Mauriceau-Smellie-Veit לראש האחרון (או Burns-Marshall); סופרה-פובי עדין; אם כליאת ראש — McRoberts, שקילת חתכים בצוואר הרחם.',
        structured_data: {
          ctg: { fhr_baseline: 90, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 108, bp_systolic: 126, bp_diastolic: 80, spo2: 98, temp: 37.0 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — לאחר החילוץ',
        clinical_description: '27 שנים, G3P2, 37+5 שב׳ — לידת עכוז\nהראש חולץ. היילוד נמסר לצוות הניאונטולוגי (אפגר 6/8). האם יציבה, דימום תקין, בדיקת תעלת לידה. נדרש: תיעוד זמנים ומנוברות, דבריפינג צוות, מכתב לידה מפורט.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 95, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 37.0 },
          labs: { cbc: { hgb: 10.8, hct: 32.5 } },
          abnormal_fields: ['hgb', 'hct'],
        },
      },
    ],
  },

  // ─── 14. The refusing patient (communication) ──────────────────────────────
  {
    name: 'המטופלת המסרבת — סימולציית תקשורת',
    slug: 'refusing-patient-communication',
    case_story: 'יולדת בת 24, G1P0, שבוע 39+0, בלידה פעילה. חרדה מאוד, מסרבת לניטור רציף, לבדיקות וגינליות ולעירוי. בן זוגה דומיננטי ומתנגד לכל התערבות. הצוות נדרש לבנות אמון תוך שמירה על בטיחות.',
    expected_actions: 'בניית אמון והקשבה פעילה · מתן מידע מדורג ומותאם · הערכת כשירות להחלטה · גיוס גורם מתווך (מיילדת בכירה, רופא בכיר, רב) · כיבוד אוטונומיה · הצעת חלופות (ניטור לסירוגין) · תיעוד קפדני של שיחות וסירובים · הסלמה מדורגת של שיחת סיכונים',
    phases: 'שלב 1: סירוב לניטור | שלב 2: מוניטור קטגוריה 2 — שיחת סיכונים | שלב 3: החמרה — ישיבת צוות וחלופות | שלב 4: הסכמה חלקית ולידה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — סירוב לניטור רציף',
        clinical_description: 'יולדת בת 24, G1P0, שבוע 39+0. לידה פעילה, פתיחה 5 ס"מ. חרדה, מסרבת לניטור רציף ("זה מקרין על התינוק") ולעירוי. בן הזוג עונה במקומה. בניטור קצר שהסכימה לו — תקין. נדרש: הקשבה, בירור החששות, בניית אמון, הצעת ניטור לסירוגין.',
        structured_data: {
          patient: { name: 'יולדת', age: 24, gravida: 1, para: 0, gestational_weeks: 39, gestational_days: 0, blood_type: 'O+', allergies: 'ללא', history: 'G1P0, חרדה, מעקב הריון חלקי' },
          ctg: { fhr_baseline: 140, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 3, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 96, bp_systolic: 122, bp_diastolic: 76, spo2: 99, temp: 36.8 },
          labs: { cbc: { hgb: 12.0, plt: 230 } },
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — מוניטור קטגוריה 2, שיחת סיכונים',
        clinical_description: '24 שנים, G1P0, 39+0 שב׳ — מטופלת מסרבת\nבניטור לסירוגין שהוסכם — האטות מאוחרות חוזרות. היולדת מסרבת לניטור רציף ולבדיקה. נדרש: שיחת סיכונים מובנית (מה רואים, מה זה אומר, מה מציעים), בדיקת הבנה, הצעת פשרות, תיעוד מדויק.',
        structured_data: {
          ctg: { fhr_baseline: 145, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'late', deceleration_depth: 20, contraction_frequency: 4, contraction_intensity: 'moderate', special: 'none' },
          vitals: { hr: 100, bp_systolic: 124, bp_diastolic: 78, spo2: 99, temp: 37.0 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — החמרה, ישיבת צוות וגורם מתווך',
        clinical_description: '24 שנים, G1P0, 39+0 שב׳ — מטופלת מסרבת\nההאטות המאוחרות מעמיקות והווריאביליות יורדת. היולדת עדיין מסרבת להתערבות; בן הזוג מסלים. נדרש: ישיבת צוות קצרה, גיוס גורם מתווך מוסכם (מיילדת בכירה / רב), הערכת כשירות, הצגת חלופות מדורגות, הימנעות מעימות.',
        structured_data: {
          ctg: { fhr_baseline: 148, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'late', deceleration_depth: 30, contraction_frequency: 4, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 104, bp_systolic: 126, bp_diastolic: 80, spo2: 98, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — הסכמה חלקית ולידה',
        clinical_description: '24 שנים, G1P0, 39+0 שב׳ — מטופלת מסרבת\nבעקבות השיחה הוסכם: ניטור רציף + עירוי, תוך ויתור על התערבויות אחרות בשלב זה. הלידה מתקדמת — פתיחה גמורה, המוניטור משתפר עם שינוי תנוחה וחמצן. דגשי דבריפינג: תקשורת, אוטונומיה, תיעוד, עבודת צוות.',
        structured_data: {
          ctg: { fhr_baseline: 142, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 4, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 98, bp_systolic: 122, bp_diastolic: 76, spo2: 99, temp: 37.1 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },

  // ─── 15. Trauma in pregnancy ───────────────────────────────────────────────
  {
    name: 'טראומה בהריון',
    slug: 'trauma-pregnancy',
    case_story: 'אישה בת 33, G2P1, שבוע 32+0. נוסעת ברכב שהיה מעורב בתאונת דרכים — חגורת בטיחות מונחת נמוך על הבטן. מגיעה למיון יולדות עם כאבי בטן. הצוות נדרש לסקר טראומה מותאם הריון.',
    expected_actions: 'סקר ראשוני ABC עם הטיה שמאלית של הרחם · סקר שניוני · ניטור עוברי ממושך · סוג דם + אנטי-D לאם RH שלילי · Kleihauer-Betke · זיהוי סימני היפרדות שליה · פרוטוקול דימום מסיבי · מודעות ל-perimortem CS',
    phases: 'שלב 1: סקר ראשוני | שלב 2: סימני היפרדות שליה | שלב 3: הידרדרות אימהית + DIC | שלב 4: ניתוח דחוף',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — סקר ראשוני',
        clinical_description: 'בת 33, G2P1, שבוע 32+0. תאונת דרכים במהירות עירונית, חגורה נמוכה על הבטן. מתלוננת על כאב בטן. נדרש: סקר ראשוני עם הטיה שמאלית, ניטור עוברי, סוג דם ו-RH (שלילי! — אנטי-D), Kleihauer-Betke, בדיקת סימני חבלה.',
        structured_data: {
          patient: { name: 'יולדת', age: 33, gravida: 2, para: 1, gestational_weeks: 32, gestational_days: 0, blood_type: 'A-', allergies: 'ללא', history: 'G2P1, תאונת דרכים, חגורת בטן נמוכה, RH שלילי' },
          ctg: { fhr_baseline: 145, fhr_variability: 'normal', accelerations: 'present', decelerations: 'none', contraction_frequency: 1, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 104, bp_systolic: 118, bp_diastolic: 76, spo2: 98, temp: 36.6 },
          labs: { cbc: { wbc: 12.5, hgb: 11.5, hct: 34.2, plt: 230 }, coagulation: { inr: 1.0, ptt: 26.0, fib: 420, d_dimer: 0.4 }, other: { blood_type: 'A-' } },
          abnormal_fields: ['wbc'],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — סימני היפרדות שליה',
        clinical_description: '33 שנים, G2P1, 32+0 שב׳ — טראומה בהריון\nכעבור 40 דקות: צירים תכופים וכואבים, רחם רגיש וקשה בין צירים, דימום וגינלי כהה. במוניטור — האטות מאוחרות. נדרש: חשד גבוה להיפרדות שליה, הרחבת גישה ורידית, הזמנת דם, הכנה לחדר ניתוח.',
        structured_data: {
          ctg: { fhr_baseline: 150, fhr_variability: 'reduced', accelerations: 'absent', decelerations: 'late', deceleration_depth: 25, contraction_frequency: 6, contraction_intensity: 'strong', special: 'none' },
          vitals: { hr: 118, bp_systolic: 104, bp_diastolic: 66, spo2: 98, temp: 36.7 },
          labs: { cbc: { hgb: 9.5, hct: 28.4, plt: 160 }, coagulation: { inr: 1.2, fib: 240, d_dimer: 1.8 } },
          abnormal_fields: ['hgb', 'hct', 'fib', 'd_dimer'],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — הידרדרות אימהית, DIC מתחיל',
        clinical_description: '33 שנים, G2P1, 32+0 שב׳ — חשד להיפרדות שליה\nל"ד צונח, טכיקרדיה, FAST חיובי לנוזל חופשי. מעבדה: DIC מתפתח. במוניטור — האטה ממושכת. נדרש: הכרזה על ניתוח דחוף, פרוטוקול דימום מסיבי, עדכון טיפול נמרץ וניאונטולוגיה (32 שבועות).',
        structured_data: {
          ctg: { fhr_baseline: 100, fhr_variability: 'minimal', accelerations: 'absent', decelerations: 'prolonged', contraction_frequency: 6, contraction_intensity: 'strong', special: 'bradycardia' },
          vitals: { hr: 128, bp_systolic: 88, bp_diastolic: 54, spo2: 96, temp: 36.4, rr: 26 },
          labs: { cbc: { hgb: 8.6, hct: 25.8, plt: 95 }, coagulation: { inr: 1.5, ptt: 38.0, fib: 180, d_dimer: 3.1 } },
          abnormal_fields: ['hgb', 'hct', 'plt', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — ניתוח קיסרי דחוף',
        clinical_description: '33 שנים, G2P1, 32+0 שב׳ — היפרדות שליה, DIC\nבחדר ניתוח: קיסרי דחוף, יילוד פג נמסר לניאונטולוג. היפרדות 60% עם קריש רטרו-פלצנטרי. דימום פעיל — פרוטוקול דימום מסיבי פעיל. עקרון מנחה: אם קריסה אימהית — perimortem CS בתוך 4 דקות.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 122, bp_systolic: 95, bp_diastolic: 60, spo2: 97, temp: 36.2, rr: 22 },
          labs: { cbc: { hgb: 7.9, hct: 23.6, plt: 80 }, coagulation: { inr: 1.7, ptt: 44.0, fib: 150, d_dimer: 4.2 } },
          abnormal_fields: ['hgb', 'hct', 'plt', 'inr', 'ptt', 'fib', 'd_dimer'],
        },
      },
    ],
  },

  // ─── 16. Neonatal resuscitation ─────────────────────────────────────────────
  {
    name: 'החייאת יילוד',
    slug: 'neonatal-resuscitation',
    case_story: 'לידה במועד, שבוע 40+1, עם מים מקוניאליים סמיכים. מיד לאחר הלידה — יילוד היפוטוני, ללא נשימה ספונטנית. צוות ההחייאה נקרא לעמדת ההחייאה. (המדדים במסך — של האם, היציבה; מהלך היילוד מתואר בכרטיסים.)',
    expected_actions: 'חימום, ייבוש וגירוי · הערכת נשימה ודופק · PPV בתוך 60 שניות ("דקת הזהב") · MR SOPA לתיקון אוורור · עיסויים 3:1 אם דופק <60 · חמצן 100% בעת עיסויים · אינטובציה/LMA · אדרנלין דרך וריד טבורי · תקשורת צוות ותיעוד זמנים',
    phases: 'שלב 1: לידה ויילוד אפאטי | שלב 2: דופק <100 — PPV | שלב 3: דופק <60 — עיסויים | שלב 4: אדרנלין ותגובה',
    cards: [
      {
        card_number: 1,
        title: 'כרטיס 1 — לידה ויילוד אפאטי',
        clinical_description: 'לידה ואגינלית במועד (40+1), מים מקוניאליים סמיכים. היילוד נמסר לעמדת ההחייאה: היפוטוני, ללא בכי, ללא נשימה ספונטנית. אפגר דקה 1: 2. נדרש: חימום, ייבוש, גירוי, פתיחת נתיב אוויר, הערכת דופק ונשימה תוך 30 שניות.',
        structured_data: {
          patient: { name: 'יולדת', age: 28, gravida: 2, para: 1, gestational_weeks: 40, gestational_days: 1, blood_type: 'O+', allergies: 'ללא', history: 'לידה במועד, מים מקוניאליים סמיכים; היילוד בעמדת החייאה' },
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 90, bp_systolic: 120, bp_diastolic: 75, spo2: 99, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 2,
        title: 'כרטיס 2 — דופק <100, הנשמה בלחץ חיובי',
        clinical_description: 'החייאת יילוד — דקה 1-2\nלאחר צעדים ראשונים: דופק יילוד כ-80, ללא נשימה. נדרש: PPV במסכה בתוך 60 שניות, קצב 40-60 לדקה, הערכת עליית בית חזה; אם אין תגובה — MR SOPA (מיקום מסכה, נתיב אוויר, שאיבה, פתיחת פה, לחץ, חלופה). ניטור סטורציה יד ימין; יעדי סטורציה לפי דקות חיים.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 92, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 36.9 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 3,
        title: 'כרטיס 3 — דופק <60, עיסויי לב',
        clinical_description: 'החייאת יילוד — דקה 3-4\nלמרות אוורור יעיל 30 שניות: דופק יילוד כ-50. נדרש: עיסויי לב ביחס 3:1 (90 עיסויים + 30 הנשמות בדקה), העלאת חמצן ל-100%, שקילת אינטובציה/LMA לאוורור יעיל, הכנת גישה טבורית ואדרנלין.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 95, bp_systolic: 118, bp_diastolic: 74, spo2: 99, temp: 37.0 },
          labs: {},
          abnormal_fields: [],
        },
      },
      {
        card_number: 4,
        title: 'כרטיס 4 — אדרנלין ותגובה',
        clinical_description: 'החייאת יילוד — דקה 5-6\nהוכנס קטטר טבורי, ניתן אדרנלין 0.02mg/kg IV. לאחר סבב נוסף: דופק עולה ל-120, נשימות ספונטניות ראשונות, טונוס משתפר. גזי טבור: pH 6.98, BE -14. נדרש: המשך תמיכה, העברה לפגייה/טיפול נמרץ יילודים, תיעוד זמנים מלא, דבריפינג צוות ועדכון ההורים.',
        structured_data: {
          ctg: { postpartum: true, fhr_baseline: 0, fhr_variability: 'normal', accelerations: 'absent', decelerations: 'none', contraction_frequency: 0, contraction_intensity: 'mild', special: 'none' },
          vitals: { hr: 88, bp_systolic: 120, bp_diastolic: 76, spo2: 99, temp: 36.8 },
          labs: {},
          abnormal_fields: [],
        },
      },
    ],
  },
];

/** Helper: get scenario by index (0-based) */
export function getScenario(index: number): SimScenario {
  return SEEDED_SCENARIOS[index] ?? SEEDED_SCENARIOS[0];
}
