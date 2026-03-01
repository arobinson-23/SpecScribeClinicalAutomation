import AuthPage from "../auth-page";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d17]" />}>
      <AuthPage />
    </Suspense>
  );
}
