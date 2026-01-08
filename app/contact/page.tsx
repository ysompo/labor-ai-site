"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

export default function ContactPage() {
  const [status, setStatus] = useState<Status>("idle");
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const formData = new FormData(form);

    // reCAPTCHA v3
    const token = await (window as any).grecaptcha.execute(
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
      { action: "contact" }
    );

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
        token,
      }),
    });

    if (res.ok) {
      setStatus("success");
      form.reset();
    } else {
      setStatus("error");
    }
  }

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => setStatus("idle"), 5000);
      return () => clearTimeout(t);
    }
  }, [status]);

  // Scroll to feedback message
  useEffect(() => {
    if (status === "success" || status === "error") {
      messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [status]);

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-4xl font-semibold text-[#4B2E6A]">Contact Us</h1>

      <p>
        For collaborations, media inquiries, or more information about our work,
        please contact the Labor-AI Lab team using the form below or by email.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-black">Name</label>
          <input
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-black/20 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border border-black/20 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black">Message</label>
          <textarea
            name="message"
            rows={4}
            required
            className="mt-1 w-full rounded-md border border-black/20 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-md bg-[#4B2E6A] px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send message"}
        </button>

        {(status === "success" || status === "error") && (
          <p
            ref={messageRef}
            className={`text-sm ${
              status === "success" ? "text-green-700" : "text-red-700"
            }`}
          >
            {status === "success"
              ? "Message sent successfully. Thank you for reaching out."
              : "Failed to send message. Please try again later."}
          </p>
        )}
      </form>

      <div className="text-sm text-black/70">
        <strong>Email:</strong>{" "}
        <a
          href="mailto:labor.ai.research@gmail.com"
          className="text-[#4B2E6A] underline"
        >
          labor.ai.research@gmail.com
        </a>
      </div>

      {/* Load reCAPTCHA */}
      <script
        src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
      />
    </div>
  );
}
