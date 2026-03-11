"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const DEMO_SCENARIOS = [
    {
        label: "Behavioral Health — Follow-up (SOAP)",
        noteType: "progress_note",
        noteFormat: "SOAP",
        patientContext: {
            ageYears: 41,
            biologicalSex: "male",
            priorDiagnoses: ["Major Depressive Disorder (F32.1)", "Generalized Anxiety Disorder (F41.1)"],
            currentMedications: ["Sertraline 50mg daily", "Clonazepam 0.5mg PRN"],
            chiefComplaint: "Follow-up — sleep disturbance and intrusive thoughts",
        },
        transcript: `Provider: Good morning Marcus. How have you been since our last session two weeks ago?
Patient: Honestly it's been a rough couple of weeks. The sleep has been really bad — I'm maybe getting four hours a night, and when I do sleep the dreams are vivid and unsettling. I wake up feeling more tired than when I went to bed.
Provider: And how's the anxiety been during the day?
Patient: Pretty bad honestly. I had a panic attack at work on Monday. I was in a presentation and suddenly my heart just started racing, I couldn't breathe properly, I had to excuse myself and go to the washroom for like ten minutes to calm down.
Provider: Was this similar to previous panic attacks you've had, or did it feel different?
Patient: Similar I guess, but the timing was worse. It's happening more at work lately. I keep having these thoughts that everyone can see I'm struggling, like they're all waiting for me to fail.
Provider: Those sounds like cognitive distortions — specifically catastrophizing and mind-reading. Are you still taking the sertraline every day?
Patient: Yes, without fail. I actually ran out for two days last month and I could really feel the difference, so I made sure not to let that happen again.
Provider: That's actually a good sign — it tells us the medication is doing something meaningful. Have you had any thoughts of harming yourself or feeling that life isn't worth living?
Patient: No, nothing like that. I want to get better. I just feel stuck right now.
Provider: That motivation matters a lot. Let me ask about appetite and energy — how are those?
Patient: Appetite is okay, maybe slightly less than usual. Energy is low but I'm still making it to the gym twice a week which I know is good.
Provider: It is good. Exercise has a meaningful antidepressant effect. PHQ-9 today?
Patient: I filled it out in the waiting room — I think I scored a 14?
Provider: Yes, 14, which is moderate. That's up from an 11 two weeks ago, so we've had some worsening. I want to address the sleep specifically — let's talk about sleep hygiene and also consider whether we should bump the sertraline to 75mg. The panic attacks may also warrant revisiting whether we need to add something short-term. GAD-7?
Patient: I think 13.
Provider: Thirteen, moderate-severe. Alright. Here's what I want to do: we'll increase sertraline to 75mg starting tonight, stay at that dose for four weeks, and I'm going to add a referral for CBT for panic disorder specifically — I think you'd benefit from some exposure-based techniques for the workplace anxiety. Check in again in two weeks. Does that plan make sense to you?
Patient: Yes, that makes sense. Thank you.
Provider: And please call the clinic if the panic attacks get more frequent or if anything shifts with your mood before we reconnect.`,
    },
    {
        label: "Behavioral Health — Intake Assessment (BIRP)",
        noteType: "intake",
        noteFormat: "BIRP",
        patientContext: {
            ageYears: 28,
            biologicalSex: "female",
            priorDiagnoses: [],
            currentMedications: ["Alesse oral contraceptive pill (Dr. Smith)"],
            chiefComplaint: "New patient — depression and relationship difficulties",
        },
        transcript: `Provider: Hi Elena, thank you for connecting today. Before we begin, I need to confirm you are in Alberta for this telehealth session, and that you are in a private location?
Patient: Yes, I'm at my home in Calgary, just in my home office.
Provider: Great, and I am in my clinic office here as well. I want to note that this 60-minute intake session is confidential, but as we discussed during informed consent earlier, if there is imminent risk to yourself or others, I might need to break confidentiality. You signed the consent forms for treatment and medication via the portal, is that correct?
Patient: Yes, I signed them this morning.
Provider: Excellent, thank you. I see you were referred to us by Dr. Smith, your family physician. Can you tell me in your own words what brought you in today?
Patient: I've just been feeling really low for the past few months, starting around October. Like, I get through the day working from home as a graphic designer, but I don't enjoy anything anymore. I used to love painting, I haven't touched it in maybe four months. And my relationship with my boyfriend has been really strained — we've been fighting a lot and I feel like I'm pushing him away.
Provider: Have you noticed if this mood fluctuation is tied to your menstrual cycle at all?
Patient: I take Alesse prescribed by Dr. Smith, so my cycles are pretty light and regular. No, the mood stays flat all month.
Provider: Any allergies or adverse reactions to medications in the past?
Patient: No, no allergies.
Provider: Any history of mental health issues in your family?
Patient: My mom has anxiety, but no major depression or bipolar that I know of.
Provider: You look well-groomed today, speech is clear. Your mood seems, as you said, flat or depressed. Has your concentration or memory been affected?
Patient: A bit, yeah. I find it hard to focus on design tasks.
Provider: Have you had any thoughts of hurting yourself or ending your life?
Patient: No. I thought about it once in university during a bad breakup, but I've never had a plan or tried anything. I don't feel that way now.
Provider: Okay, so risk is low, and you have no active SI or plan. We'll use the Columbia scale, but you're scoring a 0 right now. I'll provide you with the Access 24/7 and 988 numbers at the end of the session, just so you have those crisis resources on file.
Patient: Sounds good.
Provider: So your PHQ-9 is 18 today, and GAD-7 is 11. I believe you are experiencing a recurrent Major Depressive Episode. Your GAD-7 shows some anxiety, but I think it's secondary to the depression right now. To rule out any medical causes, I'm going to send a requisition for basic labs: TSH, CBC, B12, and Vitamin D.
Patient: Okay.
Provider: For treatment, since you've had a previous episode, I'd recommend starting Ciprolex, or escitalopram. Let's start at 10mg once daily. Since you are on Alesse, there's no major interaction, but as with any SSRI, it takes 4 to 6 weeks for full effect. You might have some mild nausea or headache in the first few days. If you miss a dose, just skip it and take the next one. Does that sound okay?
Patient: Yes, I can do that.
Provider: I'd also like to see you for weekly Cognitive Behavioral Therapy sessions for the first month to work on behavioral activation — maybe 15 minutes of painting a week. Let's schedule our next appointment for next Tuesday at 2 PM.
Patient: Yes, that works for me. Thank you.`,
    },
    {
        label: "Behavioral Health — Treatment Plan (NARRATIVE)",
        noteType: "treatment_plan",
        noteFormat: "NARRATIVE",
        patientContext: {
            ageYears: 35,
            biologicalSex: "female",
            priorDiagnoses: ["Bipolar II Disorder (F31.81)", "ADHD, combined presentation (F90.2)"],
            currentMedications: ["Lamotrigine 200mg daily", "Methylphenidate ER 27mg daily"],
            chiefComplaint: "Hypomanic episode — treatment plan update",
        },
        transcript: `Provider: So Amara, we've had three sessions now and I've been able to review all the history. Let's talk about where we are with your treatment plan going forward.
Patient: Okay. I've been thinking about it too.
Provider: Good. So you came in initially with what looked like a hypomanic episode — elevated mood, decreased sleep need, increased goal-directed activity, some impulsive spending. Looking at the full picture with your history of depressive episodes and the timing, I'm confident in the Bipolar II diagnosis we discussed.
Patient: I'm still kind of getting used to that label, to be honest.
Provider: That's understandable and completely normal. What I want you to know is that Bipolar II, with the right treatment, is very manageable. The lamotrigine has been showing good results — you're stable right now, the hypomanic episode has resolved, and you told me last week that the emotional swings feel less sharp.
Patient: Yes, that's true. I feel more like myself. Still a lot of anxiety though.
Provider: Right. And that's where the ADHD picture complicates things a bit — we need to be careful that the methylphenidate isn't tipping the mood balance. I want to try keeping it at the current dose and monitoring closely. If you notice another activation or elevated period, we'll reassess.
Patient: Okay. Can we talk about what to do if I feel another hypo coming on? I want to have a plan.
Provider: Absolutely — that's exactly what I want to do. Your early warning signs based on what you've described are: decreased need for sleep without fatigue, racing thoughts especially at night, and that feeling of being "on" — like everything is exciting and you want to start a hundred projects.
Patient: Yes. That's exactly it.
Provider: So the plan if those appear: first, call the clinic the same day. Don't wait for your next scheduled appointment. Second, we'll have a standing order for lorazepam 0.5mg PRN for sleep if needed to break the cycle early. Third, I want your partner involved — they've agreed to be a support person, and when they notice those signs, they'll prompt you to reach out.
Patient: That makes sense. My partner is good at noticing before I do, honestly.
Provider: Perfect. That's the ideal setup. For ongoing treatment: lamotrigine stays at 200mg, we'll do labs in three months to check levels and a metabolic panel. Therapy weekly for another month, then biweekly. I also want to refer you to the mood disorders group — they run every Thursday evening and I think the peer support component would be really valuable for you.
Patient: I'm open to that.
Provider: Great. And one more thing — I want to go over your mood chart app. You've been using it?
Patient: Mostly yes. I missed a few days.
Provider: That's normal at the start. The data you do have is really useful for our sessions. Even if it's imperfect, keep going with it. Is there anything you want to add to the plan or anything you disagree with?
Patient: No, this feels right. I actually feel hopeful about it.
Provider: That's exactly where we want to be.`,
    },
];

