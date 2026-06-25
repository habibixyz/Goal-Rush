with open('src/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the specific mobile grid override
old_block = """  @media (max-width: 480px) {
    .hero-info-grid {
      grid-template-columns: 1fr;
    }
  }"""

new_block = """  @media (max-width: 480px) {
    .hero-info-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      justify-content: center;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }
    .hero-info-card {
      padding: 8px 10px;
    }
    .hero-info-card-value {
      font-size: 0.75rem;
    }
  }"""

if old_block in content:
    content = content.replace(old_block, new_block)
else:
    # If indentation is different, use regex
    import re
    content = re.sub(r'@media \(max-width: 480px\) \{\s*\.hero-info-grid \{\s*grid-template-columns: 1fr;\s*\}\s*\}', new_block, content)

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated grid layout to 2x2.")
