"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, Mail, Lock, Tag, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function onSubmit(data: LoginForm) {
    setAuthError(null);
    try {
      await signIn(data.email, data.password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  if (loading || user) return null;

  return (
    <div className="w-full max-w-sm animate-slide-up">
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mb-4 shadow-lg shadow-brand-600/20">
          <Tag className="text-white" size={22} />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">LabelGen</h1>
        <p className="text-slate-400 text-sm mt-1">Sign in to continue</p>
      </div>

      {/* Card */}
      <div className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {authError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="form-label" htmlFor="email">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register("email")}
                className={cn("input-base pl-9", errors.email && "border-red-500 focus:ring-red-500")}
              />
            </div>
            {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="form-label" htmlFor="password">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className={cn("input-base pl-9 pr-10", errors.password && "border-red-500 focus:ring-red-500")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2">
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={15} />
                Sign in
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-slate-600 text-xs mt-6">
        Internal use only · Contact your administrator for access
      </p>
    </div>
  );
}
