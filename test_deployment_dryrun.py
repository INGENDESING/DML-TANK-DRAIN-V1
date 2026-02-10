
import sys
import os
import json

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from main import app
    print("SUCCESS: App imported successfully.")
    
    # Create a test client
    client = app.test_client()
    
    # Test health check
    response = client.get('/health')
    if response.status_code == 200:
        print("SUCCESS: Health check passed.")
    else:
        print(f"FAILURE: Health check failed with status {response.status_code}")
        sys.exit(1)

    # Test basic simulation (dry run)
    payload = {
        "tank_diameter": 3.0,
        "tank_height": 5.0,
        "initial_level": 4.0,
        "valve_open": 50,
        "calc_mode": "pressure_fixed"
    }
    
    response = client.post('/simulate', json=payload)
    if response.status_code == 200:
        data = response.get_json()
        if "results" in data and len(data["results"]) > 0:
            print("SUCCESS: Simulation ran successfully.")
        else:
            print("FAILURE: Simulation returned no results.")
            sys.exit(1)
    else:
        print(f"FAILURE: Simulation failed with status {response.status_code}")
        print(response.get_data(as_text=True))
        sys.exit(1)

except Exception as e:
    print(f"CRITICAL FAILURE: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
