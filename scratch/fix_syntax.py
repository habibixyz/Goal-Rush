with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want to remove lines 5977 to 6022 (inclusive) which correspond to index 5976 to 6022
# Let's verify line 5978 is indeed {/* Protocol Info Bar */}
# and line 6023 is {/* Footer */}

if "Protocol Info Bar" in lines[5977]:
    # Delete from index 5977 to 6021 (which is line 5978 to 6022)
    # Actually wait, let's just use a simple state machine to remove the bad block
    pass

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "      {/* Protocol Info Bar */}" in line and "card-playstyle-badge" in lines[i-3]:
        skip = True
    
    if skip and "      {/* Footer */}" in line:
        skip = False
        new_lines.append("                                {/* Footer */}\n")
        continue
        
    if not skip:
        new_lines.append(line)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print("Cleaned up App.jsx")
