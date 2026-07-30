import csv
import io
import json
import os
import sys
import urllib.request

# Ensure stdout uses utf-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

GOOGLE_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQl_XxFv-5zt2_IAgiKoZHEyzFD3KKGv5WYoJqWqk6lCXkmJEe8ioTT4DD2EfPlQZWYgQ9n1ckVg6KT/pub?gid=0&single=true&output=csv"
)

def fetch_and_sync():
    print("Downloading latest Google Sheet CSV data...")
    req = urllib.request.Request(
        GOOGLE_SHEET_CSV_URL,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req) as response:
        csv_bytes = response.read()
    
    csv_text = csv_bytes.decode("utf-8-sig", errors="replace")
    reader = list(csv.reader(io.StringIO(csv_text)))
    
    header_idx = -1
    for i, row in enumerate(reader):
        if row and (row[0].strip() == "STT" or "STT" in row):
            header_idx = i
            break
            
    if header_idx == -1:
        print("Error: Could not find header row with STT!")
        sys.exit(1)
        
    records = []
    for row in reader[header_idx + 1:]:
        if not row or not row[0].strip():
            continue
        try:
            stt_val = int(row[0].strip())
        except ValueError:
            continue
            
        def g(idx):
            return row[idx].strip() if len(row) > idx else ""

        records.append({
            "stt": stt_val,
            "canBoBBT": g(1),
            "canBoKTHT": g(2),
            "ngayChuyen": g(3),
            "toBoiThuong": g(4),
            "hoTen": g(5),
            "diaChi": g(6),
            "duong": g(7),
            "phuong": g(8),
            "toBanDo": g(9),
            "thuaDat": g(10),
            "khuPho": g(11),
            "giaiToaMotPhan": g(12),
            "giaiToaToanPhan": g(13),
            "trangThai": g(14),
            "ghiChu": g(15),
            "phapChe": g(16),
            "doLuong": g(17),
            "trungLap": g(18)
        })

    print(f"Parsed {len(records)} records successfully.")
    
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js", "data.js")
    js_content = f"// Data dataset for {len(records)} records\n// Auto-synced from Google Sheet\nwindow.DOSSIER_DATA = {json.dumps(records, ensure_ascii=False, indent=2)};\n"
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"Updated js/data.js ({len(records)} records) successfully!")

if __name__ == "__main__":
    fetch_and_sync()
