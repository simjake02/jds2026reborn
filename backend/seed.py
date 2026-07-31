"""Seed masters + orders from Excel, and default users."""
import os, uuid
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
import openpyxl
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / '.env')
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]

TIPE = lambda pid: (pid[0].upper() if pid and pid[0].upper() in ("A", "D", "P") else "P")


def compute(o):
    tg = sum(float(d.get("gaji") or 0) for d in o["drivers"])
    tb = tg + o["biaya_sewa_rekanan"] + o["biaya_bbm"] + o["biaya_toll_parkir"] + o["biaya_lain"]
    o["total_gaji_driver"] = tg
    o["total_biaya"] = tb
    o["margin"] = o["harga"] - tb
    o["status"] = "lengkap" if (o["biaya_sewa_rekanan"] or o["biaya_bbm"] or o["biaya_toll_parkir"] or tg) else "draft"
    return o


def num(v):
    try:
        return float(v) if v is not None else 0
    except Exception:
        return 0


def datestr(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    return None


def run():
    wb = openpyxl.load_workbook(ROOT / 'data' / 'jds.xlsx', data_only=True)

    # Masters from Sheet2
    s2 = list(wb['Sheet2'].iter_rows(values_only=True))
    clients, units = [], []
    for r in s2[1:]:
        if r[1] and r[2]:
            clients.append({"id": str(uuid.uuid4()), "penyewa_id": str(r[1]).strip(),
                            "nama": str(r[2]).strip(), "tipe": TIPE(str(r[1]).strip())})
        if r[5] and r[6]:
            units.append({"id": str(uuid.uuid4()), "unit_id": str(r[5]).strip(), "nama": str(r[6]).strip()})

    # Orders from Sheet1 grouped by ID Order
    s1 = list(wb['Sheet1'].iter_rows(values_only=True))
    groups = defaultdict(list)
    order_seq = []
    for r in s1[1:]:
        if not r[0]:
            continue
        oid = str(r[0]).strip()
        if oid not in groups:
            order_seq.append(oid)
        groups[oid].append(r)

    driver_names = set()
    orders = []
    for oid in order_seq:
        rows = groups[oid]
        head = rows[0]
        drivers = []
        for r in rows:
            dname = (str(r[6]).strip() if r[6] else "")
            if dname:
                driver_names.add(dname)
                drivers.append({"driver_id": None, "driver_nama": dname,
                                "gaji": num(r[12]), "segmen": (str(r[9]).strip() if r[9] else "")})
        o = {
            "id": str(uuid.uuid4()),
            "id_order": oid,
            "penyewa_nama": str(head[1]).strip() if head[1] else "",
            "penyewa_id": str(head[2]).strip() if head[2] else "",
            "penyewa_tipe": TIPE(str(head[2]).strip() if head[2] else ""),
            "tamu": str(head[3]).strip() if head[3] else "",
            "unit_id": str(head[4]).strip() if head[4] else "",
            "unit_nama": str(head[5]).strip() if head[5] else "",
            "tanggal_mulai": datestr(head[7]),
            "tanggal_selesai": datestr(head[8]),
            "rute": str(head[9]).strip() if head[9] else "",
            "harga": num(head[10]),
            "biaya_sewa_rekanan": num(head[11]),
            "biaya_bbm": num(head[13]),
            "biaya_toll_parkir": num(head[14]),
            "biaya_lain": num(head[15]),
            "ket": str(head[16]).strip() if head[16] else "",
            "drivers": drivers,
            "created_by": "import@jds",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        compute(o)
        orders.append(o)

    drivers_master = [{"id": str(uuid.uuid4()), "nama": n, "telepon": "", "alamat": "",
                       "tanggal_bergabung": None, "aktif": True} for n in sorted(driver_names)]

    db.clients.delete_many({})
    db.units.delete_many({})
    db.drivers.delete_many({})
    db.orders.delete_many({})
    if clients: db.clients.insert_many(clients)
    if units: db.units.insert_many(units)
    if drivers_master: db.drivers.insert_many(drivers_master)
    if orders: db.orders.insert_many(orders)

    print(f"clients={len(clients)} units={len(units)} drivers={len(drivers_master)} orders={len(orders)}")
    print("sample order:", {k: orders[0][k] for k in ("id_order","penyewa_nama","harga","total_gaji_driver","margin","drivers")} if orders else None)


if __name__ == "__main__":
    run()
