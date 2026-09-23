import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("192.168.100.1", username="kirtan", password="1432")

cmds = [
    "docker rm -f contextvault-backend 2>/dev/null || true",
    "docker run -d --name contextvault-backend --restart always -p 8000:8000 -v /home/kirtan/ContextVault/backend/app:/app/app --env-file /home/kirtan/ContextVault/backend/.env contextvault-backend:latest",
    "sleep 2",
    "curl -s http://localhost:8000/api/vision/health",
    "curl -s http://localhost:8000/api/health"
]

for cmd in cmds:
    print(f"Running: {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(f"OUT: {out}")
    if err:
        print(f"ERR: {err}")

client.close()
