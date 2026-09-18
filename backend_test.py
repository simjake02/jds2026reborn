#!/usr/bin/env python3
"""
Backend API Testing for JDS 2026 Dashboard
Tests all high-priority backend features from test_result.md
"""

import requests
import json
import sys
from typing import Optional, Dict, Any

# Backend URL from frontend/.env
BASE_URL = "https://revenue-order-margin.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
CREDENTIALS = {
    "owner": {"email": "adityapermanarh62@gmail.com", "password": "Jds@2025"},
    "admin": {"email": "admin@jds.com", "password": "Jds@2025"},
    "operator": {"email": "operator@jds.com", "password": "Jds@2025"}
}

class TestSession:
    def __init__(self, role: str):
        self.role = role
        self.session = requests.Session()
        self.user_data = None
        self.token = None
        
    def login(self) -> bool:
        """Login and get session token"""
        creds = CREDENTIALS[self.role]
        try:
            resp = self.session.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                self.user_data = data.get("user")
                # Token is in cookie, session will handle it
                print(f"✓ {self.role.upper()} login successful: {self.user_data.get('email')}")
                return True
            else:
                print(f"✗ {self.role.upper()} login failed: {resp.status_code} - {resp.text}")
                return False
        except Exception as e:
            print(f"✗ {self.role.upper()} login error: {e}")
            return False
    
    def get(self, path: str, params: Optional[Dict] = None) -> requests.Response:
        """GET request"""
        return self.session.get(f"{BASE_URL}{path}", params=params, timeout=15)
    
    def post(self, path: str, data: Dict) -> requests.Response:
        """POST request"""
        return self.session.post(f"{BASE_URL}{path}", json=data, timeout=15)
    
    def put(self, path: str, data: Dict) -> requests.Response:
        """PUT request"""
        return self.session.put(f"{BASE_URL}{path}", json=data, timeout=15)
    
    def delete(self, path: str) -> requests.Response:
        """DELETE request"""
        return self.session.delete(f"{BASE_URL}{path}", timeout=15)


def test_orders_filter_bulan_tahun():
    """Test 1: GET /api/orders with bulan & tahun params - ascending sort by id_order"""
    print("\n" + "="*80)
    print("TEST 1: Orders list filter bulan+tahun & ascending sort by id_order")
    print("="*80)
    
    session = TestSession("owner")
    if not session.login():
        return False
    
    # Test with bulan=9, tahun=2025 (September 2025)
    print("\n→ Testing GET /api/orders?bulan=9&tahun=2025")
    resp = session.get("/orders", params={"bulan": 9, "tahun": 2025})
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    orders = resp.json()
    print(f"✓ Got {len(orders)} orders for September 2025")
    
    if len(orders) == 0:
        print("✗ FAILED: Expected orders for September 2025, got 0")
        return False
    
    # Check filtering: all orders should have tanggal_mulai starting with 2025-09
    filtered_correctly = True
    for order in orders:
        tanggal = order.get("tanggal_mulai", "")
        if not tanggal.startswith("2025-09"):
            print(f"✗ FAILED: Order {order.get('id_order')} has tanggal_mulai={tanggal}, expected 2025-09-*")
            filtered_correctly = False
            break
    
    if filtered_correctly:
        print("✓ All orders correctly filtered to September 2025")
    else:
        return False
    
    # Check sorting: should be ascending by id_order
    id_orders = [o.get("id_order") for o in orders]
    sorted_ids = sorted(id_orders)
    
    if id_orders == sorted_ids:
        print(f"✓ Orders correctly sorted ASCENDING by id_order")
        print(f"  First 3 IDs: {id_orders[:3]}")
        print(f"  Last 3 IDs: {id_orders[-3:]}")
    else:
        print(f"✗ FAILED: Orders NOT sorted ascending by id_order")
        print(f"  Actual order: {id_orders[:5]}")
        print(f"  Expected order: {sorted_ids[:5]}")
        return False
    
    # Test without bulan/tahun - should sort by tanggal_mulai descending
    print("\n→ Testing GET /api/orders (no bulan/tahun params)")
    resp = session.get("/orders")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    orders = resp.json()
    print(f"✓ Got {len(orders)} total orders")
    
    # Check descending sort by tanggal_mulai
    dates = [o.get("tanggal_mulai") for o in orders[:10]]
    sorted_dates = sorted(dates, reverse=True)
    
    if dates == sorted_dates:
        print(f"✓ Orders correctly sorted DESCENDING by tanggal_mulai (default)")
        print(f"  First 3 dates: {dates[:3]}")
    else:
        print(f"✗ FAILED: Orders NOT sorted descending by tanggal_mulai")
        print(f"  Actual: {dates[:3]}")
        print(f"  Expected: {sorted_dates[:3]}")
        return False
    
    print("\n✓✓✓ TEST 1 PASSED: Orders filter bulan+tahun & sorting works correctly")
    return True