interface DemoModeProps {
    onTranscriptReady: (transcript: string, segments: unknown[]) => void;
    onNoteTypeChange?: (noteType: string, noteFormat: string, patientContext: Record<string, unknown>) => void;
}

export function DemoMode({ onTranscriptReady, onNoteTypeChange }: DemoModeProps) {
    const [open, setOpen] = useState(false);

    function loadScenario(scenario: typeof DEMO_SCENARIOS[number]) {
        // Pass the transcript + empty segments (no audio — typed transcript)
        onTranscriptReady(scenario.transcript, []);

        // Optionally tell parent to switch note type/format
        onNoteTypeChange?.(
            scenario.noteType,
            scenario.noteFormat,
            scenario.patientContext as Record<string, unknown>
        );

        setOpen(false);
    }

    return (
        <div className="relative">
            <button
                id="demo-mode-toggle"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 hover:border-purple-400/50 text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
                <Sparkles className="h-3.5 w-3.5" />
                Demo mode
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#14162a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Demo Scenarios</p>
                        <p className="text-[11px] text-white/30 mt-0.5">
                            Injects a realistic transcript — skips audio recording
                        </p>
                    </div>
                    <div className="py-1">
                        {DEMO_SCENARIOS.map((s, i) => (
                            <button
                                key={i}
                                id={`demo-scenario-${i}`}
                                onClick={() => loadScenario(s)}
                                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors group"
                            >
                                <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
                                            {s.label}
                                        </p>
                                        <p className="text-[11px] text-white/30 mt-0.5">
                                            {s.patientContext.chiefComplaint}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <span className="text-[10px] px-1.5 py-0.5 bg-white/[0.06] border border-white/10 rounded text-white/40 font-mono">
                                                {s.noteFormat}
                                            </span>
                                            <span className="text-[10px] text-white/30">
                                                {s.patientContext.ageYears}yo {s.patientContext.biologicalSex}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02]">
                        <p className="text-[10px] text-white/20">
                            Transcripts are synthetic — no real patient data
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
