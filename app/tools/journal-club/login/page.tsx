import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export const metadata = {
  title: 'Login — Journal Club',
};

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sim_auth')?.value;

  if (!token) return null;

  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const isAuth = await checkAuth();

  // If already logged in, redirect to journals
  if (isAuth) {
    redirect('/tools/journal-club/journals');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d0d1f] via-[#1a1a2e] to-[#16213e] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Labor-AI</h1>
          <p className="text-gray-400">Journal Club</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#1a1a2e] rounded-lg shadow-2xl p-8 border border-purple-500/20">
          <form action="/api/journal-club/auth/login" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                className="w-full px-4 py-2 bg-[#0d0d1f] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="Your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-4 py-2 bg-[#0d0d1f] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded hover:from-purple-700 hover:to-purple-800 transition"
            >
              Sign In
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-4">
            You use your Labor-AI account to access Journal Club.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <a href="https://labor-ai.org" className="hover:text-gray-300 transition">
            ← Back to Labor-AI
          </a>
        </div>
      </div>
    </div>
  );
}