def test_order_nominal_dp():
    """Test 2: Order create/update with nominal_dp (DP)"""
    print("\n" + "="*80)
    print("TEST 2: Order create/update with nominal_dp (DP)")
    print("="*80)
    
    session = TestSession("owner")
    if not session.login():
        return False
    
    # Create order with nominal_dp
    order_data = {
        "penyewa_nama": "Test Client DP",
        "tamu": "Test Guest",
        "unit_nama": "Test Unit",
        "tanggal_mulai": "2025-12-01",
        "tanggal_selesai": "2025-12-03",
        "rute": "Jakarta - Bandung",
        "harga": 5000000,
        "status_bayar": "DP",
        "nominal_dp": 1000000,
        "drivers": [
            {
                "driver_nama": "Test Driver",
                "gaji": 500000,
                "segmen": "Segmen A"
            }
        ]
    }
    
    print("\n→ Creating order with nominal_dp=1000000")
    resp = session.post("/orders", order_data)
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    created_order = resp.json()
    order_id = created_order.get("id")
    print(f"✓ Order created: {created_order.get('id_order')}")
    
    # Check nominal_dp persisted
    if created_order.get("nominal_dp") == 1000000:
        print(f"✓ nominal_dp correctly saved: {created_order.get('nominal_dp')}")
    else:
        print(f"✗ FAILED: nominal_dp not saved correctly. Got: {created_order.get('nominal_dp')}, expected: 1000000")
        session.delete(f"/orders/{order_id}")
        return False
    
    # GET the order back
    print(f"\n→ Getting order {order_id}")
    resp = session.get(f"/orders/{order_id}")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        session.delete(f"/orders/{order_id}")
        return False
    
    retrieved_order = resp.json()
    
    if retrieved_order.get("nominal_dp") == 1000000:
        print(f"✓ nominal_dp correctly retrieved: {retrieved_order.get('nominal_dp')}")
    else:
        print(f"✗ FAILED: nominal_dp not retrieved correctly. Got: {retrieved_order.get('nominal_dp')}")
        session.delete(f"/orders/{order_id}")
        return False
    
    # Update nominal_dp
    print(f"\n→ Updating nominal_dp to 2000000")
    order_data["nominal_dp"] = 2000000
    resp = session.put(f"/orders/{order_id}", order_data)
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        session.delete(f"/orders/{order_id}")
        return False
    
    updated_order = resp.json()
    
    if updated_order.get("nominal_dp") == 2000000:
        print(f"✓ nominal_dp correctly updated: {updated_order.get('nominal_dp')}")
    else:
        print(f"✗ FAILED: nominal_dp not updated correctly. Got: {updated_order.get('nominal_dp')}")
        session.delete(f"/orders/{order_id}")
        return False
    
    # Clean up
    print(f"\n→ Cleaning up: deleting test order")
    resp = session.delete(f"/orders/{order_id}")
    if resp.status_code == 200:
        print(f"✓ Test order deleted")
    
    print("\n✓✓✓ TEST 2 PASSED: Order nominal_dp works correctly")
    return True


