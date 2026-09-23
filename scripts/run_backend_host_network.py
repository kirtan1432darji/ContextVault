import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("192.168.100.1", username="kirtan", password="1432")

cmds = [
    # Clean up any stopped build containers
    "docker rm -f c07a24f13135 2>/dev/null || true",
    # Restart backend with --network host so it directly reaches host ports (1433 for SQL Server, 8001 for Vision Server)
    "docker rm -f contextvault-backend 2>/dev/null || true",
    "docker run -d --name contextvault-backend --restart always --network host -v /home/kirtan/ContextVault/backend/app:/app/app --env-file /home/kirtan/ContextVault/backend/.env -e DB_SERVER=localhost contextvault-backend:latest",
    "sleep 3",
    "curl -s http://localhost:8000/api/health",
    "curl -s http://localhost:8000/api/vision/health",
    "curl -s http://localhost:8000/api/vision/ping"
]

for cmd in cmds:
    print(f"\n---> {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(f"OUT: {out}")
    if err:
        print(f"ERR: {err}")

client.close()
print("\n[FINISHED] Host network backend run complete.")
