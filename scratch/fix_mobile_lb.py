import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Fix the wrapping and text size in the leaderboard stats
old_stats = """<div className="compact-stats">
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
                        </div>"""

new_stats = """<div className="compact-stats">
                          <div className="stat-col hide-mobile">
                            <span className="compact-stat-primary" style={{ color: 'var(--color-secondary)', whiteSpace: 'nowrap' }}>{row.claimed.toFixed(4)} OKB <span className="desktop-only-text" style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.4)'}}>CLAIMED</span></span>
                            {row.grushClaimed > 0 && <span className="compact-stat-secondary" style={{whiteSpace: 'nowrap'}}>⚽ {row.grushClaimed.toLocaleString()} GRUSH <span className="desktop-only-text" style={{fontSize:'0.6rem'}}>CLAIMED</span></span>}
                          </div>
                          <div className="stat-col">
                            <span className="compact-stat-primary" style={{ color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{row.volume.toFixed(4)} OKB <span className="desktop-only-text" style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.4)'}}>VOL</span></span>
                            {row.grushVolume > 0 && <span className="compact-stat-secondary" style={{whiteSpace: 'nowrap'}}>⚽ {row.grushVolume.toLocaleString()} GRUSH <span className="desktop-only-text" style={{fontSize:'0.6rem'}}>VOL</span></span>}
                          </div>
                          <div className="stat-col stat-col-right">
                            <span className="compact-stat-primary" style={{ color: '#fff', fontSize: '1.1rem', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                               {row.goals} <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.5)'}}>Goals</span>
                            </span>
                          </div>
                        </div>"""

app_content = app_content.replace(old_stats, new_stats)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

# Update style.css
with open('src/style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

css_appends = """
@media (max-width: 480px) {
  .desktop-only-text {
    display: none !important;
  }
  .compact-stats {
    gap: 8px !important;
  }
  .stat-col {
    min-width: auto !important;
  }
  .compact-stat-primary {
    font-size: 0.8rem !important;
  }
  .compact-stat-secondary {
    font-size: 0.65rem !important;
  }
  .compact-address {
    font-size: 0.8rem !important;
    gap: 4px !important;
  }
  .compact-user-info {
    gap: 6px !important;
  }
  .compact-rank {
    width: 20px !important;
  }
}
"""
with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css_appends)

print("Applied fixes for mobile leaderboard congestion.")
