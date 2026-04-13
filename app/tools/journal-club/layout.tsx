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
    <html lang="en" className="dark">
      <body className="bg-surface text-on-surface">
        {children}
      </body>
    </html>
  );
}
