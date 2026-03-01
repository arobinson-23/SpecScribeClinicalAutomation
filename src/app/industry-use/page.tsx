import Link from "next/link";
import { MarketingNav } from "@/components/layout/MarketingNav";

function CheckIcon() {
  return (
    <svg className="w-3 h-3 stroke-coral" viewBox="0 0 12 12" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
        <CheckIcon />
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
    </div>
  );
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="bg-blue-50 border-b border-[#f3c6c6] px-5 py-3 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff6059]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbe2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-xs font-semibold text-slate-500">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const specialties = [
  { icon: "🧠", name: "Psychiatry & Mental Health", desc: "DAP, SOAP, and BIRP note formats. PHQ-9, GAD-7 and MADRS scoring auto-inserted. Multi-provincial referral pathways pre-configured." },
  { icon: "🦴", name: "Orthopedics", desc: "Procedure notes and surgical reports. Functional outcome measures (ASES, DASH, KOOS). Surgical specialty referral integration." },
  { icon: "🔬", name: "Dermatology", desc: "Biopsy and excision notes with ICD-11 mapping. Lesion documentation with photographic attachment support." },
  { icon: "❤️", name: "Cardiology", desc: "Stress test, echo, and catheterization report templates. Advanced specialized cardiovascular–aligned workflows." },
  { icon: "🎗️", name: "Oncology", desc: "Oncology-aligned staging and treatment plan notes. Provincial Cancer Registry coding and tumour board summaries." },
  { icon: "💊", name: "Pain Management", desc: "Opioid treatment agreement documentation, compliance notes. National and Provincial Guideline-aligned templates." },
];

const testimonials = [
  {
    quote: "I used to spend my evenings finishing charts. Now I leave my clinic at 5:30 and my notes are already done. It's the first tool that actually fits how I think through a case.",
    initials: "DK",
    name: "Dr. D. Kowalski, MD FRCPC",
    role: "Psychiatrist · Specialist Medical Centre",
  },
  {
    quote: "The EHR integration is seamless. I open SpecScribe and the patient's problem list and last consult are already there. My documentation time dropped by at least a third.",
    initials: "SN",
    name: "Dr. S. Nguyen, MD FRCSC",
    role: "Orthopedic Surgeon · Tertiary Care Hospital",
  },
  {
    quote: "The billing suggestions alone pay for the subscription. I was routinely underbilling complex visits — SpecScribe flags them every time and explains exactly why the note supports the higher code.",
    initials: "MB",
    name: "Dr. M. Brar, MD",
    role: "Family Physician · Multi-Specialty Clinic",
  },
];

const complianceBadges = [
  { icon: "🏛️", title: "PIPEDA (Federal) and HIA (Alberta)", desc: "Full compliance with custodian and Information Manager obligations under Federal and Provincial laws." },
  { icon: "🍁", title: "Canadian Data Residency", desc: "All PHI stored and processed on infrastructure located in Canada — no cross-border transfer." },
  { icon: "🔐", title: "AES-256-GCM Encryption", desc: "PHI encrypted at the application layer before database write. Zero plaintext stored at rest." },
  { icon: "📋", title: "Regulatory Standard Alignment", desc: "Templates reviewed against Provincial Standards of Practice for Medical Records." },
];

export default function IndustryUsePage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── HERO ── */}
      <section className="pt-16 bg-gradient-to-b from-coral-pale to-white">
        <div className="max-w-4xl mx-auto px-8 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-[#f3c6c6] rounded-full px-4 py-1.5 text-xs font-bold text-blue-600 uppercase tracking-wide mb-6">
            For Canadian Clinicians
          </div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 leading-tight mb-5">
            Give yourself back to{" "}
            <em className="not-italic text-blue-600">your patients.</em>
          </h1>
          <p className="text-xl text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            SpecScribe listens to your encounter, drafts the note, and handles documentation — so Canada&apos;s physicians can do what they trained for: practice medicine.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/demo" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3.5 rounded-md transition-colors text-sm">
              Request a Demo →
            </Link>
            <Link href="#how-it-works" className="bg-white border-[1.5px] border-slate-200 hover:border-blue-600 hover:text-blue-600 text-slate-700 font-semibold px-8 py-3.5 rounded-md transition-colors text-sm">
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-slate-900 py-14">
        <div className="max-w-4xl mx-auto px-8 grid grid-cols-4 divide-x divide-white/10">
          {[
            { n: "38%", label: "reduction in documentation time per encounter" },
            { n: "40%", label: "less charting outside of working hours" },
            { n: "23%", label: "more face time with each patient" },
            { n: "2 hrs", label: "saved per physician per day on average" },
          ].map((s) => (
            <div key={s.n} className="text-center px-6 py-4">
              <div className="text-4xl font-black text-blue-400 tracking-tight mb-2">{s.n}</div>
              <div className="text-xs text-white/50 max-w-[150px] mx-auto leading-relaxed">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE 1: Connect Care ── */}
      <section className="max-w-5xl mx-auto px-8 py-24" id="how-it-works">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">Connect Care Integration</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-4">
              Every answer — right when you need it.
            </h2>
            <p className="text-slate-500 leading-relaxed mb-8">
              SpecScribe pulls directly from your EHR. Problem lists, medication records, specialist letters, and prior visit summaries are surfaced at the point of care — so you spend your visit listening to your patient, not hunting through charts.
            </p>
            <div className="flex flex-col gap-3.5">
              <FeatureItem><strong className="text-slate-800">Live EHR sync</strong> — schedules, problems, and meds auto-populated before the encounter begins.</FeatureItem>
              <FeatureItem><strong className="text-slate-800">Patient Recap</strong> — a one-glance summary of everything relevant from the last 12 months, generated before you walk in.</FeatureItem>
              <FeatureItem><strong className="text-slate-800">Cross-referral context</strong> — pulls specialist consult notes from other providers into a single view.</FeatureItem>
            </div>
          </div>
          <CardShell title="Patient Recap — EHR Link">
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              ● Live EHR Connection
            </div>
            <p className="text-sm font-bold text-slate-900 mb-0.5">Patient #4821 — M.T., 54F</p>
            <p className="text-xs text-slate-400 mb-4">Seen last: Feb 3, 2026</p>
            <div className="space-y-2.5">
              {[
                { label: "Active Conditions", value: "Generalized anxiety disorder · Hypertension (controlled) · Hypothyroidism" },
                { label: "Current Medications", value: "Sertraline 100mg · Ramipril 5mg · Levothyroxine 75mcg" },
                { label: "Recent Consult", value: "Psychiatry at UAH — Jan 12, 2026 · No med changes recommended" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 mb-1">{label}</p>
                  <p className="text-xs text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </section>

      {/* ── FEATURE 2: Specialty Notes ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-5xl mx-auto px-8">
          <div className="grid grid-cols-2 gap-16 items-center">
            <CardShell title="AI Draft — Behavioural Health SOAP">
              <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Draft — awaiting your review
              </div>
              <div className="space-y-3">
                {[
                  { heading: "Subjective", body: "Patient reports worsening low mood over the past 3 weeks. Sleep is disrupted — averaging 4–5 hrs/night. Denies active suicidal ideation. PHQ-9 score today: 14 (moderate)." },
                  { heading: "Objective", body: "Alert and oriented ×3. Affect flat, psychomotor slowing observed. No formal thought disorder. Cognition grossly intact." },
                  { heading: "Assessment", body: "Major depressive disorder, recurrent moderate episode (F33.1). Partial response to current Sertraline dose." },
                  { heading: "Plan", body: "Increase Sertraline to 150mg. Referral to counseling. Follow-up in 4 weeks or sooner if deteriorating." },
                ].map(({ heading, body }) => (
                  <div key={heading}>
                    <p className="text-xs font-bold text-slate-900 mb-1">{heading}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </CardShell>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">Specialty-Specific Notes</p>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-4">
                Notes that think like you do.
              </h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                SpecScribe adapts to your specialty and clinical reasoning style — not the other way around. Whether you dictate in DAP, SOAP, or BIRP format, the AI structures the note to match your preferences and CPSA documentation standards.
              </p>
              <div className="flex flex-col gap-3.5">
                <FeatureItem><strong className="text-slate-800">PIPEDA & HIA aligned</strong> — notes built to satisfy Federal and Provincial documentation standards.</FeatureItem>
                <FeatureItem><strong className="text-slate-800">Format memory</strong> — the AI remembers your preferred physical exam normals, section order, and abbreviation style.</FeatureItem>
                <FeatureItem><strong className="text-slate-800">Lay-language patient summaries</strong> — generate plain-language handouts in English or French for patients to take home.</FeatureItem>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE 3: AHCIP Billing ── */}
      <section className="max-w-5xl mx-auto px-8 py-24">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">AHCIP Billing Guidance</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-4">
              Bill what you earned. Every time.
            </h2>
            <p className="text-slate-500 leading-relaxed mb-8">
              SpecScribe is built around the Alberta Health Care Insurance Plan and the AMA Physician&apos;s Schedule of Medical Benefits. Every note comes with in-flow billing suggestions — so you capture the right service code before the encounter closes.
            </p>
            <div className="flex flex-col gap-3.5">
              <FeatureItem><strong className="text-slate-800">Service code suggestions</strong> — AI recommends the correct billing service code based on the documented encounter complexity.</FeatureItem>
              <FeatureItem><strong className="text-slate-800">Time-based billing alerts</strong> — flags encounters qualifying for extended visit codes when documentation supports it.</FeatureItem>
              <FeatureItem><strong className="text-slate-800">Modifier guidance</strong> — identifies when after-hours, emergency, or telehealth modifiers apply.</FeatureItem>
              <FeatureItem><strong className="text-slate-800">Always a draft</strong> — you review and submit. SpecScribe never auto-submits a claim on your behalf.</FeatureItem>
            </div>
          </div>
          <CardShell title="AHCIP Billing Suggestions">
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              Review before submitting to AHCIP
            </div>
            <div className="space-y-0">
              {[
                { code: "03.04B", desc: "Office visit — intermediate complexity (15–29 min)", conf: "High", confClass: "bg-green-100 text-green-700" },
                { code: "03.08A", desc: "Mental health counselling — initial assessment", conf: "High", confClass: "bg-green-100 text-green-700" },
                { code: "03.07J", desc: "Telehealth premium — patient in rural community", conf: "Review", confClass: "bg-yellow-100 text-yellow-700" },
              ].map(({ code, desc, conf, confClass }) => (
                <div key={code} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                  <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded shrink-0">{code}</span>
                  <span className="text-xs text-slate-600 flex-1">{desc}</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${confClass}`}>{conf}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-bold text-slate-700 mb-1">⚠ Possible underbilling flagged</p>
              <p className="text-xs text-slate-500">Documentation supports 03.04C (complex, 30+ min). Consider upgrading before submission.</p>
            </div>
          </CardShell>
        </div>
      </section>

      {/* ── SPECIALTIES ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">Canadian Specialties</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-3">Built for high-demand specialty practices</h2>
            <p className="text-slate-500">Starting with the highest documentation burden specialties — with more launching through 2026.</p>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {specialties.map(({ icon, name, desc }) => (
              <div
                key={name}
                className="bg-white border-[1.5px] border-slate-200 hover:border-blue-600 hover:shadow-[0_4px_16px_rgba(232,93,93,0.12)] rounded-xl p-6 transition-all"
              >
                <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-2xl mb-4">{icon}</div>
                <h3 className="font-bold text-slate-900 mb-2 text-sm">{name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-slate-900 py-24">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-black uppercase tracking-widest text-blue-400 mb-3">From Canadian Clinicians</p>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">What physicians are saying</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {testimonials.map(({ quote, initials, name, role }) => (
              <div key={name} className="bg-white/6 border border-white/10 rounded-xl p-8 flex flex-col gap-5">
                <p className="text-sm text-white/80 leading-relaxed italic">
                  <span className="text-blue-400 text-2xl leading-none align-[-8px] mr-1">&ldquo;</span>
                  {quote}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{name}</p>
                    <p className="text-xs text-white/50">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE ── */}
      <section className="bg-blue-50 py-24">
        <div className="max-w-5xl mx-auto px-8 grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">PIPEDA & HIA Compliance</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-4">
              Built for PIPEDA (Federal) and HIA (Alberta).
            </h2>
            <p className="text-slate-600 leading-relaxed">
              SpecScribe was designed from day one around <strong>PIPEDA</strong> and Provincial laws like <strong>HIA</strong>. Patient data never crosses national borders for processing. All health information is stored and processed on Canadian infrastructure.
            </p>
          </div>
          <div className="space-y-3">
            {complianceBadges.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-lg p-4 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl shrink-0">{icon}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-0.5">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 text-center px-8">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
          Ready to reclaim your <span className="text-blue-600">evenings?</span>
        </h2>
        <p className="text-slate-500 text-lg max-w-md mx-auto mb-10">
          Join Canada&apos;s forward-thinking specialty practices. 30-day free trial — no credit card required.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/login?mode=signup" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3.5 rounded-md transition-colors">
            Start Free Trial →
          </Link>
          <Link href="/demo" className="bg-white border-[1.5px] border-slate-200 hover:border-blue-600 hover:text-blue-600 text-slate-700 font-semibold px-8 py-3.5 rounded-md transition-colors">
            Book a Demo
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 py-8 px-8">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4 text-sm text-white/50">
          <span className="text-white font-bold">SpecScribe</span>
          <span>PIPEDA (Federal) and HIA (Alberta) Compliant · Made in Canada · © 2026 SpecScribe Inc.</span>
          <div className="flex gap-5">
            <Link href="#" className="hover:text-blue-400 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">Terms</Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
