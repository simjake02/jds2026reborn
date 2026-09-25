#!/usr/bin/env python3
"""
Backend API Testing for JDS 2026 Dashboard - BATCH 2
Tests: Cascade updates, per-day driver assignment, kasbon endpoints, payroll + slip PDF
"""
import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://revenue-order-margin.preview.emergentagent.com/api"

# Test credentials
OWNER_EMAIL = "adityapermanarh62@gmail.com"
OWNER_PASSWORD = "Jds@2025"

session_token = None


def login():
    """Login as owner and get session token"""
    global session_token
    print("\n=== LOGIN ===")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": OWNER_EMAIL,
        "password": OWNER_PASSWORD
    })
    print(f"POST /api/auth/login: {resp.status_code}")
    if resp.status_code != 200:
        print(f"ERROR: Login failed - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    session_token = resp.cookies.get("session_token")
    if not session_token:
        print("ERROR: No session_token cookie received")
        sys.exit(1)
    
    print(f"✓ Logged in as {data['user']['email']} (role: {data['user']['role']})")
    return session_token


def headers():
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json"
    }


def test_cascade_driver_update():
    """Test 1: CASCADE UPDATE - Driver rename propagates to orders and analytics"""
    print("\n" + "="*80)
    print("TEST 1: CASCADE UPDATE - DRIVER RENAME")
    print("="*80)
    
    # Step 1: Get drivers list and find one that appears in orders
    print("\n1. GET /api/drivers - finding a driver with assignments...")
    resp = requests.get(f"{BASE_URL}/drivers", headers=headers())
    assert resp.status_code == 200, f"GET /drivers failed: {resp.status_code}"
    drivers = resp.json()
    print(f"✓ Retrieved {len(drivers)} drivers")
    
    # Step 2: Get orders to find a driver with assignments
    print("\n2. GET /api/orders?bulan=8&tahun=2025 - finding driver in orders...")
    resp = requests.get(f"{BASE_URL}/orders?bulan=8&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /orders failed: {resp.status_code}"
    orders = resp.json()
    print(f"✓ Retrieved {len(orders)} orders from Aug 2025")
    
    # Find a driver that appears in orders
    test_driver = None
    original_name = None
    for order in orders:
        for drv in order.get("drivers", []):
            driver_id = drv.get("driver_id")
            if driver_id:
                # Find this driver in drivers list
                for d in drivers:
                    if d.get("driver_id") == driver_id:
                        test_driver = d
                        original_name = d.get("nama")
                        break
                if test_driver:
                    break
        if test_driver:
            break
    
    if not test_driver:
        print("ERROR: Could not find a driver with assignments")
        return False
    
    driver_uuid = test_driver["id"]
    driver_code = test_driver["driver_id"]
    print(f"✓ Selected driver: {driver_code} - {original_name} (UUID: {driver_uuid})")
    
    # Step 3: Rename the driver
    new_name = f"{original_name}_RENAMED_TEST"
    print(f"\n3. PUT /api/drivers/{driver_uuid} - renaming to '{new_name}'...")
    resp = requests.put(f"{BASE_URL}/drivers/{driver_uuid}", headers=headers(), json={
        "driver_id": driver_code,
        "nama": new_name,
        "telepon": test_driver.get("telepon", ""),
        "aktif": True,
        "foto_sim": test_driver.get("foto_sim")
    })
    assert resp.status_code == 200, f"PUT /drivers failed: {resp.status_code} - {resp.text}"
    print(f"✓ Driver renamed successfully")
    
    # Step 4: Verify orders reflect the new name
    print(f"\n4. GET /api/orders?bulan=8&tahun=2025 - verifying cascade to orders...")
    resp = requests.get(f"{BASE_URL}/orders?bulan=8&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /orders failed: {resp.status_code}"
    orders = resp.json()
    
    found_updated = False
    for order in orders:
        for drv in order.get("drivers", []):
            if drv.get("driver_id") == driver_code:
                if drv.get("driver_nama") == new_name:
                    found_updated = True
                    print(f"✓ Order {order['id_order']} shows updated driver name: {new_name}")
                    break
                else:
                    print(f"✗ FAIL: Order {order['id_order']} still shows old name: {drv.get('driver_nama')}")
                    return False
        if found_updated:
            break
    
    if not found_updated:
        print(f"✗ FAIL: No orders found with updated driver name")
        return False
    
    # Step 5: Verify analytics reflects the new name
    print(f"\n5. GET /api/analytics/drivers?bulan=8&tahun=2025 - verifying cascade to analytics...")
    resp = requests.get(f"{BASE_URL}/analytics/drivers?bulan=8&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /analytics/drivers failed: {resp.status_code}"
    analytics = resp.json()
    
    # Analytics groups by driver_nama, not driver_id, so search by name
    found_in_analytics = False
    for driver_stat in analytics.get("drivers", []):
        if driver_stat.get("nama") == new_name:
            found_in_analytics = True
            print(f"✓ Analytics shows updated driver name: {new_name}")
            print(f"   Tasks: {driver_stat.get('tugas')}, Total gaji: {driver_stat.get('total_gaji')}")
            break
    
    if not found_in_analytics:
        print(f"✗ FAIL: Driver with new name '{new_name}' not found in analytics")
        # Check if old name still exists
        for driver_stat in analytics.get("drivers", []):
            if driver_stat.get("nama") == original_name:
                print(f"✗ FAIL: Analytics still shows old name: {original_name}")
                return False
        print(f"   Note: Driver might not have tasks in Aug 2025 period")
        return False
    
    # Step 6: Revert the name back
    print(f"\n6. PUT /api/drivers/{driver_uuid} - reverting to original name...")
    resp = requests.put(f"{BASE_URL}/drivers/{driver_uuid}", headers=headers(), json={
        "driver_id": driver_code,
        "nama": original_name,
        "telepon": test_driver.get("telepon", ""),
        "aktif": True,
        "foto_sim": test_driver.get("foto_sim")
    })
    assert resp.status_code == 200, f"PUT /drivers revert failed: {resp.status_code}"
    print(f"✓ Driver name reverted to: {original_name}")
    
    print("\n✅ TEST 1 PASSED: Driver cascade update works correctly")
    return True


def test_cascade_unit_update():
    """Test 1b: CASCADE UPDATE - Unit rename propagates to orders"""
    print("\n" + "="*80)
    print("TEST 1b: CASCADE UPDATE - UNIT RENAME")
    print("="*80)
    
    # Get units and orders
    print("\n1. GET /api/units - finding a unit with assignments...")
    resp = requests.get(f"{BASE_URL}/units", headers=headers())
    assert resp.status_code == 200, f"GET /units failed: {resp.status_code}"
    units = resp.json()
    print(f"✓ Retrieved {len(units)} units")
    
    print("\n2. GET /api/orders?bulan=9&tahun=2025 - finding unit in orders...")
    resp = requests.get(f"{BASE_URL}/orders?bulan=9&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /orders failed: {resp.status_code}"
    orders = resp.json()
    print(f"✓ Retrieved {len(orders)} orders from Sept 2025")
    
    # Find a unit that appears in orders
    test_unit = None
    original_name = None
    for order in orders:
        unit_id = order.get("unit_id")
        if unit_id:
            for u in units:
                if u.get("unit_id") == unit_id:
                    test_unit = u
                    original_name = u.get("nama")
                    break
        if test_unit:
            break
    
    if not test_unit:
        print("ERROR: Could not find a unit with assignments")
        return False
    
    unit_uuid = test_unit["id"]
    unit_code = test_unit["unit_id"]
    print(f"✓ Selected unit: {unit_code} - {original_name} (UUID: {unit_uuid})")
    
    # Rename the unit
    new_name = f"{original_name}_RENAMED_TEST"
    print(f"\n3. PUT /api/units/{unit_uuid} - renaming to '{new_name}'...")
    resp = requests.put(f"{BASE_URL}/units/{unit_uuid}", headers=headers(), json={
        "unit_id": unit_code,
        "nama": new_name
    })
    assert resp.status_code == 200, f"PUT /units failed: {resp.status_code} - {resp.text}"
    print(f"✓ Unit renamed successfully")
    
    # Verify orders reflect the new name
    print(f"\n4. GET /api/orders?bulan=9&tahun=2025 - verifying cascade to orders...")
    resp = requests.get(f"{BASE_URL}/orders?bulan=9&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /orders failed: {resp.status_code}"
    orders = resp.json()
    
    found_updated = False
    for order in orders:
        if order.get("unit_id") == unit_code:
            if order.get("unit_nama") == new_name:
                found_updated = True
                print(f"✓ Order {order['id_order']} shows updated unit name: {new_name}")
                break
            else:
                print(f"✗ FAIL: Order {order['id_order']} still shows old name: {order.get('unit_nama')}")
                return False
    
    if not found_updated:
        print(f"✗ FAIL: No orders found with updated unit name")
        return False
    
    # Revert the name back
    print(f"\n5. PUT /api/units/{unit_uuid} - reverting to original name...")
    resp = requests.put(f"{BASE_URL}/units/{unit_uuid}", headers=headers(), json={
        "unit_id": unit_code,
        "nama": original_name
    })
    assert resp.status_code == 200, f"PUT /units revert failed: {resp.status_code}"
    print(f"✓ Unit name reverted to: {original_name}")
    
    print("\n✅ TEST 1b PASSED: Unit cascade update works correctly")
    return True


def test_cascade_client_update():
    """Test 1c: CASCADE UPDATE - Client rename propagates to orders"""
    print("\n" + "="*80)
    print("TEST 1c: CASCADE UPDATE - CLIENT RENAME")
    print("="*80)
    
    # Get clients and orders
    print("\n1. GET /api/clients - finding a client with orders...")
    resp = requests.get(f"{BASE_URL}/clients", headers=headers())
    assert resp.status_code == 200, f"GET /clients failed: {resp.status_code}"
    clients = resp.json()
    print(f"✓ Retrieved {len(clients)} clients")
    
    print("\n2. GET /api/orders?bulan=10&tahun=2025 - finding client in orders...")
    resp = requests.get(f"{BASE_URL}/orders?bulan=10&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /orders failed: {resp.status_code}"
    orders = resp.json()
    print(f"✓ Retrieved {len(orders)} orders from Oct 2025")
    
    # Find a client that appears in orders
    test_client = None
    original_name = None
    for order in orders:
        penyewa_id = order.get("penyewa_id")
        if penyewa_id:
            for c in clients:
                if c.get("penyewa_id") == penyewa_id:
                    test_client = c
                    original_name = c.get("nama")
                    break
        if test_client:
            break
    
    if not test_client:
        print("ERROR: Could not find a client with orders")
        return False
    
    client_uuid = test_client["id"]
    client_code = test_client["penyewa_id"]
    print(f"✓ Selected client: {client_code} - {original_name} (UUID: {client_uuid})")
    
    # Rename the client
    new_name = f"{original_name}_RENAMED_TEST"
    print(f"\n3. PUT /api/clients/{client_uuid} - renaming to '{new_name}'...")
    resp = requests.put(f"{BASE_URL}/clients/{client_uuid}", headers=headers(), json={
        "penyewa_id": client_code,
        "nama": new_name
    })
    assert resp.status_code == 200, f"PUT /clients failed: {resp.status_code} - {resp.text}"
    print(f"✓ Client renamed successfully")
    
    # Verify orders reflect the new name
    print(f"\n4. GET /api/orders?bulan=10&tahun=2025 - verifying cascade to orders...")
    resp = requests.get(f"{BASE_URL}/orders?bulan=10&tahun=2025", headers=headers())
    assert resp.status_code == 200, f"GET /orders failed: {resp.status_code}"
    orders = resp.json()
    
    found_updated = False
    for order in orders:
        if order.get("penyewa_id") == client_code:
            if order.get("penyewa_nama") == new_name:
                found_updated = True
                print(f"✓ Order {order['id_order']} shows updated client name: {new_name}")
                break
            else:
                print(f"✗ FAIL: Order {order['id_order']} still shows old name: {order.get('penyewa_nama')}")
                return False
    
    if not found_updated:
        print(f"✗ FAIL: No orders found with updated client name")
        return False
    
    # Revert the name back
    print(f"\n5. PUT /api/clients/{client_uuid} - reverting to original name...")
    resp = requests.put(f"{BASE_URL}/clients/{client_uuid}", headers=headers(), json={
        "penyewa_id": client_code,
        "nama": original_name
    })
    assert resp.status_code == 200, f"PUT /clients revert failed: {resp.status_code}"
    print(f"✓ Client name reverted to: {original_name}")
    
    print("\n✅ TEST 1c PASSED: Client cascade update works correctly")
    return True


def test_per_day_driver_assignment():
    """Test 2: PER-DAY DRIVER ASSIGNMENT - Create order with 5+ drivers, each with tanggal"""
    print("\n" + "="*80)
    print("TEST 2: PER-DAY DRIVER ASSIGNMENT + NO MAX-4 CAP")
    print("="*80)
    
    # Get some drivers
    print("\n1. GET /api/drivers - getting drivers for test order...")
    resp = requests.get(f"{BASE_URL}/drivers", headers=headers())
    assert resp.status_code == 200, f"GET /drivers failed: {resp.status_code}"
    drivers = resp.json()
    print(f"✓ Retrieved {len(drivers)} drivers")
    
    # Create order with 5+ drivers, each with a tanggal
    print("\n2. POST /api/orders - creating order with 5+ drivers with per-day assignments...")
    
    # Use first 6 drivers
    test_drivers = drivers[:6]
    order_drivers = []
    base_date = "2025-11-10"
    total_gaji = 0
    
    for i, drv in enumerate(test_drivers):
        gaji = 150000 + (i * 10000)  # 150k, 160k, 170k, etc.
        total_gaji += gaji
        order_drivers.append({
            "driver_id": drv["driver_id"],
            "driver_nama": drv["nama"],
            "gaji": gaji,
            "segmen": f"Segmen {i+1}",
            "tanggal": f"2025-11-{10+i}"  # Different date for each driver
        })
    
    harga = total_gaji + 500000  # Ensure harga > total_gaji
    
    order_data = {
        "penyewa_nama": "Test Client Multi Driver",
        "tamu": "Test Guest",
        "unit_nama": "Test Unit",
        "tanggal_mulai": "2025-11-10",
        "tanggal_selesai": "2025-11-15",
        "rute": "Surabaya - Jakarta - Bandung",
        "harga": harga,
        "biaya_sewa_rekanan": 0,
        "biaya_bbm": 200000,
        "biaya_toll_parkir": 100000,
        "biaya_lain": 50000,
        "status_bayar": "Belum Bayar",
        "drivers": order_drivers
    }
    
    print(f"   Creating order with {len(order_drivers)} drivers, total_gaji={total_gaji}, harga={harga}")
    resp = requests.post(f"{BASE_URL}/orders", headers=headers(), json=order_data)
    
    if resp.status_code != 200:
        print(f"✗ FAIL: POST /orders returned {resp.status_code} - {resp.text}")
        return False
    
    created_order = resp.json()
    order_id = created_order["id"]
    print(f"✓ Order created successfully: {created_order['id_order']} (UUID: {order_id})")
    print(f"   Drivers count: {len(created_order.get('drivers', []))}")
    
    # Verify the order has all drivers with tanggal persisted
    print("\n3. GET /api/orders/{id} - verifying per-day tanggal persisted...")
    resp = requests.get(f"{BASE_URL}/orders/{order_id}", headers=headers())
    assert resp.status_code == 200, f"GET /orders/{order_id} failed: {resp.status_code}"
    order = resp.json()
    
    if len(order.get("drivers", [])) != len(order_drivers):
        print(f"✗ FAIL: Expected {len(order_drivers)} drivers, got {len(order.get('drivers', []))}")
        return False
    
    print(f"✓ Order has {len(order['drivers'])} drivers")
    
    # Check each driver has tanggal
    all_tanggal_ok = True
    for i, drv in enumerate(order["drivers"]):
        expected_tanggal = order_drivers[i]["tanggal"]
        actual_tanggal = drv.get("tanggal")
        if actual_tanggal == expected_tanggal:
            print(f"   ✓ Driver {drv['driver_nama']}: tanggal={actual_tanggal}, gaji={drv['gaji']}")
        else:
            print(f"   ✗ Driver {drv['driver_nama']}: expected tanggal={expected_tanggal}, got {actual_tanggal}")
            all_tanggal_ok = False
    
    if not all_tanggal_ok:
        print("✗ FAIL: Some drivers missing or incorrect tanggal")
        # Clean up
        requests.delete(f"{BASE_URL}/orders/{order_id}", headers=headers())
        return False
    
    # Test validation: total_gaji > harga should fail
    print("\n4. POST /api/orders - testing validation (total_gaji > harga should fail)...")
    invalid_order = order_data.copy()
    invalid_order["harga"] = total_gaji - 100000  # Make harga less than total_gaji
    
    resp = requests.post(f"{BASE_URL}/orders", headers=headers(), json=invalid_order)
    if resp.status_code == 400:
        print(f"✓ Validation works: 400 error when total_gaji > harga")
    else:
        print(f"✗ FAIL: Expected 400 error, got {resp.status_code}")
        # Clean up
        requests.delete(f"{BASE_URL}/orders/{order_id}", headers=headers())
        return False
    
    # Clean up: delete the test order
    print(f"\n5. DELETE /api/orders/{order_id} - cleaning up test order...")
    resp = requests.delete(f"{BASE_URL}/orders/{order_id}", headers=headers())
    assert resp.status_code == 200, f"DELETE /orders failed: {resp.status_code}"
    print(f"✓ Test order deleted")
    
    print("\n✅ TEST 2 PASSED: Per-day driver assignment works correctly (no max-4 cap)")
    return True


def test_kasbon_endpoints():
    """Test 3: KASBON ENDPOINTS - Create, summary, by-driver, delete"""
    print("\n" + "="*80)
    print("TEST 3: KASBON ENDPOINTS")
    print("="*80)
    
    # Get a driver
    print("\n1. GET /api/drivers - getting a driver for kasbon test...")
    resp = requests.get(f"{BASE_URL}/drivers", headers=headers())
    assert resp.status_code == 200, f"GET /drivers failed: {resp.status_code}"
    drivers = resp.json()
    test_driver = drivers[0]
    driver_id = test_driver["driver_id"]
    print(f"✓ Selected driver: {driver_id} - {test_driver['nama']}")
    
    # Create kasbon
    print("\n2. POST /api/kasbon - creating kasbon entry...")
    kasbon_data = {
        "driver_id": driver_id,
        "tanggal": "2025-08-05",
        "jumlah": 1000000
    }
    resp = requests.post(f"{BASE_URL}/kasbon", headers=headers(), json=kasbon_data)
    
    if resp.status_code != 200:
        print(f"✗ FAIL: POST /kasbon returned {resp.status_code} - {resp.text}")
        return False
    
    kasbon = resp.json()
    kasbon_id = kasbon["id"]
    print(f"✓ Kasbon created: {kasbon_id}, jumlah={kasbon['jumlah']}")
    
    # Get kasbon summary
    print("\n3. GET /api/kasbon/summary - verifying driver appears in summary...")
    resp = requests.get(f"{BASE_URL}/kasbon/summary", headers=headers())
    assert resp.status_code == 200, f"GET /kasbon/summary failed: {resp.status_code}"
    summary = resp.json()
    
    found_driver = None
    for drv in summary.get("drivers", []):
        if drv["driver_id"] == driver_id:
            found_driver = drv
            break
    
    if not found_driver:
        print(f"✗ FAIL: Driver {driver_id} not found in kasbon summary")
        return False
    
    print(f"✓ Driver found in summary:")
    print(f"   jumlah (count): {found_driver['jumlah']}")
    print(f"   total_pinjam: {found_driver['total_pinjam']}")
    print(f"   total_potong: {found_driver['total_potong']}")
    print(f"   sisa: {found_driver['sisa']}")
    
    # Verify sisa calculation
    expected_sisa = found_driver['total_pinjam'] - found_driver['total_potong']
    if abs(found_driver['sisa'] - expected_sisa) > 0.01:
        print(f"✗ FAIL: Sisa calculation incorrect. Expected {expected_sisa}, got {found_driver['sisa']}")
        return False
    print(f"✓ Sisa calculation correct: {found_driver['sisa']}")
    
    # Get kasbon by driver
    print(f"\n4. GET /api/kasbon/driver/{driver_id} - getting driver kasbon details...")
    resp = requests.get(f"{BASE_URL}/kasbon/driver/{driver_id}", headers=headers())
    assert resp.status_code == 200, f"GET /kasbon/driver failed: {resp.status_code}"
    driver_kasbon = resp.json()
    
    print(f"✓ Driver kasbon details:")
    print(f"   pinjam entries: {len(driver_kasbon['pinjam'])}")
    print(f"   potong entries: {len(driver_kasbon['potong'])}")
    print(f"   total_pinjam: {driver_kasbon['total_pinjam']}")
    print(f"   total_potong: {driver_kasbon['total_potong']}")
    print(f"   sisa: {driver_kasbon['sisa']}")
    
    # Verify our kasbon entry is in the list
    found_entry = False
    for entry in driver_kasbon['pinjam']:
        if entry['id'] == kasbon_id:
            found_entry = True
            print(f"✓ Our kasbon entry found in pinjam list: jumlah={entry['jumlah']}")
            break
    
    if not found_entry:
        print(f"✗ FAIL: Kasbon entry {kasbon_id} not found in driver's pinjam list")
        return False
    
    # Delete kasbon (keep one for slip test, but we'll create a new one there)
    print(f"\n5. DELETE /api/kasbon/{kasbon_id} - deleting kasbon entry...")
    resp = requests.delete(f"{BASE_URL}/kasbon/{kasbon_id}", headers=headers())
    
    if resp.status_code != 200:
        print(f"✗ FAIL: DELETE /kasbon returned {resp.status_code} - {resp.text}")
        return False
    
    print(f"✓ Kasbon deleted successfully")
    
    # Verify deletion
    print(f"\n6. GET /api/kasbon/driver/{driver_id} - verifying deletion...")
    resp = requests.get(f"{BASE_URL}/kasbon/driver/{driver_id}", headers=headers())
    assert resp.status_code == 200, f"GET /kasbon/driver failed: {resp.status_code}"
    driver_kasbon = resp.json()
    
    # Check if our entry is gone
    for entry in driver_kasbon['pinjam']:
        if entry['id'] == kasbon_id:
            print(f"✗ FAIL: Kasbon entry still exists after deletion")
            return False
    
    print(f"✓ Kasbon entry successfully deleted")
    
    print("\n✅ TEST 3 PASSED: Kasbon endpoints work correctly")
    return True


def test_payroll_and_slip():
    """Test 4: PAYROLL + SLIP PDF + KASBON DEDUCTION"""
    print("\n" + "="*80)
    print("TEST 4: PAYROLL + SLIP PDF + KASBON DEDUCTION")
    print("="*80)
    
    # Get payroll for August 2025, periode 1 (days 1-15)
    print("\n1. GET /api/payroll?tahun=2025&bulan=8&periode=1 - getting payroll data...")
    resp = requests.get(f"{BASE_URL}/payroll?tahun=2025&bulan=8&periode=1", headers=headers())
    assert resp.status_code == 200, f"GET /payroll failed: {resp.status_code}"
    payroll_data = resp.json()
    
    print(f"✓ Payroll data retrieved:")
    print(f"   Period: {payroll_data['periode']['start']} to {payroll_data['periode']['end']}")
    print(f"   Drivers: {len(payroll_data['drivers'])}")
    
    if len(payroll_data['drivers']) == 0:
        print("✗ FAIL: No drivers found in payroll for Aug 2025 periode 1")
        return False
    
    # Verify periode bucketing (all items should be between days 01-15)
    print("\n2. Verifying periode bucketing (days 01-15)...")
    all_dates_ok = True
    for driver in payroll_data['drivers']:
        for item in driver['items']:
            tanggal = item['tanggal']
            day = int(tanggal.split('-')[2])
            if not (1 <= day <= 15):
                print(f"   ✗ FAIL: Driver {driver['driver_nama']} has item with tanggal={tanggal} (day {day}) outside periode 1")
                all_dates_ok = False
    
    if not all_dates_ok:
        print("✗ FAIL: Some items fall outside periode 1 bucket")
        return False
    
    print("✓ All items correctly bucketed in periode 1 (days 01-15)")
    
    # Test periode 2 (days 16-end)
    print("\n3. GET /api/payroll?tahun=2025&bulan=8&periode=2 - testing periode 2...")
    resp = requests.get(f"{BASE_URL}/payroll?tahun=2025&bulan=8&periode=2", headers=headers())
    assert resp.status_code == 200, f"GET /payroll periode 2 failed: {resp.status_code}"
    payroll_p2 = resp.json()
    
    print(f"✓ Periode 2 data retrieved:")
    print(f"   Period: {payroll_p2['periode']['start']} to {payroll_p2['periode']['end']}")
    print(f"   Drivers: {len(payroll_p2['drivers'])}")
    
    # Verify periode 2 bucketing (all items should be between days 16-31)
    all_dates_ok = True
    for driver in payroll_p2['drivers']:
        for item in driver['items']:
            tanggal = item['tanggal']
            day = int(tanggal.split('-')[2])
            if not (16 <= day <= 31):
                print(f"   ✗ FAIL: Driver {driver['driver_nama']} has item with tanggal={tanggal} (day {day}) outside periode 2")
                all_dates_ok = False
    
    if not all_dates_ok:
        print("✗ FAIL: Some items fall outside periode 2 bucket")
        return False
    
    print("✓ All items correctly bucketed in periode 2 (days 16-31)")
    
    # Select a driver with assignments for slip test
    test_driver = payroll_data['drivers'][0]
    driver_id = test_driver['driver_id']
    print(f"\n4. Selected driver for slip test: {driver_id} - {test_driver['driver_nama']}")
    print(f"   Items: {len(test_driver['items'])}")
    print(f"   Total gaji: {test_driver['total_gaji']}")
    print(f"   Sisa kasbon: {test_driver['sisa_kasbon']}")
    
    # Create a kasbon for this driver
    print(f"\n5. POST /api/kasbon - creating kasbon for slip test...")
    kasbon_data = {
        "driver_id": driver_id,
        "tanggal": "2025-08-01",
        "jumlah": 1000000
    }
    resp = requests.post(f"{BASE_URL}/kasbon", headers=headers(), json=kasbon_data)
    assert resp.status_code == 200, f"POST /kasbon failed: {resp.status_code}"
    kasbon = resp.json()
    print(f"✓ Kasbon created: jumlah={kasbon['jumlah']}")
    
    # Get current sisa
    resp = requests.get(f"{BASE_URL}/kasbon/driver/{driver_id}", headers=headers())
    assert resp.status_code == 200, f"GET /kasbon/driver failed: {resp.status_code}"
    before_kasbon = resp.json()
    sisa_before = before_kasbon['sisa']
    print(f"✓ Sisa kasbon before slip: {sisa_before}")
    
    # Generate slip with potongan_kasbon
    print(f"\n6. POST /api/payroll/slip - generating slip PDF with potongan_kasbon=500000...")
    slip_data = {
        "driver_id": driver_id,
        "tahun": 2025,
        "bulan": 8,
        "periode": 1,
        "potongan_kasbon": 500000
    }
    resp = requests.post(f"{BASE_URL}/payroll/slip", headers=headers(), json=slip_data)
    
    if resp.status_code != 200:
        print(f"✗ FAIL: POST /payroll/slip returned {resp.status_code} - {resp.text}")
        return False
    
    # Verify response is PDF
    content_type = resp.headers.get('Content-Type', '')
    if 'application/pdf' not in content_type:
        print(f"✗ FAIL: Expected Content-Type application/pdf, got {content_type}")
        return False
    
    pdf_size = len(resp.content)
    print(f"✓ Slip PDF generated successfully:")
    print(f"   Content-Type: {content_type}")
    print(f"   PDF size: {pdf_size} bytes")
    
    if pdf_size < 1000:
        print(f"✗ FAIL: PDF size too small ({pdf_size} bytes), likely empty or invalid")
        return False
    
    # Verify kasbon deduction
    print(f"\n7. GET /api/kasbon/driver/{driver_id} - verifying kasbon deduction...")
    resp = requests.get(f"{BASE_URL}/kasbon/driver/{driver_id}", headers=headers())
    assert resp.status_code == 200, f"GET /kasbon/driver failed: {resp.status_code}"
    after_kasbon = resp.json()
    sisa_after = after_kasbon['sisa']
    
    print(f"✓ Sisa kasbon after slip: {sisa_after}")
    print(f"   Sisa before: {sisa_before}")
    print(f"   Potongan: 500000")
    print(f"   Expected sisa after: {sisa_before - 500000}")
    
    if abs(sisa_after - (sisa_before - 500000)) > 0.01:
        print(f"✗ FAIL: Sisa kasbon not decreased correctly")
        return False
    
    print(f"✓ Kasbon deduction correct: sisa decreased by exactly 500000")
    
    # Verify potong entry was added
    if len(after_kasbon['potong']) <= len(before_kasbon['potong']):
        print(f"✗ FAIL: No potong entry added")
        return False
    
    print(f"✓ Potong entry added to kasbon records")
    
    # Test slip for driver with no assignments (should return 404)
    print(f"\n8. POST /api/payroll/slip - testing 404 for driver with no assignments...")
    
    # Find a driver with no assignments in this period
    resp = requests.get(f"{BASE_URL}/drivers", headers=headers())
    all_drivers = resp.json()
    
    # Find a driver not in payroll
    driver_ids_in_payroll = {d['driver_id'] for d in payroll_data['drivers']}
    no_assignment_driver = None
    for drv in all_drivers:
        if drv['driver_id'] not in driver_ids_in_payroll:
            no_assignment_driver = drv['driver_id']
            break
    
    if no_assignment_driver:
        slip_data_404 = {
            "driver_id": no_assignment_driver,
            "tahun": 2025,
            "bulan": 8,
            "periode": 1,
            "potongan_kasbon": 0
        }
        resp = requests.post(f"{BASE_URL}/payroll/slip", headers=headers(), json=slip_data_404)
        
        if resp.status_code == 404:
            print(f"✓ Correctly returns 404 for driver with no assignments")
        else:
            print(f"✗ FAIL: Expected 404, got {resp.status_code}")
            return False
    else:
        print("⚠ Skipped: All drivers have assignments in this period")
    
    print("\n✅ TEST 4 PASSED: Payroll and slip PDF work correctly with kasbon deduction")
    return True


def main():
    """Run all tests"""
    print("="*80)
    print("JDS 2026 DASHBOARD - BATCH 2 BACKEND TESTING")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test User: {OWNER_EMAIL}")
    
    # Login
    login()
    
    # Run all tests
    results = {}
    
    try:
        results['cascade_driver'] = test_cascade_driver_update()
    except Exception as e:
        print(f"\n✗ TEST 1 FAILED WITH EXCEPTION: {e}")
        results['cascade_driver'] = False
    
    try:
        results['cascade_unit'] = test_cascade_unit_update()
    except Exception as e:
        print(f"\n✗ TEST 1b FAILED WITH EXCEPTION: {e}")
        results['cascade_unit'] = False
    
    try:
        results['cascade_client'] = test_cascade_client_update()
    except Exception as e:
        print(f"\n✗ TEST 1c FAILED WITH EXCEPTION: {e}")
        results['cascade_client'] = False
    
    try:
        results['per_day_driver'] = test_per_day_driver_assignment()
    except Exception as e:
        print(f"\n✗ TEST 2 FAILED WITH EXCEPTION: {e}")
        results['per_day_driver'] = False
    
    try:
        results['kasbon'] = test_kasbon_endpoints()
    except Exception as e:
        print(f"\n✗ TEST 3 FAILED WITH EXCEPTION: {e}")
        results['kasbon'] = False
    
    try:
        results['payroll_slip'] = test_payroll_and_slip()
    except Exception as e:
        print(f"\n✗ TEST 4 FAILED WITH EXCEPTION: {e}")
        results['payroll_slip'] = False
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
