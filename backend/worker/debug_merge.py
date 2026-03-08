import re

def _merge_split_name_fields(context: str) -> str:
    if not context:
        return context
    
    def _merge_names_in_record(record: str) -> str:
        fn_match = re.search(r'(?:first_name|firstname)\s*:\s*([^\|]+)', record, re.IGNORECASE)
        ln_match = re.search(r'(?:last_name|lastname|surname)\s*:\s*([^\|]+)', record, re.IGNORECASE)

        if fn_match and ln_match:
            first = fn_match.group(1).strip()
            last  = ln_match.group(1).strip()

            mn_match = re.search(r'(?:middle_name|middlename)\s*:\s*([^\|]+)', record, re.IGNORECASE)
            middle   = mn_match.group(1).strip() if mn_match else ''

            parts     = [p for p in [first, middle, last] if p]
            full_name = ' '.join(parts)

            if full_name:
                result = re.sub(r'(?:first_name|firstname)\s*:\s*([^\|]+)\|?\s*', '', record, flags=re.IGNORECASE)
                result = re.sub(r'(?:middle_name|middlename)\s*:\s*([^\|]+)\|?\s*', '', result, flags=re.IGNORECASE)
                result = re.sub(r'(?:last_name|lastname|surname)\s*:\s*([^\|]+)\|?\s*', '', result, flags=re.IGNORECASE)
                result = result.strip().strip('|').strip()
                return f"full_name: {full_name} | {result}" if result else f"full_name: {full_name}"
        return record
    
    parts = re.split(r'(DOCUMENT RECORD \d+:\n)', context)
    merged = []
    for part in parts:
        if part.startswith('DOCUMENT RECORD'):
            merged.append(part)
        else:
            merged.append(_merge_names_in_record(part))
    
    return ''.join(merged)

test_record = "DOCUMENT RECORD 1:\nalumni_id: STU20240015 | student_id: STU20240015 | first_name: Andrea | last_name: Beck | email: andrea.beck@gmail.com | phone: 895-814-8465"
print("BEFORE:")
print(test_record)
print("\nAFTER:")
print(_merge_split_name_fields(test_record))
