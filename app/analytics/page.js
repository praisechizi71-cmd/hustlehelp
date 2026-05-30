"use client";

import Link from "next/link";
import Script from "next/script"; 
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AnalyticsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("Loading...");
  const [userEmail, setUserEmail] = useState(""); 
  
  // Real Database Operational States
  const [currentOrgId, setCurrentOrgId] = useState(""); // Tracked for secure metadata payloads
  const [creditBalance, setCreditBalance] = useState(0); 
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalAiMessages, setTotalAiMessages] = useState(0);
  const [escalatedChats, setEscalatedChats] = useState(0);
  const [convertedPurchases, setConvertedPurchases] = useState(0);

  useEffect(() => {
    async function loadRealAnalytics() {
      try {
        // 1. Fetch the logged-in user session safely
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          window.location.href = "/login";
          return;
        }

        setUserEmail(user.email || ""); 

        // 2. Fetch the organization info 
        const { data: orgData } = await supabase
          .from("Organisations")
          .select("id, business_name, credit_balance")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (orgData) {
          setCurrentOrgId(orgData.id);
          setBusinessName(orgData.business_name || "My Organization");
          setCreditBalance(orgData.credit_balance || 0);

          // 3. Optimized data counters running cleanly in parallel
          const [customersCount, aiMessagesCount, escalatedCount, convertedCount] = await Promise.all([
            supabase
              .from("customers")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id),

            // FIXED: Clean inner join count syntax for messages mapping
            supabase
              .from("messages")
              .select("id, customers!inner(user_id)", { count: "exact" })
              .eq("sender", "ai")
              .eq("customers.user_id", user.id)
              .limit(1), // Lean query boundary instead of crashing header keys

            supabase
              .from("customers")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("is_ai_paused", true),

            supabase
              .from("customers")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("status", "Converted") 
          ]);

          setTotalCustomers(customersCount.count || 0);
          setTotalAiMessages(aiMessagesCount.count || 0);
          setEscalatedChats(escalatedCount.count || 0);
          setConvertedPurchases(convertedCount.count || 0);
        }
      } catch (err) {
        console.error("Error executing database calculations:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRealAnalytics();
  }, []);

  // --- WALLET CHECKOUT ENGINE ---
  const handlePaystackCheckout = () => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (isMobileDevice) {
      alert("Redirecting securely to your browser workspace to complete wallet authentication...");
      window.open("https://hustlehelp.com/analytics", "_blank");
      return;
    }

    if (!window.PaystackPop) {
      alert("Securing payment portal connection... please try clicking again in 2 seconds!");
      return;
    }

    const userInput = prompt("Enter the number of credits you want to purchase:\n(Minimum: 500 Credits = ₦1,000\nMaximum: 25,000 Credits = ₦50,000)", "500");
    if (userInput === null) return; 
    
    const creditsToBuy = parseInt(userInput, 10);

    if (isNaN(creditsToBuy) || creditsToBuy < 500 || creditsToBuy > 25000) {
      alert("❌ Invalid Credit Range!\n\nYour purchase bundle must be between 500 Credits (₦1,000) and 25,000 Credits (₦50,000).");
      return;
    }

    const pricePerCredit = 2; 
    const totalAmountAmount = creditsToBuy * pricePerCredit; 

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, 
      email: userEmail || "billing@hustlehelp.com",
      amount: totalAmountAmount * 100, // Scaled to Kobo
      currency: "NGN",
      // FIXED: Metadata payload bound cleanly to match secure API backend logic
      metadata: {
        orgId: currentOrgId,
        tierCredits: creditsToBuy
      },
      callback: async function (response) {
        try {
          const verifyRes = await fetch("/api/paystack/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reference: response.reference,
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setCreditBalance(verifyData.newBalance);
            alert(`⚡ Top-up successful! Added ${creditsToBuy.toLocaleString()} Credits to your wallet.`);
          } else {
            alert(`Verification Error: ${verifyData.error}`);
          }
        } catch (err) {
          console.error("Verification processing failed:", err);
        }
      },
      onClose: function () {
        console.log("Vendor window cancelled payment gateway session.");
      },
    });

    handler.openIframe();
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#140b24] flex items-center justify-center text-white">
        <p className="text-xl animate-pulse">Calculating real-time workspace metrics...</p>
      </div>
    );
  }

  return (
    <main className="flex h-screen bg-[#140b24] text-white overflow-hidden relative">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-screen w-64 bg-[#1c1230] border-r border-purple-900/60 p-5 flex flex-col transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`} >
        <div>
          <h1 className="text-2xl font-bold text-purple-300">HustleHelp</h1>
          <p className="text-sm text-gray-400 mt-1">Lighten Your Hustle</p>
        </div>
        <nav className="mt-10 flex flex-col gap-3">
          <Link href="/" className="hover:bg-[#2b1a47] px-4 py-3 rounded-xl text-left transition text-gray-300">Customers</Link>
          <Link href="/analytics" className="bg-purple-600 px-4 py-3 rounded-xl text-left font-medium">Analytics</Link>
          <Link href="/settings" className="hover:bg-[#2b1a47] px-4 py-3 rounded-xl text-left transition text-gray-300">Settings</Link>
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
        
        {/* TOP BAR */}
        <div className="sticky top-0 z-30 bg-[#140b24]/95 backdrop-blur-md border-b border-purple-900/50 px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4 min-w-0">
            <button className="md:hidden bg-[#24163d] p-2.5 rounded-xl text-lg" onClick={() => setSidebarOpen(true)}>☰</button>
            <div>
              <h2 className="text-3xl font-semibold">Analytics</h2>
              <p className="text-sm text-gray-400 mt-1 hidden sm:block">Track customer activity and business performance</p>
            </div>
          </div>
          <div className="bg-[#2a1c45] px-4 py-2 rounded-full text-xs md:text-sm font-medium border border-purple-800/40 truncate max-w-[200px]">
            {businessName}
          </div>
        </div>

        {/* CONTENT PACK */}
        <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">

          {/* DYNAMIC CREDITS WALLET SYSTEM */}
          <div className="bg-gradient-to-r from-[#20113b] to-[#2a1452] border border-purple-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div>
                <span className="text-xs font-semibold tracking-wider text-purple-300 uppercase bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
                  Automation Credit Wallet
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-3">
                <h3 className="text-4xl font-black tracking-tight text-white">
                  {creditBalance.toLocaleString()}
                </h3>
                <p className="text-sm text-purple-300 font-medium">Available Credits</p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                1 credit is consumed for every conversation response handled by your AI agent.
              </p>
            </div>
            <button 
              onClick={handlePaystackCheckout}
              className="w-full md:w-auto bg-purple-600 hover:bg-purple-500 active:bg-purple-700 transition font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-purple-900/40 text-sm flex items-center justify-center gap-2"
            >
              ⚡ Purchase Automation Credits
            </button>
          </div>

          {/* TOP STATS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="bg-[#1b112d] rounded-3xl p-6 border border-purple-900/60 shadow-md">
              <p className="text-gray-400 text-sm font-medium">Total Customers</p>
              <h3 className="text-4xl font-bold mt-4 tracking-tight">{totalCustomers.toLocaleString()}</h3>
            </div>

            <div className="bg-[#1b112d] rounded-3xl p-6 border border-purple-900/60 shadow-md">
              <p className="text-gray-400 text-sm font-medium">AI Managed Messages</p>
              <h3 className="text-4xl font-bold mt-4 tracking-tight text-purple-400">{totalAiMessages.toLocaleString()}</h3>
            </div>

            <div className="bg-[#1b112d] rounded-3xl p-6 border border-purple-900/60 shadow-md">
              <p className="text-gray-400 text-sm font-medium">Escalated to Human</p>
              <h3 className="text-4xl font-bold mt-4 tracking-tight text-red-400">{escalatedChats.toLocaleString()}</h3>
            </div>

            <div className="bg-[#1b112d] rounded-3xl p-6 border border-purple-900/60 shadow-md">
              <p className="text-gray-400 text-sm font-medium">Converted Purchases</p>
              <h3 className="text-4xl font-bold mt-4 tracking-tight text-green-400">{convertedPurchases.toLocaleString()}</h3>
            </div>
          </div>

          {/* CHART AREA */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* SEGMENT VISUALIZATION */}
            <div className="bg-[#1b112d] rounded-3xl p-6 border border-purple-900/60 shadow-md flex flex-col justify-between">
              <h3 className="text-xl font-semibold text-purple-200">Customer Conversion Segments</h3>
              <div className="my-6">
                <div className="w-full h-5 rounded-full bg-[#24163d] overflow-hidden flex border border-purple-950">
                  <div className="bg-purple-500 h-full" style={{ width: `${totalCustomers ? (convertedPurchases / totalCustomers) * 100 : 0}%` }}></div>
                  <div className="bg-red-400 h-full" style={{ width: `${totalCustomers ? (escalatedChats / totalCustomers) * 100 : 0}%` }}></div>
                </div>
              </div>
              <div className="space-y-3 w-full">
                <div className="flex items-center justify-between border-b border-purple-950/40 pb-2">
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <div className="w-3.5 h-3.5 bg-purple-500 rounded-full"></div>
                    <span>Converted Users</span>
                  </div>
                  <span className="font-semibold">{convertedPurchases}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <div className="w-3.5 h-3.5 bg-red-400 rounded-full"></div>
                    <span>Escalated (Manual Attention)</span>
                  </div>
                  <span className="font-semibold">{escalatedChats}</span>
                </div>
              </div>
            </div>

            {/* WEEKLY REPLICATED TRACKER */}
            <div className="bg-[#1b112d] rounded-3xl p-6 border border-purple-900/60 shadow-md">
              <h3 className="text-xl font-semibold text-purple-200">Weekly Interaction Activity</h3>
              <div className="mt-8 flex items-end gap-2.5 sm:gap-3 h-56">
                <div className="bg-purple-500/80 rounded-t-xl w-full h-20 transition-all hover:bg-purple-500"></div>
                <div className="bg-purple-500/80 rounded-t-xl w-full h-40 transition-all hover:bg-purple-500"></div>
                <div className="bg-purple-500/80 rounded-t-xl w-full h-28 transition-all hover:bg-purple-500"></div>
                <div className="bg-purple-500/80 rounded-t-xl w-full h-48 transition-all hover:bg-purple-500"></div>
                <div className="bg-purple-500/80 rounded-t-xl w-full h-36 transition-all hover:bg-purple-500"></div>
                <div className="bg-purple-500/80 rounded-t-xl w-full h-44 transition-all hover:bg-purple-500"></div>
                <div className="bg-purple-500/80 rounded-t-xl w-full h-52 transition-all hover:bg-purple-500"></div>
              </div>
              <div className="mt-4 flex justify-between text-xs font-medium text-gray-400 px-1">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Paystack JavaScript Modal Engine CDN */}
      <Script 
        src="https://js.paystack.co/v1/inline.js" 
        strategy="lazyOnload" 
      />
    </main>
  );
}