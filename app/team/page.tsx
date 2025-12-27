// File: app/team/page.tsx

import Image from "next/image";

export default function TeamPage() {
  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-semibold text-[#4B2E6A]">Our Team</h1>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Leadership</h2>
        <div className="space-y-4">
          <div>
            <p className="font-medium">Dr. Yishai Sompolinsky, MD MPH</p>
            <p className="text-sm text-slate-700">
              OB/GYN and Maternal–Fetal Medicine specialist, co-director of Labor-AI Lab. His work focuses on AI in obstetrics, clinical decision-support, and perinatal epidemiology.
            </p>
          </div>
          <div>
            <p className="font-medium">Prof. Michal Lipschuetz, RN PhD</p>
            <p className="text-sm text-slate-700">
              Co-director of Labor-AI Lab. Leads the lab’s academic and methodological development with expertise in bioinformatics and epidemiological modeling.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Core Team</h2>
        <div className="space-y-4">
          <div>
            <p className="font-medium">Prof. Simcha Yagel</p>
            <p className="text-sm text-slate-700">
              Senior advisor and clinical lead in ultrasound and fetal medicine. Supports integration of AI tools into high-risk obstetric workflows.
            </p>
          </div>
          <div>
            <p className="font-medium">Dr. Joshua Guedalia, PhD</p>
            <p className="text-sm text-slate-700">
              Computer scientist specializing in medical machine learning. Leads development of real-time labor prediction tools and model validation pipelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
