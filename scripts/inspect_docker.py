import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.100.1', username='kirtan', password='1432', timeout=5)

stdin, stdout, stderr = client.exec_command('docker inspect contextvault-sql --format "{{json .NetworkSettings.Networks}}"')
print('contextvault-sql networks:', stdout.read().decode())

stdin, stdout, stderr = client.exec_command('docker inspect contextvault-api --format "{{json .NetworkSettings.Networks}}"')
print('contextvault-api networks:', stdout.read().decode())

stdin, stdout, stderr = client.exec_command('grep DB_ /home/kirtan/ContextVault/backend/.env')
print('backend .env DB settings:\n', stdout.read().decode())

stdin, stdout, stderr = client.exec_command('docker network ls')
print('docker networks:\n', stdout.read().decode())

client.close()
