import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Pattern to capture everything from <div className="hackathon-left"> to its closing </div>
# which is right before {/* Cyber-Matrix Right Column */}
pattern = re.compile(r'<div className="hackathon-left">.*?(?=\s*\{\/\* Cyber-Matrix Right Column \*\/})', re.DOTALL)

new_hero_left = """<div className="hackathon-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '28px', paddingRight: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="hero-logo-wrapper" style={{
                  display: 'flex',
                  padding: '16px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(20,25,20,0.9))',
                  border: '1px solid rgba(157, 255, 0, 0.3)',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(157, 255, 0, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <img
                    src="/logo.png?v=2"
                    alt="Goal Rush Logo"
                    className="hero-logo-img"
                    style={{
                      height: '72px',
                      width: 'auto',
                      display: 'block',
                      mixBlendMode: 'screen',
                      filter: 'drop-shadow(0 0 8px rgba(157, 255, 0, 0.4))'
                    }}
                  />
                </div>
                <h1 style={{ 
                  fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', 
                  fontWeight: 900, 
                  margin: 0, 
                  lineHeight: 1.1, 
                  background: 'linear-gradient(to right, #fff, #9dff00)', 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 12px rgba(157,255,0,0.15))'
                }}>
                  GoalRush
                </h1>
              </div>
              
              <p className="hackathon-desc" style={{ 
                fontSize: '1.2rem', 
                lineHeight: '1.6', 
                color: 'rgba(255, 255, 255, 0.75)', 
                maxWidth: '600px', 
                margin: 0,
                fontWeight: 400
              }}>
                The premier decentralized sports prediction experience on <strong style={{color: '#fff'}}>OKX X Layer</strong>. Fund a match pick through the prediction router, follow live fixtures, and play a cosmetic penalty challenge after confirmation.
              </p>
              
              <div className="security-status-card desktop-security-card" role="note" aria-label="Protocol security status" style={{ maxWidth: '600px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="security-status-icon" style={{ background: 'rgba(157, 255, 0, 0.1)' }}><ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} /></div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '1rem', color: '#fff', letterSpacing: '0.5px' }}>Mainnet Beta &middot; Contract Verified</strong>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginTop: '4px' }}>Verify the contract address and transaction amount in your wallet. GoalRush will never ask for a seed phrase or tell you to bypass a wallet warning.</span>
                </div>
                <a href={`https://www.okx.com/explorer/xlayer/address/${HOOK_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, color: 'var(--color-secondary)' }}>
                  View Source <ExternalLink size={14} style={{ marginLeft: '4px' }} />
                </a>
              </div>
              
              <div className="hackathon-actions" style={{ marginTop: '8px' }}>
                <button
                  onClick={() => {
                    document.getElementById('grush-token-hub')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-primary"
                  style={{ 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '16px 32px', 
                    fontSize: '1.15rem', 
                    fontWeight: 800, 
                    borderRadius: '16px',
                    boxShadow: '0 0 30px rgba(157, 255, 0, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Play size={20} fill="currentColor" /> Buy GRUSH Token
                </button>
              </div>
            </div>"""

if pattern.search(app_content):
    app_content = pattern.sub(new_hero_left, app_content)
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(app_content)
    print("Hero section updated to premium layout.")
else:
    print("Pattern not found. Aborting.")
