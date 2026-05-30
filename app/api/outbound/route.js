import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const payload = await req.json();
    const dataRow = payload.record || payload.new;
    
    if (!dataRow) {
      // Return 200 so the Supabase webhook engine doesn't endlessly retry an empty payload
      return NextResponse.json({ error: "No payload record found" }, { status: 200 });
    }

    // GUARD: Only handle manual messages typed by the admin dashboard operator
    if (dataRow.sender !== "admin") {
      return NextResponse.json({ message: "Skipping: Not an admin message" }, { status: 200 });
    }

    // 1. Fetch customer details to get the telegram_chat_id AND user_id (dashboard owner)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("telegram_chat_id, user_id")
      .eq("id", dataRow.customer_id)
      .maybeSingle(); // Safe structural boundary check

    if (customerError || !customer?.telegram_chat_id) {
      console.error("Could not find customer profile or chat ID:", customerError);
      return NextResponse.json({ error: "Customer validation failed" }, { status: 200 });
    }

    // 2. Look up the dynamic token in your Organisations table matching that dashboard user
    const { data: orgData, error: orgError } = await supabase
      .from("Organisations")
      .select("telegram_bot_token")
      .eq("owner_id", customer.user_id)
      .maybeSingle(); // Safe structural boundary check

    if (orgError || !orgData?.telegram_bot_token) {
      console.error("Could not find a valid bot token for this business owner:", orgError);
      return NextResponse.json({ error: "Missing organization bot token" }, { status: 200 });
    }

    // 3. Dispatch the message directly to the official Telegram Bot API endpoint
    const telegramUrl = `https://api.telegram.org/bot${orgData.telegram_bot_token}/sendMessage`;
    
    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: customer.telegram_chat_id,
        text: dataRow.message,
      }),
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      console.error("Telegram API delivery failed:", telegramResult);
      return NextResponse.json({ error: "Telegram rejection" }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: "Dispatched to Telegram safely!" });
  } catch (error) {
    console.error("Global Outbound Webhook Error:", error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}