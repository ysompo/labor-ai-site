import Sidebar from './components/Sidebar';
import ToolsNavbar from '@/app/components/ToolsNavbar';

export const metadata = {
  title: 'Journal Club — Labor-AI',
  description: 'Follow journals, manage reading list',
};

export default function JournalClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --fs-sm: 13px;
            --fs-md: 15px;
            --fs-lg: 17px;
            --fs-xl: 19px;
            --font-size: var(--fs-md);
            --primary: #005977;
            --primary-light: #007398;
            --bg-sidebar: #f9fafb;
            --bg-main: #f5f3ff;
            --bg-card: #ffffff;
            --border-color: #e2e8f0;
            --text-primary: #191c1e;
            --text-secondary: #64748b;
            --text-tertiary: #9ca3af;
          }

          html.fs-sm { font-size: var(--fs-sm); }
          html.fs-md { font-size: var(--fs-md); }
          html.fs-lg { font-size: var(--fs-lg); }
          html.fs-xl { font-size: var(--fs-xl); }

          html.dark {
            --bg-sidebar: #1a1d20;
            --bg-main: #0f1214;
            --bg-card: #1e2124;
            --border-color: #2e3235;
            --text-primary: #e2e4e6;
            --text-secondary: #b0b8c0;
            --text-tertiary: #7a8490;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background: var(--bg-main);
            color: var(--text-primary);
            transition: background 0.2s, color 0.2s;
          }

          a {
            color: inherit;
            text-decoration: none;
          }

          button {
            font-family: inherit;
          }
        `}</style>
      </head>
      <body>
        <ToolsNavbar currentModule="journal-club" theme="light" direction="ltr" />
        <Sidebar />
        <main style={{ marginLeft: '256px', minHeight: '100vh', paddingTop: '44px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
