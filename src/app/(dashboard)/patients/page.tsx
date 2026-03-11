import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import Link from "next/link";

export default async function PatientsPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await getDbUser();
  if (!dbUser) redirect("/sign-in");

  const { practiceId } = dbUser;

  const patients = await prisma.patient.findMany({
    where: { practiceId, deletedAt: null },
    include: {
      _count: { select: { encounters: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-white/50 text-sm mt-0.5">{patients.length} clients in your practice</p>
        </div>
        <Link
          href="/patients/new"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add client
        </Link>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-white/50">Name</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">PHN</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Date of Birth</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Encounters</th>
              <th className="text-right px-4 py-3 font-medium text-white/50">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-white/30">
                  No clients yet. Add your first client to get started.
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3 font-medium text-white">
                  {decryptPHISafe(p.lastName) ?? "[encrypted]"},{" "}
                  {decryptPHISafe(p.firstName) ?? "[encrypted]"}
                </td>
                <td className="px-4 py-3 text-white/50 font-mono text-xs">{p.phn ?? "—"}</td>
                <td className="px-4 py-3 text-white/60">
                  {decryptPHISafe(p.dob) ?? "—"}
                </td>
                <td className="px-4 py-3 text-white/60">{p._count.encounters}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/patients/${p.id}`}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
