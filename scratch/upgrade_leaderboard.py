import re

# 1. Update App.jsx to replace the table with the new list layout
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

old_table_pattern = re.compile(r'<div style=\{\{ overflowX: \'auto\' \}\}>\s*<table.*?</table>\s*</div>', re.DOTALL)

new_list_layout = """<div className="leaderboard-list">
                {leaderboardData.length > 0 ? (
                  leaderboardData.map((row, idx) => {
                    const isCurrentUser = walletConnected && userAddress && row.address.toLowerCase() === userAddress.toLowerCase();
                    const rankColor = isCurrentUser ? 'var(--color-primary)' : idx === 0 ? 'var(--color-primary)' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.6)';
                    return (
                      <div key={row.address} className={`leaderboard-card ${isCurrentUser ? 'is-current-user' : ''}`}>
                        <div className="leaderboard-card-left">
                          <span className="leaderboard-rank" style={{ color: rankColor }}>
                            {isCurrentUser ? 'MY' : `#${idx + 1}`}
                          </span>
                          <span className="leaderboard-address">
                            {row.address.slice(0, 8)}...{row.address.slice(-6)}
                          </span>
                        </div>
                        
                        <div className="leaderboard-card-stats">
                          <div className="stat-block">
                            <span className="stat-label">Goals</span>
                            <span className="stat-value">{row.goals}</span>
                          </div>
                          <div className="stat-block">
                            <span className="stat-label">Volume</span>
                            <div className="stat-value-group">
                              <span className="stat-primary">{row.volume.toFixed(4)} OKB</span>
                              {row.grushVolume > 0 && <span className="stat-secondary" style={{ color: 'var(--color-primary)' }}>⚽ {row.grushVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} GRUSH</span>}
                            </div>
                          </div>
                          <div className="stat-block">
                            <span className="stat-label">Claimed</span>
                            <div className="stat-value-group">
                              <span className="stat-primary text-glow-green" style={{ color: 'var(--color-primary)' }}>{row.claimed.toFixed(4)} OKB</span>
                              {row.grushClaimed > 0 && <span className="stat-secondary text-glow-cyan" style={{ color: 'var(--color-secondary)' }}>⚽ {row.grushClaimed.toLocaleString(undefined, { maximumFractionDigits: 0 })} GRUSH</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="leaderboard-empty">
                    No active swappers recorded yet. Swap & predict to become the first on the board!
                  </div>
                )}
              </div>"""

app_content = old_table_pattern.sub(new_list_layout, app_content)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)


# 2. Add the specialized CSS for the new leaderboard layout
css_content = """
/* --- Leaderboard List UI --- */
.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.leaderboard-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.leaderboard-card.is-current-user {
  background: rgba(157, 255, 0, 0.05);
  border-color: rgba(157, 255, 0, 0.2);
  box-shadow: 0 0 15px rgba(157, 255, 0, 0.05);
}

.leaderboard-card:hover {
  background: rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.leaderboard-card-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.leaderboard-rank {
  font-size: 1.2rem;
  font-weight: 800;
  min-width: 36px;
}

.leaderboard-address {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  color: #fff;
  font-weight: 500;
}

.leaderboard-card-stats {
  display: flex;
  align-items: center;
  gap: 24px;
}

.stat-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 80px;
}

.stat-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.stat-value-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value, .stat-primary {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
}

.stat-secondary {
  font-size: 0.7rem;
  font-weight: 700;
}

.leaderboard-empty {
  padding: 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.01);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

/* Mobile Leaderboard Adjustments */
@media (max-width: 768px) {
  .leaderboard-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
  }
  
  .leaderboard-card-stats {
    width: 100%;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 12px;
  }
  
  .stat-block {
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .leaderboard-address {
    font-size: 0.85rem;
  }
  .stat-value, .stat-primary {
    font-size: 0.85rem;
  }
}
"""

with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css_content)

print("Leaderboard successfully upgraded to card list layout.")
