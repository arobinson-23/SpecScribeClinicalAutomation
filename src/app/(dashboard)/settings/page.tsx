import { redirect } from "next/navigation";

export default function SettingsRootPage() {
    // Redirect to the default settings tab (Practice Settings)
    redirect("/settings/practice");
}
