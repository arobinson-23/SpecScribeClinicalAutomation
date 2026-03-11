import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { NewClientPage } from "./NewClientPage";

export default async function NewPatientPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const dbUser = await getDbUser();
  const canMigrate = dbUser
    ? hasPermission(dbUser.role, "practice_settings", "create")
    : false;

  return <NewClientPage canMigrate={canMigrate} />;
}
