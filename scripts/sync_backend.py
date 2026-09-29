"""
Syncs latest backend code and Florence-2 configuration to Ubuntu server,
restarts the Docker container, and verifies health across all endpoints.
"""

import paramiko
import os
import time

HOST = "192.168.100.1"
USER = "kirtan"
PASS = "1432"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=10)
sftp = client.open_sftp()

# 1. Upload updated backend files
base_local = r"c:\Kirtan_Darji\AI_Projects\ContextVault\backend"
base_remote = "/home/kirtan/ContextVault/backend"

files_to_sync = [
    (r"app\core\config.py", "app/core/config.py"),
    (r"app\api\api.py", "app/api/api.py"),
    (r"app\api\v1\vision.py", "app/api/v1/vision.py"),
    (r"app\api\v1\florence.py", "app/api/v1/florence.py"),
    (r"app\services\vision_gateway_service.py", "app/services/vision_gateway_service.py"),
    (r"app\services\florence_gateway_service.py", "app/services/florence_gateway_service.py"),
]

for rel_local, rel_remote in files_to_sync:
    local_path = os.path.join(base_local, rel_local)
    remote_path = f"{base_remote}/{rel_remote}"
    print(f"Uploading: {rel_local} -> {remote_path}")
    sftp.put(local_path, remote_path)

# 2. Update /home/kirtan/ContextVault/backend/.env
remote_env_path = f"{base_remote}/.env"
with sftp.open(remote_env_path, "r") as f:
    env_content = f.read().decode()

lines = [l.strip() for l in env_content.splitlines() if l.strip()]
env_map = {}
for line in lines:
    if "=" in line:
        k, v = line.split("=", 1)
        env_map[k.strip()] = v.strip()

# Configure Vision and Florence gateway settings
env_map["VISION_SERVER_URL"] = "http://192.168.100.2:8001"
env_map["VISION_ENABLED"] = "True"
env_map["VISION_MODEL"] = "Qwen2.5-VL-3B-Instruct"

env_map["FLORENCE_SERVER_URL"] = "http://192.168.100.2:8002"
env_map["FLORENCE_ENABLED"] = "True"
env_map["FLORENCE_MODEL"] = "Florence-2-base"
env_map["FLORENCE_TIMEOUT"] = "30"

new_env = "\n".join([f"{k}={v}" for k, v in env_map.items()]) + "\n"
with sftp.open(remote_env_path, "w") as f:
    f.write(new_env)
print("Updated remote .env with FLORENCE_SERVER_URL=http://192.168.100.2:8002 and VISION_SERVER_URL=http://192.168.100.2:8001")

sftp.close()

# 3. Recreate docker container with volume mount and updated .env
print("\nRecreating contextvault-api container in Docker...")
recreate_cmd = (
    "docker rm -f contextvault-api && "
    "docker run -d --name contextvault-api --restart always "
    "-p 8000:8000 "
    "-v /home/kirtan/ContextVault/backend/app:/app/app "
    "--env-file /home/kirtan/ContextVault/backend/.env "
    "--network contextvault-network "
    "contextvault-backend:latest"
)
stdin, stdout, stderr = client.exec_command(recreate_cmd)
container_id = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(f"Container created: {container_id}")
if err:
    print(f"Stderr: {err}")

# 4. Wait for uvicorn to boot
print("Waiting 4s for backend application boot...")
time.sleep(4)

# 5. Check container status
stdin, stdout, stderr = client.exec_command("docker ps -f name=contextvault-api --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'")
print("\n=== DOCKER PS ===")
print(stdout.read().decode().strip())

# 6. Verify health endpoints
endpoints = [
    ("/api/health", "General Backend Health"),
    ("/api/vision/health", "Vision AI Gateway (Qwen on 8001)"),
    ("/api/florence/health", "Florence-2 Gateway (Port 8002)"),
    ("/api/florence/model-info", "Florence-2 Model Info"),
]

print("\n=== HEALTH CHECKS VIA UBUNTU DOCKER ===")
for ep, label in endpoints:
    stdin, stdout, stderr = client.exec_command(f"curl -s http://localhost:8000{ep}")
    res = stdout.read().decode().strip()
    print(f"[{label}] {ep} -> {res[:150]}...")

client.close()
print("\n[SUCCESS] Docker backend is live and verified on latest code!")
