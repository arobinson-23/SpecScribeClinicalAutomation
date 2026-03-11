"use client";

export type PracticeFormData = {
  name: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  businessNumber: string;
  registrationNumber: string;
};

const input = "w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60";
const label = "block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider";

type Props = {
  form: PracticeFormData;
  onChange: (key: keyof PracticeFormData, value: string) => void;
};

export function PracticeStep({ form, onChange }: Props) {
  const set = (key: keyof PracticeFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange(key, e.target.value);

  return (
    <div className="space-y-5">
      <div>
        <label className={label}>Clinic / Practice Name *</label>
        <input className={input} placeholder="e.g. Westside Behavioural Health" value={form.name} onChange={set("name")} required />
      </div>

      <div>
        <label className={label}>Phone *</label>
        <input className={input} type="tel" placeholder="(587) 000-0000" value={form.phone} onChange={set("phone")} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Province</label>
          <select
            className={input}
            value={form.province}
            onChange={set("province")}
          >
            <option value="AB">Alberta (AB)</option>
            <option value="BC">British Columbia (BC)</option>
            <option value="ON">Ontario (ON)</option>
            <option value="MB">Manitoba (MB)</option>
            <option value="SK">Saskatchewan (SK)</option>
            <option value="QC">Québec (QC)</option>
            <option value="NS">Nova Scotia (NS)</option>
            <option value="NB">New Brunswick (NB)</option>
            <option value="NL">Newfoundland (NL)</option>
            <option value="PE">PEI (PE)</option>
          </select>
        </div>
        <div>
          <label className={label}>City *</label>
          <input className={input} placeholder="Calgary" value={form.city} onChange={set("city")} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Street Address *</label>
          <input className={input} placeholder="123 Main St SW" value={form.street} onChange={set("street")} required />
        </div>
        <div>
          <label className={label}>Postal Code *</label>
          <input className={input} placeholder="T2P 1J9" value={form.postalCode} onChange={set("postalCode")} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>
            Alberta Health Facility / Registration #
            <span className="ml-1 text-white/30 normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <input className={input} placeholder="AH-12345" value={form.registrationNumber} onChange={set("registrationNumber")} />
          <p className="mt-1 text-[10px] text-white/25">Assigned by Alberta Health Services or your professional college for the clinic</p>
        </div>
        <div>
          <label className={label}>
            CRA Business Number
            <span className="ml-1 text-white/30 normal-case font-normal tracking-normal">(optional)</span>
          </label>
          <input className={input} placeholder="123456789" maxLength={9} value={form.businessNumber} onChange={set("businessNumber")} />
          <p className="mt-1 text-[10px] text-white/25">9-digit Canada Revenue Agency business number</p>
        </div>
      </div>
    </div>
  );
}
