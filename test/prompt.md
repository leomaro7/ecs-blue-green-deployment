## 1. コーディング - リファクタリング判断

```
以下のPythonコードをレビューし、改善すべき点を特定してください。
各改善提案について、優先度（高/中/低）と理由を説明し、
リファクタリング後のコードを提示してください。

```python
def process_data(data):
    result = []
    for i in range(len(data)):
        if data[i]['status'] == 'active':
            temp = data[i]['value'] * 2
            if temp > 100:
                result.append({'id': data[i]['id'], 'processed_value': temp, 'flag': 'high'})
            else:
                result.append({'id': data[i]['id'], 'processed_value': temp, 'flag': 'low'})
    return result

def calculate_total(items):
    total = 0
    for item in items:
        total = total + item['processed_value']
    return total

def main():
    data = [
        {'id': 1, 'status': 'active', 'value': 50},
        {'id': 2, 'status': 'inactive', 'value': 30},
        {'id': 3, 'status': 'active', 'value': 80}
    ]
    processed = process_data(data)
    total = calculate_total(processed)
    print(f"Total: {total}")
```

**評価ポイント:**
- 改善箇所の特定精度
- リファクタリング判断の妥当性
- コードの可読性・保守性向上
```

