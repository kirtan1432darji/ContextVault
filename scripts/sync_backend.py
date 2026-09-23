import paramiko
import os

HOST = "192.168.100.1"
USER = "kirtan"
PASS = "1432"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=10)
sftp = client.open_sftp()

# 1. Upload updated vision files
files_to_sync = [
    (r"c:\Kirtan_Darji\AI_Projects\ContextVault\backend\app\services\vision_gateway_service.py",
     "/home/kirtan/ContextVault/backend/app/services/vision_gateway_service.py"),
    (r"c:\Kirtan_Darji\AI_Projects\ContextVault\backend\app\api\v1\vision.py",
     "/home/kirtan/ContextVault/backend/app/api/v1/vision.py"),
]
for local_p, remote_p in files_to_sync:
    print(f"Uploading {local_p} -> {remote_p}")
    sftp.put(local_p, remote_p)

# 2. Update /home/kirtan/ContextVault/backend/.env
remote_env_path = "/home/kirtan/ContextVault/backend/.env"
with sftp.open(remote_env_path, "r") as f:
    env_content = f.read().decode()

lines = [l.strip() for l in env_content.splitlines() if l.strip()]
env_map = {}
for line in lines:
    if "=" in line:
        k, v = line.split("=", 1)
        env_map[k.strip()] = v.strip()

env_map["VISION_SERVER_URL"] = "http://192.168.100.2:8001"
env_map["VISION_ENABLED"] = "True"
env_map["VISION_MODEL"] = "Qwen2.5-VL-3B-Instruct"

new_env = "\n".join([f"{k}={v}" for k, v in env_map.items()]) + "\n"
with sftp.open(remote_env_path, "w") as f:
    f.write(new_env)
print("Updated remote .env with VISION_SERVER_URL=http://192.168.100.2:8001")

sftp.close()

# 3. Check if container needs restart or recreation with updated env
# Let's restart contextvault-api or run docker restart
stdin, stdout, stderr = client.exec_command("docker restart contextvault-api")
print("Restart output:", stdout.read().decode().strip(), stderr.read().decode().strip())

# 4. If container wasn't run with --env-file, docker restart won't re-read new env vars unless recreated.
# Let's recreate container to guarantee new env vars are loaded:
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
print("Recreate output:", stdout.read().decode().strip(), stderr.read().decode().strip())

# 5. Wait 3 seconds and curl health
import time
time.sleep(3)
stdin, stdout, stderr = client.exec_command("curl -s http://localhost:8000/api/vision/health")
print("Vision Health from Ubuntu:\n", stdout.read().decode().strip())

client.close()
print("Done!")
