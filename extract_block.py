import sys
with open('full_debug_logs.txt', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()
    idx = content.find('FINAL_CONTEXT_FOR_LLM')
    if idx != -1:
        print(content[idx:idx+3000])
    else:
        print('LOG NOT FOUND')
