import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { SettingsForm } from "./SettingsForm";
import { DEFAULT_SETTINGS } from "./settings-schema";
import type { PracticeSettings } from "./settings-schema";

const ROLE_LABELS: Record<string, string> = {
  provider:   "Provider",
  admin:      "Administrator",
  biller:     "Biller",
  staff:      "Staff",
  superadmin: "Super Admin",
};

export default async function PracticeSettingsPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: {
      id: true,
      practiceId: true,
      email: true,
      role: true,
      credentials: true,
      provincialRegistrationNumber: true,
      lastLoginAt: true,
      lastLoginIp: true,
      firstName: true,
      lastName: true,
    },
  });

  if (dbUser?.id) {
    await writeAuditLog({
      practiceId: dbUser.practiceId,
      userId: dbUser.id,
      action: "READ",
      resource: "user",
      resourceId: dbUser.id,
      fieldsAccessed: ["firstName", "lastName", "email", "role", "lastLoginAt"],
      metadata: { context: "settings_page_view" },
    });
  }

  const displayName = dbUser
    ? `${decryptPHISafe(dbUser.firstName) ?? ""} ${decryptPHISafe(dbUser.lastName) ?? ""}`.trim()
    : null;

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const practiceId = dbUser?.practiceId ?? null;

  const practice = practiceId
    ? await prisma.practice.findUnique({
        where: { id: practiceId },
        select: {
          name: true,
          specialty: true,
          provincialRegistrationNumber: true,
          businessNumber: true,
          phone: true,
          address: true,
          subscriptionTier: true,
          fhirBaseUrl: true,
          settings: true,
        },
      })
    : null;

  const address = practice?.address as Record<string, string> | null;
  const storedSettings = practice?.settings as Partial<PracticeSettings> | null;
  const initialSettings: PracticeSettings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Practice Settings</h1>
        <p className="text-white/50 text-sm mt-0.5">Manage your practice information and preferences</p>
      </div>

      <div className="space-y-4">
        {/* Account & Profile */}
        {dbUser && (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h2 className="font-semibold text-white/80 text-sm">Account &amp; Profile</h2>
              <span className="text-xs text-white/30">Identity and security status</span>
            </div>
            <div className="p-5 flex items-start gap-5">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-400">{initials}</span>
              </div>
              {/* Fields grid */}
              <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Full Name</div>
                  <div className="font-medium text-white">{displayName || "—"}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Role</div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] text-white/70 border border-white/10">
                    {ROLE_LABELS[dbUser.role] ?? dbUser.role}
                  </span>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Email</div>
                  <div className="text-white/80">{dbUser.email}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Credentials</div>
                  <div className="text-white/80">{dbUser.credentials || "—"}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Provincial Registration #</div>
                  <div className="font-mono text-white/80 text-xs">{dbUser.provincialRegistrationNumber || "—"}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Multi-Factor Auth</div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Managed by Clerk
                  </span>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Last Sign-in</div>
                  <div className="text-white/60 text-xs">
                    {dbUser.lastLoginAt
                      ? dbUser.lastLoginAt.toLocaleString("en-CA", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Last Sign-in IP</div>
                  <div className="font-mono text-white/50 text-xs">{dbUser.lastLoginIp || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Practice Info */}
        {practice ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h2 className="font-semibold text-white/80 text-sm">Practice Information</h2>
              <span className="text-xs text-white/30">Read-only — contact support to update registration details</span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-white/40 text-xs mb-1">Practice Name</div>
                <div className="font-medium text-white">{practice.name}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Specialty</div>
                <div className="font-medium text-white capitalize">{practice.specialty.replace("_", " ")}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Provincial Registration #</div>
                <div className="font-medium text-white font-mono">{practice.provincialRegistrationNumber}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">CRA Business Number</div>
                <div className="font-medium text-white">{practice.businessNumber ?? "—"}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Phone</div>
                <div className="font-medium text-white">{practice.phone ?? "—"}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Subscription Tier</div>
                <div className="font-medium text-white capitalize">{practice.subscriptionTier}</div>
              </div>
              {address && (
                <div className="col-span-2">
                  <div className="text-white/40 text-xs mb-1">Address</div>
                  <div className="font-medium text-white">
                    {address.street}, {address.city}, {address.province} {address.postalCode}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 text-sm text-amber-400">
            Practice setup incomplete — practice information and billing sections will appear once your practice record is created. All preference settings below are still active.
          </div>
        )}

        {/* EHR Integration */}
        {practice && (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <h2 className="font-semibold text-white/80 text-sm">EHR Integration (FHIR R4)</h2>
            </div>
            <div className="p-5 text-sm">
              {practice.fhirBaseUrl ? (
                <div>
                  <div className="text-white/40 text-xs mb-1">FHIR Base URL</div>
                  <code className="text-xs bg-white/10 px-2 py-1 rounded font-mono text-white/70">
                    {practice.fhirBaseUrl}
                  </code>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Connected
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-white/30 text-sm mb-3">No EHR connected</div>
                  <p className="text-xs text-white/30 max-w-sm mx-auto">
                    Connect your EHR via FHIR R4 to automatically sync patient demographics and encounter schedules.
                    Contact support to set up an integration.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription */}
        {practice && (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <h2 className="font-semibold text-white/80 text-sm">Subscription &amp; Billing</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white capitalize">{practice.subscriptionTier} Plan</div>
                  <div className="text-xs text-white/40 mt-0.5">Manage your plan, invoices, and payment methods</div>
                </div>
                <a
                  href="/settings/billing"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Billing Portal →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Configurable Settings */}
        <SettingsForm initial={initialSettings} />
      </div>
    </div>
  );
}
