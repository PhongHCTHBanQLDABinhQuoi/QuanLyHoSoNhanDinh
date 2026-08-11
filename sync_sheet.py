import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import urllib.parse
from collections import defaultdict


def deep_nfc(obj):
    """Chuẩn hóa MỌI chuỗi (cả key lẫn value) về Unicode NFC.
    Base HRM API trả tên dạng NFD (dấu tách rời) còn Google Sheet là NFC -> tra tên bị trượt.
    Chuẩn hóa toàn bộ về NFC để khớp tên + để bộ tìm kiếm bỏ dấu (regex ký tự tổ hợp) hoạt động đúng."""
    if isinstance(obj, str):
        return unicodedata.normalize("NFC", obj)
    if isinstance(obj, list):
        return [deep_nfc(x) for x in obj]
    if isinstance(obj, dict):
        return {deep_nfc(k): deep_nfc(v) for k, v in obj.items()}
    return obj

# Ensure stdout uses utf-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

GOOGLE_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQl_XxFv-5zt2_IAgiKoZHEyzFD3KKGv5WYoJqWqk6lCXkmJEe8ioTT4DD2EfPlQZWYgQ9n1ckVg6KT/pub?gid=0&single=true&output=csv"
)

# New Google Sheet URLs for Table VII (Bảng VII)
TABLE_VII_DAILY_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmNo6_kkbQy6pA-VjrYbhZpDuVCZRA76oFKQorBxnOSwiIg8GMbGS6E6phfzFDbhxu4ZXnRd_wVScN/pub?gid=0&single=true&output=csv"
)
TABLE_VII_WEEKLY_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmNo6_kkbQy6pA-VjrYbhZpDuVCZRA76oFKQorBxnOSwiIg8GMbGS6E6phfzFDbhxu4ZXnRd_wVScN/pub?gid=199224610&single=true&output=csv"
)

# Base Workflow API Config
BASE_ACCESS_TOKEN_V2 = "11836~YYEkzFCdqh2rl0G2kgDNWFzUlBfzVE2Ynf01bvh0qxm5Ws0q_9o8gaHoKNF_-VNQUE69iQZymyDyEfmzEfr2zgsThCymrAN0d8kEjji4sVe6UWWTJt3eKXgZE5c2w9ojLnuCQPXHWDZPIpVIQe4ORw"
BASE_WORKFLOW_ID = "16526"
BASE_API_URL = "https://workflow.base.vn/extapi/v1/workflow/jobs"

# Base HRM API Config
BASE_HRM_TOKEN = "11836~9NcWbodZ1ellG2VMFMW4n9VAo60JsKiJ3YobJBmDqmxEJJGW2Irj1wWc39yGmpQXu6vFFFO_PnKLZgjqo0ttr_I0hYH-s8f2achEYzWTYI4BImQG0hzMQ2HWhsMS-ZrjzIuQ3iyNKqHnvDvU8pVkNw"
BASE_HRM_URL = "https://hrm.base.vn/extapi/v1/employee/list"

