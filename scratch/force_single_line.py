with open('src/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace flex-wrap: wrap with nowrap for nav-actions
content = content.replace(
    'flex-wrap: wrap !important;',
    'flex-wrap: nowrap !important;'
)

# Just to be safe, also ensure the text size is slightly smaller so it fits beautifully on smaller phones
css_appends = """
@media (max-width: 900px) {
  .mobile-wallet-nav .badge-xlayer {
    padding: 4px 8px !important;
    font-size: 0.65rem !important;
  }
  .mobile-wallet-nav .wallet-connected-wrapper > div,
  .mobile-wallet-nav .wallet-connected-wrapper > button {
    padding: 4px 8px !important;
    font-size: 0.65rem !important;
  }
}
"""

content += css_appends

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated style.css to force single line and reduce padding.")
