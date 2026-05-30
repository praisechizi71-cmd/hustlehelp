import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

// Initialize Supabase with Service Role to bypass RLS policies safely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini exactly how the modern SDK requires
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("Incoming Telegram Body:", body);

    const message = body.message;

    // If it's a background event from Telegram without a text message, close safely
    if (!message) {
      return NextResponse.json({ success: true });
    }

    const telegramChatId = message.chat.id.toString();
    const customerName = `${message.from.first_name || ""} ${message.from.last_name || ""}`.trim();
    const customerMessage = message.text || "";

    // --- FIND WHICH USER OWNS THIS TELEGRAM BOT ---
    const { searchParams } = new URL(req.url);
    const botTokenParam = searchParams.get("token"); 

    let assignedUserId = null;
    let businessId = null;
    let currentCredits = 0;
    
    // Fallback template defaults just in case a new organisation row is completely blank
    let systemInstruction = "You are a helpful customer support assistant.";

    // Look up the owner and their split business settings in the Organisations table
    if (botTokenParam) {
      const { data: orgData } = await supabase
        .from("Organisations")
        .select("id, owner_id, business_name, core_offerings, business_faqs, ai_tone, credit_balance")
        .eq("telegram_bot_token", botTokenParam)
        .maybeSingle(); // Safer execution fallback than .single()
      
      if (orgData) {
        businessId = orgData.id;
        assignedUserId = orgData.owner_id;
        currentCredits = orgData.credit_balance || 0;
        
        const bName = orgData.business_name || "our company";
        const offerings = orgData.core_offerings || "Premium products and helpful assistance.";
        const faqs = orgData.business_faqs || "Standard delivery terms and retail operating timelines.";
        const tone = orgData.ai_tone || "Friendly and casual";

        systemInstruction = `
You are an expert AI customer support representative working directly for ${bName}. 
Your primary job is to attend to incoming retail customers, answer their questions, and help them place orders. 
Do NOT offer general business startup advice or treat the customer like a business owner. You represent the brand.

Here is what our company sells/does (Core Offerings):
${offerings}

Here are our operational guidelines, locations, shipping fees, and logistics rules (FAQs):
${faqs}

Strictly communicate using a ${tone} tone of voice. Keep your responses natural, ultra-short, concise, and focused on helping the customer finish their transaction.
`.trim();
      }
    }

    // CHECK IF CUSTOMER ALREADY EXISTS
    let { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("telegram_chat_id", telegramChatId)
      .maybeSingle();

    // CREATE CUSTOMER IF THEY DO NOT EXIST
    if (!customer) {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert([
          {
            name: customerName,
            telegram_chat_id: telegramChatId,
            last_message: customerMessage,
            status: "Hot",
            user_id: assignedUserId,
            is_ai_paused: false // Uses explicit boolean initialization safely
          },
        ])
        .select()
        .single();

      if (customerError) {
        console.log("Customer Creation Error:", customerError);
        return NextResponse.json({ success: false });
      }

      customer = newCustomer;
    }

    // SAVE THE INCOMING MESSAGE TO THE MESSAGES TABLE
    const { error: messageError } = await supabase
      .from("messages")
      .insert([
        {
          customer_id: customer.id,
          sender: "customer",
          message: customerMessage,
        },
      ]);

    if (messageError) {
      console.log("Message Insertion Error:", messageError);
    }

    // UPDATE THE CUSTOMER'S LAST MESSAGE TIMESTAMP
    await supabase
      .from("customers")
      .update({
        last_message: customerMessage,
        last_message_time: new Date(),
      })
      .eq("id", customer.id);

    // =================================================================
    // 🤖 AI AUTOMATION ENGINE TRIGGER & CREDIT VALIDATION
    // =================================================================
    
    // 1. Check if human manual override takeover is active
    if (customer.is_ai_paused === true) {
      console.log(`Manual override active for ${customerName}. Skipping AI response.`);
      return NextResponse.json({ success: true }); // Return true so Telegram stops retrying webhook
    }

    // 2. 🛑 CREDIT CHECK WALL: Stop execution if account balance is exhausted
    if (currentCredits <= 0) {
      console.log(`Business account out of credits (${currentCredits}). Muting AI assistant.`);
      
      // Optional: Inform the customer or notify the vendor admin that credits are depleted
      if (botTokenParam) {
        const warningUrl = `https://api.telegram.org/bot${botTokenParam}/sendMessage`;
        await fetch(warningUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: "Hello! We are currently experiencing a brief technical update. Our team will get back to you shortly.",
          }),
        });
      }
      return NextResponse.json({ success: true });
    }

    // 3. Fetch conversational history context so Gemini stays tracking
    const { data: chatHistory } = await supabase
      .from("messages")
      .select("sender, message")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(6);

    const cleanHistory = chatHistory
      ? chatHistory.reverse().map(m => `${m.sender}: ${m.message}`).join("\n")
      : "";

    // 4. Generate responses using the clean official SDK structure for gemini-2.5-flash-lite
    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
Recent Chat Context:
${cleanHistory}

New Customer Message: "${customerMessage}"
AI Reply:
      `.trim(),
      config: {
        // Keeps user prompt separated completely away from structural code directives
        systemInstruction: systemInstruction,
      }
    });

    const aiReplyText = aiResponse.text;

    // 5. Dispatch the response out via Telegram Bot API
    if (botTokenParam && aiReplyText) {
      const telegramUrl = `https://api.telegram.org/bot${botTokenParam}/sendMessage`;
      await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: aiReplyText,
        }),
      });

      // 6. Log the AI response down into your messages table
      await supabase.from("messages").insert([
        {
          customer_id: customer.id,
          sender: "ai",
          message: aiReplyText,
        },
      ]);

      // 7. 📉 DEDUCT ONE AUTOMATION CREDIT LIVE FROM YOUR DATABASE TABLE
      if (businessId) {
        await supabase
          .from("Organisations")
          .update({ credit_balance: currentCredits - 1 })
          .eq("id", businessId);
        
        console.log(`Deducted 1 credit for Business ID ${businessId}. New Balance: ${currentCredits - 1}`);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.log("Global Webhook Error:", error);
    // Return true to Telegram on managed errors so it doesn't endlessly slam your endpoint with the same payload
    return NextResponse.json({ success: true }); 
  }
}