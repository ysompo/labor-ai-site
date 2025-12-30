// File: app/publications/page.tsx

export default function PublicationsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-semibold text-[#4B2E6A]">Selected Publications</h1>

      <ol className="list-decimal list-outside space-y-4 pl-5 text-base text-slate-800">
        <li>
          Sompolinsky Y, Lipschuetz M, Cohen-Cymberknoh M, et al. <br />
          <span className="italic">Early childhood respiratory morbidity according to gestational age at birth.</span>
          Respir Med. 2025;236:107913. PMID: 39689734.
        </li>

        <li>
          Guedalia J, Sompolinsky Y, Novoselsky Persky M, et al. <br />
          <span className="italic">Prediction of severe adverse neonatal outcomes at the second stage of labour using machine learning: a retrospective cohort study.</span>
          BJOG. 2021. PMID: 33609073.
        </li>

        <li>
          Guedalia J, Lipschuetz M, Sompolinsky Y, et al. <br />
          <span className="italic">Transporting an AI model to predict emergency cesarean delivery: overcoming challenges posed by interfacility variation.</span>
          J Med Internet Res. 2021. PMID: 34935767.
        </li>

        <li>
          Lipschuetz M, Guedalia J, Sompolinsky Y, et al. <br />
          <span className="italic">Machine learning in EHRs: identifying high-risk obstetric patients pre and during labor.</span>
          Stud Health Technol Inform. 2024;315:3–7.
        </li>

        <li>
          Sompolinsky Y, Guedalia J, Vilk-Ayalon N, et al. <br />
          <span className="italic">Fetal head station during artificial rupture of membranes: a large retrospective cohort study.</span>
          Front Med - Obstet Gynecol. In press.
        </li>

        <li>
          Sompolinsky Y, Lipschuetz M, Cohen SM, Yagel S. <br />
          <span className="italic">Gynecology, Obstetrics and Fertility; reborn in the digital revolution.</span>
          Harefuah. In press.
        </li>
      </ol>
    </div>
  );
}