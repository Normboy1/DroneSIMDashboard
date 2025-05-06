# Drone GPS Simulator

An interactive web-based drone simulator that allows users to control virtual drones with realistic GPS tracking, battery management, and autonomous features.

![Drone Simulator Screenshot](screenshot.png)

## Features

- **Multi-Drone Management**: Create and control multiple drones simultaneously
- **Real-time GPS Tracking**: Set destinations on an interactive map and watch drones navigate
- **Battery Simulation**: Realistic battery drain during flight with automatic recharging when drones return home
- **Follow Me Mode**: Drones can automatically follow your current GPS location
- **Drone Tracking**: Keep the map centered on your drone as it flies
- **Custom Home Locations**: Set your current location or any map position as a drone's home base
- **Realistic Physics**: Simulated flight paths, speed controls, and distance calculations
- **Visual Feedback**: Status messages, battery indicators, and distance tracking

## Technologies Used

- **JavaScript**: Core application logic and drone simulation
- **HTML/CSS**: User interface and styling
- **Leaflet.js**: Interactive mapping and visualization
- **Browser Geolocation API**: Real-time location tracking

## How to Use

1. **Getting Started**:
   - Allow location access or use the default location
   - Click "Add New Drone" to create your first drone
   - Name your drone and select a color

2. **Basic Controls**:
   - Click on the map to set a destination
   - Use the speed slider to adjust drone speed
   - Click "Start" to begin flight or "Pause" to stop

3. **Advanced Features**:
   - "Return Home": Send the drone back to its home location
   - "Set Home": Configure a custom home location
   - "My Location → Home": Set your current location as home
   - "Follow Me": Drone will continuously follow your location
   - "Track Drone": Keep the map centered on the selected drone

4. **Battery Management**:
   - Monitor battery levels in the drone info panel
   - Drones automatically return home when battery is low
   - Batteries recharge when drones are at their home location

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/drone-simulator.git
   ```

2. Open the project directory:
   ```
   cd drone-simulator
   ```

3. Open `index.html` in your web browser, or use a local server:
   ```
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000` in your browser.

## Future Enhancements

- Integration with real drone APIs (DJI, Parrot, etc.)
- Obstacle avoidance simulation
- Weather effects
- Multiple user support
- Waypoint mission planning

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Created with ❤️ by [Norman Maxey](https://github.com/Normboy1)
