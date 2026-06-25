import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The block to extract and move
hero_info_grid_start = "              {/* Cyber Info Panel */}"
community_end = "              </div>\n            </div>\n\n            {/* Cyber-Matrix Right Column */}"

# Use regex to find and extract the whole block
pattern = re.compile(r'(\s*\{/\* Cyber Info Panel \*/\}.*?)(?=\s*\{/\* Cyber-Matrix Right Column \*/\})', re.DOTALL)
match = pattern.search(content)

if match:
    extracted_block = match.group(1)
    # Remove it from its current location
    content = content.replace(extracted_block, "\n            </div>\n")
    
    # We only want the hero-info-grid, not the community links
    # The community block starts with <div style={{ display: 'flex', gap: '12px', marginTop: '24px'
    grid_only_pattern = re.compile(r'(\s*\{/\* Cyber Info Panel \*/\}.*?)(?=\s*<div style=\{\{ display: \'flex\', gap: \'12px\', marginTop: \'24px\')', re.DOTALL)
    grid_match = grid_only_pattern.search(extracted_block)
    
    if grid_match:
        grid_only = grid_match.group(1)
    else:
        grid_only = extracted_block # Fallback
        
    # We want to format the grid_only slightly so it spans the width nicely at the bottom
    # We'll put it in a container
    bottom_section = f"""
      {{/* Protocol Info Bar */}}
      <section className="bottom-info-bar" style={{ padding: '0 32px 32px 32px', maxWidth: '1200px', margin: '0 auto' }}>
{grid_only}      </section>
"""
    
    # Insert before footer
    content = content.replace("      {/* Footer */}", bottom_section + "\n      {/* Footer */}")
    
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully moved the info grid to the bottom!")
else:
    print("Could not find the info grid block.")
