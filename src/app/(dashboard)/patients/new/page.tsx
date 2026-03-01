import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { NewClientPage } from "./NewClientPage";

export default async function NewPatientPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  return <NewClientPage />;
}
