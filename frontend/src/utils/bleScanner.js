export async function scanForESP32Beacon() {
  // Web Bluetooth requires a secure context (HTTPS)
  if (!window.isSecureContext) {
    throw new Error("Web Bluetooth requires a secure HTTPS connection.");
  }

  if (!navigator.bluetooth) {
    // Check if it's potentially iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      throw new Error("Web Bluetooth is not supported in Chrome/Safari on iOS. Please use the 'Bluefy' or 'WebBLE' browser.");
    }
    throw new Error("Web Bluetooth is not supported in this browser. Please use Chrome on Android or Desktop.");
  }

  try {
    console.log("Requesting Bluetooth device...");
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true
    });

    console.log("Device selected:", device.name);

    return {
      name: device.name || "Unknown Device",
      id: device.id,
      rssi: -60 // RSSI is not directly available during requestDevice
    };

  } catch (error) {
    console.error("BLE Scan Error:", error);
    if (error.name === 'NotFoundError') {
      throw new Error("Bluetooth scan cancelled.");
    }
    if (error.name === 'SecurityError') {
      throw new Error("Bluetooth scan blocked by security policy (User gesture required).");
    }
    throw error;
  }
}