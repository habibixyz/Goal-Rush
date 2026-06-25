import re

# 1. Update App.jsx
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# --- FIX HERO ALIGNMENT ---
# Find the entire hackathon-left block
hero_pattern = re.compile(r'<div className="hackathon-left".*?(?=\s*<div className="hackathon-actions" style=\{\{ marginTop: \'8px\' \}\}>)', re.DOTALL)

new_hero_left = """<div className="hackathon-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', paddingRight: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                <img
                  src="/logo.png?v=2"
                  alt="Goal Rush Logo"
                  style={{
                    height: '84px',
                    width: 'auto',
                    display: 'block',
                    mixBlendMode: 'screen',
                    filter: 'drop-shadow(0 0 12px rgba(157, 255, 0, 0.4)) contrast(1.2)'
                  }}
                />
                <h1 style={{ 
                  fontSize: 'clamp(3rem, 6vw, 5rem)', 
                  fontWeight: 900, 
                  margin: 0, 
                  lineHeight: 1, 
                  letterSpacing: '-1.5px',
                  background: 'linear-gradient(to right, #ffffff 30%, #9dff00 100%)', 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 12px rgba(157,255,0,0.15))'
                }}>
                  GoalRush
                </h1>
              </div>
              
              <p className="hackathon-desc" style={{ 
                fontSize: '1.25rem', 
                lineHeight: '1.6', 
                color: 'rgba(255, 255, 255, 0.8)', 
                maxWidth: '620px', 
                margin: 0,
                fontWeight: 400
              }}>
                The premier decentralized sports prediction experience on <strong style={{color: '#fff'}}>OKX X Layer</strong>. Fund a match pick through the prediction router, follow live fixtures, and play a cosmetic penalty challenge after confirmation.
              </p>
              
              <div className="security-status-card desktop-security-card" role="note" aria-label="Protocol security status" style={{ maxWidth: '620px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="security-status-icon" style={{ background: 'rgba(157, 255, 0, 0.1)', flexShrink: 0 }}><ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} /></div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '1rem', color: '#fff', letterSpacing: '0.5px' }}>Mainnet Beta &middot; Contract Verified</strong>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginTop: '4px', lineHeight: '1.4' }}>Verify the contract address and transaction amount in your wallet. GoalRush will never ask for a seed phrase or tell you to bypass a wallet warning.</span>
                </div>
                <a href={`https://www.okx.com/explorer/xlayer/address/${HOOK_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, color: 'var(--color-secondary)', flexShrink: 0, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                  View Source <ExternalLink size={14} style={{ marginLeft: '6px' }} />
                </a>
              </div>
              """

app_content = hero_pattern.sub(new_hero_left, app_content)


# --- FIX LEADERBOARD STATS ---
# Find the compact-stats block inside the leaderboard loop
stats_pattern = re.compile(r'<div className="compact-stats">.*?</div>\s*</div>\s*\);\s*\}\)\s*\)\s*:', re.DOTALL)

new_stats_block = """<div className="compact-stats">
                          <div className="stat-col hide-mobile">
                            <span className="compact-stat-primary" style={{ color: 'var(--color-secondary)' }}>{row.claimed.toFixed(4)} OKB <span style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.4)'}}>CLAIMED</span></span>
                            {row.grushClaimed > 0 && <span className="compact-stat-secondary">⚽ {row.grushClaimed.toLocaleString()} GRUSH <span style={{fontSize:'0.6rem'}}>CLAIMED</span></span>}
                          </div>
                          <div className="stat-col">
                            <span className="compact-stat-primary" style={{ color: 'var(--color-primary)' }}>{row.volume.toFixed(4)} OKB <span style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.4)'}}>VOL</span></span>
                            {row.grushVolume > 0 && <span className="compact-stat-secondary">⚽ {row.grushVolume.toLocaleString()} GRUSH <span style={{fontSize:'0.6rem'}}>VOL</span></span>}
                          </div>
                          <div className="stat-col stat-col-right">
                            <span className="compact-stat-primary" style={{ color: '#fff', fontSize: '1.1rem' }}>{row.goals} <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.5)'}}>Goals</span></span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) :"""

app_content = stats_pattern.sub(new_stats_block, app_content)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)


# 2. Update style.css
css_appends = """
/* Stats Layout Override for Leaderboard */
.compact-stats {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 32px !important;
}

.stat-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 120px;
}

.stat-col-right {
  min-width: 80px;
  align-items: flex-end;
}

@media (max-width: 900px) {
  .compact-stats {
    gap: 16px !important;
  }
  .hide-mobile {
    display: none !important;
  }
  .stat-col {
    min-width: auto;
  }
}
"""

with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css_appends)

print("Hero and Leaderboard updated to perfection.")
