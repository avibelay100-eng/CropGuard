/**
 * שליחת SMS - מאחורי ממשק, כך שקל להחליף ספק.
 *
 *   console - לפיתוח: ההודעה (כולל הקוד!) נכתבת בטרמינל של השרת במקום להישלח. לעולם לא בייצור.
 *   twilio  - שליחה אמיתית דרך Twilio (דורש חשבון: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
 */

import { maskPhone } from "../auth/phone.js";

export interface SmsSender {
  /** to בפורמט בינלאומי (+9725...) */
  send(to: string, text: string): Promise<void>;
}

export function createConsoleSmsSender(write: (line: string) => void = console.log): SmsSender {
  return {
    async send(to, text) {
      write(`[SMS - DEV ONLY, not really sent] to ${maskPhone(to)}: ${text}`);
    },
  };
}

export interface TwilioOptions {
  accountSid: string;
  authToken: string;
  /** מספר השולח שהוקצה בחשבון Twilio */
  from: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createTwilioSmsSender({
  accountSid,
  authToken,
  from,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: TwilioOptions): SmsSender {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  return {
    async send(to, text) {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: text }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 200)}`);
      }
    },
  };
}
