import socket
import threading

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8000
TARGET_HOST = "192.168.100.1"
TARGET_PORT = 8000

def forward(src, dst):
    try:
        while True:
            data = src.recv(4096)
            if not data:
                break
            dst.sendall(data)
    except:
        pass
    finally:
        try:
            src.close()
        except:
            pass
        try:
            dst.close()
        except:
            pass

def handle_client(client_socket):
    try:
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.connect((TARGET_HOST, TARGET_PORT))
        t1 = threading.Thread(target=forward, args=(client_socket, server_socket), daemon=True)
        t2 = threading.Thread(target=forward, args=(server_socket, client_socket), daemon=True)
        t1.start()
        t2.start()
    except Exception as e:
        client_socket.close()

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((LISTEN_HOST, LISTEN_PORT))
    server.listen(50)
    print(f"[TCP Proxy] Forwarding 127.0.0.1:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}")
    while True:
        client, _ = server.accept()
        threading.Thread(target=handle_client, args=(client,), daemon=True).start()

if __name__ == "__main__":
    main()
