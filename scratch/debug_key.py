import subprocess
try:
    old = subprocess.check_output("git show origin/main:pos.html", shell=True).decode('utf-8')
    for line in old.split('\n'):
        if 'apiKey' in line:
            print(f"Line: '{line}'")
            parts = line.split('"')
            if len(parts) >= 2:
                key = parts[1]
                print(f"Key length: {len(key)}")
                print(f"Key start: {key[:10]}")
                print(f"Key end: {key[-10:]}")
except Exception as e:
    print(e)
