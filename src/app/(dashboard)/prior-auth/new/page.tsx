import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { getEncountersForAuthAction } from "../actions";
import { ClinicalAuthWizard } from "../components/ClinicalAuthWizard";

export default async function NewPriorAuthPage() {
  const dbUser = await getDbUser();
  if (!dbUser) redirect("/sign-in");
  if (!hasPermission(dbUser.role, "prior_auth", "create")) redirect("/403");

  const encounters = await getEncountersForAuthAction();

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      {/* Page header */}
      <div className="mb-8">
        <Link
          href="/prior-auth"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-4 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Prior Authorizations
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <div className="h-5 w-1 bg-blue-500 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80">
            Clinical Authorization Engine
          </span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">New Prior Authorization</h1>
        <p className="text-white/40 text-sm font-medium mt-1">
          Alberta Behavioral Health — AI-assisted clinical justification with physician sign-off.
        </p>
      </div>

      <ClinicalAuthWizard encounters={encounters} />
    </div>
  );
}
