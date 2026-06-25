import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Home import
if 'Home,' not in content:
    content = content.replace("  Activity,\n  Download\n} from 'lucide-react'", "  Activity,\n  Download,\n  Home\n} from 'lucide-react'")

# 2. Remove sidebar markup and fix header
sidebar_pattern = re.compile(r'\s*\{/\* Premium Mobile Sidebar \*/\}.*?\{/\* Header / Navbar \*/\}', re.DOTALL)
content = sidebar_pattern.sub('\n      {/* Header / Navbar */}', content)

# 3. Fix header markup
old_header = """      <header className="navbar">
        <div className="logo-wrap">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="logo-icon">⚽</span>
          <h1 className="logo-text">GoalRush</h1>
        </div>
        <nav className="desktop-nav">
          {renderNavLinks(false)}
        </nav>
        <div className="desktop-wallet">
          {renderWalletActions(false)}
        </div>
      </header>"""

new_header = """      <header className="navbar">
        <div className="logo-wrap">
          <span className="logo-icon">⚽</span>
          <h1 className="logo-text">GoalRush</h1>
        </div>
        <nav className="desktop-nav">
          {renderNavLinks(false)}
        </nav>
        <div className="mobile-wallet-nav">
          {renderWalletActions(false)}
        </div>
      </header>"""

content = content.replace(old_header, new_header)

# 4. Add Bottom Nav
bottom_nav = """
      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button className={`bottom-nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => { setCurrentView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <Home size={20} />
          <span>Home</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'match-center' ? 'active' : ''}`} onClick={() => { setCurrentView('match-center'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <Activity size={20} />
          <span>Matches</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'news' ? 'active' : ''}`} onClick={() => setCurrentView('news')}>
          <Globe size={20} />
          <span>News</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'leaderboard' ? 'active' : ''}`} onClick={() => { setCurrentView('leaderboard'); setTimeout(() => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>
          <Award size={20} />
          <span>Ranks</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'about' ? 'active' : ''}`} onClick={() => setCurrentView('about')}>
          <HelpCircle size={20} />
          <span>About</span>
        </button>
      </nav>
    </div>
  )
}
"""

content = content.replace("    </div>\n  )\n}", bottom_nav)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("App.jsx restructured successfully.")
