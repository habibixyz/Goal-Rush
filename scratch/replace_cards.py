import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Locate the Twitter Cards block
pattern = re.compile(r'\{\/\* Crypto Twitter Football Cards \*\/\}.*?(?=\s*</div>\s*</div>\s*</section>\s*\{\/\* Leaderboards \*\/})', re.DOTALL)

access_pass_html = """{/* VIP Access Pass */}
              <div className="card-bezel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 className="panel-title" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px rgba(157,255,0,0.3)' }}>
                    <Award size={20} />
                    GoalRush Access Pass
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', lineHeight: '1.4' }}>
                    Guarantees exclusive gated access to VIP prediction pools and zero-fee token swaps.
                  </p>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at center, rgba(157,255,0,0.2) 0%, transparent 70%)', filter: 'blur(20px)', zIndex: 0 }}></div>
                  <img 
                    src="/access-pass.png" 
                    alt="GoalRush Access Pass" 
                    style={{ 
                      width: '100%', 
                      maxWidth: '300px', 
                      borderRadius: '16px', 
                      boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(157,255,0,0.15)', 
                      border: '1px solid rgba(157,255,0,0.3)',
                      zIndex: 1,
                      position: 'relative'
                    }} 
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>Supply</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fff' }}>1000 / 1000</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>Mint Price</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>$10.00 <span style={{fontSize:'0.75rem', color:'rgba(255,255,255,0.4)'}}>(USDT)</span></span>
                  </div>
                </div>

                <button 
                  className="btn-primary" 
                  style={{ 
                    padding: '16px', 
                    fontSize: '1.1rem', 
                    fontWeight: '800', 
                    borderRadius: '12px', 
                    marginTop: '4px',
                    boxShadow: '0 0 20px rgba(157,255,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={() => {
                    if (!walletConnected) {
                      handleConnectWallet();
                      return;
                    }
                    alert('VIP Access Pass minting contract will be deployed shortly.');
                  }}
                >
                  <Award size={18} fill="currentColor" /> {walletConnected ? 'Mint Access Pass' : 'Connect to Mint'}
                </button>
              </div>"""

if pattern.search(app_content):
    new_content = pattern.sub(access_pass_html, app_content)
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced Twitter Cards with Access Pass.")
else:
    print("Pattern not found! Dumping regex surroundings for debug:")
    # Print the lines around 6220
    lines = app_content.splitlines()
    for i in range(6215, 6230):
        if i < len(lines):
            print(f"{i}: {lines[i]}")
