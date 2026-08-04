import http.server
import socketserver
import sys
import threading
import time
import sync_sheet

# Force UTF-8 on Windows stdout/stderr
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

PORT = 8888

class SafeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        try:
            sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
        except Exception:
            pass

def auto_sync_daemon():
    """Background daemon thread to auto-sync Google Sheets & Base Workflow API every 20 seconds"""
    print("[Auto-Sync Thread] Khởi chạy luồng tự động cập nhật dữ liệu (Google Sheets & Base Workflow) mỗi 20s...")
    while True:
        time.sleep(20)
        try:
            sync_sheet.fetch_and_sync()
        except Exception as e:
            print(f"[Auto-Sync Thread Error] Lỗi tự động đồng bộ: {e}")

if __name__ == "__main__":
    # Start auto-sync daemon thread
    sync_thread = threading.Thread(target=auto_sync_daemon, daemon=True)
    sync_thread.start()

    Handler = SafeHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"Serving HTTP on port {PORT} (http://localhost:{PORT}/)...")
            httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {e}")
