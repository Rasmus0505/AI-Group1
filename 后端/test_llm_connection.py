import requests
import os
import sys
import ssl

print("=== System Environment Diagnostic ===")
print(f"Python: {sys.version}")
print(f"OpenSSL: {ssl.OPENSSL_VERSION}")

# 1. Check Proxies
print("\n1. Checking Proxy Environment Variables...")
proxies = {
    "HTTP_PROXY": os.environ.get("HTTP_PROXY"),
    "HTTPS_PROXY": os.environ.get("HTTPS_PROXY"),
    "ALL_PROXY": os.environ.get("ALL_PROXY"),
    "http_proxy": os.environ.get("http_proxy"),
    "https_proxy": os.environ.get("https_proxy"),
}
has_proxy = False
for k, v in proxies.items():
    if v:
        print(f"   ⚠️ Found Proxy: {k}={v}")
        has_proxy = True

if not has_proxy:
    print("   ✅ No system proxy variables detected.")

# 2. Check General Internet
print("\n2. Testing General Connectivity (Baidu)...")
try:
    requests.get("https://www.baidu.com", timeout=5)
    print("   ✅ Baidu is reachable (Internet is okay).")
except Exception as e:
    print(f"   ❌ Baidu unreachable: {e}")

# 3. Check Target again with Session
print("\n3. Testing DeepSeek API with Session & custom negotiation...")
TARGET = "https://api.deepseek.com/v1/models"
try:
    s = requests.Session()
    # Sometimes mounting an adapter helps control the pool
    a = requests.adapters.HTTPAdapter(max_retries=3)
    s.mount("https://", a)
    
    headers = {"User-Agent": "PostmanRuntime/7.26.8"} # Mimic Postman
    
    # Try verify=False again just in case
    resp = s.get(TARGET, headers=headers, verify=False, timeout=10)
    print(f"   Status: {resp.status_code}")
except Exception as e:
    print(f"   ❌ Failed again: {e}")

print("\nSuggestions:")
print("1. If you have a VPN/Proxy software (Clash, V2Ray, etc), ensure it's in 'Global' or 'Rule' mode properly.")
print("2. Try temporarily turning OFF your VPN to see if the error changes.")
print("3. Try changing the API Base URL to 'http://api.deepseek.com/v1' (remove 's') just to see if port 80 is open.")

input("\nPress Enter to exit...")
