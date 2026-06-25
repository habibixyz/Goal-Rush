with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i in range(len(lines)):
    if 5977 <= i <= 6022:  # line 5978 to 6023
        if i == 6022:
            new_lines.append("                                {/* Footer */}\n")
    else:
        new_lines.append(lines[i])

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print("Successfully deleted the broken block!")
