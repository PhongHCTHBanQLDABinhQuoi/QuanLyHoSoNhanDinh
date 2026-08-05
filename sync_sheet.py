import csv
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from collections import defaultdict

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
    hrm_map = {}
    user_dept_map = {}
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
                for emp in employees:
                    raw_name = emp.get("name", "").strip()
                    first_name = emp.get("first_name", "").strip()
                    last_name = emp.get("last_name", "").strip()
                    full_name = f"{last_name} {first_name}".strip() if (last_name or first_name) else raw_name
                    area_id = str(emp.get("area_id", ""))
                    dept_name = area_dict.get(area_id, "Ban QLDA")

                    if full_name:
                        parts = full_name.split()
                        if len(parts) >= 2:
                            short_2 = f"{parts[-2]} {parts[-1]}"
                            hrm_map[short_2] = full_name
                            user_dept_map[short_2] = dept_name
                        if len(parts) >= 1:
                            short_1 = parts[-1]
                            hrm_map[short_1] = full_name
                            user_dept_map[short_1] = dept_name
                        hrm_map[full_name] = full_name
                        user_dept_map[full_name] = dept_name

                print(f"Parsed {len(employees)} official employees & departments from Base HRM API.")
                return hrm_map, user_dept_map
    except Exception as e:
        print(f"Warning: Could not fetch Base HRM API: {e}")
    return {}, {}

