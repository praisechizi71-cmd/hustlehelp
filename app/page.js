"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // LOAD INDIVIDUAL CUSTOMER CHAT RECORDS
  const loadMessages = async (customerId) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading chat records:", error.message);
      return;
    }
    setMessages(data || []);
  };

  // HIGH-PERFORMANCE SIDEBAR FETCH (Eliminates N+1 Query Loops)
  const fetchDashboardCustomers = async (userId) => {
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select(`
        *,
        messages (
          message,
          created_at
        )
      `)
      .eq("user_id", userId);

    if (customerError) {
      console.error("Sidebar compilation error:", customerError.message);
      return [];
    }

    if (!customerData) return [];

    // Parse data locally inside memory instead of calling the database repeatedly
    const processedCustomers = customerData.map((customer) => {
      const sortedMsgs = customer.messages || [];
      // Sort to find the newest entry
      sortedMsgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      const hasMessage = sortedMsgs.length > 0;
      return {
        ...customer,
        preview: hasMessage ? sortedMsgs[0].message : "No messages yet",
        last_activity: hasMessage ? sortedMsgs[0].created_at : customer.created_at,
        messages: undefined // Clean memory allocation
      };
    });

    // Sort sidebar list dynamically by newest activity
    processedCustomers.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
    setCustomers(processedCustomers);
    return processedCustomers;
  };

  // PERSIST AI MANIPULATION STATES EFFECTIVELY
  const handleToggleAi = async () => {
    if (!selectedCustomer) return;

    const nextPauseState = !selectedCustomer.is_ai_paused;

    // Optimistic mutation tracking for structural latency control
    setSelectedCustomer((prev) => ({ ...prev, is_ai_paused: nextPauseState }));
    setCustomers((prevList) =>
      prevList.map((c) =>
        c.id === selectedCustomer.id ? { ...c, is_ai_paused: nextPauseState } : c
      )
    );

    const { error } = await supabase
      .from("customers")
      .update({ is_ai_paused: nextPauseState })
      .eq("id", selectedCustomer.id);

    if (error) {
      console.error("Database fallback triggered:", error.message);
      // Revert states cleanly if transaction terminates abruptly
      setSelectedCustomer((prev) => ({ ...prev, is_ai_paused: !nextPauseState }));
      if (user) await fetchDashboardCustomers(user.id);
    }
  };

  // MANUAL REPLY MANAGEMENT
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedCustomer || sending || !selectedCustomer.is_ai_paused) return;

    setSending(true);
    const messageToSend = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          customer_id: selectedCustomer.id,
          message: messageToSend,
          sender: "admin",
        },
      ]);

    if (error) {
      console.error("Failed to append admin string output:", error.message);
      setNewMessage(messageToSend); 
    } else {
      if (user) await fetchDashboardCustomers(user.id);
    }
    setSending(false);
  };

  // INITIAL AUTH VERIFICATION BLOCK
  useEffect(() => {
    const initializeSession = async () => {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      setUser(userData.user);
      const sortedList = await fetchDashboardCustomers(userData.user.id);

      if (sortedList && sortedList.length > 0) {
        setSelectedCustomer(sortedList[0]);
      }
      setLoading(false);
    };

    initializeSession();
  }, [router]);

  // ISOLATED CLEAN WEBHOOK SUBSCRIPTION ENGINE
  useEffect(() => {
    if (!selectedCustomer || !user) return;

    loadMessages(selectedCustomer.id);

    const channel = supabase
      .channel(`messages-room-${selectedCustomer.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          if (payload.new && payload.new.customer_id === selectedCustomer.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
          // Soft refreshes dashboard elements asynchronously
          await fetchDashboardCustomers(user.id);
        }
      )
      .subscribe();

    // Clean teardown prevents background thread overload inside browser tabs
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCustomer?.id, user?.id]);

  return (
    <main className="h-screen w-screen bg-[#140b24] text-white flex overflow-hidden select-none">
      
      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed md:relative top-0 left-0 z-50 h-full w-64 bg-[#1c1230] border-r border-purple-900 p-5 flex flex-col transform transition-transform duration-300 flex-shrink-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <h1 className="text-2xl font-bold text-purple-300">HustleHelp</h1>
        <p className="text-sm text-gray-400 mt-1">Lighten Your Hustle</p>

        <nav className="mt-10 flex flex-col gap-3">
          <Link href="/" className="bg-purple-600 px-4 py-3 rounded-xl font-medium">
            Customers
          </Link>
          <Link href="/analytics" className="hover:bg-[#2b1a47] px-4 py-3 rounded-xl transition text-gray-300 hover:text-white">
            Analytics
          </Link>
          <Link href="/settings" className="hover:bg-[#2b1a47] px-4 py-3 rounded-xl transition text-gray-300 hover:text-white">
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

      {/* MAIN CONTAINER */}
      <section className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP HEADER */}
        <div className="border-b border-purple-900 px-4 md:px-6 py-4 flex justify-between items-center bg-[#180f2a] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-2xl text-purple-300" onClick={() => setMobileMenuOpen(true)}>
              ☰
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-semibold">Customer Dashboard</h2>
              <p className="text-xs md:text-sm text-gray-400 mt-1">Track customer conversations</p>
            </div>
          </div>
          <div className="bg-[#2a1c45] border border-purple-900/60 px-4 py-2 rounded-full text-xs md:text-sm text-purple-300 font-medium">
            {user?.user_metadata?.business_name || "Active Session"}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-purple-400 font-medium animate-pulse">Loading workspace vectors...</div>
          </div>
        ) : (
          <>
            {/* DESKTOP VIEWPORT LAYER */}
            <div className="hidden lg:flex flex-1 w-full h-full overflow-hidden">
              
              {/* SIDEBAR SELECTOR */}
              <div className="w-80 border-r border-purple-900 overflow-y-auto bg-[#170f29] flex-shrink-0 h-full">
                <div className="p-4 border-b border-purple-900 sticky top-0 bg-[#170f29] z-10">
                  <h3 className="font-semibold text-purple-300">Active Handlers</h3>
                </div>

                <div className="p-4 space-y-4">
                  {customers.length === 0 && (
                    <div className="bg-[#211537] p-6 rounded-2xl text-center text-gray-400 border border-purple-900/20">
                      No customers managed yet
                    </div>
                  )}

                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                      }}
                      className={`p-4 rounded-2xl cursor-pointer transition border ${
                        selectedCustomer?.id === customer.id
                          ? "bg-purple-700 border-purple-500 shadow-lg shadow-purple-950/50"
                          : "bg-[#211537] border-transparent hover:bg-[#2b1a47]"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">{customer.name}</h3>
                        {customer.is_ai_paused && (
                          <span className="text-xs bg-amber-600/30 text-amber-400 px-2 py-0.5 rounded-md font-medium border border-amber-500/20">
                            Manual
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 mt-2 truncate">
                        {customer.preview}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIMELINE VIEWPORT */}
              <div className="flex-1 flex flex-col bg-[#140b24] h-full overflow-hidden">
                {selectedCustomer ? (
                  <>
                    <div className="border-b border-purple-900 px-6 py-4 flex justify-between items-center flex-shrink-0 bg-[#140b24]">
                      <h3 className="text-xl font-semibold text-purple-200">{selectedCustomer.name}</h3>
                      
                      <button
                        onClick={handleToggleAi}
                        className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition duration-200 ${
                          selectedCustomer.is_ai_paused 
                            ? "bg-green-600 hover:bg-green-700 text-white shadow-md" 
                            : "bg-[#2a1c45] hover:bg-purple-900 text-purple-300 border border-purple-800"
                        }`}
                      >
                        {selectedCustomer.is_ai_paused ? <><span>▶</span> Resume AI</> : <><span>⏸</span> Pause AI</>}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#120921]">
                      {messages.length === 0 && (
                        <div className="text-gray-400 text-center mt-10">
                          No text logs captured yet
                        </div>
                      )}

                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`px-5 py-4 rounded-3xl max-w-md break-words text-sm shadow-sm ${
                              msg.sender === "customer" ? "bg-[#2a1c45] rounded-bl-none" : "bg-purple-700 rounded-br-none"
                            }`}
                          >
                            {msg.message}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* INPUT/FOOTER CONTROLS */}
                    <div className="border-t border-purple-900 p-4 bg-[#180f2a] flex-shrink-0 grid grid-cols-3 gap-4">
                      <div className="bg-[#24163d] border border-purple-900/40 rounded-2xl px-4 py-3 flex items-center justify-start select-none">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${selectedCustomer.is_ai_paused ? "bg-amber-500" : "bg-green-400 animate-pulse"}`}></span>
                          <p className={`text-xs font-medium ${selectedCustomer.is_ai_paused ? "text-amber-400" : "text-gray-400"}`}>
                            {selectedCustomer.is_ai_paused ? "AI Handoff Active" : "AI Routing Engaged"}
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleSendMessage} className="col-span-2 flex gap-2">
                        <input
                          type="text"
                          placeholder={selectedCustomer.is_ai_paused ? "Type your manual reply here..." : "AI control active — manual inputs locked"}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          disabled={sending || !selectedCustomer.is_ai_paused}
                          className={`flex-1 bg-[#1e1336] border border-purple-950 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600 text-sm transition-all ${
                            !selectedCustomer.is_ai_paused ? "opacity-40 cursor-not-allowed bg-[#180f2a]" : ""
                          }`}
                        />
                        <button
                          type="submit"
                          disabled={sending || !newMessage.trim() || !selectedCustomer.is_ai_paused}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/20 disabled:text-gray-600 transition px-6 py-3 rounded-2xl font-semibold text-sm flex-shrink-0 disabled:cursor-not-allowed"
                        >
                          {sending ? "..." : "Send →"}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    Select a core vector node to view stream
                  </div>
                )}
              </div>
            </div>

            {/* MOBILE VIEWPORT SYSTEM */}
            <div className="lg:hidden flex-1 overflow-hidden h-full">
              {!mobileChatOpen && (
                <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#140b24]">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setMobileChatOpen(true);
                      }}
                      className="bg-[#211537] p-4 rounded-2xl flex justify-between items-start border border-purple-900/20"
                    >
                      <div className="flex-1 truncate pr-2">
                        <h3 className="font-semibold text-purple-200">{customer.name}</h3>
                        <p className="text-sm text-gray-400 mt-2 truncate">{customer.preview}</p>
                      </div>
                      {customer.is_ai_paused && (
                        <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded-md font-medium border border-amber-500/10 flex-shrink-0">
                          Manual
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mobileChatOpen && selectedCustomer && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="border-b border-purple-900 p-4 flex items-center justify-between flex-shrink-0 bg-[#140b24]">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMobileChatOpen(false)} className="bg-[#24163d] px-3 py-2 rounded-xl text-sm font-medium border border-purple-900/30 text-purple-300">
                        ← Back
                      </button>
                      <h3 className="font-semibold text-sm max-w-[120px] truncate">{selectedCustomer.name}</h3>
                    </div>

                    <button
                      onClick={handleToggleAi}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold ${selectedCustomer.is_ai_paused ? "bg-green-600 text-white" : "bg-[#2a1c45] text-purple-300 border border-purple-800"}`}
                    >
                      {selectedCustomer.is_ai_paused ? "▶ Resume" : "⏸ Pause"}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#120921]">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}>
                        <div className={`px-4 py-3 rounded-3xl max-w-xs break-words text-sm ${msg.sender === "customer" ? "bg-[#2a1c45] rounded-bl-none" : "bg-purple-700 rounded-br-none"}`}>
                          {msg.message}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="border-t border-purple-900 p-3 bg-[#180f2a] flex-shrink-0 space-y-2">
                    <div className="bg-[#24163d] rounded-xl px-3 py-1.5 flex items-center gap-2 select-none">
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedCustomer.is_ai_paused ? "bg-amber-500" : "bg-green-400 animate-pulse"}`}></span>
                      <p className="text-xs text-gray-400 font-medium">{selectedCustomer.is_ai_paused ? "AI Handoff Active" : "AI Loop Tracking"}</p>
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={selectedCustomer.is_ai_paused ? "Type a message..." : "Manual inputs locked"}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={sending || !selectedCustomer.is_ai_paused}
                        className={`flex-1 bg-[#1e1336] border border-purple-950 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 text-xs focus:outline-none ${
                          !selectedCustomer.is_ai_paused ? "opacity-40 cursor-not-allowed" : ""
                        }`}
                      />
                      <button 
                        type="submit" 
                        disabled={sending || !newMessage.trim() || !selectedCustomer.is_ai_paused} 
                        className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs disabled:bg-purple-900/20 disabled:text-gray-600 disabled:cursor-not-allowed"
                      >
                        {sending ? "..." : "Send"}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}