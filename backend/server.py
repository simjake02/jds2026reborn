from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import bcrypt
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


def now_utc():
    return datetime.now(timezone.utc)


def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


def client_tipe(penyewa_id: str) -> str:
    if not penyewa_id:
        return "P"
    p = penyewa_id[0].upper()
    return p if p in ("A", "D", "P") else "P"


TIPE_LABEL = {"A": "Agen", "D": "Kedinasan", "P": "Perorangan"}


class OrderDriverItem(BaseModel):
    driver_id: Optional[str] = None
    driver_nama: str
    gaji: float = 0
    segmen: Optional[str] = ""


class OrderCreate(BaseModel):
    penyewa_id: Optional[str] = None
    penyewa_nama: str
    tamu: Optional[str] = ""
    unit_id: Optional[str] = None
    unit_nama: str
    tanggal_mulai: Optional[str] = None
    tanggal_selesai: Optional[str] = None
    rute: Optional[str] = ""
    harga: float = 0
    biaya_sewa_rekanan: float = 0
    biaya_bbm: float = 0
    biaya_toll_parkir: float = 0
    biaya_lain: float = 0
    ket: Optional[str] = ""
    drivers: List[OrderDriverItem] = []


class ClientModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    penyewa_id: str
    nama: str
    tipe: Optional[str] = None


class UnitModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    nama: str


class DriverModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nama: str
    telepon: Optional[str] = ""
    alamat: Optional[str] = ""
    tanggal_bergabung: Optional[str] = None
    aktif: bool = True


async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi pemilik.")
    return user


def require_roles(*roles):
    async def checker(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran ini")
        return user
    return checker


@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    r = requests.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Gagal memverifikasi sesi Google")
    data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        count = await db.users.count_documents({})
        role = "owner" if count == 0 else "operator"
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "role": role,
            "active": True,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(dict(user))
        user = clean(user)

    session_token = data["session_token"]
    expires = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 3600)
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    return {"user": user}


@api_router.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


class LoginBody(BaseModel):
    email: str
    password: str


@api_router.post("/auth/login")
async def auth_login(body: LoginBody, request: Request, response: Response):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until"):
        lu = att["locked_until"]
        lu = datetime.fromisoformat(lu) if isinstance(lu, str) else lu
        if lu.tzinfo is None:
            lu = lu.replace(tzinfo=timezone.utc)
        if lu > now_utc():
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        cnt = (att.get("count", 0) + 1) if att else 1
        upd = {"identifier": ident, "count": cnt}
        if cnt >= 5:
            upd["locked_until"] = (now_utc() + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi pemilik.")
    await db.login_attempts.delete_one({"identifier": ident})
    token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": token,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(), "created_at": now_utc().isoformat(),
    })
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 3600)
    clean(user)
    user.pop("password_hash", None)
    return {"user": user}


class ResetPasswordBody(BaseModel):
    email: str
    new_password: str


@api_router.post("/auth/reset-password")
async def auth_reset_password(body: ResetPasswordBody):
    email = body.email.strip().lower()
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Email tidak terdaftar")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi pemilik.")
    await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{email}$"}})
    return {"ok": True, "message": "Password berhasil diperbarui. Silakan masuk."}


@api_router.get("/users")
async def list_users(user=Depends(require_roles("owner"))):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)


class CreateUserBody(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""
    role: str = "operator"


@api_router.post("/users")
async def create_user_account(body: CreateUserBody, user=Depends(require_roles("owner"))):
    email = body.email.strip().lower()
    if body.role not in ("owner", "admin", "operator"):
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email,
           "name": body.name or email.split("@")[0], "role": body.role, "active": True,
           "password_hash": hash_password(body.password), "created_at": now_utc().isoformat()}
    await db.users.insert_one(dict(doc))
    doc.pop("password_hash", None)
    clean(doc)
    return doc


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, body: dict, user=Depends(require_roles("owner"))):
    upd = {}
    if "role" in body and body["role"] in ("owner", "admin", "operator"):
        upd["role"] = body["role"]
    if "active" in body:
        upd["active"] = bool(body["active"])
    if "name" in body and body["name"]:
        upd["name"] = body["name"]
    if body.get("password"):
        if len(body["password"]) < 6:
            raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
        upd["password_hash"] = hash_password(body["password"])
    if upd:
        await db.users.update_one({"user_id": user_id}, {"$set": upd})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