def fetch_base_workflow_counts():
    print("Fetching Base Workflow jobs data via API (including Step 6 fallback rule)...")
    raw_counts = defaultdict(int)
    page = 0
    total_jobs = 0
    jobs_map = {}

    officer_to_username = {
        "Quốc Thạch": ["thachhq"],
        "Thiện Như": ["nhunt"],
        "Thanh Tuyền": ["tuyennt"],
        "Hoài Thương": ["thuonghh"],
        "Tố Lam": ["lamdtt"],
        "Xuân Trúc": ["trucplx"],
        "Văn Tân": ["tanhv"],
        "Anh Tuấn": ["tuanla"],
        "Ngọc Thịnh": ["thinhpn"],
        "Đăng Vinh": ["vinhdhd"],
        "Mỹ Thương": ["thuongctm"],
        "Trọng Nhân": ["nhanvt"],
        "Duy Bảo": ["baotd"],
        "Lan Phương": ["phuongll"],
        "Kim Ngân": ["nganmnk"],
        "Thảo Nguyên": ["nguyennnt"],
        "Kiều Oanh": ["oanhdck"],
        "Thiên Ngân": ["nganntt"],
        "Minh Châu": ["chaundm"],
        "Văn Hải": ["hainv"],
        "Quốc Bảo": ["baohlq"],
        "Duy Quang": ["quangpd"],
        "Thành Giang": ["giangnpt"],
        "Trọng Phúc": ["phucvt"],
        "Thúy Quyên": ["quyendtt"],
        "Thanh Tùng": ["tungnt"],
        "Hoàng Minh": ["minhth"],
        "Ngọc Trân": ["trannn"],
        "Trí Nghĩa": ["nghiadt"],
        "Như Hà": ["hattn"],
        "Vân Khánh": ["khanhptv"],
        "Quang Trãi": ["trailq"],
        "Vinh Hiển": ["hiennv"],
        "Ánh Linh": ["linhpta", "linhhk"],
        "Minh Quân": ["quannm"],
        "Uyên Như": ["nhutnu"],
        "Anh Thư": ["thutna"],
        "Bảo Vi": ["vittb"],
        "Anh Hào": ["haola"],
        "Minh Huy": ["huyhbm"]
    }

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
                        target_usernames = []
                        if isinstance(owners, list) and len(owners) > 0 and stage_id != "116735":
                            for o in owners:
                                if isinstance(o, dict):
                                    un = o.get("username")
                                    if un and un not in excluded_users:
                                        target_usernames.append(un)
                        
                        # Step 6 (116735) OR anhvpm/linhhk/dunglq/banqlda fallback rule:
                        # Trace back through moves to find the compensation officer who handled it at Step 5
                        if not target_usernames:
                            moves = j.get("moves", [])
                            if isinstance(moves, list):
                                for m in reversed(moves):
                                    u = m.get("username")
                                    if u and u not in excluded_users:
                                        target_usernames.append(u)
                                        break
                                        
                        for un in target_usernames:
                            raw_counts[un] += 1

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

        result_map = {}
        for off_name, u_list in officer_to_username.items():
            result_map[off_name] = sum(raw_counts.get(u, 0) for u in u_list)

        result_map["_total_jobs"] = total_jobs
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

            khu_pho = row[1].strip() if len(row) > 1 else ""
            thu_ly = row[2].strip() if len(row) > 2 else ""
            so_duyet = row[3].strip() if len(row) > 3 else ""
            so_tra_sua = row[4].strip() if len(row) > 4 else ""
            ghi_chu = row[5].strip() if len(row) > 5 else ""

            if not khu_pho and not thu_ly and not so_duyet and not so_tra_sua:
                continue

            clean_thu_ly = thu_ly.strip().lower()
            if clean_thu_ly in ["thụ lý", "cán bộ", "cán bộ thụ lý", "thụ lý bqlda", "tên cán bộ", "người thụ lý"]:
                continue

            try:
                val_duyet = int(so_duyet) if so_duyet else 0
            except ValueError:
                val_duyet = 0

            try:
                val_tra_sua = int(so_tra_sua) if so_tra_sua else 0
            except ValueError:
                val_tra_sua = 0

            records.append({
                "timeKey": current_time_label,
                "khuPho": khu_pho,
                "canBo": thu_ly,
                "soHsDuyet": val_duyet,
                "soHsTraSua": val_tra_sua,
                "tongHs": val_duyet + val_tra_sua,
                "ghiChu": ghi_chu
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

    base_counts, jobs_map = fetch_base_workflow_counts()
    hrm_names, hrm_depts = fetch_base_hrm_employees()

    # Attach baseLink to each main dossier record based on maHoSo matching
    for r in records:
        ma_hs = r.get("maHoSo", "")
        clean_hs = re.sub(r'[^A-Z0-9]', '', ma_hs.upper()) if ma_hs else ""
        matched_job = None
        if clean_hs and jobs_map:
            if clean_hs in jobs_map:
                matched_job = jobs_map[clean_hs]
            else:
                # Partial matching (e.g. 106KP18)
                for k, j_info in jobs_map.items():
                    if clean_hs in k or k in clean_hs:
                        matched_job = j_info
                        break

        if matched_job:
            r["baseJobId"] = matched_job["id"]
            r["baseJobName"] = matched_job["name"]
            r["baseStageName"] = matched_job["stageName"]
            r["baseLink"] = matched_job["link"]
        elif ma_hs:
            r["baseLink"] = f"https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da?q={urllib.parse.quote(ma_hs)}"
        else:
            r["baseLink"] = "https://workflow.base.vn/bql-du-an-binh-quoi-thanh-da"

    print(f"Parsed Table VII: {len(table_vii_daily)} daily records, {len(table_vii_weekly)} weekly records.")
    
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js", "data.js")
    js_content = f"""// Data dataset auto-synced from Google Sheets, Base Workflow API & Base HRM API
window.DOSSIER_DATA = {json.dumps(records, ensure_ascii=False, indent=2)};
window.TABLE_VII_DATA_DAILY = {json.dumps(table_vii_daily, ensure_ascii=False, indent=2)};
window.TABLE_VII_DATA_WEEKLY = {json.dumps(table_vii_weekly, ensure_ascii=False, indent=2)};
window.BASE_WORKFLOW_COUNTS = {json.dumps(base_counts, ensure_ascii=False, indent=2)};
window.BASE_JOBS_MAP = {json.dumps(jobs_map, ensure_ascii=False, indent=2)};
window.BASE_HRM_NAMES = {json.dumps(hrm_names, ensure_ascii=False, indent=2)};
window.BASE_HRM_DEPARTMENTS = {json.dumps(hrm_depts, ensure_ascii=False, indent=2)};
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
