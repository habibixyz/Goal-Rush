import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Make the wrapper flexWrap: wrap so it never forces cutoff
old_wrapper = """<div style={{ display: 'flex', gap: '8px', flexDirection: isSidebar ? 'column' : 'row', width: isSidebar ? '100%' : 'auto', alignItems: 'center' }}>"""
new_wrapper = """<div style={{ display: 'flex', gap: '8px', flexDirection: isSidebar ? 'column' : 'row', width: isSidebar ? '100%' : 'auto', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>"""
app_content = app_content.replace(old_wrapper, new_wrapper)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Added flexWrap to prevent any possible cutoff.")
