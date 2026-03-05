import Link from "next/link";
import { MarketingNav } from "@/components/layout/MarketingNav";

export const metadata = {
  title: "Privacy Policy — SpecScribe",
  description:
    "How SpecScribe collects, uses, and protects your personal health information under PIPEDA and the Alberta Health Information Act.",
};

const LAST_UPDATED = "March 4, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── HERO ── */}
      <section
        className="pt-16"
        style={{
          background:
            "linear-gradient(180deg, #0b0d17 0%, #0b0d17 40%, #eff6ff 85%, #ffffff 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 sm:px-8 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold text-blue-300 uppercase tracking-wide mb-6">
            PIPEDA &amp; HIA Compliant
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight mb-5">
            Privacy Policy
          </h1>
          <p className="text-base sm:text-lg text-blue-100/70 max-w-lg mx-auto leading-relaxed">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className="py-14 sm:py-20 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="prose prose-slate max-w-none">

            {/* Intro */}
            <p className="text-slate-600 leading-relaxed mb-10">
              SpecScribe Inc. (&ldquo;SpecScribe,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates an
              AI-powered clinical documentation and compliance platform for specialty medical
              practices in Canada. This Privacy Policy explains how we collect, use, disclose,
              and protect personal information — including personal health information (PHI) —
              in accordance with the{" "}
              <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA),
              the Alberta <em>Health Information Act</em> (HIA), the Ontario{" "}
              <em>Personal Health Information Protection Act</em> (PHIPA), and other applicable
              Canadian provincial privacy laws.
            </p>

            <hr className="border-slate-100 my-10" />

            {/* Section 1 */}
            <Section number="1" title="Who This Policy Applies To">
              <p>
                This policy applies to:
              </p>
              <ul>
                <li>
                  <strong>Practice administrators and staff</strong> who create and manage a
                  SpecScribe account on behalf of a medical practice.
                </li>
                <li>
                  <strong>Health care providers (clinicians)</strong> who use SpecScribe to
                  document clinical encounters.
                </li>
                <li>
                  <strong>Patients</strong> whose personal health information is processed
                  through the platform as part of their provider&apos;s documentation workflow.
                </li>
              </ul>
              <p>
                SpecScribe acts as an <strong>agent</strong> (under HIA) and{" "}
                <strong>service provider</strong> (under PIPEDA) to the health information
                custodian — the medical practice. The practice retains primary responsibility
                for PHI collected from patients. SpecScribe processes that PHI only as directed
                by and on behalf of the practice.
              </p>
            </Section>

            {/* Section 2 */}
            <Section number="2" title="What Information We Collect">
              <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
                2.1 Account &amp; User Information
              </h3>
              <p>
                When a practice creates an account, we collect: practice name, address, NPI
                number, specialty, and billing information. For individual users, we collect
                name, email address, role, professional credentials, and multi-factor
                authentication data.
              </p>

              <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
                2.2 Personal Health Information (PHI)
              </h3>
              <p>
                To provide the documentation service, we process the following PHI on behalf of
                the practice:
              </p>
              <ul>
                <li>Patient name, date of birth, health card number, and contact information</li>
                <li>Audio recordings of clinical encounters (with patient consent)</li>
                <li>Transcripts of clinical encounters</li>
                <li>Clinical notes, diagnoses, procedure codes, and treatment plans</li>
                <li>Insurance and billing information</li>
                <li>Prior authorization requests and correspondence</li>
              </ul>
              <p>
                All PHI is encrypted using AES-256-GCM at the application layer before being
                written to our database. PHI values are never included in system logs.
              </p>

              <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
                2.3 Technical &amp; Usage Data
              </h3>
              <p>
                We automatically collect IP addresses, browser type, session duration, and
                feature usage events for security monitoring and product improvement. This data
                does not include PHI.
              </p>
            </Section>

            {/* Section 3 */}
            <Section number="3" title="How We Use Your Information">
              <p>We use personal information only for the purposes for which it was collected:</p>
              <ul>
                <li>Generating AI-assisted draft clinical notes for provider review</li>
                <li>Suggesting medical billing codes (CPT, ICD-10) for provider approval</li>
                <li>Automating prior authorization requests at the direction of the provider</li>
                <li>Monitoring documentation completeness and compliance requirements</li>
                <li>Providing account management, billing, and customer support</li>
                <li>Detecting and preventing unauthorized access or security incidents</li>
              </ul>
              <p>
                <strong>AI outputs are always drafts.</strong> SpecScribe never auto-finalizes
                clinical notes, submits claims, or makes clinical decisions on behalf of a
                provider. All AI-generated content requires explicit provider review and approval
                before use.
              </p>
              <p>
                We do <strong>not</strong> sell personal information, use PHI for advertising,
                or use customer data to train our AI models.
              </p>
            </Section>

            {/* Section 4 */}
            <Section number="4" title="Data Residency &amp; Cross-Border Transfers">
              <p>
                <strong>Primary storage:</strong> All PHI is stored in Canada, on AWS
                infrastructure in the <code>ca-central-1</code> region (Montreal, Quebec).
              </p>
              <p>
                <strong>AI processing:</strong> Clinical transcripts are processed by Anthropic
                Claude via AWS Bedrock, which operates in the <code>ca-central-1</code> region.
                Before any content is sent for AI processing, patient identifiers (name, date of
                birth, health card number, address) are stripped. Anthropic does not retain
                prompts or outputs and does not use your data for model training.
              </p>
              <p>
                <strong>Speech-to-text:</strong> Audio recordings are transcribed using AWS
                Transcribe Medical, processed exclusively in the AWS ca-central-1 (Montreal,
                Canada) region. All audio data remains within Canada. AWS Transcribe Medical is
                covered under the existing AWS Data Processing Agreement (DPA).
              </p>
              <p>
                <strong>User account data:</strong> Authentication and user identity data
                (provider names, email addresses, and MFA credentials) is processed by{" "}
                <strong>Clerk Inc.</strong>, a US-based authentication service provider. This
                data may be stored on servers outside Canada. Clerk processes user identity data
                only — no patient PHI is transmitted to Clerk. A Data Processing Agreement is
                in place with Clerk governing the handling of this data.
              </p>
              <p>
                <strong>Billing:</strong> Payment and subscription data is processed by{" "}
                <strong>Stripe Inc.</strong> in the United States. No patient PHI is ever
                transmitted to Stripe.
              </p>
              <p>
                Patients are informed of cross-border data flows in the practice&apos;s patient
                consent documentation, which practices are required to maintain under HIA s. 27
                and PIPEDA Principle 3.
              </p>
            </Section>

            {/* Section 5 */}
            <Section number="5" title="Data Retention">
              <table className="w-full text-sm border-collapse mt-4 mb-6">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-3 font-semibold text-slate-700 border border-slate-200">Data Type</th>
                    <th className="text-left p-3 font-semibold text-slate-700 border border-slate-200">Retention Period</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Clinical notes and finalized records", "10 years from last patient contact"],
                    ["Audio recordings", "Deleted within 30 days of transcription confirmation"],
                    ["Transcripts", "10 years (part of encounter record)"],
                    ["Audit logs", "10 years"],
                    ["Billing records", "7 years"],
                    ["User account data", "Duration of account + 90 days after termination"],
                  ].map(([type, period]) => (
                    <tr key={type}>
                      <td className="p-3 border border-slate-200 text-slate-700">{type}</td>
                      <td className="p-3 border border-slate-200 text-slate-500">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                PHI records are never hard-deleted within their retention period. Records are
                soft-deleted (marked with a <code>deleted_at</code> timestamp) and permanently
                removed only after the applicable retention window has elapsed.
              </p>
            </Section>

            {/* Section 6 */}
            <Section number="6" title="Security Safeguards">
              <p>We implement the following safeguards in accordance with PIPEDA Principle 7 and HIA s. 60:</p>
              <ul>
                <li>
                  <strong>Encryption at rest:</strong> AES-256-GCM at the application layer
                  for all PHI fields before database write
                </li>
                <li>
                  <strong>Encryption in transit:</strong> TLS 1.3 on all connections; HSTS
                  enforced
                </li>
                <li>
                  <strong>Access control:</strong> Role-based access (RBAC) — providers access
                  only their own patients; no cross-practice data access is architecturally
                  possible
                </li>
                <li>
                  <strong>Multi-factor authentication:</strong> Mandatory TOTP for all users;
                  no bypass path exists
                </li>
                <li>
                  <strong>Session management:</strong> 15-minute idle timeout; 24-hour absolute
                  maximum session duration
                </li>
                <li>
                  <strong>Audit logging:</strong> Every PHI read, write, and delete is logged
                  with user ID, timestamp, IP address, and resource — PHI values are never
                  included in logs
                </li>
                <li>
                  <strong>Penetration testing:</strong> Annual third-party security assessment
                  before any PHI enters production
                </li>
              </ul>
            </Section>

            {/* Section 7 */}
            <Section number="7" title="Your Rights">
              <p>
                Patients do not interact with SpecScribe directly. Access, correction, and
                complaint requests are handled through the health information custodian — the
                medical practice — in accordance with HIA Part 3 and PHIPA Part V.
              </p>
              <p>
                Practices can export complete patient records from SpecScribe in PDF or FHIR
                format upon request to fulfil a patient&apos;s right of access.
              </p>
              <p>
                If a patient believes their health information has been mishandled, they may file
                a complaint with the applicable regulator:
              </p>
              <ul>
                <li>
                  <strong>Federal / all provinces:</strong> Office of the Privacy Commissioner
                  of Canada (OPC) — <Link href="https://priv.gc.ca" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">priv.gc.ca</Link>
                </li>
                <li>
                  <strong>Alberta:</strong> Office of the Information and Privacy Commissioner
                  of Alberta (OIPC) — <Link href="https://oipc.ab.ca" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">oipc.ab.ca</Link>
                </li>
                <li>
                  <strong>Ontario:</strong> Information and Privacy Commissioner of Ontario
                  (IPC) — <Link href="https://ipc.on.ca" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">ipc.on.ca</Link>
                </li>
                <li>
                  <strong>British Columbia:</strong> Office of the Information and Privacy
                  Commissioner for BC — <Link href="https://oipc.bc.ca" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">oipc.bc.ca</Link>
                </li>
              </ul>
            </Section>

            {/* Section 8 */}
            <Section number="8" title="Breach Notification">
              <p>
                In the event of a privacy breach, SpecScribe will notify the affected practice
                without undue delay. The practice and SpecScribe will jointly assess whether the
                breach meets the notification threshold under applicable law:
              </p>
              <ul>
                <li>
                  <strong>PIPEDA:</strong> Notify the OPC and affected individuals if there is a
                  &ldquo;real risk of significant harm&rdquo;
                </li>
                <li>
                  <strong>HIA (Alberta):</strong> Notify OIPC &ldquo;as soon as practicable&rdquo; after
                  unauthorized access, use, or disclosure
                </li>
                <li>
                  <strong>PHIPA (Ontario):</strong> Notify IPC &ldquo;without unreasonable delay&rdquo;
                  after theft, loss, or unauthorized use
                </li>
              </ul>
            </Section>

            {/* Section 9 */}
            <Section number="9" title="Changes to This Policy">
              <p>
                We may update this policy to reflect changes in our practices or applicable law.
                Material changes will be communicated to practice administrators by email at least
                30 days before they take effect. The &ldquo;Last updated&rdquo; date at the top of this
                page reflects the most recent revision.
              </p>
            </Section>

            {/* Section 10 */}
            <Section number="10" title="Contact Us">
              <p>
                Questions or concerns about this policy or how we handle personal information
                should be directed to:
              </p>
              <address className="not-italic bg-slate-50 rounded-xl p-6 mt-4 text-slate-700 leading-relaxed">
                <strong>Privacy Officer</strong><br />
                SpecScribe Inc.<br />
                Calgary, Alberta, Canada<br />
                <a href="mailto:privacy@specscribe.ca" className="text-blue-600 hover:underline">
                  privacy@specscribe.ca
                </a>
              </address>
            </Section>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 py-8 px-6 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 text-sm text-white/50">
          <span className="text-white font-bold">SpecScribe</span>
          <span className="text-center text-xs sm:text-sm">
            PIPEDA (Federal) and HIA (Alberta) Compliant · Made in Canada · © 2026 SpecScribe Inc.
          </span>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-white hover:text-blue-400 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">Terms</Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
      </div>
      <div className="pl-10 text-slate-600 leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-slate-800 [&_a]:text-blue-600 [&_a:hover]:underline [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-slate-700">
        {children}
      </div>
    </div>
  );
}
