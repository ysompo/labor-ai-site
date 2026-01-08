
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not defined");
    }

    const resend = new Resend(apiKey);

    const { name, email, message, token } = await req.json();

    if (!name || !email || !message) {
      return new Response("Missing fields", { status: 400 });
    }

    // (Optional) reCAPTCHA bypass / validation here

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