@api_router.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    return await db.clients.find({}, {"_id": 0}).sort("penyewa_id", 1).to_list(5000)


@api_router.post("/clients")
async def create_client(body: ClientModel, user=Depends(require_roles("owner", "admin", "operator"))):
    body.tipe = client_tipe(body.penyewa_id)
    doc = body.model_dump()
    await db.clients.insert_one(dict(doc))
    return clean(doc)


@api_router.put("/clients/{id}")
async def update_client(id: str, body: ClientModel, user=Depends(require_roles("owner", "admin", "operator"))):
    body.tipe = client_tipe(body.penyewa_id)
    doc = body.model_dump()
    doc["id"] = id
    await db.clients.update_one({"id": id}, {"$set": doc})
    return clean(doc)


@api_router.delete("/clients/{id}")
async def delete_client(id: str, user=Depends(require_roles("owner", "admin"))):
    await db.clients.delete_one({"id": id})
    return {"ok": True}


@api_router.get("/units")
async def list_units(user=Depends(get_current_user)):
    return await db.units.find({}, {"_id": 0}).sort("unit_id", 1).to_list(5000)


@api_router.post("/units")
async def create_unit(body: UnitModel, user=Depends(require_roles("owner", "admin", "operator"))):
    doc = body.model_dump()
    await db.units.insert_one(dict(doc))
    return clean(doc)


@api_router.put("/units/{id}")
async def update_unit(id: str, body: UnitModel, user=Depends(require_roles("owner", "admin", "operator"))):
    doc = body.model_dump()
    doc["id"] = id
    await db.units.update_one({"id": id}, {"$set": doc})
    return clean(doc)


@api_router.delete("/units/{id}")
async def delete_unit(id: str, user=Depends(require_roles("owner", "admin"))):
    await db.units.delete_one({"id": id})
    return {"ok": True}


@api_router.get("/drivers")
async def list_drivers(user=Depends(get_current_user)):
    return await db.drivers.find({}, {"_id": 0}).sort("nama", 1).to_list(5000)


@api_router.post("/drivers")
async def create_driver(body: DriverModel, user=Depends(require_roles("owner", "admin", "operator"))):
    doc = body.model_dump()
    await db.drivers.insert_one(dict(doc))
    return clean(doc)


@api_router.put("/drivers/{id}")
async def update_driver(id: str, body: DriverModel, user=Depends(require_roles("owner", "admin", "operator"))):
    doc = body.model_dump()
    doc["id"] = id
    await db.drivers.update_one({"id": id}, {"$set": doc})
    return clean(doc)


@api_router.delete("/drivers/{id}")
async def delete_driver(id: str, user=Depends(require_roles("owner", "admin"))):
    await db.drivers.delete_one({"id": id})
    return {"ok": True}


def compute_order(o: dict) -> dict:
    total_gaji = sum(float(d.get("gaji") or 0) for d in o.get("drivers", []))
    total_biaya = (float(o.get("biaya_sewa_rekanan") or 0) + total_gaji +
                   float(o.get("biaya_bbm") or 0) + float(o.get("biaya_toll_parkir") or 0) +
                   float(o.get("biaya_lain") or 0))
    o["total_gaji_driver"] = total_gaji
    o["total_biaya"] = total_biaya
    o["margin"] = float(o.get("harga") or 0) - total_biaya
    filled = o.get("biaya_sewa_rekanan") or o.get("biaya_bbm") or o.get("biaya_toll_parkir") or total_gaji
    o["status"] = "lengkap" if filled else "draft"
    return o


async def gen_order_code(tanggal_mulai):
    prefix = "2500"
    if tanggal_mulai:
        try:
            dt = datetime.fromisoformat(tanggal_mulai)
            prefix = dt.strftime("%y%m")
        except Exception:
            pass
    cnt = await db.orders.count_documents({}) + 1
    return f"{prefix}{cnt:04d}"


