import Image from "next/image";

type Person = {
  name: string;
  role: string;
  bio: string;
  img: string; // in /public/team
};

const founders: Person[] = [
  {
    name: "Yishai Sompolinsky, MD, MPH",
    role: "Co-Director",
    bio: "Maternal–Fetal Medicine specialist and AI researcher. Leads the Labor-AI Lab, focusing on explainable, reliable AI decision-support tools in obstetrics and large-scale perinatal data integration.",
    img: "/team/YS.png",
  },
  {
    name: "Michal Lipschuetz, RN, PhD",
    role: "Co-Director",
    bio: "Leads the academic and methodological direction of Labor-AI, with extensive experience in obstetric research, epidemiology, and bioinformatics, bridging clinical questions with rigorous data-driven methods.",
    img: "/team/ML.png",
  },
];

const coreTeam: Person[] = [
  {
    name: "Simcha Yagel, MD",
    role: "Core Team",
    bio: "Senior academic leader in obstetrics and maternal–fetal medicine. Provides clinical and scientific leadership supporting the lab’s mission to translate data-driven methods into impactful obstetric care.",
    img: "/team/SY.png",
  },
  {
    name: "Joshua Guedalia, PhD",
    role: "Core Team",
    bio: "Computer scientist specializing in clinical machine learning. Contributes to model development, validation, and translation of AI methods for real-world obstetric decision support.",
    img: "/team/JG.png",
  },
];

const labMembers: Person[] = [
  {
    name: "Gabriella Gross",
    role: "B.Sc., M.Sc. Bioinformatics candidate",
    bio: "BSc in Computer Science from the Hebrew University of Jerusalem, currently completing her MSc in Bioinformatics with the Labor-AI Lab. Focuses on database development and reinforcement learning frameworks for clinical decision support in obstetrics.",
    img: "/team/GG.png",
  },
  {
    name: "Ellie Leidner",
    role: "M.Sc. Computer Sciences and MD candidate",
    bio: "Graduate of the prestigious joint BSc program in Medicine and Computer Science at the Hebrew University. Leads advanced image processing tasks in the lab, applying deep learning methods to medical imaging challenges.",
    img: "/team/EL.png",
  },
  {
    name: "Liav Feldman",
    role: "MD candidate",
    bio: "Graduate of the prestigious joint BSc program in Medicine and Computer Science at the Hebrew University. Focuses on developing unsupervised machine learning models for pattern discovery in labor and delivery data.",
    img: "/team/LF.png",
  },
];

function TeamGrid({ people }: { people: Person[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((p) => (
        <div
          key={p.name}
          className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-black/10">
              <Image
                src={p.img}
                alt={p.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div>
              <div className="font-semibold text-black">{p.name}</div>
              <div className="text-sm text-[#4B2E6A]">{p.role}</div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-black/70">
            {p.bio}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function TeamPage() {
  return (
    <div className="space-y-12">
      <h1 className="text-4xl font-semibold text-[#4B2E6A]">Team</h1>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Founders</h2>
        <TeamGrid people={founders} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Core Team</h2>
        <TeamGrid people={coreTeam} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Lab Members</h2>
        <TeamGrid people={labMembers} />
      </section>
    </div>
  );
}
