css = """

/* --- Premium Mobile Sidebar --- */
.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.mobile-sidebar {
  position: fixed;
  top: 0;
  left: -300px;
  width: 300px;
  height: 100vh;
  background: rgba(5, 8, 5, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid rgba(157, 255, 0, 0.15);
  z-index: 1000;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;
}

.mobile-sidebar.open {
  transform: translateX(300px);
  box-shadow: 15px 0 40px rgba(0, 0, 0, 0.6);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
}

.sidebar-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 16px;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-logo-img {
  height: 48px;
  width: auto;
  filter: contrast(1.2) brightness(0.9) saturate(1.2);
}

.sidebar-close-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-close-btn:hover {
  background: rgba(255, 51, 68, 0.1);
  color: var(--color-danger);
  border-color: rgba(255, 51, 68, 0.3);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 24px;
  overflow-y: auto;
}

.sidebar-nav-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-nav-links .nav-btn {
  font-size: 1.1rem;
  padding: 14px 16px;
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s;
}

.sidebar-nav-links .nav-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.sidebar-nav-links .nav-btn.active {
  background: rgba(157, 255, 0, 0.08);
  border-color: rgba(157, 255, 0, 0.3);
  color: var(--color-primary);
  box-shadow: 0 0 15px rgba(157, 255, 0, 0.05);
}

.sidebar-wallet-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 20px;
}

@media (max-width: 900px) {
  .mobile-menu-btn {
    display: flex;
  }
  .desktop-nav, .desktop-wallet {
    display: none !important;
  }
}
"""

with open('src/style.css', 'a', encoding='utf-8') as f:
    f.write(css)

print("style.css updated successfully!")
