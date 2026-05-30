"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
// Import our centralized, safe singleton client instead of creating a new one!
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core Form States matching your exact database columns
  const [orgId, setOrgId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [botToken, setBotToken] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  
  // AI Personalization Split Fields
  const [coreOfferings, setCoreOfferings] = useState("");
  const [faqs, setFaqs] = useState("");
  const [aiTone, setAiTone] = useState("Friendly and casual");

  // Load Real Business Data on Component Mount
  useEffect(() => {
    async function loadSettings() {
      try {
        // 1. Get the authenticated session user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          window.location.href = "/login";
          return;
        }

        // 2. Fetch their business row from the Organisations table using owner_id connection
        const { data: orgData, error: orgError } = await supabase
          .from("Organisations")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle(); // Fallback safely if row compiles asynchronously

        if (orgData) {
          setOrgId(orgData.id);
          
          // Mapping directly to your exact database column names
          setBusinessName(orgData.business_name || ""); 
          setEmail(orgData.email || user.email || ""); 
          setBotToken(orgData.telegram_bot_token || ""); 
          setTelegramUserId(orgData.telegram_user_id || "");
          setCoreOfferings(orgData.core_offerings || "");
          setFaqs(orgData.business_faqs || "");
          setAiTone(orgData.ai_tone || "Friendly and casual");
        }
      } catch (err) {
        console.error("Error loading workspace configurations:", err);
      } finally {
        loading && setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Save Data to Supabase & Re-assemble Gemini Context Prompt
  const handleSaveChanges = async () => {
    if (!orgId) return;
    setSaving(true);

    // Concatenate fields into the master rule system instruction for Gemini 2.5 Flash-lite
    const completeSystemInstruction = `
You are an expert AI customer support agent for ${businessName}.
Our main products/services are: ${coreOfferings}.

Here are our core business logistical operations and guidelines:
${faqs}

Always formulate answers using a ${aiTone} tone of voice. Keep all messages short, concise, and helpful.
`.trim();

    try {
      const { error } = await supabase
        .from("Organisations")
        .update({
          business_name: businessName,
          telegram_bot_token: botToken,
          telegram_user_id: telegramUserId,
          core_offerings: coreOfferings,
          business_faqs: faqs,
          ai_tone: aiTone,
          // If you have a system_instruction column in your database, this saves it perfectly:
          system_instruction: completeSystemInstruction 
        })
        .eq("id", orgId);

      if (error) throw error;
      alert("Settings updated successfully!");
    } catch (err) {
      console.error("Error committing workspace updates:", err);
      alert("Failed to update preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#140b24] flex items-center justify-center text-white">
        <p className="text-xl animate-pulse">Loading dashboard configurations...</p>
      </div>
    );
  }

  return (
    <main className="flex h-screen bg-[#140b24] text-white overflow-hidden relative">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-screen w-64 bg-[#1c1230] border-r border-purple-900/60 p-5 flex flex-col transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex justify-between items-center md:block">
          <div>
            <h1 className="text-2xl font-bold text-purple-300">HustleHelp</h1>
            <p className="text-sm text-gray-400 mt-1">Lighten Your Hustle</p>
          </div>
          <button className="md:hidden text-xl p-2 text-purple-400" onClick={() => setSidebarOpen(false)}>
            ✕
          </button>
        </div>

        <nav className="mt-10 flex flex-col gap-3">
          <Link href="/" className="hover:bg-[#2b1a47] px-4 py-3 rounded-xl text-left transition text-gray-300">
            Customers
          </Link>
          <Link href="/analytics" className="hover:bg-[#2b1a47] px-4 py-3 rounded-xl text-left transition text-gray-300">
            Analytics
          </Link>
          <Link href="/settings" className="bg-purple-600 px-4 py-3 rounded-xl text-left font-medium">
            Settings
          </Link>
        </nav>

        <div className="mt-auto">
          <div className="bg-[#24163d] rounded-2xl p-4 border border-purple-900/40">
            <p className="text-sm text-gray-400">Powered by</p>
            <h2 className="text-lg font-semibold text-purple-300 mt-1">HustleLight</h2>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <section className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* TOP NAVBAR */}
        <div className="sticky top-0 z-30 bg-[#140b24]/95 backdrop-blur-md border-b border-purple-900/50 px-4 md:px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4 min-w-0">
            <button
              className="md:hidden bg-[#24163d] p-2.5 rounded-xl text-lg"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="truncate">
              <h2 className="text-2xl md:text-3xl font-semibold truncate">Settings</h2>
              <p className="text-xs md:text-sm text-gray-400 mt-0.5 hidden sm:block">
                Manage your business preferences and AI personalization engine
              </p>
            </div>
          </div>
          <div className="bg-[#2a1c45] px-4 py-2 rounded-full text-xs md:text-sm font-medium border border-purple-800/40 shadow-inner flex-shrink-0 max-w-[200px] truncate">
            {businessName || "My Organization"}
          </div>
        </div>

        {/* SETTINGS FORMS CONTAINER */}
        <div className="p-4 md:p-6 space-y-6 max-w-5xl w-full mx-auto pb-12">
          
          {/* SECTION 1: CORE BUSINESS PROFILE */}
          <div className="bg-[#1b112d] border border-purple-900/60 rounded-3xl p-5 md:p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-purple-200">Business Information</h3>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm text-gray-300 font-medium">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Shaka Wear"
                  className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition shadow-inner text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 font-medium">Operator Email Address</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full mt-2 bg-[#24163d] border border-purple-950 rounded-2xl px-4 py-3.5 outline-none text-gray-400 text-sm cursor-default"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: AI TRAINING KNOWLEDGE BASE */}
          <div className="bg-[#1b112d] border border-purple-900/60 rounded-3xl p-5 md:p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-purple-200">🤖 AI Personalization</h3>
            <p className="text-xs text-gray-400 mt-1">Train your automated engine on exactly how your company speaks and runs.</p>
            
            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm text-gray-300 font-medium">What does your business sell or do? (Core Offerings)</label>
                <textarea
                  rows={3}
                  value={coreOfferings}
                  onChange={(e) => setCoreOfferings(e.target.value)}
                  placeholder="e.g., We sell custom premium streetwear, graphic hoodies, and accessories. Hoodies cost 350 GHS / 25,000 NGN..."
                  className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-3 outline-none focus:border-purple-500 transition text-sm text-white resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 font-medium">Logistics & Common FAQs (Hours, Location, Shipping)</label>
                <textarea
                  rows={3}
                  value={faqs}
                  onChange={(e) => setFaqs(e.target.value)}
                  placeholder="e.g., Deliveries within Lagos take 24-48 hours. Accra orders ship out on Fridays. We are closed on Sundays."
                  className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-3 outline-none focus:border-purple-500 transition text-sm text-white resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 font-medium">AI Agent Persona Style</label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition text-sm appearance-none cursor-pointer text-purple-300 font-medium"
                >
                  <option value="Professional, corporate and highly formal">👔 Professional & Formal</option>
                  <option value="Friendly, casual, enthusiastic, and uses minor street-style emojis">🔥 Casual & Friendly</option>
                  <option value="Direct, urgent, ultra-short, and hyper-focused on closing sales">⚡ Urgent & Sales Driven</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: TELEGRAM CORE INTEGRATIONS */}
          <div className="bg-[#1b112d] border border-purple-900/60 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start md:items-center gap-3">
              <div>
                <h3 className="text-xl font-semibold text-purple-200">Telegram Integration</h3>
                <p className="text-xs text-gray-400 mt-0.5">Connected multi-tenant gateway configurations</p>
              </div>
              <span className="self-start sm:self-auto bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3.5 py-1.5 rounded-full font-medium tracking-wide">
                ● Connected
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm text-gray-300 font-medium">Live Telegram Bot Token</label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g., 734712345:AAH_ExampleToken..."
                  className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 font-medium">Admin Identifier (User ID)</label>
                <input
                  type="text"
                  value={telegramUserId}
                  onChange={(e) => setTelegramUserId(e.target.value)}
                  placeholder="e.g., 827374838"
                  className="w-full mt-2 bg-[#24163d] border border-purple-900 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition text-sm text-white"
                />
              </div>
            </div>
          </div>

          {/* PERSISTENT MASTER SAVE TRIGGER */}
          <div className="pt-2">
            <button 
              onClick={handleSaveChanges}
              disabled={saving}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed transition-all duration-150 px-10 py-4 rounded-2xl font-semibold shadow-lg text-sm tracking-wide text-white"
            >
              {saving ? "Saving Changes..." : "Save Preferences"}
            </button>
          </div>

        </div>
      </section>
    </main>
  );
}