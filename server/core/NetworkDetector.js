const os = require('os');

class NetworkDetector {
  /**
   * Get all active non-internal IPv4 addresses of the host device.
   * @returns {string[]} Array of local IP addresses
   */
  static getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({
            interface: name,
            ip: net.address
          });
        }
      }
    }

    return addresses;
  }

  /**
   * Get the primary local Wi-Fi / LAN IP address.
   * @returns {string} Primary local IP address or fallback to '127.0.0.1'
   */
  static getPrimaryIP() {
    const ips = this.getLocalIPs();
    if (ips.length === 0) return '127.0.0.1';

    // Prioritize common Wi-Fi interface names (en0, wlan0, Wi-Fi)
    const wifiMatch = ips.find(item => 
      /wifi|wlan|en0|eth0|ethernet/i.test(item.interface)
    );

    return wifiMatch ? wifiMatch.ip : ips[0].ip;
  }
}

module.exports = NetworkDetector;
