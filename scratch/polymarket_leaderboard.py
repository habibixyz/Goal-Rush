import re

# 1. Update App.jsx
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

old_list_pattern = re.compile(r'<div className="leaderboard-list">.*?</div>\s*\)\s*\}\s*</div>', re.DOTALL)

# Wait, finding the exact bounds of the list is tricky with regex if there are nested divs.
# I will just match from <div className="leaderboard-list"> to the end of that block before </section>.
old_list_pattern2 = re.compile(r'<div className="leaderboard-list">.*?(?=</section>)', re.DOTALL)

new_list_layout = """<div className="leaderboard-compact-list">
                {leaderboardData.length > 0 ? (
                  leaderboardData.map((row, idx) => {
                    const isCurrentUser = walletConnected && userAddress && row.address.toLowerCase() === userAddress.toLowerCase();
                    const rankColor = idx === 0 ? 'var(--color-primary)' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)';
                    // Generate a deterministic hex color from the address
                    const avatarColor1 = `#${row.address.slice(2, 8)}`;
                    const avatarColor2 = `#${row.address.slice(-6)}`;
                    
                    return (
                      <div key={row.address} className={`leaderboard-compact-row ${isCurrentUser ? 'is-current-user' : ''}`}>
                        <div className="compact-rank" style={{ color: rankColor }}>
                          {idx + 1}
                        </div>
                        <div className="compact-user-info">
                          <div className="compact-avatar" style={{ background: `linear-gradient(135deg, ${avatarColor1}, ${avatarColor2})` }}></div>
                          <div className="compact-address">
                            {row.address.slice(0, 6)}...{row.address.slice(-4)}
                            {isCurrentUser && <span className="compact-badge-my">MY</span>}
                          </div>
                        </div>
                        
                        <div className="compact-stats">
                          <span className="compact-stat-primary">{row.volume.toFixed(4)} OKB</span>
                          <span className="compact-stat-secondary">⚽ {row.goals} Goals</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="leaderboard-empty">
                    No active swappers recorded yet. Swap & predict to become the first on the board!
                  </div>
                )}
              </div>
            """

app_content = old_list_pattern2.sub(new_list_layout, app_content)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

# 2. Add CSS
css_content = """
/* --- Compact Polymarket-Style Leaderboard --- */
.leaderboard-compact-list {
  display: flex;
  flex-direction: column;
}

.leaderboard-compact-row {
  display: flex;
  align-items: center;
  padding: 16px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s;
}

.leaderboard-compact-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.leaderboard-compact-row.is-current-user {
  background: rgba(157, 255, 0, 0.05);
  border-bottom: 1px solid rgba(157, 255, 0, 0.2);
}

.compact-rank {
  font-size: 0.9rem;
  font-weight: 600;
  width: 32px;
  flex-shrink: 0;
  text-align: left;
}

.compact-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.compact-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  flex-shrink: 0;
}

.compact-address {
  font-family: var(--font-display);
  font-size: 0.95rem;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.compact-badge-my {
  background: var(--color-primary);
  color: #000;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.compact-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.compact-stat-primary {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-primary);
}

.compact-stat-secondary {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.5);
  font-weight: 600;
}

@media (max-width: 480px) {
  .leaderboard-compact-row {
    padding: 12px 4px;
  }
  .compact-address {
    font-size: 0.85rem;
  }
  .compact-avatar {
    width: 28px;
    height: 28px;
  }
  .compact-stat-primary {
    font-size: 0.85rem;
  }
}
"""

with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css_content)

print("Leaderboard upgraded to Polymarket compact style.")
