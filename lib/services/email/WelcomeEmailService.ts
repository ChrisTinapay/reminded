import "server-only";

import { Resend } from "resend";

const FROM_ADDRESS = "ReMindED <welcome@reminded.site>";
const SUBJECT = "Welcome to ReMindED - Let's optimize your memory.";

function buildWelcomeHtml(userName: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #131312; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <p style="color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 24px;">
    RemindED
  </p>
  <h1 style="font-size: 24px; margin-bottom: 24px; font-weight: 700; color: #ffffff;">
    Welcome, ${userName}
  </h1>
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px; color: #d1d5db;">
    You are now enrolled in the data-gathering phase of ReMindED.
  </p>
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px; color: #d1d5db;">
    Your study sessions will generate backend telemetry data. By measuring your response times, the system will mathematically adapt your review schedule to validate our dynamic spaced repetition algorithm.
  </p>
  <div style="background-color: #1a1a1a; border: 1px solid #374151; padding: 16px; border-radius: 6px; margin-bottom: 32px;">
    <p style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #ffffff;">What to expect:</p>
    <p style="font-size: 14px; line-height: 1.5; margin: 0; color: #9ca3af;">
      We will send a single, automated reminder to your inbox when you have reviews due. Consistent participation ensures the algorithm can accurately calculate your optimal review windows.
    </p>
  </div>
  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/student" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 12px 24px; border-radius: 6px; text-align: center;">
    Access Your Dashboard
  </a>
  <p style="font-size: 12px; color: #6b7280; margin-top: 40px; line-height: 1.5;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/student" style="color: #4f46e5; text-decoration: underline;">
      ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/student
    </a>
  </p>
</div>
  `.trim();
}

export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("[WelcomeEmailService] Missing RESEND_API_KEY");
    return false;
  }

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.error("[WelcomeEmailService] Missing NEXT_PUBLIC_SITE_URL");
    return false;
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: userEmail,
      subject: SUBJECT,
      html: buildWelcomeHtml(userName),
    });

    if (error) {
      console.error("[WelcomeEmailService] Resend send failed", {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error("[WelcomeEmailService] Unexpected error sending welcome email");
    console.error(err);
    return false;
  }
}
