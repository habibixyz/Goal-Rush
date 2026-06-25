import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Fix the disconnected state wrapper to be perfectly aligned
old_wrapper = """<div style={{ display: 'flex', gap: '8px', flexDirection: isSidebar ? 'column' : 'row', width: isSidebar ? '100%' : 'auto' }}>"""
new_wrapper = """<div style={{ display: 'flex', gap: '8px', flexDirection: isSidebar ? 'column' : 'row', width: isSidebar ? '100%' : 'auto', alignItems: 'center' }}>"""
app_content = app_content.replace(old_wrapper, new_wrapper)

# Add whiteSpace: nowrap to the buttons so they don't break into multiple lines
# Button 1
old_btn1 = """style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#9dff00', color: '#9dff00', background: 'rgba(157, 255, 0, 0.05)', cursor: 'pointer', width: isSidebar ? '100%' : 'auto' }}"""
new_btn1 = """style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#9dff00', color: '#9dff00', background: 'rgba(157, 255, 0, 0.05)', cursor: 'pointer', width: isSidebar ? '100%' : 'auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}"""
app_content = app_content.replace(old_btn1, new_btn1)

# Button 2
old_btn2 = """style={{ padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer', width: isSidebar ? '100%' : 'auto', justifyContent: 'center' }}"""
new_btn2 = """style={{ padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer', width: isSidebar ? '100%' : 'auto', justifyContent: 'center', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}"""
app_content = app_content.replace(old_btn2, new_btn2)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Nav actions perfectly aligned.")
