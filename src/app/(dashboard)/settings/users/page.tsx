import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { requirePermission } from "@/lib/auth/rbac";
import { format } from "date-fns";
import type { UserRole } from "@prisma/client";

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);
  const typedSession = session as unknown as { practiceId: string; role: string; id: string };
  const practiceId = typedSession?.practiceId;

  requirePermission(typedSession.role as UserRole, "user_management", "read");

  const users = await prisma.user.findMany({
    where: { practiceId, deletedAt: null },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      credentials: true,
      mfaEnabled: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const ROLE_BADGE: Record<string, string> = {
    provider: "bg-blue-50 text-blue-700",
    admin: "bg-purple-50 text-purple-700",
    biller: "bg-orange-50 text-orange-700",
    staff: "bg-slate-100 text-slate-600",
    superadmin: "bg-red-50 text-red-700",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage providers, admins, and staff access</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Invite User
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Role</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">MFA</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Last Login</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  No team members found.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const firstName = decryptPHISafe(user.firstName) ?? "[encrypted]";
              const lastName = decryptPHISafe(user.lastName) ?? "[encrypted]";
              return (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {firstName} {lastName}
                    </div>
                    {user.credentials && (
                      <div className="text-xs text-slate-400">{user.credentials}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.mfaEnabled ? (
                      <span className="text-green-600 text-xs font-medium">✓ Enabled</span>
                    ) : (
                      <span className="text-red-500 text-xs font-medium">✗ Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy") : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    {user.active ? (
                      <span className="text-green-600 text-xs">Active</span>
                    ) : (
                      <span className="text-slate-400 text-xs">Inactive</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>HIPAA reminder:</strong> MFA is mandatory for all users with access to ePHI (2025 HIPAA NPRM).
        Users with MFA disabled are flagged in the compliance dashboard.
      </div>
    </div>
  );
}
