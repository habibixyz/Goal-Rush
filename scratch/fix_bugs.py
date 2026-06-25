import re

# 1. Update App.jsx to fix the H1 text gradient bug
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Replace the H1 style
old_h1_style = """<h1 style={{ 
                  fontSize: 'clamp(3rem, 6vw, 5rem)', 
                  fontWeight: 900, 
                  margin: 0, 
                  lineHeight: 1, 
                  letterSpacing: '-1.5px',
                  background: 'linear-gradient(to right, #ffffff 30%, #9dff00 100%)', 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 12px rgba(157,255,0,0.15))'
                }}>"""

new_h1_style = """<h1 style={{ 
                  fontSize: 'clamp(3rem, 6vw, 5rem)', 
                  fontWeight: 900, 
                  margin: 0, 
                  lineHeight: 1, 
                  letterSpacing: '-1.5px',
                  color: '#ffffff',
                  textShadow: '0 0 20px rgba(157, 255, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.5)'
                }}>"""

app_content = app_content.replace(old_h1_style, new_h1_style)

# Add padding to hackathon-left to prevent clipping
app_content = app_content.replace(
    """<div className="hackathon-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', paddingRight: '20px' }}>""",
    """<div className="hackathon-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', paddingRight: '20px', paddingLeft: '16px' }}>"""
)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

# 2. Update style.css to fix Leaderboard spacing and bottom Grid layout
with open('src/style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Fix bottom grid (hero-info-grid)
# Find the base definition of .hero-info-grid
css_content = css_content.replace(
    """grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));""",
    """grid-template-columns: repeat(4, 1fr);\n    width: 100%;\n    max-width: 800px;\n    margin-left: auto;\n    margin-right: auto;"""
)

# Fix leaderboard spacing
css_content = css_content.replace(
    """gap: 32px !important;""",
    """gap: 80px !important;"""
)
css_content = css_content.replace(
    """min-width: 120px;""",
    """min-width: 180px;"""
)

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

print("Applied fixes: Solid white text (no blocks), massive breathing room on leaderboard, and horizontal info grid.")
