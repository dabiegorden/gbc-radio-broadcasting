"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Check, X, Radio } from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const PasswordStrengthBar = ({ password }: { password: string }) => {
  const getStrength = () => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
  };

  const strength = getStrength();
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
  ];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="space-y-2">
      <div className="h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${colors[strength - 1] || "bg-gray-300"}`}
          style={{ width: `${(strength / 4) * 100}%` }}
        />
      </div>
      {password && (
        <p className="text-xs text-purple-300">
          Strength:{" "}
          <span className="font-semibold">
            {labels[strength - 1] || "Very Weak"}
          </span>
        </p>
      )}
    </div>
  );
};

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <div className="flex items-center gap-2 text-xs">
    {met ? (
      <Check className="w-4 h-4 text-green-400" />
    ) : (
      <X className="w-4 h-4 text-purple-400/50" />
    )}
    <span className={met ? "text-purple-200" : "text-purple-400/70"}>
      {text}
    </span>
  </div>
);

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordMatch =
    password && confirmPassword && password === confirmPassword;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z\d]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (!passwordMatch) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role: "users", // Default to regular user role
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Store token and user data in localStorage
      localStorage.setItem("token", data.data.token);
      localStorage.setItem("user", JSON.stringify(data.data.user));

      toast.success("Registration successful! Redirecting...");

      // Role-based redirect
      const userRole = data.data.user.role;

      if (userRole === "admin") {
        // Admin users go to dashboard
        router.push("/dashboard");
      } else {
        // Regular users go to live stream page
        router.push("/live-stream");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-linear-to-br from-slate-950 via-purple-950 to-slate-900">
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 bg-linear-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/50">
                <Radio className="w-9 h-9 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
              Join GBC Radio
            </h1>
            <p className="text-purple-300 text-lg">
              Create your account to start listening
            </p>
          </div>

          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl space-y-6">
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="firstName"
                    className="text-sm font-semibold text-purple-300"
                  >
                    First Name
                  </label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isLoading}
                    className="h-12 bg-black/30 border-purple-500/30 text-white placeholder-purple-400/50 focus:border-purple-500/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="lastName"
                    className="text-sm font-semibold text-purple-300"
                  >
                    Last Name
                  </label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isLoading}
                    className="h-12 bg-black/30 border-purple-500/30 text-white placeholder-purple-400/50 focus:border-purple-500/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-purple-300"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-black/30 border-purple-500/30 text-white placeholder-purple-400/50 focus:border-purple-500/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-purple-300"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-12 pr-12 bg-black/30 border-purple-500/30 text-white placeholder-purple-400/50 focus:border-purple-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {password && (
                  <div className="space-y-3 pt-2">
                    <PasswordStrengthBar password={password} />
                    <div className="space-y-2 bg-black/20 border border-purple-500/20 rounded-xl p-3">
                      <RequirementItem
                        met={password.length >= 6}
                        text="At least 6 characters"
                      />
                      <RequirementItem
                        met={hasNumber}
                        text="Contains a number"
                      />
                      <RequirementItem
                        met={hasSpecial}
                        text="Contains a special character"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-semibold text-purple-300"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-12 pr-12 bg-black/30 border-purple-500/30 text-white placeholder-purple-400/50 focus:border-purple-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-2 text-xs mt-2">
                    {passwordMatch ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 font-semibold">
                          Passwords match
                        </span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-red-300">
                          Passwords do not match
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !passwordMatch || password.length < 6}
                className="w-full h-12 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-base transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating account...
                  </div>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-purple-500/30" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-linear-to-br from-purple-900/40 to-pink-900/40 text-purple-300">
                  Already have an account?
                </span>
              </div>
            </div>

            <Link href="/login">
              <Button
                variant="outline"
                className="w-full h-12 bg-transparent border-purple-500/30 text-purple-300 hover:bg-purple-600/20 hover:text-white transition-all"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="text-center text-xs text-purple-400/70">
            <p>
              🔒 Your data is encrypted and protected with industry-standard
              security
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
