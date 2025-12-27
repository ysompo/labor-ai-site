// File: app/research/page.tsx

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold text-[#4B2E6A]">Research</h1>

      <p>
        Labor-AI integrates real-world clinical data from over 130,000 deliveries to develop, validate, and deploy AI-driven decision support tools in obstetrics. Our research spans three core domains:
      </p>

      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong>Labor & Delivery Prediction Models:</strong> Development and external validation of models to predict unplanned cesarean delivery (uCD), labor progression, and risk of fetal/maternal complications.
        </li>
        <li>
          <strong>Perinatal Epidemiology:</strong> Large-scale cohort analyses linking maternal and neonatal outcomes, including studies on labor timing, weight estimation errors, and risk factors in special populations.
        </li>
        <li>
          <strong>Clinical ML Methodology:</strong> Research on explainable AI (XAI), reinforcement learning for labor decisions, and transportability of machine learning models across hospitals.
        </li>
      </ul>

      <p>
        Our work includes ORACLE-AI, an explainable model for predicting uCD at the time of admission; MRI-based pelvimetry for delivery planning; unsupervised clustering of partograms; and AI-enhanced triage tools.
      </p>

      <p>
        All models are developed with an emphasis on clinical relevance, transparency, and potential integration into hospital systems.
      </p>
    </div>
  );
}