def fetch_base_hrm_employees():
    print("Fetching official personnel directory & departments from Base HRM API...")
    hrm_map = {}            # tên (đầy đủ / rút gọn) -> tên đầy đủ chuẩn
    ambiguous_keys = set()  # key rút gọn trùng nhiều người -> sẽ loại bỏ để tránh map nhầm
    user_dept_map = {}      # tên đầy đủ -> phòng ban
    uid2name = {}           # user_id (Base) -> tên đầy đủ | KHÓA NỐI CHUẨN với Workflow moves[].user_id
    try:
        # 1. Fetch Area / Departments list
        data_area = urllib.parse.urlencode({
            "access_token_v2": BASE_HRM_TOKEN,
            "updated_from": "0",
            "updated_to": "2000000000"
        }).encode("utf-8")
        req_area = urllib.request.Request(
            "https://hrm.base.vn/extapi/v1/area/list",
            data=data_area,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        area_dict = {}
        with urllib.request.urlopen(req_area, timeout=15) as res_a:
            res_a_json = json.loads(res_a.read().decode("utf-8"))
            if res_a_json and res_a_json.get("code") == 1:
                for a in res_a_json.get("areas", []):
                    area_dict[str(a.get("id"))] = a.get("name")

        # 2. Fetch Employees list
        data_emp = urllib.parse.urlencode({
            "access_token_v2": BASE_HRM_TOKEN,
            "updated_from": "0",
            "updated_to": "2000000000"
        }).encode("utf-8")

        req_emp = urllib.request.Request(
            BASE_HRM_URL, 
            data=data_emp, 
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        with urllib.request.urlopen(req_emp, timeout=15) as response:
            res = json.loads(response.read().decode("utf-8"))
            if res and res.get("code") == 1:
                employees = res.get("employees", [])

                # Thêm 1 key rút gọn -> tên đầy đủ. Nếu key đã trỏ người KHÁC => đánh dấu nhập nhằng để loại bỏ,
                # tránh việc "Oanh"/"Phúc"/"Minh"... bị người xử lý sau ghi đè thành tên sai người.
                def add_short_key(key, full):
                    key = key.strip()
                    if not key:
                        return
                    if key in hrm_map and hrm_map[key] != full:
                        ambiguous_keys.add(key)
                    else:
                        hrm_map[key] = full

                for emp in employees:
                    raw_name = emp.get("name", "").strip()
                    first_name = emp.get("first_name", "").strip()
                    last_name = emp.get("last_name", "").strip()
                    full_name = f"{last_name} {first_name}".strip() if (last_name or first_name) else raw_name
                    uid = str(emp.get("user_id") or "").strip()
                    area_id = str(emp.get("area_id", ""))
                    dept_name = area_dict.get(area_id, "Ban QLDA")

                    if not full_name:
                        continue

                    if uid:
                        uid2name[uid] = full_name
                    user_dept_map[full_name] = dept_name
                    hrm_map[full_name] = full_name  # tên đầy đủ luôn an toàn

                    parts = full_name.split()
                    if len(parts) >= 2:
                        add_short_key(f"{parts[-2]} {parts[-1]}", full_name)
                    if len(parts) >= 1:
                        add_short_key(parts[-1], full_name)

                # Loại bỏ các key rút gọn bị nhiều người dùng chung (chỉ giữ tên đầy đủ để tra chính xác)
                for k in ambiguous_keys:
                    hrm_map.pop(k, None)

                print(f"Parsed {len(employees)} employees | {len(uid2name)} user_id links | removed {len(ambiguous_keys)} ambiguous short keys.")
                return hrm_map, user_dept_map, uid2name
    except Exception as e:
        print(f"Warning: Could not fetch Base HRM API: {e}")
    return {}, {}, {}

def fetch_base_workflow_counts(uid2name=None):
    print("Fetching Base Workflow jobs data via API (đếm theo user_id, tên chuẩn từ HRM)...")
    uid2name = uid2name or {}
    raw_counts = defaultdict(int)   # key = user_id (hoặc 'u:username' nếu thiếu user_id) -> số job
    uid_username = {}               # key -> username (để log/đối chiếu)
    page = 0
    total_jobs = 0
    jobs_map = {}

    try:
        while True:
            data = urllib.parse.urlencode({
                "access_token_v2": BASE_ACCESS_TOKEN_V2,
                "id": BASE_WORKFLOW_ID,
                "page_id": page,
                "limit": 100,
            }).encode("utf-8")

            req = urllib.request.Request(
                BASE_API_URL, 
                data=data, 
                method="POST",
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            with urllib.request.urlopen(req, timeout=25) as response:
                result = json.loads(response.read().decode("utf-8"))
                if result and result.get("code") == 1:
                    jobs = result.get("jobs", [])
                    total_jobs += len(jobs)
                    for j in jobs:
                        owners = j.get("owners", [])
                        stage_id = str(j.get("stage_id", ""))

                        excluded_users = {"anhvpm", "dunglq", "linhhk", "banqlda", "system", "admin", ""}
                        targets = []  # danh sách (username, user_id) sẽ được tính
                        if isinstance(owners, list) and len(owners) > 0 and stage_id != "116735":
                            for o in owners:
                                if isinstance(o, dict):
                                    un = o.get("username")
                                    if un and un not in excluded_users:
                                        targets.append((un, str(o.get("user_id") or "")))

                        # Step 6 (116735) hoặc owner bị loại: truy ngược moves tìm cán bộ bồi thường ở Bước 5
                        if not targets:
                            moves = j.get("moves", [])
                            if isinstance(moves, list):
                                for m in reversed(moves):
                                    u = m.get("username")
                                    if u and u not in excluded_users:
                                        targets.append((u, str(m.get("user_id") or "")))
                                        break

                        for un, uid in targets:
                            key = uid if uid else f"u:{un}"  # ưu tiên user_id (khóa nối HRM), fallback username
                            raw_counts[key] += 1
                            uid_username[key] = un

                        j_id = j.get("id")
                        j_name = j.get("name", "")
                        j_stage_id = str(j.get("stage_id", ""))
                        j_stage_name = str(j.get("stage_name", ""))
                        link = f"https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da?job={j_id}"

                        if j_name and j_id:
                            clean_name = re.sub(r'[^A-Z0-9]', '', j_name.upper())
                            jobs_map[clean_name] = {
                                "id": j_id,
                                "name": j_name,
                                "stageId": j_stage_id,
                                "stageName": j_stage_name,
                                "link": link
                            }
                            
                    if len(jobs) < 100:
                        break
                    page += 1
                else:
                    break

        print(f"Parsed {total_jobs} total jobs from Base Workflow across {page + 1} pages with Step 6 fallback.")

        # Quy đổi số đếm theo user_id -> TÊN ĐẦY ĐỦ chuẩn từ HRM (thiếu thì fallback username)
        result_map = defaultdict(int)
        unresolved = []
        for key, cnt in raw_counts.items():
            name = uid2name.get(key)
            if not name:
                name = uid_username.get(key, key)
                unresolved.append(name)
            result_map[name] += cnt
        result_map = dict(result_map)
        result_map["_total_jobs"] = total_jobs
        if unresolved:
            print(f"Note: {len(set(unresolved))} user_id không có trong HRM, dùng username tạm: {sorted(set(unresolved))[:10]}")
        print(f"BASE_WORKFLOW_COUNTS: {len([k for k in result_map if not k.startswith('_')])} cán bộ (đếm theo user_id).")
        return result_map, jobs_map
    except Exception as e:
        print(f"Warning: Could not fetch Base Workflow API data: {e}")
        return {}, {}

def fetch_table_vii_sheet(csv_url):
    try:
        req = urllib.request.Request(csv_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            csv_bytes = response.read()

        csv_text = csv_bytes.decode("utf-8-sig", errors="replace")
        reader = list(csv.reader(io.StringIO(csv_text)))

        header_idx = -1
        for idx, row in enumerate(reader):
            if row and any(h in row[0] for h in ["Ngày", "Tuần"]):
                header_idx = idx
                break

        if header_idx == -1:
            return []

        records = []
        current_time_label = ""

        for row in reader[header_idx + 1:]:
            if not row:
                continue
            first_cell = row[0].strip() if len(row) > 0 else ""
            if first_cell:
                current_time_label = first_cell

            quarter = row[1].strip() if len(row) > 1 else ""
            officer = row[2].strip() if len(row) > 2 else ""
            approved_str = row[3].strip() if len(row) > 3 else ""
            returned_str = row[4].strip() if len(row) > 4 else ""
            note = row[5].strip() if len(row) > 5 else ""

            if not quarter and not officer and not approved_str and not returned_str:
                continue

            clean_officer = officer.strip().lower()
            if clean_officer in ["thụ lý", "cán bộ", "cán bộ thụ lý", "thụ lý bqlda", "tên cán bộ", "người thụ lý"]:
                continue

            try:
                approved_count = int(approved_str) if approved_str else 0
            except ValueError:
                approved_count = 0

            try:
                returned_count = int(returned_str) if returned_str else 0
            except ValueError:
                returned_count = 0

            records.append({
                "timeKey": current_time_label,
                "khuPho": quarter,
                "canBo": officer,
                "soHsDuyet": approved_count,
                "soHsTraSua": returned_count,
                "tongHs": approved_count + returned_count,
                "ghiChu": note
            })
        return records
    except Exception as e:
        print(f"Warning: Could not fetch Table VII sheet ({csv_url}): {e}")
        return []

def fetch_and_sync():
    now_str = time.strftime("%H:%M:%S - %d/%m/%Y")
    print(f"[{now_str}] Downloading latest Google Sheet CSV data...")
    req = urllib.request.Request(
        GOOGLE_SHEET_CSV_URL,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req) as response:
        csv_bytes = response.read()
    
    csv_text = csv_bytes.decode("utf-8-sig", errors="replace")
    reader = list(csv.reader(io.StringIO(csv_text)))
    
    header_idx = -1
    header_row = None
    for i, row in enumerate(reader):
        if row and any("STT" in cell for cell in row):
            header_idx = i
            header_row = [cell.strip() for cell in row]
            break
            
    if header_idx == -1:
        print("Error: Could not find header row with STT!")
        sys.exit(1)

    col_map = {}
    for idx, h in enumerate(header_row):
        clean_h = h.lower().replace("\n", " ").strip()
        if "stt" in clean_h: col_map["stt"] = idx
        elif "cán bộ bbt" in clean_h or "bqlda" in clean_h or "thụ lý bqlda" in clean_h or "thu ly bqlda" in clean_h: col_map["canBoBBT"] = idx
        elif "chuyển về" in clean_h or "kthtđt chuyển về" in clean_h: col_map["ngayKthtChuyenVe"] = idx
        elif "ngày chuyển" in clean_h: col_map["ngayChuyen"] = idx
        elif ("cán bộ" in clean_h and ("ktht" in clean_h or "phòng ktht" in clean_h)) or "thụ lý phòng ktht" in clean_h or "thụ lý ktht" in clean_h: col_map["canBoKTHT"] = idx
        elif "tổ bồi thường" in clean_h: col_map["toBoiThuong"] = idx
        elif "mã hồ sơ" in clean_h or "mã hs" in clean_h: col_map["maHoSo"] = idx
        elif "họ và tên" in clean_h or "họ tên" in clean_h: col_map["hoTen"] = idx
        elif "địa chỉ" in clean_h: col_map["diaChi"] = idx
        elif "đường" in clean_h: col_map["duong"] = idx
        elif "phường" in clean_h: col_map["phuong"] = idx
        elif "tờ bản đồ" in clean_h: col_map["toBanDo"] = idx
        elif "thửa đất" in clean_h: col_map["thuaDat"] = idx
        elif "khu phố" in clean_h: col_map["khuPho"] = idx
        elif "một phần" in clean_h: col_map["giaiToaMotPhan"] = idx
        elif "toàn phần" in clean_h: col_map["giaiToaToanPhan"] = idx
        elif "trạng thái" in clean_h: col_map["trangThai"] = idx
        elif "ghi chú" in clean_h: col_map["ghiChu"] = idx
        elif "pháp chế" in clean_h: col_map["phapChe"] = idx
        elif "đo lường" in clean_h: col_map["doLuong"] = idx
        elif "trùng lặp" in clean_h: col_map["trungLap"] = idx
        
    records = []
    for row in reader[header_idx + 1:]:
        if not row or not any(row):
            continue
        
        def g(key, default=""):
            idx = col_map.get(key)
            if idx is not None and idx < len(row):
                return row[idx].strip()
            return default

        stt_str = g("stt")
        if not stt_str:
            continue
        try:
            stt_val = int(stt_str)
        except ValueError:
            continue

        records.append({
            "stt": stt_val,
            "canBoBBT": g("canBoBBT"),
            "canBoKTHT": g("canBoKTHT"),
            "ngayChuyen": g("ngayChuyen"),
            "ngayKthtChuyenVe": g("ngayKthtChuyenVe"),
            "toBoiThuong": g("toBoiThuong"),
            "maHoSo": g("maHoSo"),
            "hoTen": g("hoTen"),
            "diaChi": g("diaChi"),
            "duong": g("duong"),
            "phuong": g("phuong"),
            "toBanDo": g("toBanDo"),
            "thuaDat": g("thuaDat"),
            "khuPho": g("khuPho"),
            "giaiToaMotPhan": g("giaiToaMotPhan"),
            "giaiToaToanPhan": g("giaiToaToanPhan"),
            "trangThai": g("trangThai"),
            "ghiChu": g("ghiChu"),
            "phapChe": g("phapChe"),
            "doLuong": g("doLuong"),
            "trungLap": g("trungLap")
        })

    print(f"Parsed {len(records)} main dossier records successfully.")

    print("Fetching Table VII Google Sheet data (Daily & Weekly)...")
    table_vii_daily = fetch_table_vii_sheet(TABLE_VII_DAILY_CSV_URL)
    table_vii_weekly = fetch_table_vii_sheet(TABLE_VII_WEEKLY_CSV_URL)

    # HRM trước để lấy uid2name (khóa nối chuẩn), rồi mới đếm Workflow theo user_id
    hrm_names, hrm_depts, hrm_uid2name = fetch_base_hrm_employees()
    base_counts, jobs_map = fetch_base_workflow_counts(hrm_uid2name)

    # Bí danh tên ngắn (2 từ) -> tên đầy đủ cho các cán bộ BBT thực tế (có trong Workflow counts).
    # Sheet ghi tên 2 từ ("Duy Bảo", "Quốc Bảo"...); trong nhóm ~40 cán bộ này tên 2 từ là DUY NHẤT,
    # nên tra chính xác VÀ ghi đè các key trước đó bị loại vì trùng tên với nhân sự phòng ban khác.
    for full in list(base_counts.keys()):
        if full.startswith("_"):
            continue
        hrm_names[full] = full
        p = full.split()
        if len(p) >= 2:
            hrm_names[f"{p[-2]} {p[-1]}"] = full

    # Attach baseLink to each main dossier record based on maHoSo matching
    for r in records:
        dossier_code = r.get("maHoSo", "")
        clean_dossier_code = re.sub(r'[^A-Z0-9]', '', dossier_code.upper()) if dossier_code else ""
        matched_job = None
        if clean_dossier_code and jobs_map:
            if clean_dossier_code in jobs_map:
                matched_job = jobs_map[clean_dossier_code]
            else:
                # Partial matching (e.g. 106KP18)
                for k, j_info in jobs_map.items():
                    if clean_dossier_code in k or k in clean_dossier_code:
                        matched_job = j_info
                        break

        if matched_job:
            r["baseJobId"] = matched_job["id"]
            r["baseJobName"] = matched_job["name"]
            r["baseStageName"] = matched_job["stageName"]
            r["baseLink"] = matched_job["link"]
        elif dossier_code:
            r["baseLink"] = f"https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da?q={urllib.parse.quote(dossier_code)}"
        else:
            r["baseLink"] = "https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da"

    print(f"Parsed Table VII: {len(table_vii_daily)} daily records, {len(table_vii_weekly)} weekly records.")

    # An toàn: nếu Workflow API lỗi/timeout (không có cán bộ nào) thì GIỮ NGUYÊN data.js cũ,
    # tránh ghi đè làm mất sạch cột "TỔNG HS NẮM GIỮ" cho tới lần sync kế tiếp.
    real_officers = [k for k in base_counts if not k.startswith("_")]
    if not real_officers:
        print("⚠️ Workflow API không trả dữ liệu (timeout?). GIỮ NGUYÊN js/data.js cũ, KHÔNG ghi đè.")
        return

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js", "data.js")
    # Chuẩn hóa toàn bộ dữ liệu về Unicode NFC trước khi ghi (đồng bộ tên & tìm kiếm chính xác)
    js_content = f"""// Data dataset auto-synced from Google Sheets, Base Workflow API & Base HRM API (Unicode NFC)
window.DOSSIER_DATA = {json.dumps(deep_nfc(records), ensure_ascii=False, indent=2)};
window.TABLE_VII_DATA_DAILY = {json.dumps(deep_nfc(table_vii_daily), ensure_ascii=False, indent=2)};
window.TABLE_VII_DATA_WEEKLY = {json.dumps(deep_nfc(table_vii_weekly), ensure_ascii=False, indent=2)};
window.BASE_WORKFLOW_COUNTS = {json.dumps(deep_nfc(base_counts), ensure_ascii=False, indent=2)};
window.BASE_JOBS_MAP = {json.dumps(deep_nfc(jobs_map), ensure_ascii=False, indent=2)};
window.BASE_HRM_NAMES = {json.dumps(deep_nfc(hrm_names), ensure_ascii=False, indent=2)};
window.BASE_HRM_DEPARTMENTS = {json.dumps(deep_nfc(hrm_depts), ensure_ascii=False, indent=2)};
window.BASE_HRM_UID_NAMES = {json.dumps(deep_nfc(hrm_uid2name), ensure_ascii=False, indent=2)};
"""
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"Updated js/data.js successfully with Base HRM official names!")

if __name__ == "__main__":
    if "--loop" in sys.argv:
        interval = 300  # Default 5 minutes (300 seconds)
        for arg in sys.argv:
            if arg.startswith("--interval="):
                try:
                    interval = int(arg.split("=")[1])
                except ValueError:
                    pass
        print(f"Starting continuous auto-sync loop (every {interval}s / 5 minutes)... Press Ctrl+C to stop.")
        while True:
            try:
                fetch_and_sync()
            except Exception as e:
                print(f"Sync error: {e}")
            time.sleep(interval)
    else:
        fetch_and_sync()
