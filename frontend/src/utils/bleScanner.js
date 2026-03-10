export async function scanForESP32Beacon() {

  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth not supported. Use Chrome.");
  }

  try {

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true
    });

    return {
      name: device.name || "Unknown Device",
      id: device.id,
      rssi: -60
    };

  } catch (error) {

    console.log("Scan cancelled");
    return null;

  }

}