import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Study Notes',
  description: 'Genera appunti intelligenti e mappe concettuali con Ollama',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
