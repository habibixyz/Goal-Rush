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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
            <div>
              © {new Date().getFullYear()} Goal Rush Football Intelligence. Powered by Sofascore API & OpenAI.
            </div>
            <a 
              href="https://gitlab.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263C4.783.84 4.185.84 4.05 1.26L1.386 9.449.044 13.587c-.121.375.014.789.331 1.023L12 23.054l11.625-8.443c.318-.235.453-.647.33-1.024z"/>
              </svg>
              View on GitLab
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
