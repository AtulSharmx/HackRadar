// Supabase Auth "Send SMS" hook -> Fast2SMS (phone OTP for India).
//
// Supabase makes the 6-digit code, checks it on verify, handles expiry, rate limits and the session;
// this function only delivers the SMS. Deployed with JWT verification OFF: Supabase Auth calls it, and
// every call must carry a valid Standard Webhooks signature made with SEND_SMS_HOOK_SECRET instead.
//
// Secrets (Edge Functions > Secrets, never in the repo): FAST2SMS_API_KEY, SEND_SMS_HOOK_SECRET
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
//       https://docs.fast2sms.com/reference/error-code-list
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const FAST2SMS = "https://www.fast2sms.com/dev/bulkV2";

const reply = (status: number, message?: string) =>
  new Response(JSON.stringify(message ? { error: { http_code: status, message } } : {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const payload = await req.text();
  const secret = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
  let data: { user: { phone?: string }; sms: { otp: string } };
  try {
    data = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof data;
  } catch {
    return reply(401, "Invalid signature");
  }

  // Supabase sends the number with or without "+": keep the 10 digits after India's 91
  const digits = (data.user.phone ?? "").replace(/\D/g, "");
  if (!/^91[6-9]\d{9}$/.test(digits)) return reply(400, "Phone sign-in works only for Indian mobile numbers (+91).");
  const otp = data.sms.otp;
  if (!/^\d{4,10}$/.test(otp)) return reply(400, "Bad code");

  let res: Response;
  try {
    res = await fetch(FAST2SMS, {
      method: "POST",
      headers: { authorization: Deno.env.get("FAST2SMS_API_KEY") ?? "" },
      body: new URLSearchParams({ route: "otp", variables_values: otp, numbers: digits.slice(2), flash: "0" }),
    });
  } catch (e) {
    console.error("fast2sms unreachable", String(e));
    return reply(502, "Couldn't send the SMS right now. Try again in a minute.");
  }
  const body = await res.json().catch(() => ({}));
  if (body.return === true) return reply(200);

  // logged without the number or the code
  console.error("fast2sms refused", body.status_code, body.message);
  const busy = body.status_code === 995; // their spam guard: same number too often
  return reply(busy ? 429 : 502, busy ? "Too many codes to this number. Wait a few minutes." : "Couldn't send the SMS right now. Try again in a minute.");
});
