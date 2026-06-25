css_fix = """
@media (max-width: 900px) {
  /* Fix the disconnect button stretching */
  .mobile-wallet-nav .wallet-connected-wrapper > button {
    flex: 0 0 auto !important;
    padding: 6px 12px !important;
    width: auto !important;
    min-width: 0 !important;
  }
  
  /* Make the X Layer Mainnet badge compact */
  .mobile-wallet-nav .badge-xlayer {
    flex: 0 0 auto !important;
    width: auto !important;
  }
  
  /* Ensure everything aligns nicely to the right */
  .mobile-wallet-nav {
    display: flex;
    justify-content: flex-end;
  }
}
"""

with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css_fix)
    
print("CSS fix applied.")
