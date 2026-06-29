import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
