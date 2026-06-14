import './globals.css';
import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Goal Rush — Live Football Intelligence Engine',
  description: 'AI-Powered Football Predictions, Live Match Analytics, and Deep Event Insights',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#090d16] text-gray-100 flex flex-col min-h-screen">
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 font-black text-2xl tracking-wider text-emerald-400">
                GOAL<span className="text-white">RUSH</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="text-gray-300 hover:text-white transition font-medium">Live Scores</Link>
                <Link href="/standings" className="text-gray-300 hover:text-white transition font-medium">Standings</Link>
                <Link href="/insights" className="text-gray-300 hover:text-white transition font-medium">AI Insights</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Engine Live
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-gray-800/60 bg-gray-900/20 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Goal Rush Football Intelligence. Powered by Sofascore API & OpenAI.
          </div>
        </footer>
      </body>
    </html>
  );
}
