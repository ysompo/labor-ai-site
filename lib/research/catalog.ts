import { isDbConfigured, sql } from '@/lib/db';

/**
 * Returns a compact catalog summary (~1500 tokens) injected into every Claude prompt.
 */
export async function buildCatalogSummary(): Promise<string> {
  if (!isDbConfigured()) return getHardcodedCatalogSummary();

  try {
    const cats = await sql`
      SELECT id, name FROM catalog_categories WHERE TRUE ORDER BY display_order
    `;
    if (cats.rows.length === 0) return getHardcodedCatalogSummary();

    const vars = await sql`
      SELECT category_id, variable_name, variable_type, sample_values, unit, notes
      FROM catalog_variables
      WHERE is_active = true
      ORDER BY category_id, display_order
    `;

    const meta = await sql`SELECT key, value FROM catalog_metadata`;
    const metaMap: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meta.rows.forEach((r: any) => { metaMap[r.key as string] = r.value as string; });

    const grouped: Record<number, string[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vars.rows.forEach((v: any) => {
      if (!grouped[v.category_id]) grouped[v.category_id] = [];
      const extra = [v.sample_values, v.unit].filter(Boolean).join(', ');
      grouped[v.category_id].push(`${v.variable_name} (${v.variable_type}${extra ? ': ' + extra : ''})`);
    });

    const lines: string[] = [
      `Available Data: ${metaMap.institution ?? 'Hadassah Mt. Scopus'}, ${metaMap.total_deliveries ?? '130,000+'} deliveries, ${metaMap.coverage_years ?? '2015-2024'}`,
      '',
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cats.rows.forEach((c: any) => {
      const items = grouped[c.id] ?? [];
      lines.push(`${c.name} (${items.length}): ${items.join(', ')}`);
    });
    lines.push('');
    lines.push('Additional data available on request: vital signs (~28 cols), previous delivery summaries (~29 cols), detailed prior pregnancies (~200 cols), cervical time-series (~273 cols), 195+ additional lab tests, fetus 3-4 data');

    return lines.join('\n');
  } catch {
    return getHardcodedCatalogSummary();
  }
}

function getHardcodedCatalogSummary(): string {
  return `Available Data: Hadassah Mt. Scopus Medical Center, 130,000+ deliveries, 2015-2024

Demographics (7): MOM_AGE_AT_BIRTH (continuous: 22-48), blood_type (categorical), mother_height (continuous, cm), mother_weight_pre_pregnancy (continuous, kg), mother_weight_during_pregnancy (continuous, kg), BMI_pre_prgnancy (continuous), BMI_during_pregnancy (continuous)

Obstetric History (14): G (continuous: 0-30), P (continuous: 0-20), AB (continuous: 0-20), LC (continuous: 0-30), EUP (continuous: 0-10), prev_CS (continuous: 0-10), VBACS (continuous: 0-20), primipara (binary), previous_cd, previous_vd, previous_ivd, vd_after_cd_in_the_past (binary), last_delivery_GA, inter_pregnancy_interval_from_last_delivery

Current Pregnancy (22): GA_week, GA_days, pre-term_term (categorical), multiple_gestation, mode_of_conception_cat (spont/IVF/IUI/ovulation_induction), NT, TT, GDM_test (binary), GDM (binary), smoking (binary), alcohol (binary), drugs (binary), HDP (binary), Proteinuria (None/Mild/Severe), estimated_weight_ultra_sound (grams), estimated_weight_clinical (grams), fetal_death_during_pregnancy (binary), FHC (cm), early_scan_system, late_scan_system, detailed_scan_system, minor_major

Labor & Delivery (26): mode_start_new (Spontaneous/pitocin/balloon/prostaglandin/combined), mode_of_end (NVD/IVD/UCD/ECD), anesth_type_cat (no_anesth/epidural/spinal/general), Bishop_Score (0-13), Meconium (clear/meconium1/meconium2/meconium3/bloody), maternal_contraction (binary), full_dilation_time, first_stage_length, second_stage_length, third_stage_length, prolonged_second_stage (binary), cd_during_second_stage (binary), time_ROM_delivery, ROM_time (timestamp: date+time of rupture of membranes), ROM_GA_weeks (continuous: gestational age at ROM in weeks), ROM_GA_days (continuous: gestational age at ROM in days), CS_urgency (Urgent/Elective), CS_uterine_cut, obstetrical_bleeding (binary), tear_or_episiotomy (binary), degree_of_tear_or_episiotomy (0-4), admission, birth_year (2015-2024), birth_month (1-12)

Medication Orders (6): med_oxytocin_dose (continuous, mU/min: oxytocin infusion dose), med_oxytocin_start_time (timestamp: time oxytocin initiated), med_misoprostol_dose (continuous, mcg), med_misoprostol_admin_time (timestamp), med_magnesium_sulfate_dose (continuous, g/hr), med_magnesium_sulfate_start_time (timestamp) — additional medications available on request (antibiotics, antihypertensives, corticosteroids, tocolytics)

Pain Management (4): analgesia_pre_labor (categorical: none/opioid/NSAID/other — pain medication administered before labor onset), analgesia_pre_labor_time (timestamp), analgesia_post_labor (categorical: none/opioid/NSAID/epidural_top-up/other — pain medication after delivery), analgesia_post_labor_time (timestamp)

Cervical Exam Snapshots (9): first_check_dilation (0-10 cm), first_check_effacement (0-100%), first_check_station (-4 to +3), dilation_before_rapture, dilation_after_rapture, station_before_rapture, station_after_rapture, dilation_difference

Neonatal Outcomes (24): f1_birthweight (grams), f1_presentation (vertex/breech/other), f1_mode_delivery, f1_sex, f1_apgar1, f1_apgar5, f1_apgar10, f1_perinatal_mortality (binary), f1_delivery_time, max_fetus_number (1-4), sga (binary), lga (binary), NICU (binary), PH (6.8-7.45), SANO (binary composite: Apgar5≤7 OR pH≤7.1 OR NICU)

Key Blood Results (51): CBC: HGB, HCT, WBC, PLT, RBC, MCV, MCH, RDW, MPV | Metabolic: Glucose, Creatinine, BUN, Uric Acid, Calcium, Magnesium, Sodium, Potassium | Liver: AST, ALT, Alk Phos, GGT, Total Bilirubin, Direct Bilirubin, LDH, Albumin | Coagulation: PT, INR, PTT, Fibrinogen, D-Dimer | Iron: Iron, Ferritin, Transferrin | Thyroid: TSH, Free T4 | Preeclampsia: sFlt-1, PlGF, Bile Acids, Protein/Creatinine Ratio | GDM: HbA1c | APS: Anticardiolipin IgG/IgM, Anti-β2GP1 IgG/IgM | ANA, CRP, ESR, β-hCG | Vitamins: B12, Folic Acid, Vitamin D

Additional data available on request: vital signs (~28 cols), previous delivery summaries (~29 cols), detailed prior pregnancies (~200 cols), cervical time-series (~273 cols), 195+ additional lab tests, fetus 3-4 data`;
}

export async function searchCatalog(query: string, category?: string): Promise<object[]> {
  if (!isDbConfigured()) return [];
  try {
    const pattern = '%' + query + '%';
    let rows;
    if (category) {
      const catPattern = '%' + category + '%';
      rows = await sql`
        SELECT cv.variable_name, cv.display_name, cv.description, cv.variable_type,
               cv.sample_values, cv.unit, cv.notes, cc.name AS category
        FROM catalog_variables cv
        JOIN catalog_categories cc ON cc.id = cv.category_id
        WHERE cv.is_active = true
          AND (
            cv.variable_name ILIKE ${pattern}
            OR cv.display_name ILIKE ${pattern}
            OR cv.description ILIKE ${pattern}
          )
          AND cc.name ILIKE ${catPattern}
        ORDER BY cv.display_order
        LIMIT 20
      `;
    } else {
      rows = await sql`
        SELECT cv.variable_name, cv.display_name, cv.description, cv.variable_type,
               cv.sample_values, cv.unit, cv.notes, cc.name AS category
        FROM catalog_variables cv
        JOIN catalog_categories cc ON cc.id = cv.category_id
        WHERE cv.is_active = true
          AND (
            cv.variable_name ILIKE ${pattern}
            OR cv.display_name ILIKE ${pattern}
            OR cv.description ILIKE ${pattern}
          )
        ORDER BY cv.display_order
        LIMIT 20
      `;
    }
    return rows.rows;
  } catch {
    return [];
  }
}
