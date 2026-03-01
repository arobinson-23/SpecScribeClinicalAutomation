import Link from "next/link";
import { MarketingNav } from "@/components/layout/MarketingNav";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ backgroundColor: '#fff' }}>
      <MarketingNav />

      {/* ── HERO ── */}
      {/* Hero — dark top seamlessly continues the nav, then fades into light */}
      <section className="pt-16" style={{ background: 'linear-gradient(180deg, #0b0d17 0%, #0b0d17 30%, #eff6ff 75%, #ffffff 100%)' }}>
        <div className="max-w-6xl mx-auto px-8 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold text-blue-300 uppercase tracking-wide mb-6">
            ✦ Serving Canadian specialty practices
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white leading-tight mb-5">
            Document less.<br />
            <span className="text-blue-400">Care more.</span>
          </h1>
          <p className="text-xl text-blue-100/70 max-w-lg mx-auto mb-10 leading-relaxed">
            SpecScribe listens to your encounter, writes your note, and suggests billing codes — so you can focus on your patient.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/login?mode=signup"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-full transition-colors shadow-lg shadow-blue-600/30"
            >
              Start Free Trial
            </Link>
            <Link
              href="/industry-use"
              className="text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              See how it works for your specialty →
            </Link>
          </div>
        </div>
      </section>

      {/* ── DEMO PANEL ── */}
      <section className="max-w-5xl mx-auto px-8 py-20" id="how-it-works">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Live encounter demo</p>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Three panels. One workflow.</h2>
        <p className="text-slate-500 mb-10">Transcript → AI note → Patient handout, generated in real time from a single conversation.</p>

        <div className="bg-blue-50 rounded-2xl p-5 flex gap-4">

          {/* TRANSCRIPT */}
          <div className="bg-white rounded-xl p-5 flex-1 flex flex-col shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Transcript</h3>
            <div className="flex flex-col justify-between flex-1 gap-3">
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">J</div>
                <div className="bg-blue-500 text-white text-xs leading-relaxed px-3 py-2 rounded-2xl rounded-bl-sm max-w-[75%]">
                  Hi, Dr. Smith I&apos;ve been feeling unwell lately, and I need your help
                </div>
              </div>
              <div className="flex items-end gap-2 flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold shrink-0">Dr</div>
                <div className="bg-[#d1d5db] text-slate-700 text-xs leading-relaxed px-3 py-2 rounded-2xl rounded-br-sm max-w-[75%]">
                  Of course. What seems to be the problem?
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">J</div>
                <div className="bg-blue-500 text-white text-xs leading-relaxed px-3 py-2 rounded-2xl rounded-bl-sm max-w-[75%]">
                  I&apos;ve been having terrible headaches and feeling a bit dizzy at times.
                </div>
              </div>
              <div className="flex items-end gap-2 flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold shrink-0">Dr</div>
                <div className="bg-[#d1d5db] text-slate-700 text-xs leading-relaxed px-3 py-2 rounded-2xl rounded-br-sm max-w-[75%]">
                  I&apos;m sorry to hear that. Any nausea or vomiting with the headaches?
                </div>
              </div>
            </div>
          </div>

          {/* CLINICIAN NOTE */}
          <div className="bg-white rounded-xl p-5 flex-1 flex flex-col shadow-sm">
            <h3 className="font-bold text-slate-900 mb-3">Clinician Note</h3>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-blue-600 font-bold text-base leading-none">+</span>
              <span className="text-xs text-blue-600">Based on preferences, here are suggestions:</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">● 03:23:06</p>
            <div className="mb-3">
              <p className="text-xs font-bold text-slate-900 mb-1">Subjective:</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Reports experiencing headaches that <span className="text-blue-600">have</span> been increasing in frequency over the past month, causing her to take more time off work. <span className="text-blue-600">Describes</span> the headaches as a tight band around the head, sometimes accompanied by blurry vision at times...
              </p>
            </div>
            <div className="mb-3">
              <p className="text-xs font-bold text-slate-900 mb-1">Objective:</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Patient appears well and <span className="text-blue-600">was able to</span> get onto the examination table without difficulty.
              </p>
            </div>
            <p className="mt-auto pt-2 text-right text-xs text-slate-400">2 min ago</p>
          </div>

          {/* PATIENT HANDOUT */}
          <div className="bg-white rounded-xl p-5 flex-1 flex flex-col shadow-sm">
            <h3 className="font-bold text-slate-900 mb-3">Patient Handout</h3>
            <p className="text-xs font-bold text-slate-900 mb-1">Patient Handout</p>
            <p className="text-xs text-slate-400 mb-1">Created  August 17, 2023  08:45 am</p>
            <p className="text-xs font-bold text-slate-900 mb-3">Patient #124</p>
            <div className="flex-1 text-xs text-slate-700 leading-relaxed">
              <p className="mb-2">Today we discussed your increasing frequency of headaches, potential causes, and a plan to manage them.</p>
              <p className="mb-2">Action items:</p>
              <p className="text-blue-600 mb-1">Improve your sleep hygiene as per the educational materials provided.</p>
              <p className="text-blue-600 mb-1">Increase your fluid intake to at least 1.5 litres of water per day.</p>
              <p className="text-blue-600 mb-1">Incorporate more protein into your breakfast.</p>
              <p className="text-blue-600">Attend a screening for Anxiety and Depression scale to assess the impact of stress on your physical health.</p>
            </div>
            <p className="mt-auto pt-2 text-right text-xs text-slate-400">2 min ago</p>
          </div>

        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-slate-900 py-14">
        <div className="max-w-4xl mx-auto px-8 grid grid-cols-3 gap-px bg-white/10">
          {[
            { n: "38%", label: "reduction in documentation time per encounter" },
            { n: "40%", label: "less charting outside of working hours" },
            { n: "2 hrs", label: "saved per physician per day on average" },
          ].map((s) => (
            <div key={s.n} className="bg-slate-900 text-center px-8 py-10">
              <div className="text-4xl font-black text-blue-400 tracking-tight mb-2">{s.n}</div>
              <div className="text-xs text-white/50 max-w-[160px] mx-auto leading-relaxed">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 text-center px-8" id="pricing">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
          Ready to reclaim your <span className="text-blue-600">evenings?</span>
        </h2>
        <p className="text-slate-500 text-lg max-w-md mx-auto mb-10">
          Join Canada&apos;s forward-thinking specialty practices. 30-day free trial — no credit card required.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/pricing" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-md transition-colors shadow-lg shadow-blue-600/20">
            Compare Plans & ROI →
          </Link>
          <Link href="/login?mode=signup" className="bg-white border border-slate-200 hover:border-blue-600 hover:text-blue-600 text-slate-700 font-semibold px-8 py-3 rounded-md transition-colors">
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 py-8 px-8">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4 text-sm text-white/50">
          <span className="text-white font-bold">✦ SpecScribe</span>
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
