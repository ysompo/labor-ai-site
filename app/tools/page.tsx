'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ToolsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has valid auth token
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
        }
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #f0f1ff 100%)',
      }}>
        <p style={{ color: '#868e96', fontSize: '14px' }}>Loading…</p>
      </div>
    );
  }

  const modules = [
    {
      id: 'journal-club',
      name: 'Journal Club',
      icon: '📚',
      description: 'Follow journals, manage reading lists, download PDFs',
      href: 'https://journal-club-pwa.vercel.app',
      color: '#005977',
      gradient: 'linear-gradient(135deg, #005977, #007398)',
    },
    {
      id: 'simulator',
      name: 'Simulator',
      icon: '⚙️',
      description: 'Run interactive educational simulations',
      href: '/tools/simulator',
      color: '#4B2E6A',
      gradient: 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
    },
    {
      id: 'research',
      name: 'Research Assistant',
      icon: '🔬',
      description: 'AI-powered research with persistent memory',
      href: '/tools/research',
      color: '#4B2E6A',
      gradient: 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #f0f1ff 100%)',
      padding: '60px 24px',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 60, textAlign: 'center' }}>
          <h1 style={{
            margin: '0 0 12px',
            fontSize: '36px',
            fontWeight: 700,
            color: '#212529',
            fontFamily: "'Noto Serif', Georgia, serif",
          }}>
            Labor-AI Tools
          </h1>
          <p style={{
            margin: '0 auto 24px',
            fontSize: '16px',
            color: '#868e96',
            maxWidth: '480px',
          }}>
            Integrated workspace for academic research, simulation, and journal management
          </p>
        </div>

        {/* Module cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: 40,
        }}>
          {modules.map(module => (
            <Link
              key={module.id}
              href={module.href}
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e9ecef',
                overflow: 'hidden',
                transition: 'all 0.2s',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.borderColor = module.color;
                el.style.boxShadow = `0 12px 32px ${module.color}20`;
                el.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.borderColor = '#e9ecef';
                el.style.boxShadow = 'none';
                el.style.transform = 'translateY(0)';
              }}>
                {/* Header with gradient */}
                <div style={{
                  background: module.gradient,
                  padding: '32px 24px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '16px',
                  minHeight: '120px',
                }}>
                  <div style={{
                    fontSize: '48px',
                    lineHeight: 1,
                  }}>
                    {module.icon}
                  </div>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '22px',
                      fontWeight: 700,
                      color: '#ffffff',
                      fontFamily: "'Noto Serif', Georgia, serif",
                    }}>
                      {module.name}
                    </h2>
                  </div>
                </div>

                {/* Content */}
                <div style={{
                  padding: '24px',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#495057',
                    lineHeight: '1.6',
                    flex: 1,
                  }}>
                    {module.description}
                  </p>

                  {/* CTA button */}
                  <div style={{
                    display: 'inline-flex',
                    padding: '10px 16px',
                    background: module.gradient,
                    color: 'white',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    textDecoration: 'none',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: 'auto',
                  }}>
                    Open {module.name} →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Features section */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          padding: '40px',
          marginBottom: 40,
        }}>
          <h3 style={{
            margin: '0 0 24px',
            fontSize: '18px',
            fontWeight: 700,
            color: '#212529',
            fontFamily: "'Noto Serif', Georgia, serif",
          }}>
            Unified Experience
          </h3>
          <ul style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🔐</span>
              <div>
                <div style={{ fontWeight: 600, color: '#212529', marginBottom: '4px', fontSize: '14px' }}>
                  Single Sign-On
                </div>
                <div style={{ fontSize: '13px', color: '#868e96' }}>
                  Log in once, access all modules with the same credentials
                </div>
              </div>
            </li>
            <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>⚡</span>
              <div>
                <div style={{ fontWeight: 600, color: '#212529', marginBottom: '4px', fontSize: '14px' }}>
                  Quick Navigation
                </div>
                <div style={{ fontSize: '13px', color: '#868e96' }}>
                  Switch between modules with the top navigation bar
                </div>
              </div>
            </li>
            <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🎓</span>
              <div>
                <div style={{ fontWeight: 600, color: '#212529', marginBottom: '4px', fontSize: '14px' }}>
                  Integrated Workspace
                </div>
                <div style={{ fontSize: '13px', color: '#868e96' }}>
                  All tools use consistent design and authentication
                </div>
              </div>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: '#868e96',
        }}>
          <p style={{ margin: 0 }}>
            Need help? <Link href="/" style={{ color: '#005977', textDecoration: 'none', fontWeight: 600 }}>
              Back to Labor-AI Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
