import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with Service Role to update balances securely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { reference } = await req.json();

    if (!reference) {
      return NextResponse.json({ success: false, error: "Missing transaction reference" }, { status: 400 });
    }

    // 1. Double-check with Paystack's secure servers using your hidden Secret Key
    const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const paystackResponse = await fetch(paystackUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const paymentData = await paystackResponse.json();

    // 2. Validate Paystack's structural status response
    if (!paymentData.status || paymentData.data.status !== "success") {
      return NextResponse.json({ success: false, error: "Payment verification failed or pending" }, { status: 400 });
    }

    // 3. Extract the locked details straight from Paystack's verified metadata object
    // Pass this metadata when triggering the Paystack popup on your frontend:
    // metadata: { orgId: orgId, tierCredits: 1000 }
    const verifiedOrgId = paymentData.data.metadata?.orgId;
    const verifiedCredits = Number(paymentData.data.metadata?.tierCredits);

    if (!verifiedOrgId || !verifiedCredits) {
      console.error("Paystack verified metadata fields are missing:", paymentData.data.metadata);
      return NextResponse.json({ success: false, error: "Invalid transaction metadata tracking" }, { status: 400 });
    }

    // 4. Fetch their existing balance using the secure metadata ID
    const { data: orgData, error: orgError } = await supabase
      .from("Organisations")
      .select("id, credit_balance")
      .eq("id", verifiedOrgId)
      .maybeSingle();

    if (orgError || !orgData) {
      return NextResponse.json({ success: false, error: "Organization profile not found" }, { status: 404 });
    }

    const currentBalance = orgData.credit_balance || 0;

    // 5. Update their live wallet balance safely inside Supabase
    const { error: updateError } = await supabase
      .from("Organisations")
      .update({ credit_balance: currentBalance + verifiedCredits })
      .eq("id", orgData.id);

    if (updateError) {
      console.error("Wallet Update DB Error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to top up credit ledger" }, { status: 500 });
    }

    console.log(`Successfully verified reference ${reference}. Added ${verifiedCredits} credits to Organization ${orgData.id}.`);
    
    return NextResponse.json({ 
      success: true, 
      newBalance: currentBalance + verifiedCredits 
    });

  } catch (error) {
    console.error("Paystack Secure Verification System Crash:", error);
    return NextResponse.json({ success: false, error: "Internal operational error" }, { status: 500 });
  }
}