@api_router.get("/orders")
async def list_orders(user=Depends(get_current_user), search: Optional[str] = None,
                      start: Optional[str] = None, end: Optional[str] = None):
    q = {}
    if search:
        q["$or"] = [{"penyewa_nama": {"$regex": search, "$options": "i"}},
                    {"tamu": {"$regex": search, "$options": "i"}},
                    {"rute": {"$regex": search, "$options": "i"}},
                    {"id_order": {"$regex": search, "$options": "i"}}]
    if start:
        q.setdefault("tanggal_mulai", {})["$gte"] = start
    if end:
        q.setdefault("tanggal_mulai", {})["$lte"] = end
    return await db.orders.find(q, {"_id": 0}).sort("tanggal_mulai", -1).to_list(5000)


@api_router.post("/orders")
async def create_order(body: OrderCreate, user=Depends(require_roles("owner", "admin", "operator"))):
    o = body.model_dump()
    if len(o.get("drivers", [])) > 4:
        raise HTTPException(status_code=400, detail="Maksimal 4 driver dalam satu order")
    total_gaji = sum(float(d.get("gaji") or 0) for d in o.get("drivers", []))
    if total_gaji > float(o.get("harga") or 0):
        raise HTTPException(status_code=400, detail="Total gaji driver tidak boleh melebihi harga sewa")
    o["id"] = str(uuid.uuid4())
    o["id_order"] = await gen_order_code(o.get("tanggal_mulai"))
    o["penyewa_tipe"] = client_tipe(o.get("penyewa_id") or "")
    compute_order(o)
    o["created_by"] = user["email"]
    o["created_at"] = now_utc().isoformat()
    await db.orders.insert_one(dict(o))
    return clean(o)


