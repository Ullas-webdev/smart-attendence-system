#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SERVICE_UUID "12345678-1234-1234-1234-1234567890ab"

void setup() {

  Serial.begin(115200);

  BLEDevice::init("Classroom_Beacon");

  BLEServer *pServer = BLEDevice::createServer();

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();

  pAdvertising->start();

  Serial.println("BLE Beacon Started");
}

void loop() {

  delay(2000);

}