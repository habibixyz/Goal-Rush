import re

with open('src/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace justify-content: flex-end with center
content = content.replace('justify-content: flex-end !important;', 'justify-content: center !important;')

# Force the navbar to stack and center
navbar_override = """
  /* Make sure the navbar doesn't force a column layout */
  .navbar {
    flex-wrap: wrap;
    gap: 12px;
  }
"""

navbar_new = """
  /* Stack the logo on top, wallet in the middle */
  .navbar {
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 16px !important;
  }
"""

content = content.replace(navbar_override, navbar_new)

# Also ensure proper spacing left and right
content = content.replace('gap: 6px !important;', 'gap: 12px !important;')
content = content.replace('padding: 4px 8px !important;', 'padding: 6px 12px !important;')

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied centered layout with proper spacing.")
