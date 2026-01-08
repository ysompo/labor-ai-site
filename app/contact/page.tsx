"use client";

export default function ContactPage() {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
      }),
    });

    if (res.ok) {
      alert("Message sent successfully.");
      form.reset();
    } else {
      alert("Failed to send message. Please try again later.");
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-4xl font-semibold text-[#4B2E6A]">Contact Us</h1>

      <p>
        For collaborations, media inquiries, or more information about our work,
        please contact the Labor-AI Lab team using the form below or by email.
      </p>

      {/* Contact form */}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-black">
            Name
          </label>
          <input
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4B2E6A]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4B2E6A]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black">
            Message
          </label>
          <textarea
            name="message"
            rows={4}
            required
            className="mt-1 w-full rounded-md border border-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4B2E6A]"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-[#4B2E6A] px-6 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Send message
        </button>
      </form>

      {/* Email */}
      <div className="text-sm text-black/70">
        <strong>Email:</strong>{" "}
        <a
          href="mailto:labor.ai.research@gmail.com"
          className="text-[#4B2E6A] underline hover:opacity-80"
        >
          labor.ai.research@gmail.com
        </a>
      </div>
    </div>
  );
}
