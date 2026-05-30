"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter both your email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      console.error("Login verification failed:", error.message);
      
      // Target unconfirmed email edge cases cleanly
      if (error.message.toLowerCase().includes("email not confirmed")) {
        alert("📩 Account Active but Unverified!\n\nPlease check your inbox and click the validation link inside your confirmation email to log in.");
      } else {
        alert(error.message);
      }
      setLoading(false);
      return;
    }

    // Dynamic clean redirect using Next.js internal router optimizer
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#140b24] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-[#1c1230] border border-purple-900 rounded-3xl p-8 shadow-xl shadow-purple-950/20">
        
        <h1 className="text-4xl font-bold text-purple-300">HustleHelp</h1>
        <p className="text-gray-400 mt-2">Login to your dashboard</p>

        {/* INPUT LAYOUT FLUIDITY */}
        <div className="mt-8 space-y-5">
          <div>
            <label className="text-sm text-gray-300">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-2 bg-[#24163d] text-white border border-purple-900 rounded-2xl px-4 py-4 outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Password</label>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#24163d] text-white border border-purple-900 rounded-2xl px-4 py-4 pr-14 outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-purple-300 hover:text-purple-200"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        {/* DYNAMIC SUBMIT SWITCH */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-10 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 transition rounded-2xl py-4 font-semibold text-center disabled:opacity-50 shadow-lg shadow-purple-950/40"
        >
          {loading ? "Verifying Credentials..." : "Login"}
        </button>

        {/* FOOTER SWITCH OVER REGISTRATION */}
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-400">New to the platform? </span>
          <Link href="/signup" className="text-purple-400 hover:underline font-medium">Create an Account</Link>
        </div>

      </div>
    </main>
  );
}