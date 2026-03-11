"use client";

export type ProfileFormData = {
  firstName: string;
  lastName: string;
  profession: string;
  credentials: string;
  registrationNumber: string;
  practitionerId: string;
  providerCount: string;
};

const PROFESSIONS = [
  { value: "psychiatrist",    label: "Psychiatrist",                      college: "CPSA",    regLabel: "CPSA License #" },
  { value: "psychologist",    label: "Psychologist",                      college: "CAP",     regLabel: "CAP Registration #" },
  { value: "rsw",             label: "Registered Social Worker (RSW)",    college: "ACSW",    regLabel: "ACSW Registration #" },
  { value: "rpn",             label: "Registered Psychiatric Nurse",      college: "CRPNAB",  regLabel: "CRPNAB Registration #" },
  { value: "ot",              label: "Occupational Therapist",            college: "ACOT",    regLabel: "ACOT Registration #" },
  { value: "np",              label: "Nurse Practitioner",                college: "CARNA",   regLabel: "CARNA Registration #" },
  { value: "admin",           label: "Practice Administrator (non-clinical)", college: null,  regLabel: null },
  { value: "other",           label: "Other",                             college: null,      regLabel: "Professional Registration #" },
];

const input = "w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60";
const label = "block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider";

type Props = {
  form: ProfileFormData;
  email: string;
  onChange: (key: keyof ProfileFormData, value: string) => void;
};

export function ProfileStep({ form, email, onChange }: Props) {
  const set = (key: keyof ProfileFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(key, e.target.value);

  const selectedProfession = PROFESSIONS.find((p) => p.value === form.profession);
  const regLabel = selectedProfession?.regLabel ?? "Professional Registration #";
  const showReg = selectedProfession ? selectedProfession.regLabel !== null : false;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>First Name *</label>
          <input className={input} placeholder="Jane" value={form.firstName} onChange={set("firstName")} required />
        </div>
        <div>
          <label className={label}>Last Name *</label>
          <input className={input} placeholder="Smith" value={form.lastName} onChange={set("lastName")} required />
        </div>
      </div>

      <div>
        <label className={label}>Email (from your account)</label>
        <input className={`${input} opacity-50 cursor-not-allowed`} value={email} readOnly />
      </div>

      <div>
        <label className={label}>Profession / Designation *</label>
        <select className={input} value={form.profession} onChange={set("profession")} required>
          <option value="">Select your profession…</option>
          {PROFESSIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {selectedProfession?.college && (
          <p className="mt-1 text-[10px] text-white/25">Regulated by the {selectedProfession.college} (Alberta)</p>
        )}
      </div>

      <div>
        <label className={label}>
          Credentials
          <span className="ml-1 text-white/30 normal-case font-normal tracking-normal">(optional)</span>
        </label>
        <input className={input} placeholder="e.g. MD, FRCPC  or  PhD, RPsych  or  MSW, RSW" value={form.credentials} onChange={set("credentials")} />
      </div>

      {showReg && (
        <div>
          <label className={label}>{regLabel} *</label>
          <input className={input} placeholder="Enter your registration number" value={form.registrationNumber} onChange={set("registrationNumber")} required />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>
            Alberta Health Practitioner ID
            <span className="ml-1 text-white/30 normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <input className={input} placeholder="AHP-000000" value={form.practitionerId} onChange={set("practitionerId")} />
          <p className="mt-1 text-[10px] text-white/25">Assigned by AHS for fee-for-service billing</p>
        </div>
        <div>
          <label className={label}>Number of Providers *</label>
          <input
            className={input}
            type="number"
            min={1}
            max={500}
            placeholder="e.g. 3"
            value={form.providerCount}
            onChange={set("providerCount")}
            required
          />
          <p className="mt-1 text-[10px] text-white/25">Total clinicians who will use SpecScribe (affects billing)</p>
        </div>
      </div>
    </div>
  );
}