def test_driver_foto_sim():
    """Test 3: Driver foto_sim (base64) save & retrieve"""
    print("\n" + "="*80)
    print("TEST 3: Driver foto_sim (base64) save & retrieve")
    print("="*80)
    
    session = TestSession("owner")
    if not session.login():
        return False
    
    # Create driver with foto_sim
    driver_data = {
        "nama": "Test Driver Foto SIM",
        "telepon": "081234567890",
        "aktif": True,
        "foto_sim": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="
    }
    
    print("\n→ Creating driver with foto_sim (base64 data URL)")
    resp = session.post("/drivers", driver_data)
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    created_driver = resp.json()
    driver_id = created_driver.get("id")
    print(f"✓ Driver created: {created_driver.get('nama')} (ID: {created_driver.get('driver_id')})")
    
    # Check foto_sim persisted
    if created_driver.get("foto_sim") and created_driver.get("foto_sim").startswith("data:image"):
        print(f"✓ foto_sim correctly saved (length: {len(created_driver.get('foto_sim'))} chars)")
    else:
        print(f"✗ FAILED: foto_sim not saved correctly. Got: {created_driver.get('foto_sim')[:50] if created_driver.get('foto_sim') else None}")
        session.delete(f"/drivers/{driver_id}")
        return False
    
    # GET all drivers and find ours
    print(f"\n→ Getting all drivers to verify foto_sim retrieval")
    resp = session.get("/drivers")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        session.delete(f"/drivers/{driver_id}")
        return False
    
    drivers = resp.json()
    test_driver = next((d for d in drivers if d.get("id") == driver_id), None)
    
    if not test_driver:
        print(f"✗ FAILED: Could not find test driver in list")
        session.delete(f"/drivers/{driver_id}")
        return False
    
    if test_driver.get("foto_sim") and test_driver.get("foto_sim").startswith("data:image"):
        print(f"✓ foto_sim correctly retrieved (length: {len(test_driver.get('foto_sim'))} chars)")
    else:
        print(f"✗ FAILED: foto_sim not retrieved correctly")
        session.delete(f"/drivers/{driver_id}")
        return False
    
    # Update foto_sim
    print(f"\n→ Updating foto_sim with new data URL")
    driver_data["foto_sim"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    resp = session.put(f"/drivers/{driver_id}", driver_data)
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        session.delete(f"/drivers/{driver_id}")
        return False
    
    updated_driver = resp.json()
    
    if updated_driver.get("foto_sim") == driver_data["foto_sim"]:
        print(f"✓ foto_sim correctly updated")
    else:
        print(f"✗ FAILED: foto_sim not updated correctly")
        session.delete(f"/drivers/{driver_id}")
        return False
    
    # Clean up
    print(f"\n→ Cleaning up: deleting test driver")
    resp = session.delete(f"/drivers/{driver_id}")
    if resp.status_code == 200:
        print(f"✓ Test driver deleted")
    
    print("\n✓✓✓ TEST 3 PASSED: Driver foto_sim works correctly")
    return True


def test_analytics_drivers_tasks():
    """Test 4: analytics/drivers returns tasks[] per driver"""
    print("\n" + "="*80)
    print("TEST 4: analytics/drivers returns tasks[] per driver")
    print("="*80)
    
    session = TestSession("owner")
    if not session.login():
        return False
    
    # Test without filters
    print("\n→ Testing GET /api/analytics/drivers (no filters)")
    resp = session.get("/analytics/drivers")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    drivers = data.get("drivers", [])
    
    if len(drivers) == 0:
        print(f"✗ FAILED: Expected drivers data, got empty list")
        return False
    
    print(f"✓ Got {len(drivers)} drivers")
    
    # Check first driver has tasks array
    first_driver = drivers[0]
    print(f"\n→ Checking driver: {first_driver.get('nama')}")
    print(f"  Tugas count: {first_driver.get('tugas')}")
    
    if "tasks" not in first_driver:
        print(f"✗ FAILED: Driver does not have 'tasks' array")
        return False
    
    tasks = first_driver.get("tasks", [])
    tugas_count = first_driver.get("tugas", 0)
    
    print(f"  Tasks array length: {len(tasks)}")
    
    if len(tasks) != tugas_count:
        print(f"✗ FAILED: tasks array length ({len(tasks)}) does not match tugas count ({tugas_count})")
        return False
    
    print(f"✓ tasks array length matches tugas count")
    
    # Check task structure
    if len(tasks) > 0:
        first_task = tasks[0]
        required_fields = ["id_order", "penyewa_nama", "tanggal_mulai", "tanggal_selesai", "rute", "unit_nama"]
        
        print(f"\n→ Checking task structure:")
        all_fields_present = True
        for field in required_fields:
            if field in first_task:
                print(f"  ✓ {field}: {first_task.get(field)}")
            else:
                print(f"  ✗ {field}: MISSING")
                all_fields_present = False
        
        if not all_fields_present:
            print(f"✗ FAILED: Task missing required fields")
            return False
        
        print(f"✓ All required task fields present")
    
    # Test with bulan/tahun filter
    print("\n→ Testing GET /api/analytics/drivers?bulan=9&tahun=2025")
    resp = session.get("/analytics/drivers", params={"bulan": 9, "tahun": 2025})
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    filtered_data = resp.json()
    filtered_drivers = filtered_data.get("drivers", [])
    
    print(f"✓ Got {len(filtered_drivers)} drivers for September 2025")
    
    # Check that tasks are filtered
    if len(filtered_drivers) > 0:
        sample_driver = next((d for d in filtered_drivers if d.get("tugas", 0) > 0), None)
        if sample_driver:
            print(f"\n→ Checking filtered tasks for: {sample_driver.get('nama')}")
            print(f"  Tugas count: {sample_driver.get('tugas')}")
            
            tasks = sample_driver.get("tasks", [])
            print(f"  Tasks array length: {len(tasks)}")
            
            # Verify tasks are from September 2025
            if len(tasks) > 0:
                all_correct_period = True
                for task in tasks[:3]:  # Check first 3
                    tanggal = task.get("tanggal_mulai", "")
                    if not tanggal.startswith("2025-09"):
                        print(f"  ✗ Task {task.get('id_order')} has tanggal_mulai={tanggal}, expected 2025-09-*")
                        all_correct_period = False
                
                if all_correct_period:
                    print(f"✓ Filtered tasks correctly match September 2025")
                else:
                    print(f"✗ FAILED: Some tasks do not match filter period")
                    return False
    
    print("\n✓✓✓ TEST 4 PASSED: analytics/drivers tasks[] works correctly")
    return True


def test_admin_self_edit_only():
    """Test 5: update_user allows admin to edit own account only"""
    print("\n" + "="*80)
    print("TEST 5: update_user allows admin to edit own account only")
    print("="*80)
    
    # Login as admin
    admin_session = TestSession("admin")
    if not admin_session.login():
        return False
    
    # Get admin's own user_id
    print("\n→ Getting admin's user info")
    resp = admin_session.get("/auth/me")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    admin_user = resp.json()
    admin_user_id = admin_user.get("user_id")
    original_name = admin_user.get("name")
    original_email = admin_user.get("email")
    
    print(f"✓ Admin user_id: {admin_user_id}")
    print(f"  Name: {original_name}")
    print(f"  Email: {original_email}")
    print(f"  Role: {admin_user.get('role')}")
    
    # Test 1: Admin can edit own account (name, email, password)
    print(f"\n→ Testing admin editing own account (name change)")
    update_data = {
        "name": "Admin Test Name",
        "email": original_email,
        "password": "Jds@2025"
    }
    
    resp = admin_session.put(f"/users/{admin_user_id}", update_data)
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    updated_user = resp.json()
    
    if updated_user.get("name") == "Admin Test Name":
        print(f"✓ Admin successfully updated own name: {updated_user.get('name')}")
    else:
        print(f"✗ FAILED: Name not updated. Got: {updated_user.get('name')}")
        return False
    
    # Test 2: Admin cannot change own role/active (should be ignored)
    print(f"\n→ Testing admin trying to change own role (should be ignored)")
    update_data = {
        "name": "Admin Test Name",
        "email": original_email,
        "role": "owner",  # Try to escalate
        "active": False
    }
    
    resp = admin_session.put(f"/users/{admin_user_id}", update_data)
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    updated_user = resp.json()
    
    if updated_user.get("role") == "admin":
        print(f"✓ Role change correctly ignored, still: {updated_user.get('role')}")
    else:
        print(f"✗ FAILED: Role was changed to: {updated_user.get('role')}")
        return False
    
    if updated_user.get("active") == True:
        print(f"✓ Active change correctly ignored, still: {updated_user.get('active')}")
    else:
        print(f"✗ FAILED: Active was changed to: {updated_user.get('active')}")
        return False
    
    # Test 3: Admin cannot edit other users (should get 403)
    print(f"\n→ Getting list of users to find another user")
    resp = admin_session.get("/users")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        # Restore admin name before failing
        admin_session.put(f"/users/{admin_user_id}", {"name": original_name, "email": original_email, "password": "Jds@2025"})
        return False
    
    users = resp.json()
    other_user = next((u for u in users if u.get("user_id") != admin_user_id), None)
    
    if not other_user:
        print(f"✗ FAILED: Could not find another user to test with")
        # Restore admin name before failing
        admin_session.put(f"/users/{admin_user_id}", {"name": original_name, "email": original_email, "password": "Jds@2025"})
        return False
    
    other_user_id = other_user.get("user_id")
    print(f"✓ Found other user: {other_user.get('email')} (role: {other_user.get('role')})")
    
    print(f"\n→ Testing admin trying to edit other user (should get 403)")
    update_data = {
        "name": "Should Not Work"
    }
    
    resp = admin_session.put(f"/users/{other_user_id}", update_data)
    
    if resp.status_code == 403:
        print(f"✓ Admin correctly denied access to edit other user (403)")
    else:
        print(f"✗ FAILED: Expected 403, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        # Restore admin name before failing
        admin_session.put(f"/users/{admin_user_id}", {"name": original_name, "email": original_email, "password": "Jds@2025"})
        return False
    
    # Test 4: Owner can still edit any user
    print(f"\n→ Testing owner can edit users")
    owner_session = TestSession("owner")
    if not owner_session.login():
        # Restore admin name before failing
        admin_session.put(f"/users/{admin_user_id}", {"name": original_name, "email": original_email, "password": "Jds@2025"})
        return False
    
    resp = owner_session.put(f"/users/{admin_user_id}", {"name": "Owner Changed This"})
    
    if resp.status_code == 200:
        print(f"✓ Owner can edit admin user (200)")
    else:
        print(f"✗ FAILED: Owner should be able to edit admin. Got: {resp.status_code}")
        # Restore admin name before failing
        admin_session.put(f"/users/{admin_user_id}", {"name": original_name, "email": original_email, "password": "Jds@2025"})
        return False
    
    # Restore admin's original name and email
    print(f"\n→ Restoring admin's original name and email")
    restore_data = {
        "name": original_name,
        "email": original_email,
        "password": "Jds@2025"
    }
    
    resp = owner_session.put(f"/users/{admin_user_id}", restore_data)
    
    if resp.status_code == 200:
        restored_user = resp.json()
        if restored_user.get("name") == original_name and restored_user.get("email") == original_email:
            print(f"✓ Admin account restored to original state")
            print(f"  Name: {restored_user.get('name')}")
            print(f"  Email: {restored_user.get('email')}")
        else:
            print(f"⚠ Warning: Admin account may not be fully restored")
    else:
        print(f"⚠ Warning: Failed to restore admin account: {resp.status_code}")
    
    print("\n✓✓✓ TEST 5 PASSED: Admin self-edit authorization works correctly")
    return True


def test_export_orders():
    """Test 6: export/orders returns xlsx with bulan/tahun params"""
    print("\n" + "="*80)
    print("TEST 6: export/orders returns xlsx with bulan/tahun params")
    print("="*80)
    
    session = TestSession("owner")
    if not session.login():
        return False
    
    # Test without params
    print("\n→ Testing GET /api/export/orders (no params)")
    resp = session.get("/export/orders")
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    content_type = resp.headers.get("Content-Type", "")
    if "spreadsheet" in content_type or "excel" in content_type:
        print(f"✓ Correct content type: {content_type}")
    else:
        print(f"✗ FAILED: Wrong content type: {content_type}")
        return False
    
    content_length = len(resp.content)
    print(f"✓ Got xlsx file ({content_length} bytes)")
    
    # Test with bulan/tahun params
    print("\n→ Testing GET /api/export/orders?bulan=9&tahun=2025")
    resp = session.get("/export/orders", params={"bulan": 9, "tahun": 2025})
    
    if resp.status_code != 200:
        print(f"✗ FAILED: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    content_type = resp.headers.get("Content-Type", "")
    if "spreadsheet" in content_type or "excel" in content_type:
        print(f"✓ Correct content type with params: {content_type}")
    else:
        print(f"✗ FAILED: Wrong content type: {content_type}")
        return False
    
    filtered_length = len(resp.content)
    print(f"✓ Got filtered xlsx file ({filtered_length} bytes)")
    
    print("\n✓✓✓ TEST 6 PASSED: export/orders works correctly")
    return True


def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("JDS 2026 DASHBOARD - BACKEND API TESTING")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print("="*80)
    
    tests = [
        ("Orders filter bulan+tahun & ascending sort", test_orders_filter_bulan_tahun),
        ("Order nominal_dp (DP amount)", test_order_nominal_dp),
        ("Driver foto_sim (base64)", test_driver_foto_sim),
        ("Analytics drivers tasks[]", test_analytics_drivers_tasks),
        ("Admin self-edit authorization", test_admin_self_edit_only),
        ("Export orders xlsx", test_export_orders),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n✗✗✗ TEST FAILED WITH EXCEPTION: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{status}: {test_name}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
