import paramiko
import sys
import time

HOST = "192.168.100.1"
USER = "kirtan"
PASS = "1432"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print(f"Connecting to {USER}@{HOST}...")
try:
    client.connect(HOST, username=USER, password=PASS, timeout=10)
    print("Connected successfully!")
except Exception as e:
    print(f"Connection error: {e}")
    sys.exit(1)

commands = [
    "cd ~/ContextVault && git stash && git pull origin main",
    "cd ~/ContextVault/backend && docker build -t contextvault-backend:latest .",
    "docker rm -f contextvault-backend 2>/dev/null || true",
    "cd ~/ContextVault/backend && docker run -d --name contextvault-backend --restart always -p 8000:8000 --env-file .env contextvault-backend:latest",
    "sleep 2 && docker ps -f name=contextvault-backend",
    "curl -s http://localhost:8000/api/health",
    "curl -s http://localhost:8000/api/vision/health",
]

for cmd in commands:
    print(f"\n---> Running: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(f"STDOUT:\n{out}")
    if err:
        print(f"STDERR:\n{err}")

client.close()
print("\n[DONE] Backend setup complete!")
