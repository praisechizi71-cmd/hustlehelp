"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const handleContinue = async () => {
    if (!businessName || !email || !password) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);

    // Dynamic environmental redirect tracking
    const redirectUrl = window.location.origin + "/login";

    // CREATE AUTH USER WITH DATA METADATA PASSED IN
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl, // Forces Supabase to land back here gracefully
        data: {
          business_name: businessName,
          telegram_bot_token: telegramBotToken,
          telegram_user_id: telegramUserId,
        },
      },
    });

    if (error) {
      console.error(error);
      alert(error.message);
      setLoading(false);
      return;
    }

    // CREATE ORGANISATION ENTRY SAFELY LINKED
    if (data.user) {
      const { error: organisationError } = await supabase
        .from("Organisations")
        .insert([
          {
            owner_id: data.user.id,
            business_name: businessName,
            email: email.toLowerCase().trim(),
            telegram_bot_token: telegramBotToken || null,
            telegram_user_id: telegramUserId || null,
            credit_balance: 0, // Explicitly initialised for payment wallet security
          },
        ]);

      if (organisationError) {
        console.error("Database row insert error:", organisationError);
        alert(`Authentication succeeded but profile build failed: ${organisationError.message}`);
        setLoading(false);
        return;
      }
    }

    // STATE SUCCESS FLAG ENGINE
    setSuccessMessage(true);
    
    // CLEAR FORM RETAINING APP SAFETY
    setBusinessName("");
    setEmail("");
    setPassword("");
    setTelegramBotToken("");
    setTelegramUserId("");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#140b24] text-white grid lg:grid-cols-2">
      
      {/* LEFT SIDE: MARKETING DECK */}
      <section className="hidden lg:flex flex-col justify-center px-16 bg-[#1b112d] border-r border-purple-900">
        <div className="max-w-lg">
          <h1 className="text-5xl font-bold text-purple-300 leading-tight">HustleHelp</h1>
          <p className="mt-4 text-xl text-gray-300">Lighten Your Hustle</p>
          <p className="mt-10 text-gray-400 leading-8 text-lg">
            Manage customer conversations, automate business responses, track engagement and organize customer communication from one simple dashboard.
          </p>

          <div className="mt-12 space-y-5">
            <div className="bg-[#24163d] p-5 rounded-2xl">
              <h3 className="font-semibold text-lg">Faster Customer Replies</h3>
              <p className="text-gray-400 mt-2 text-sm">
                Respond to customers quickly without manually handling every conversation.
              </p>
            </div>

            <div className="bg-[#24163d] p-5 rounded-2xl">
              <h3 className="font-semibold text-lg">Organized Customer Management</h3>
              <p className="text-gray-400 mt-2 text-sm">
                Track active customers, pending responses and escalated conversations.
              </p>
            </div>

            <div className="bg-[#24163d] p-5 rounded-2xl">
              <h3 className="font-semibold text-lg">Built For Growing Businesses</h3>
              <p className="text-gray-400 mt-2 text-sm">
                Designed for modern businesses that value fast customer communication.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE: UTILITY SIGNUP FORM */}
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md bg-[#1c1230] border border-purple-900 rounded-3xl p-8">
          
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-4xl font-bold text-purple-300">HustleHelp</h1>
            <p className="text-gray-400 mt-2">Lighten Your Hustle</p>
          </div>

          {successMessage ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">📩</div>
              <h2 className="text-2xl font-bold text-purple-300">Verify Your Identity</h2>
              <p className="text-gray-300 text-sm leading-6">
                We have transmitted a secure confirmation token to your inbox. Please click the validation link inside your email to activate your workspace dashboard.
              </p>
              <button 
                onClick={() => setSuccessMessage(false)} 
                className="mt-6 text-sm font-medium text-purple-400 hover:underline"
              >
                ← Back to registration form
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold">Welcome</h2>
              <p className="text-gray-400 mt-2">Connect your business and continue to your dashboard.</p>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="text-sm text-gray-300">Business Name</label>
                  <input
                    type="text"
                    placeholder="Praise Enterprise"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-4 outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-300">Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-4 outline-none focus:border-purple-500"
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
                      className="w-full bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-4 pr-14 outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-purple-300"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <h3 className="font-semibold">Connect Platforms</h3>
                <p className="text-sm text-gray-400 mt-2">Link your communication channels to begin managing customer conversations.</p>

                <div className="mt-5 space-y-4">
                  <div className="bg-[#24163d] border border-purple-900 rounded-2xl p-4">
                    <button onClick={() => setTelegramOpen(!telegramOpen)} className="w-full text-left">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{telegramOpen ? "Back" : "Connect Telegram"}</span>
                        <span className="text-sm text-green-400">Available</span>
                      </div>
                    </button>

                    {telegramOpen && (
                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="text-sm text-gray-300">Telegram Bot Token</label>
                          <input
                            type="text"
                            placeholder="Paste Bot Token"
                            value={telegramBotToken}
                            onChange={(e) => setTelegramBotToken(e.target.value)}
                            className="w-full mt-2 bg-[#1a102c] border border-purple-900 rounded-xl px-4 py-3 outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="text-sm text-gray-300">Telegram User ID</label>
                          <input
                            type="text"
                            placeholder="Paste Telegram User ID"
                            value={telegramUserId}
                            onChange={(e) => setTelegramUserId(e.target.value)}
                            className="w-full mt-2 bg-[#1a102c] border border-purple-900 rounded-xl px-4 py-3 outline-none focus:border-purple-500"
                          />
                        </div>

                        <div className="bg-[#1a102c] border border-purple-900 rounded-xl p-4 text-sm text-gray-400 leading-7">
                          <p>1. Open Telegram</p>
                          <p>2. Search for BotFather</p>
                          <p>3. Send /newbot</p>
                          <p>4. Create your bot</p>
                          <p>5. Copy the Bot Token and paste it here</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button className="w-full bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-4 flex justify-between items-center cursor-not-allowed opacity-50">
                    <span>Connect WhatsApp</span>
                    <span className="text-red-400 text-sm">Coming Soon</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleContinue}
                disabled={loading}
                className="w-full mt-10 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 transition rounded-2xl py-4 font-semibold text-center disabled:opacity-50 shadow-lg shadow-purple-950/50"
              >
                {loading ? "Creating Account..." : "Continue To Dashboard"}
              </button>

              <div className="mt-6 text-center text-sm">
                <span className="text-gray-400">Already have an account? </span>
                <Link href="/login" className="text-purple-400 hover:underline font-medium">Log In</Link>
              </div>
            </>
          )}

          <p className="text-center text-gray-500 text-sm mt-8">Powered by HustleLight</p>
        </div>
      </section>

    </main>
  );
}