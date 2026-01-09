import requests
import json

def test_generate_snippet():
    url = 'http://localhost:8000/api/v1/snippets/generate'
    payload = {
        'type': 'education',
        'data': {
            'institution': 'Test University',
            'location': 'Test City',
            'degree': 'B.S. Testing',
            'dates': '2020-2024',
            'include_header': 'on'
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Template used:", data.get('template'))
            print("Preview:\n" + ("-" * 20))
            print(data.get('latex'))
            print("-" * 20)
            
            # Assertions
            if "\\section*{Education}" in data.get('latex'):
                print("PASS: Header found")
            else:
                print("FAIL: Header missing")
                
            if "\\textbf{Test University}" in data.get('latex'):
                print("PASS: Simple template format detected")
            else:
                print("FAIL: Unexpected format (maybe not simple template?)")
                
        else:
            print("Error:", response.text)
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_generate_snippet()
