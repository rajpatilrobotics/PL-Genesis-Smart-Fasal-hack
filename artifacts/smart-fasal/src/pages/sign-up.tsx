import { useState } from "react";
import { useLocation } from "wouter";
import { Leaf, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: undefined,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setLocation("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800" />
      <div className="fixed top-0 left-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-80 h-80 rounded-full bg-teal-400/10 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="fixed inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
        backgroundSize: "28px 28px"
      }} />

      <div className="fixed top-6 left-0 right-0 flex flex-col items-center z-10">
        <div className="flex items-center gap-2 mb-1">
          <img src={`${BASE}/logo.jpeg`} alt="Smart Fasal" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/30 shadow-lg" />
          <span className="text-2xl font-extrabold text-white tracking-tight drop-shadow">Smart Fasal</span>
        </div>
        <p className="text-emerald-100/70 text-xs font-medium">🌾 AI · IoT · Web3 Agriculture Platform</p>
      </div>

      <div className="relative z-10 w-full max-w-sm mt-24">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 p-8 border border-white/40">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
            <p className="text-sm text-gray-500 mt-1">Start your Smart Fasal journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="pl-10 h-11 border-gray-200 focus:border-emerald-400 rounded-xl"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10 h-11 border-gray-200 focus:border-emerald-400 rounded-xl"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 border-gray-200 focus:border-emerald-400 rounded-xl"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{" "}
            <button onClick={() => setLocation("/sign-in")} className="text-emerald-600 font-semibold hover:text-emerald-700">
              Sign in
            </button>
          </p>
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 flex justify-center z-10">
        <a
          href="https://www.linkedin.com/in/raj-patil-a492a1155/?skipRedirect=true"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-white/50 text-xs hover:text-white/80 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Developed by Raj Patil
        </a>
      </div>
    </div>
  );
}
