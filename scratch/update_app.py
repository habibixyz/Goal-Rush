import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert state
content = content.replace(
    "const [currentView, setCurrentView] = useState('dashboard')",
    "const [currentView, setCurrentView] = useState('dashboard')\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)"
)

# 2. Add Menu import
if 'Menu,' not in content:
    content = content.replace(
        "X,\n  Plus,",
        "X,\n  Menu,\n  Plus,"
    )

# 3. Add helper functions
helpers = """  const copyCode = (codeText) => {
    navigator.clipboard.writeText(codeText)
    alert('Code copied to clipboard!')
  }

  const renderNavLinks = (isSidebar = false) => (
    <ul className={isSidebar ? "sidebar-nav-links" : "nav-links"}>
      <li>
        <button
          onClick={() => {
            setCurrentView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (isSidebar) setIsMobileMenuOpen(false);
          }}
          className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
        >
          Dashboard
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            setCurrentView('match-center');
            if (isSidebar) setIsMobileMenuOpen(false);
          }}
          className={`nav-btn ${currentView === 'match-center' ? 'active' : ''}`}
        >
          Match Center
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            setCurrentView('news');
            if (isSidebar) setIsMobileMenuOpen(false);
          }}
          className={`nav-btn ${currentView === 'news' ? 'active' : ''}`}
        >
          Daily News
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            setCurrentView('leaderboard');
            setTimeout(() => {
              document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            if (isSidebar) setIsMobileMenuOpen(false);
          }}
          className={`nav-btn ${currentView === 'leaderboard' ? 'active' : ''}`}
        >
          Leaderboard
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            setCurrentView('about');
            if (isSidebar) setIsMobileMenuOpen(false);
          }}
          className={`nav-btn ${currentView === 'about' ? 'active' : ''}`}
        >
          About & Docs
        </button>
      </li>
    </ul>
  );

  const renderWalletActions = (isSidebar = false) => (
    <div className={isSidebar ? "sidebar-wallet-actions" : "nav-actions"}>
      {chainId !== null ? (
        chainId === 196 ? (
          <div className="badge-xlayer" style={{ color: 'var(--color-primary)' }}>
            <span className="badge-dot" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }}></span>
            <span className="badge-text">X Layer Mainnet</span>
          </div>
        ) : chainId === 195 ? (
          <div className="badge-xlayer" style={{ color: '#ffcc00' }}>
            <span className="badge-dot" style={{ backgroundColor: '#ffcc00', boxShadow: '0 0 8px #ffcc00' }}></span>
            <span className="badge-text">X Layer Testnet</span>
          </div>
        ) : (
          <button className="badge-xlayer" onClick={() => { handleSwitchNetwork(); if (isSidebar) setIsMobileMenuOpen(false); }} style={{ cursor: 'pointer', background: 'rgba(255, 51, 68, 0.1)', borderColor: '#ff3344', color: '#ff3344' }}>
            <AlertTriangle size={12} />
            <span className="badge-text">Switch Network</span>
          </button>
        )
      ) : (
        <div className="badge-xlayer">
          <span className="badge-dot" style={{ backgroundColor: '#666' }}></span>
          <span className="badge-text">Not Connected</span>
        </div>
      )}

      {walletConnected ? (
        <div className="wallet-connected-wrapper" style={isSidebar ? { flexDirection: 'column', width: '100%', gap: '8px' } : {}}>
          <div
            className="btn-secondary text-glow-green"
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'default',
              borderColor: 'var(--color-primary)',
              background: 'rgba(157, 255, 0, 0.05)',
              width: isSidebar ? '100%' : 'auto'
            }}
          >
            <User size={14} />
            <span className="wallet-text-full">
              Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </span>
            <span className="wallet-text-compact">
              {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </span>
          </div>
          <button
            className="btn-secondary btn-disconnect"
            onClick={() => { handleDisconnectWallet(); if (isSidebar) setIsMobileMenuOpen(false); }}
            style={{
              padding: '8px 12px',
              fontSize: '0.9rem',
              color: 'var(--color-danger)',
              borderColor: 'rgba(255, 51, 68, 0.2)',
              background: 'rgba(255, 51, 68, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebar ? 'center' : 'flex-start',
              gap: '6px',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
              width: isSidebar ? '100%' : 'auto'
            }}
          >
            <LogOut size={14} />
            <span className="btn-disconnect-text">Disconnect</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexDirection: isSidebar ? 'column' : 'row', width: isSidebar ? '100%' : 'auto' }}>
          {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <button
              type="button"
              onClick={() => {
                setWalletConnected(true);
                setUserAddress('0xae1b810ffb88855ffd967dc274d9ba4fadd21990');
                setUserBalance('0.1500');
                setGrushBalance('500.00');
                setChainId(196);
                addLog('Simulating wallet: 0xae1b... (Winner prediction)');
                if (isSidebar) setIsMobileMenuOpen(false);
              }}
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#9dff00', color: '#9dff00', background: 'rgba(157, 255, 0, 0.05)', cursor: 'pointer', width: isSidebar ? '100%' : 'auto' }}
            >
              Simulate Wallet 🧪
            </button>
          )}
          <button className="btn-primary" onClick={() => { handleConnectWallet(); if (isSidebar) setIsMobileMenuOpen(false); }} style={{ padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer', width: isSidebar ? '100%' : 'auto', justifyContent: 'center' }}>
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );

  return ("""

content = content.replace("  const copyCode = (codeText) => {\n    navigator.clipboard.writeText(codeText)\n    alert('Code copied to clipboard!')\n  }\n\n  return (", helpers)

# 4. Replace Header
new_header = """      {/* Premium Mobile Sidebar */}
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)}></div>
      <div className={`mobile-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png?v=2" alt="Goal Rush Logo" className="sidebar-logo-img" />
            <h1 className="logo-text">GoalRush</h1>
          </div>
          <button className="sidebar-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <div className="sidebar-content">
          {renderNavLinks(true)}
          <div className="sidebar-wallet-section">
            <h4 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '10px', marginTop: '20px', letterSpacing: '1px' }}>Connection</h4>
            {renderWalletActions(true)}
          </div>
        </div>
      </div>

      {/* Header / Navbar */}
      <header className="navbar">
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

# Find the header section using a regex that handles whitespace
header_pattern = re.compile(r'      {/\* Header / Navbar \*/}\s*<header className="navbar">.*?</header>', re.DOTALL)
content = header_pattern.sub(new_header, content)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("App.jsx updated successfully!")
