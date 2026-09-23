import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.100.1', username='kirtan', password='1432', timeout=5)

# Connect contextvault-api to contextvault-network
stdin, stdout, stderr = client.exec_command('docker network connect contextvault-network contextvault-api')
print('Network connect output:', stdout.read().decode(), stderr.read().decode())

# Test ping from contextvault-api to contextvault-sql
stdin, stdout, stderr = client.exec_command('docker exec contextvault-api ping -c 2 contextvault-sql || docker exec contextvault-api nc -z -w 2 contextvault-sql 1433 || echo "Checked"')
print('Exec test:\n', stdout.read().decode(), stderr.read().decode())

# Test backend health check directly
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:8000/api/health')
print('Health output:\n', stdout.read().decode())

client.close()