@api_router.get("/orders/{id}")
async def get_order(id: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return o


@api_router.put("/orders/{id}")
async def update_order(id: str, body: OrderCreate, user=Depends(require_roles("owner", "admin", "operator"))):
    existing = await db.orders.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    o = body.model_dump()
    if len(o.get("drivers", [])) > 4:
        raise HTTPException(status_code=400, detail="Maksimal 4 driver dalam satu order")
    total_gaji = sum(float(d.get("gaji") or 0) for d in o.get("drivers", []))
    if total_gaji > float(o.get("harga") or 0):
        raise HTTPException(status_code=400, detail="Total gaji driver tidak boleh melebihi harga sewa")
    o["id"] = id
    o["id_order"] = existing.get("id_order")
    o["penyewa_tipe"] = client_tipe(o.get("penyewa_id") or "")
    compute_order(o)
    o["created_by"] = existing.get("created_by")
    o["created_at"] = existing.get("created_at")
    o["updated_at"] = now_utc().isoformat()
    await db.orders.update_one({"id": id}, {"$set": o})
    return clean(o)


@api_router.delete("/orders/{id}")
async def delete_order(id: str, user=Depends(require_roles("owner", "admin"))):
    await db.orders.delete_one({"id": id})
    return {"ok": True}


async def fetch_orders(start=None, end=None):
    q = {}
    if start:
        q.setdefault("tanggal_mulai", {})["$gte"] = start
    if end:
        q.setdefault("tanggal_mulai", {})["$lte"] = end
    return await db.orders.find(q, {"_id": 0}).to_list(10000)


def month_key(o):
    tm = o.get("tanggal_mulai")
    if not tm:
        return "N/A"
    try:
        return datetime.fromisoformat(tm).strftime("%Y-%m")
    except Exception:
        return "N/A"


@api_router.get("/analytics/executive")
async def analytics_executive(user=Depends(get_current_user), start: Optional[str] = None, end: Optional[str] = None):
    orders = await fetch_orders(start, end)
    total_omset = sum(float(o.get("harga") or 0) for o in orders)
    total_margin = sum(float(o.get("margin") or 0) for o in orders)
    units = set(o.get("unit_nama") for o in orders if o.get("unit_nama"))
    monthly = defaultdict(lambda: {"omset": 0, "margin": 0, "order": 0})
    for o in orders:
        k = month_key(o)
        monthly[k]["omset"] += float(o.get("harga") or 0)
        monthly[k]["margin"] += float(o.get("margin") or 0)
        monthly[k]["order"] += 1
    trend = [{"bulan": k, **v} for k, v in sorted(monthly.items()) if k != "N/A"]
    return {"total_omset": total_omset, "total_margin": total_margin,
            "total_order": len(orders), "total_unit": len(units), "trend": trend}


@api_router.get("/analytics/clients")
async def analytics_clients(user=Depends(get_current_user), start: Optional[str] = None,
                            end: Optional[str] = None, tipe: Optional[str] = None):
    orders = await fetch_orders(start, end)
    if tipe:
        orders = [o for o in orders if o.get("penyewa_tipe") == tipe]
    by_tipe = defaultdict(lambda: {"order": 0, "omset": 0, "margin": 0})
    by_client = defaultdict(lambda: {"order": 0, "omset": 0, "margin": 0})
    for o in orders:
        t = o.get("penyewa_tipe") or "P"
        by_tipe[t]["order"] += 1
        by_tipe[t]["omset"] += float(o.get("harga") or 0)
        by_tipe[t]["margin"] += float(o.get("margin") or 0)
        c = o.get("penyewa_nama") or "-"
        by_client[c]["order"] += 1
        by_client[c]["omset"] += float(o.get("harga") or 0)
        by_client[c]["margin"] += float(o.get("margin") or 0)
    tipe_data = [{"tipe": k, "label": TIPE_LABEL.get(k, k), **v} for k, v in by_tipe.items()]
    top_clients = sorted([{"nama": k, **v} for k, v in by_client.items()], key=lambda x: x["omset"], reverse=True)
    return {"by_tipe": tipe_data, "top_clients": top_clients}


@api_router.get("/analytics/units")
async def analytics_units(user=Depends(get_current_user), start: Optional[str] = None, end: Optional[str] = None):
    orders = await fetch_orders(start, end)
    by_unit = defaultdict(lambda: {"order": 0, "omset": 0, "margin": 0})
    monthly = defaultdict(lambda: defaultdict(int))
    for o in orders:
        u = o.get("unit_nama") or "-"
        by_unit[u]["order"] += 1
        by_unit[u]["omset"] += float(o.get("harga") or 0)
        by_unit[u]["margin"] += float(o.get("margin") or 0)
        monthly[month_key(o)][u] += 1
    summary = []
    for k, v in by_unit.items():
        avg = v["omset"] / v["order"] if v["order"] else 0
        summary.append({"unit": k, **v, "rata_omset": avg})
    summary.sort(key=lambda x: x["omset"], reverse=True)
    freq = [{"bulan": k, **v} for k, v in sorted(monthly.items()) if k != "N/A"]
    return {"summary": summary, "freq": freq, "units": [s["unit"] for s in summary]}


@api_router.get("/analytics/drivers")
async def analytics_drivers(user=Depends(get_current_user), bulan: Optional[int] = None, tahun: Optional[int] = None):
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    by_driver = defaultdict(lambda: {"tugas": 0, "total_gaji": 0})
    for o in orders:
        mk = month_key(o)
        if mk != "N/A":
            y, m = mk.split("-")
            if tahun and int(y) != tahun:
                continue
            if bulan and int(m) != bulan:
                continue
        elif tahun or bulan:
            continue
        for d in o.get("drivers", []):
            nama = d.get("driver_nama") or "-"
            by_driver[nama]["tugas"] += 1
            by_driver[nama]["total_gaji"] += float(d.get("gaji") or 0)
    data = sorted([{"nama": k, **v} for k, v in by_driver.items()], key=lambda x: x["tugas"], reverse=True)
    return {"drivers": data}


def make_xlsx(title, headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title[:30]
    header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    for ci, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=ci, value=h)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center")
    for ri, row in enumerate(rows, 2):
        for ci, val in enumerate(row, 1):
            ws.cell(row=ri, column=ci, value=val)
    for col in ws.columns:
        width = max((len(str(c.value)) for c in col if c.value is not None), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(width + 4, 45)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def xlsx_response(buf, filename):
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@api_router.get("/export/orders")
async def export_orders(user=Depends(get_current_user), search: Optional[str] = None,
                        start: Optional[str] = None, end: Optional[str] = None):
    orders = await list_orders(user, search, start, end)
    headers = ["ID Order", "Penyewa", "Tipe", "Tamu", "Unit", "Tgl Mulai", "Tgl Selesai", "Rute",
               "Harga", "Sewa Rekanan", "Gaji Driver", "BBM", "Tol/Parkir", "Lain-lain",
               "Total Biaya", "Margin", "Driver", "Status"]
    rows = []
    for o in orders:
        drv = "; ".join(f"{d.get('driver_nama')} ({d.get('segmen','')}) Rp{int(d.get('gaji') or 0)}" for d in o.get("drivers", []))
        rows.append([o.get("id_order"), o.get("penyewa_nama"), TIPE_LABEL.get(o.get("penyewa_tipe"), ""),
                     o.get("tamu"), o.get("unit_nama"), o.get("tanggal_mulai"), o.get("tanggal_selesai"),
                     o.get("rute"), o.get("harga"), o.get("biaya_sewa_rekanan"), o.get("total_gaji_driver"),
                     o.get("biaya_bbm"), o.get("biaya_toll_parkir"), o.get("biaya_lain"),
                     o.get("total_biaya"), o.get("margin"), drv, o.get("status")])
    return xlsx_response(make_xlsx("Transaksi", headers, rows), "transaksi.xlsx")


@api_router.get("/export/clients-analysis")
async def export_clients(user=Depends(get_current_user), start: Optional[str] = None,
                         end: Optional[str] = None, tipe: Optional[str] = None):
    data = await analytics_clients(user, start, end, tipe)
    headers = ["Penyewa", "Jumlah Order", "Omset", "Margin"]
    rows = [[c["nama"], c["order"], c["omset"], c["margin"]] for c in data["top_clients"]]
    return xlsx_response(make_xlsx("Analisis Klien", headers, rows), "analisis_klien.xlsx")


@api_router.get("/export/units-analysis")
async def export_units(user=Depends(get_current_user), start: Optional[str] = None, end: Optional[str] = None):
    data = await analytics_units(user, start, end)
    headers = ["Unit", "Jumlah Order", "Total Omset", "Rata-rata Omset", "Margin"]
    rows = [[u["unit"], u["order"], u["omset"], round(u["rata_omset"]), u["margin"]] for u in data["summary"]]
    return xlsx_response(make_xlsx("Analisis Unit", headers, rows), "analisis_unit.xlsx")


@api_router.get("/export/drivers-analysis")
async def export_drivers(user=Depends(get_current_user), bulan: Optional[int] = None, tahun: Optional[int] = None):
    data = await analytics_drivers(user, bulan, tahun)
    headers = ["Driver", "Jumlah Tugas", "Total Gaji"]
    rows = [[d["nama"], d["tugas"], d["total_gaji"]] for d in data["drivers"]]
    return xlsx_response(make_xlsx("Analisis Driver", headers, rows), "analisis_driver.xlsx")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.on_event("startup")
async def seed_accounts():
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"email index: {e}")
    pwd = os.environ.get("DEFAULT_PASSWORD", "Jds@2025")
    owner_email = os.environ.get("OWNER_EMAIL", "adityapermanarh62@gmail.com").strip().lower()
    defaults = [
        (owner_email, "owner", "Pemilik"),
        ("admin@jds.com", "admin", "Admin Operasional"),
        ("operator@jds.com", "operator", "Operator"),
    ]
    for email, role, name in defaults:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": name,
                "role": role, "active": True, "password_hash": hash_password(pwd),
                "created_at": now_utc().isoformat(),
            })
        else:
            setd = {}
            if role == "owner" and existing.get("role") != "owner":
                setd["role"] = "owner"
            if not existing.get("password_hash"):
                setd["password_hash"] = hash_password(pwd)
            if setd:
                await db.users.update_one({"email": email}, {"$set": setd})
