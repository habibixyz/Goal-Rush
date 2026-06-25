import re

# 1. Update App.jsx to conditionally render the bottom-info-bar
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# The section starts with <section className="bottom-info-bar"
# and ends with </div>      </section>
# Let's wrap it in {currentView === 'dashboard' && ( ... )}
# We'll just replace the start and end tags.
app_content = app_content.replace(
    '<section className="bottom-info-bar" style={{ padding: \'0 32px 32px 32px\', maxWidth: \'1200px\', margin: \'0 auto\' }}>',
    '{currentView === \'dashboard\' && (\n      <section className="bottom-info-bar" style={{ padding: \'0 32px 32px 32px\', maxWidth: \'1200px\', margin: \'0 auto\' }}>'
)
app_content = app_content.replace(
    '</div>      </section>',
    '</div>      </section>\n      )}'
)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)


# 2. Update style.css to fix the mobile-wallet-nav layout
with open('src/style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# We will inject some CSS overrides into the existing @media (max-width: 900px) block that we added earlier
# Or we can just append it to the end of the file
css_appends = """
@media (max-width: 900px) {
  .mobile-wallet-nav .nav-actions {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    justify-content: flex-end !important;
    gap: 6px !important;
  }
  .mobile-wallet-nav .wallet-connected-wrapper {
    flex-direction: row !important;
    gap: 6px !important;
  }
  .mobile-wallet-nav .badge-xlayer {
    padding: 6px 10px !important;
    font-size: 0.75rem !important;
  }
  .mobile-wallet-nav .wallet-connected-wrapper > div,
  .mobile-wallet-nav .wallet-connected-wrapper > button {
    padding: 6px 10px !important;
    font-size: 0.75rem !important;
    width: auto !important;
    max-width: none !important;
  }
  
  /* Make sure the navbar doesn't force a column layout */
  .navbar {
    flex-wrap: wrap;
    gap: 12px;
  }
}
"""

with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css_appends)

print("Fixed App.jsx conditional rendering and updated style.css layout rules.")
