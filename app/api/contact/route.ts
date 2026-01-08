import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { name, email, message, token } = await req.json();

    if (!name || !email || !message || !token) {
      return new Response("Missing fields", { status: 400 });
    }

    // Verify reCAPTCHA
    const captchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
      }
    );

    const captchaData = await captchaRes.json();
    if (!captchaData.success || captchaData.score < 0.5) {
      return new Response("reCAPTCHA failed", { status: 403 });
    }

    // Email to lab
    await resend.emails.send({
      from: "Labor-AI Website <onboarding@resend.dev>",
      to: ["labor.ai.research@gmail.com"],
      replyTo: email,
      subject: `New contact message from ${name}`,
      text: message,
    });

    // Confirmation email to sender
    await resend.emails.send({
      from: "Labor-AI Lab <onboarding@resend.dev>",
      to: [email],
      subject: "Thank you for contacting the Labor-AI Lab",
      text: `Dear ${name},

Thank you for contacting the Labor-AI Lab.
We have received your message and will respond as soon as possible.

Best regards,
Labor-AI Lab`,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}
