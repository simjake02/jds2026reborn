"""Backend tests for PT. Jawa Dwipa Solutions travel rental app."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # frontend/.env fallback for pytest run outside compose
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

OWNER_TOKEN = "test_sess_owner_123"
ADMIN_TOKEN = "test_sess_admin_123"
OP_TOKEN = "test_sess_op_123"


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --------- Auth ---------
class TestAuth:
    def test_me_owner(self):
        r = requests.get(f"{API}/auth/me", headers=H(OWNER_TOKEN))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "owner"
        assert d["user_id"] == "test-owner-1"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers=H("garbage"))
        assert r.status_code == 401


# --------- RBAC ---------
class TestRBAC:
    def test_operator_cannot_delete_client(self):
        # Create then attempt delete as operator
        r = requests.post(f"{API}/clients", headers=H(OWNER_TOKEN),
                          json={"penyewa_id": "A999TEST", "nama": "TEST_rbac_client"})
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = requests.delete(f"{API}/clients/{cid}", headers=H(OP_TOKEN))
        assert r2.status_code == 403
        # owner cleanup
        requests.delete(f"{API}/clients/{cid}", headers=H(OWNER_TOKEN))

    def test_operator_cannot_delete_order(self):
        # create order as owner then try delete as operator
        payload = {"penyewa_nama": "TEST_rbac_order", "unit_nama": "TESTUNIT", "harga": 1000}
        r = requests.post(f"{API}/orders", headers=H(OWNER_TOKEN), json=payload)
        assert r.status_code == 200
        oid = r.json()["id"]
        r2 = requests.delete(f"{API}/orders/{oid}", headers=H(OP_TOKEN))
        assert r2.status_code == 403
        r3 = requests.delete(f"{API}/orders/{oid}", headers=H(OWNER_TOKEN))
        assert r3.status_code == 200

    def test_operator_cannot_list_users(self):
        r = requests.get(f"{API}/users", headers=H(OP_TOKEN))
        assert r.status_code == 403

    def test_owner_can_list_users(self):
        r = requests.get(f"{API}/users", headers=H(OWNER_TOKEN))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --------- Orders lifecycle ---------
class TestOrders:
    created_id = None

    def test_create_draft(self):
        payload = {"penyewa_id": "A001", "penyewa_nama": "TEST_ClientDraft",
                   "unit_nama": "TESTUNIT", "harga": 5000000,
                   "tanggal_mulai": "2025-09-01", "tanggal_selesai": "2025-09-02"}
        r = requests.post(f"{API}/orders", headers=H(OWNER_TOKEN), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "draft"
        assert d["total_biaya"] == 0
        assert d["margin"] == 5000000
        assert d["penyewa_tipe"] == "A"
        assert d.get("id_order")
        TestOrders.created_id = d["id"]

    def test_edit_add_costs_drivers(self):
        oid = TestOrders.created_id
        assert oid
        payload = {"penyewa_id": "A001", "penyewa_nama": "TEST_ClientDraft",
                   "unit_nama": "TESTUNIT", "harga": 5000000,
                   "biaya_sewa_rekanan": 500000, "biaya_bbm": 300000,
                   "biaya_toll_parkir": 100000, "biaya_lain": 50000,
                   "drivers": [
                       {"driver_nama": "D1", "gaji": 400000, "segmen": "SBY-MLG"},
                       {"driver_nama": "D2", "gaji": 300000, "segmen": "MLG-SBY"},
                   ]}
        r = requests.put(f"{API}/orders/{oid}", headers=H(OWNER_TOKEN), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_gaji_driver"] == 700000
        assert d["total_biaya"] == 500000 + 700000 + 300000 + 100000 + 50000
        assert d["margin"] == 5000000 - d["total_biaya"]
        assert d["status"] == "lengkap"
        assert len(d["drivers"]) == 2

    def test_get_persisted(self):
        r = requests.get(f"{API}/orders/{TestOrders.created_id}", headers=H(OWNER_TOKEN))
        assert r.status_code == 200
        assert r.json()["total_gaji_driver"] == 700000

    def test_validation_gaji_exceeds_harga(self):
        payload = {"penyewa_nama": "TEST_bad", "unit_nama": "U", "harga": 100000,
                   "drivers": [{"driver_nama": "X", "gaji": 200000}]}
        r = requests.post(f"{API}/orders", headers=H(OWNER_TOKEN), json=payload)
        assert r.status_code == 400

    def test_multiple_drivers_up_to_4(self):
        payload = {"penyewa_nama": "TEST_4drv", "unit_nama": "U", "harga": 10000000,
                   "drivers": [{"driver_nama": f"D{i}", "gaji": 100000, "segmen": f"S{i}"} for i in range(4)]}
        r = requests.post(f"{API}/orders", headers=H(OWNER_TOKEN), json=payload)
        assert r.status_code == 200
        d = r.json()
        assert len(d["drivers"]) == 4
        assert d["total_gaji_driver"] == 400000
        requests.delete(f"{API}/orders/{d['id']}", headers=H(OWNER_TOKEN))

    def test_list_search(self):
        r = requests.get(f"{API}/orders", headers=H(OWNER_TOKEN), params={"search": "TEST_ClientDraft"})
        assert r.status_code == 200
        assert any(o["id"] == TestOrders.created_id for o in r.json())

    def test_delete_cleanup(self):
        r = requests.delete(f"{API}/orders/{TestOrders.created_id}", headers=H(OWNER_TOKEN))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/orders/{TestOrders.created_id}", headers=H(OWNER_TOKEN))
        assert r2.status_code == 404


# --------- Master CRUD ---------
class TestMaster:
    def test_client_tipe_auto(self):
        for prefix, expected in [("A100", "A"), ("D100", "D"), ("P100", "P"), ("X100", "P")]:
            r = requests.post(f"{API}/clients", headers=H(OWNER_TOKEN),
                              json={"penyewa_id": prefix + "TEST", "nama": f"TEST_{prefix}"})
            assert r.status_code == 200
            assert r.json()["tipe"] == expected
            requests.delete(f"{API}/clients/{r.json()['id']}", headers=H(OWNER_TOKEN))

    def test_unit_crud(self):
        r = requests.post(f"{API}/units", headers=H(OWNER_TOKEN), json={"unit_id": "TESTU1", "nama": "TEST_Unit"})
        assert r.status_code == 200
        uid = r.json()["id"]
        r = requests.put(f"{API}/units/{uid}", headers=H(OWNER_TOKEN), json={"unit_id": "TESTU1", "nama": "TEST_Unit2"})
        assert r.status_code == 200 and r.json()["nama"] == "TEST_Unit2"
        r = requests.delete(f"{API}/units/{uid}", headers=H(OWNER_TOKEN))
        assert r.status_code == 200

    def test_driver_register_and_list(self):
        r = requests.post(f"{API}/drivers", headers=H(OWNER_TOKEN),
                          json={"nama": "TEST_Driver_XYZ", "telepon": "0800"})
        assert r.status_code == 200
        did = r.json()["id"]
        r2 = requests.get(f"{API}/drivers", headers=H(OWNER_TOKEN))
        assert any(d["id"] == did for d in r2.json())
        requests.delete(f"{API}/drivers/{did}", headers=H(OWNER_TOKEN))


# --------- Analytics ---------
class TestAnalytics:
    def test_executive(self):
        r = requests.get(f"{API}/analytics/executive", headers=H(OWNER_TOKEN))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_omset", "total_margin", "total_order", "total_unit", "trend"):
            assert k in d
        assert d["total_order"] >= 1

    def test_clients(self):
        r = requests.get(f"{API}/analytics/clients", headers=H(OWNER_TOKEN))
        assert r.status_code == 200
        d = r.json()
        assert "by_tipe" in d and "top_clients" in d

    def test_units(self):
        r = requests.get(f"{API}/analytics/units", headers=H(OWNER_TOKEN))
        assert r.status_code == 200
        d = r.json()
        assert "summary" in d and "freq" in d

    def test_drivers_filter(self):
        r = requests.get(f"{API}/analytics/drivers", headers=H(OWNER_TOKEN),
                         params={"bulan": 9, "tahun": 2025})
        assert r.status_code == 200
        assert "drivers" in r.json()


# --------- Export ---------
class TestExport:
    XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    @pytest.mark.parametrize("path", ["/export/orders", "/export/clients-analysis",
                                       "/export/units-analysis", "/export/drivers-analysis"])
    def test_export(self, path):
        r = requests.get(f"{API}{path}", headers=H(OWNER_TOKEN))
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith(self.XLSX_CT)
        assert r.content[:2] == b"PK"  # xlsx zip magic


# --------- User management ---------
class TestUserMgmt:
    def test_change_role_and_revert(self):
        # change operator to admin then back
        r = requests.put(f"{API}/users/test-op-1", headers=H(OWNER_TOKEN),
                         json={"role": "admin", "active": True})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        r = requests.put(f"{API}/users/test-op-1", headers=H(OWNER_TOKEN),
                         json={"role": "operator", "active": True})
        assert r.json()["role"] == "operator"
