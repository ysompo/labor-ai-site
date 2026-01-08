import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not defined");
    }

    const resend = new Resend(apiKey);

    const body = await req.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Email to lab
    await resend.emails.send({
      from: "Labor-AI <onboarding@resend.dev>",
      to: ["labor.ai.research@gmail.com"],
      replyTo: email,
      subject: `New contact message from ${name}`,
      text: message,
    });

    // Confirmation email to sender
    await resend.emails.send({
      from: "Labor-AI <onboarding@resend.dev>",
      to: [email],
      subject: "Thank you for contacting the Labor-AI Lab",
      text: `Dear ${name},

Thank you for contacting the Labor-AI Lab.
We have received your message and will respond as soon as possible.

Best regards,
Labor-AI Lab`,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("CONTACT API ERROR:", err);

    return new Response(
      JSON.stringify({
        error: err?.message || "Unknown server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
