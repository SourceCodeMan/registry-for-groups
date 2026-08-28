"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  Turnstile,
  captchaEnabled,
  type TurnstileHandle,
} from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Only allow internal redirect targets (open-redirect guard). */
function safePath(p: string | null): string {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/app";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safePath(params.get("redirect"));
  const inviteQ = params.get("redirect")
    ? `?redirect=${encodeURIComponent(params.get("redirect")!)}`
    : "";

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const isSignup = mode === "signup";
  // Only signup is captcha-gated (login stays friction-free).
  const needsCaptcha = isSignup && captchaEnabled;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsCaptcha && !captchaToken) {
      toast.error("Please complete the verification.");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await authClient.signUp.email(
          { name: name.trim(), email: email.trim(), password },
          needsCaptcha && captchaToken
            ? { headers: { "x-captcha-response": captchaToken } }
            : undefined,
        );
        if (error) {
          toast.error("Could not create your account.");
          // The token was consumed; get a fresh one for any retry.
          turnstileRef.current?.reset();
          return;
        }
        toast.success("Check your email for a verification link.");
        router.push("/login");
        return;
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) {
          const unverified =
            error.code === "EMAIL_NOT_VERIFIED" ||
            /verif/i.test(error.message ?? "");
          toast.error(
            unverified
              ? "Check your email to verify your account."
              : "Invalid email or password.",
          );
          return;
        }
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
      if (needsCaptcha) turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignup ? "Create your account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Start a registry or join your group. We'll email you a verification link."
            : "Log in to your registries."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-4">
          {isSignup && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {!isSignup && (
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 12 : undefined}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
            {isSignup && (
              <p className="text-xs text-muted-foreground">
                At least 12 characters.
              </p>
            )}
          </div>
          {isSignup && (
            <Turnstile ref={turnstileRef} onToken={setCaptchaToken} />
          )}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : isSignup
                ? "Create account"
                : "Log in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link
                  href={`/login${inviteQ}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link
                  href={`/signup${inviteQ}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
