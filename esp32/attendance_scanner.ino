/**
 * AttendSmart ESP32 BLE Scanner Firmware
 * =======================================
 * 
 * This firmware runs on an ESP32 in each classroom.
 * It continuously scans for BLE devices and POSTs detected
 * device MAC addresses to the AttendSmart backend server.
 * 
 * Hardware: ESP32 DevKit (any variant)
 * Libraries needed:
 *   - ESP32 BLE Arduino (built-in with ESP32 board package)
 *   - ArduinoJson (install via Library Manager: v6.x)
 *   - WiFi.h (built-in)
 *   - HTTPClient.h (built-in)
 * 
 * Setup:
 *   1. Install ESP32 board in Arduino IDE:
 *      File > Preferences > Additional URLs:
 *      https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *   2. Tools > Board > ESP32 Dev Module
 *   3. Install ArduinoJson library
 *   4. Flash this sketch to ESP32
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================
// CONFIGURATION — Edit these values before flashing
// ============================================================
const char* WIFI_SSID       = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD   = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL      = "http://YOUR_SERVER_IP:5000/api/proximity/verify-proximity";
const char* ESP32_DEVICE_ID = "ESP32_CLASSROOM_A";  // Unique per classroom
const char* CLASS_ID        = "YOUR_CLASS_ID_FROM_DB"; // Optional: MongoDB class _id

// RSSI threshold: only report devices within ~5 meters
// -60 to -70 dBm ≈ 3-8 meter range (adjust per room)
const int   RSSI_THRESHOLD  = -70;
const int   SCAN_DURATION   = 3;         // BLE scan duration in seconds
const int   SCAN_INTERVAL   = 5000;      // ms between scans
const int   HTTP_TIMEOUT    = 5000;      // ms
// ============================================================

BLEScan* pBLEScan;

// Custom callback: called for each BLE device found during scan
class AttendScanCallback : public BLEAdvertisedDeviceCallbacks {
public:
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    int rssi = advertisedDevice.getRSSI();
    String deviceAddress = advertisedDevice.getAddress().toString().c_str();
    deviceAddress.toUpperCase();

    // Filter by signal strength
    if (rssi < RSSI_THRESHOLD) {
      Serial.printf("[SKIP] %s | RSSI: %d (too weak)\n", deviceAddress.c_str(), rssi);
      return;
    }

    Serial.printf("[DETECTED] %s | RSSI: %d dBm\n", deviceAddress.c_str(), rssi);
    reportToServer(deviceAddress, rssi);
  }

private:
  void reportToServer(const String& macAddress, int rssi) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[ERROR] WiFi not connected, skipping HTTP call");
      return;
    }

    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(HTTP_TIMEOUT);

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["bluetoothDeviceId"] = macAddress;
    doc["esp32DeviceId"]     = ESP32_DEVICE_ID;
    doc["rssi"]              = rssi;
    if (strlen(CLASS_ID) > 0) {
      doc["classId"]         = CLASS_ID;
    }

    String payload;
    serializeJson(doc, payload);

    int httpCode = http.POST(payload);

    if (httpCode == 200 || httpCode == 201) {
      String response = http.getString();
      Serial.printf("[SERVER] OK: %s\n", response.c_str());
    } else if (httpCode > 0) {
      Serial.printf("[SERVER] HTTP %d\n", httpCode);
    } else {
      Serial.printf("[ERROR] Connection failed: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
  }
};

void connectWiFi() {
  Serial.printf("\n[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Failed to connect. Will retry during scan loop.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("========================================");
  Serial.println("   AttendSmart ESP32 BLE Scanner v1.0  ");
  Serial.printf("   Device ID: %s\n", ESP32_DEVICE_ID);
  Serial.println("========================================");

  // Connect to WiFi
  connectWiFi();

  // Initialize BLE
  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new AttendScanCallback(), true);
  pBLEScan->setActiveScan(true);   // Active scan gets more info but uses more power
  pBLEScan->setInterval(100);      // ms
  pBLEScan->setWindow(99);         // Must be <= interval

  Serial.println("[BLE] Scanner initialized. Starting scan loop...\n");
}

void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Reconnecting...");
    connectWiFi();
  }

  Serial.printf("\n[SCAN] Starting %d-second BLE scan...\n", SCAN_DURATION);
  BLEScanResults results = pBLEScan->start(SCAN_DURATION, false);
  Serial.printf("[SCAN] Found %d BLE devices total\n", results.getCount());

  pBLEScan->clearResults(); // Free memory
  delay(SCAN_INTERVAL);
}

/**
 * DEPLOYMENT NOTES:
 * =================
 * 
 * 1. Power: Use a phone charger or USB power bank. The ESP32 draws ~80-160mA during BLE scan.
 * 
 * 2. Placement: Mount the ESP32 near the front of the classroom (teacher's desk area).
 *    BLE range: ~10m indoors. RSSI_THRESHOLD of -70 keeps it to ~5m radius.
 * 
 * 3. Security: In production, add a shared secret header to prevent unauthorized POSTs:
 *    http.addHeader("X-ESP32-Secret", "your_shared_secret");
 *    Then verify this header in the /verify-proximity route middleware.
 * 
 * 4. Multiple classrooms: Flash a different ESP32_DEVICE_ID and CLASS_ID for each room.
 * 
 * 5. Student phone Bluetooth:
 *    - Android: BLE MAC address is randomized since Android 8+. Students must install
 *      a companion app that uses the phone's UUID (UUID is stable per app install).
 *    - iOS: Similarly uses randomized advertising addresses. Use a custom GATT service UUID.
 *    - For a college deployment, provide a simple React Native / Flutter companion app
 *      that advertises a stable UUID via BLE peripheral mode.
 * 
 * 6. For testing without a phone: Use a BLE peripheral simulator app like
 *    "BLE Peripheral Simulator" (Android) or "LightBlue" (iOS/Android).
 */
