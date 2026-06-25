import re

with open('src/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the @media (max-width: 900px) block that hid the wallet
# It currently looks like:
# @media (max-width: 900px) {
#   .mobile-menu-btn {
#     display: flex;
#   }
#   .desktop-nav, .desktop-wallet {
#     display: none !important;
#   }
# }

new_media_query = """@media (max-width: 900px) {
  .desktop-nav {
    display: none !important;
  }
  .app-wrapper {
    padding-bottom: 80px; /* Space for bottom nav */
  }
  .mobile-wallet-nav {
    display: flex;
  }
  .wallet-text-full {
    display: none;
  }
  .wallet-text-compact {
    display: inline;
  }
  .btn-disconnect-text {
    display: none;
  }
}
"""

# Replace the specific block we added earlier
content = re.sub(r'@media \(max-width: 900px\) \{\s*\.mobile-menu-btn \{\s*display: flex;\s*\}\s*\.desktop-nav, \.desktop-wallet \{\s*display: none !important;\s*\}\s*\}', new_media_query, content)


# 2. Append Bottom Nav CSS
bottom_nav_css = """
/* --- Mobile Bottom Navigation --- */
.mobile-bottom-nav {
  display: none;
}

@media (max-width: 900px) {
  .mobile-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: rgba(10, 12, 10, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(157, 255, 0, 0.15);
    z-index: 1000;
    justify-content: space-around;
    padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
    box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.5);
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.65rem;
    cursor: pointer;
    padding: 4px 8px;
    transition: all 0.2s ease;
  }

  .bottom-nav-item:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .bottom-nav-item.active {
    color: var(--color-primary);
  }

  .bottom-nav-item.active svg {
    filter: drop-shadow(0 0 8px rgba(157, 255, 0, 0.5));
  }
}
"""

content += bottom_nav_css

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("style.css updated successfully.")
