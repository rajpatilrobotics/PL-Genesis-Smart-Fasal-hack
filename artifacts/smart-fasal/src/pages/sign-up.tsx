import { useState } from "react";
import { useLocation } from "wouter";
import { Leaf, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StackBadges() {
  const items = ["Filecoin", "Flow", "Lit Protocol", "Starknet", "NEAR"];
  return (
    <div className="flex flex-wrap justify-center gap-1.5 mt-4">
      {items.map(name => (
        <span key={name} className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px] font-medium border border-white/10">
          {name}
        </span>
      ))}
    </div>
  );
}

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

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
        options: { data: { full_name: fullName } },
      });
      if (error) { setError(error.message); return; }
      setLocation("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) { setError(error.message); return; }
      setLocation("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setGuestLoading(false);
    }
  }

  async function handleWalletSignIn() {
    setWalletLoading(true);
    setError("");
    try {
      const eth = (window as any).ethereum;
      if (!eth) {
        setError("No Ethereum wallet detected. Install MetaMask to sign in with your wallet.");
        return;
      }
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts.length) { setError("No wallet account selected."); return; }
      const address = accounts[0];
      const message = `Sign in to Smart Fasal\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await eth.request({ method: "personal_sign", params: [message, address] });
      if (signature) setError("Wallet connected! Full on-chain sign-in coming soon.");
    } catch (err: any) {
      if (err?.code === 4001) setError("Wallet connection cancelled.");
      else setError("Wallet sign-in failed. Please try again.");
    } finally {
      setWalletLoading(false);
    }
  }

  const busy = loading || guestLoading || walletLoading;

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800" />
      <div className="fixed top-0 left-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-80 h-80 rounded-full bg-teal-400/10 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="fixed inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
        backgroundSize: "28px 28px"
      }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 p-8 border border-white/40">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-emerald-200 ring-2 ring-emerald-100 mb-3">
              <img src={`${BASE}/logo.jpeg`} alt="Smart Fasal" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Smart Fasal</h1>
            <p className="text-xs text-emerald-600 font-medium mt-1">The Smart Agriculture Platform</p>
          </div>

          {/* Ethereum Wallet */}
          <Button
            type="button"
            onClick={handleWalletSignIn}
            disabled={busy}
            variant="outline"
            className="w-full h-11 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 mb-4"
          >
            {walletLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 256 417" fill="none">
                  <polygon fill="#343434" points="128.0,0 126.6,4.8 126.6,285.2 128.0,286.5 255.9,212.3"/>
                  <polygon fill="#8C8C8C" points="128.0,0 0,212.3 128.0,286.5 128.0,153.5"/>
                  <polygon fill="#3C3C3B" points="128.0,311.0 126.4,313.0 126.4,412.7 128.0,416.9 256.0,237.5"/>
                  <polygon fill="#8C8C8C" points="128.0,416.9 128.0,311.0 0,237.5"/>
                  <polygon fill="#141414" points="128.0,286.5 255.9,212.3 128.0,153.5"/>
                  <polygon fill="#393939" points="0,212.3 128.0,286.5 128.0,153.5"/>
                </svg>
                Sign up with Ethereum Wallet
              </>
            )}
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or use email</span>
            <div className="flex-1 h-px bg-gray-200" />
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
              disabled={busy}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <Button
            type="button"
            onClick={handleGuest}
            disabled={busy}
            variant="outline"
            className="w-full h-11 border-dashed border-gray-300 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 rounded-xl font-medium"
          >
            {guestLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><UserX className="w-4 h-4 mr-2" />Continue as Guest</>
            }
          </Button>
          <p className="text-center text-xs text-gray-400 mt-2">No account needed — explore everything freely</p>

          <p className="text-center text-sm text-gray-500 mt-4">
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
