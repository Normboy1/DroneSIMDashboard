/**
 * Drone GPS Simulator
 * Main simulation controller that connects the drone model with the UI
 */

// Global variables
let map;
let drones = [];
let selectedDrone = null;
let simulationInterval = null;
let userLocation = null;
let followModeActive = false;
let followModeInterval = null;
let mapFollowActive = false;

// DOM elements
const droneList = document.getElementById('drone-list');
const droneStatus = document.getElementById('drone-status');
const distanceDisplay = document.getElementById('distance');
const homeDistanceDisplay = document.getElementById('home-distance');
const currentSpeedDisplay = document.getElementById('current-speed');
const batteryLevelDisplay = document.getElementById('battery-level');
const etaDisplay = document.getElementById('eta');
const totalDistanceDisplay = document.getElementById('total-distance');
const flightTimeDisplay = document.getElementById('flight-time');

// Initialize the application
window.onload = function() {
    console.log("Window loaded");
    
    // Show location prompt
    document.getElementById('location-prompt').style.display = 'flex';
    
    // Set up event listeners
    document.getElementById('get-location-btn').addEventListener('click', getUserLocation);
    document.getElementById('manual-location-btn').addEventListener('click', useDefaultLocation);
    document.getElementById('add-drone-btn').addEventListener('click', addNewDrone);
    document.getElementById('rename-drone-btn').addEventListener('click', openRenameModal);
    document.getElementById('start-all-btn').addEventListener('click', startAllDrones);
    document.getElementById('pause-all-btn').addEventListener('click', pauseAllDrones);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('return-home-btn').addEventListener('click', returnDroneHome);
    document.getElementById('set-home-btn').addEventListener('click', openSetHomeModal);
    document.getElementById('set-current-as-home-btn').addEventListener('click', setCurrentLocationAsHome);
    document.getElementById('toggle-follow-btn').addEventListener('click', toggleFollowMode);
    document.getElementById('toggle-map-follow-btn').addEventListener('click', toggleMapFollow);
    
    // Drone name modal
    document.getElementById('save-drone-name-btn').addEventListener('click', saveDroneName);
    document.getElementById('cancel-drone-name-btn').addEventListener('click', closeNameModal);
    
    // Home location modal
    document.getElementById('save-home-btn').addEventListener('click', saveHomeLocation);
    document.getElementById('cancel-home-btn').addEventListener('click', closeHomeModal);
    document.getElementById('use-current-location').addEventListener('change', toggleHomeCoordinates);
    
    // Speed slider
    document.getElementById('speed').addEventListener('input', updateSpeed);
    
    // Destination coordinates
    document.getElementById('destination-lat').addEventListener('change', updateDestination);
    document.getElementById('destination-lng').addEventListener('change', updateDestination);
    
    // Set up color picker
    setupColorPicker();
    
    console.log("Event listeners set up");
};

// Get user's current location
function getUserLocation() {
    console.log("getUserLocation called");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Got user location:", position.coords.latitude, position.coords.longitude);
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                document.getElementById('location-prompt').style.display = 'none';
                initializeMap(userLocation.lat, userLocation.lng);
                
                // Set up continuous location tracking for follow mode
                navigator.geolocation.watchPosition(
                    (position) => {
                        userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        
                        // If follow mode is active, update the drone's destination
                        if (followModeActive && selectedDrone) {
                            updateDroneFollowPosition();
                        }
                    },
                    (error) => {
                        console.error("Error watching location:", error);
                    },
                    {
                        enableHighAccuracy: true,
                        maximumAge: 0,
                        timeout: 5000
                    }
                );
            },
            (error) => {
                console.error("Error getting location:", error);
                useDefaultLocation();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
        useDefaultLocation();
    }
}

// Use default location (San Francisco)
function useDefaultLocation() {
    console.log("useDefaultLocation called");
    userLocation = { lat: 37.7749, lng: -122.4194 };
    document.getElementById('location-prompt').style.display = 'none';
    initializeMap(userLocation.lat, userLocation.lng);
}

// Initialize the map
function initializeMap(lat, lng) {
    console.log("Initializing map at:", lat, lng);
    map = L.map('map').setView([lat, lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Start simulation loop
    simulationInterval = setInterval(updateSimulation, 100);
    
    // Set up map click handler for setting destinations
    map.on('click', function(e) {
        // Disable map follow mode when user clicks on the map
        if (mapFollowActive) {
            toggleMapFollow(false);
        }
        
        if (selectedDrone) {
            // Set the destination for the selected drone only
            setDroneDestination(selectedDrone, e.latlng.lat, e.latlng.lng);
        } else if (drones.length > 0) {
            // If no drone is selected but drones exist, select the first one
            selectDrone(drones[0]);
            // Don't automatically set destination, just select the drone
        }
        // Removed the automatic drone creation when clicking on the map
    });
    
    // Show instructions to add a drone
    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message';
    statusMessage.textContent = 'Click "Add New Drone" to create your first drone';
    document.body.appendChild(statusMessage);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        statusMessage.classList.add('fade-out');
        setTimeout(() => {
            if (document.body.contains(statusMessage)) {
                document.body.removeChild(statusMessage);
            }
        }, 500);
    }, 5000);
}

// Create a new drone
function createDrone(lat, lng, color = getRandomColor(), name = null) {
    const id = drones.length;
    const drone = new Drone(id, lat, lng, color);
    
    if (name) {
        drone.setName(name);
    } else {
        drone.setName(generateDroneName());
    }
    
    // Create marker for drone with custom SVG icon
    const droneIcon = L.divIcon({
        className: 'drone-icon',
        html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L8 6H16L12 2Z" fill="${color}"/>
            <path d="M12 22L8 18H16L12 22Z" fill="${color}"/>
            <path d="M2 12L6 8V16L2 12Z" fill="${color}"/>
            <path d="M22 12L18 8V16L22 12Z" fill="${color}"/>
            <circle cx="12" cy="12" r="4" fill="${color}"/>
            <circle cx="12" cy="12" r="2" fill="white"/>
        </svg>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    
    drone.marker = L.marker([lat, lng], {
        icon: droneIcon
    }).addTo(map);
    
    // Create home marker with custom SVG icon
    const homeIcon = L.divIcon({
        className: 'home-icon',
        html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z" fill="#333" stroke="${color}" stroke-width="1.5"/>
            <path d="M12 8C12.5523 8 13 7.55228 13 7C13 6.44772 12.5523 6 12 6C11.4477 6 11 6.44772 11 7C11 7.55228 11.4477 8 12 8Z" fill="${color}"/>
        </svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    drone.homeMarker = L.marker([lat, lng], {
        icon: homeIcon
    }).addTo(map);
    
    // Create destination marker with custom SVG icon
    const destinationIcon = L.divIcon({
        className: 'destination-icon',
        html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" fill="white" stroke="${color}" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" fill="${color}"/>
            <path d="M12 3V6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 18V21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            <path d="M3 12H6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            <path d="M18 12H21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    drone.destinationMarker = L.marker([lat, lng], {
        icon: destinationIcon
    });
    
    // Create path line
    drone.pathLine = L.polyline([], {
        color: drone.color,
        weight: 3,
        opacity: 0.6,
        dashArray: '5, 10'
    }).addTo(map);
    
    drones.push(drone);
    updateDroneList();
    selectDrone(drone);
    
    return drone;
}

// Add a new drone at a random location near the user
function addNewDrone() {
    if (!userLocation) {
        console.error("User location not set");
        alert("Please wait for the map to initialize before adding drones.");
        return;
    }
    
    // Generate a position within 0.01 degrees of user location
    const lat = userLocation.lat + (Math.random() * 0.02 - 0.01);
    const lng = userLocation.lng + (Math.random() * 0.02 - 0.01);
    
    // Create drone and open naming modal
    const drone = createDrone(lat, lng);
    openNameModal(drone);
}

// Generate a random color
function getRandomColor() {
    const colors = [
        '#FF5252', // Red
        '#536DFE', // Blue
        '#64FFDA', // Teal
        '#FFD740', // Amber
        '#69F0AE', // Green
        '#FF4081', // Pink
        '#7C4DFF', // Deep Purple
        '#FF6E40', // Deep Orange
        '#18FFFF', // Cyan
        '#B388FF'  // Light Purple
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Generate a random drone name
function generateDroneName() {
    const prefixes = ['Sky', 'Air', 'Cloud', 'Wind', 'Storm', 'Thunder', 'Hawk', 'Eagle', 'Falcon', 'Swift'];
    const suffixes = ['Runner', 'Flyer', 'Glider', 'Soarer', 'Watcher', 'Explorer', 'Tracker', 'Scout', 'Patrol', 'Guardian'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix}${suffix}`;
}

// Update the drone list in the UI
function updateDroneList() {
    droneList.innerHTML = '';
    
    drones.forEach(drone => {
        const droneItem = document.createElement('div');
        droneItem.className = `drone-item ${drone === selectedDrone ? 'active' : ''}`;
        droneItem.dataset.droneId = drone.id;
        
        const droneColor = document.createElement('span');
        droneColor.className = 'drone-color';
        droneColor.style.backgroundColor = drone.color;
        
        const droneName = document.createElement('span');
        droneName.textContent = drone.name;
        
        const statusIndicator = document.createElement('span');
        statusIndicator.className = `drone-status-indicator ${drone.isFlying ? 'status-flying' : 'status-idle'}`;
        
        // Add individual drone control buttons
        const controlButtons = document.createElement('div');
        controlButtons.className = 'drone-control-buttons';
        
        const startButton = document.createElement('span');
        startButton.className = 'drone-control-button drone-start-button';
        startButton.innerHTML = '▶';
        startButton.title = 'Start Drone';
        startButton.addEventListener('click', (e) => {
            e.stopPropagation();
            startDrone(drone);
        });
        
        const pauseButton = document.createElement('span');
        pauseButton.className = 'drone-control-button drone-pause-button';
        pauseButton.innerHTML = '❚❚';
        pauseButton.title = 'Pause Drone';
        pauseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseDrone(drone);
        });
        
        controlButtons.appendChild(startButton);
        controlButtons.appendChild(pauseButton);
        
        droneItem.appendChild(droneColor);
        droneItem.appendChild(droneName);
        droneItem.appendChild(statusIndicator);
        droneItem.appendChild(controlButtons);
        
        droneItem.addEventListener('click', () => {
            selectDrone(drone);
        });
        
        droneList.appendChild(droneItem);
    });
}

// Select a drone and update UI
function selectDrone(drone) {
    // If we're switching drones and follow mode is active, deactivate it
    if (followModeActive && selectedDrone !== drone) {
        followModeActive = false;
        document.getElementById('toggle-follow-btn').classList.remove('active');
        document.getElementById('toggle-follow-btn').textContent = 'Follow Me';
    }
    
    // If map follow is active and we're switching drones, update to follow the new drone
    if (mapFollowActive) {
        selectedDrone = drone;
        map.panTo([drone.latitude, drone.longitude], { animate: true });
    } else {
        selectedDrone = drone;
    }
    
    updateDroneList();
    updateDroneDetails();
}

// Update drone details in the UI
function updateDroneDetails() {
    if (!selectedDrone) return;
    
    const currentLat = document.getElementById('current-lat');
    const currentLng = document.getElementById('current-lng');
    const destLat = document.getElementById('destination-lat');
    const destLng = document.getElementById('destination-lng');
    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speed-value');
    
    // Update current position
    currentLat.value = selectedDrone.latitude.toFixed(6);
    currentLng.value = selectedDrone.longitude.toFixed(6);
    
    // Update destination if set
    if (selectedDrone.destinationLat !== null && selectedDrone.destinationLng !== null) {
        destLat.value = selectedDrone.destinationLat.toFixed(6);
        destLng.value = selectedDrone.destinationLng.toFixed(6);
    }
    
    // Update speed slider
    const speedKmh = selectedDrone.speed;
    const speedScale = speedKmh / 5; // Scale to 1-10 range
    speedSlider.value = speedScale;
    speedValue.textContent = speedScale.toFixed(1);
    
    // Update status displays
    droneStatus.textContent = selectedDrone.isFlying ? 
        (selectedDrone.isReturningHome ? 'Returning Home' : 'Flying') : 'Idle';
    droneStatus.className = selectedDrone.isFlying ? 
        (selectedDrone.isReturningHome ? 'status-returning' : 'status-flying') : 'status-idle';
    
    distanceDisplay.textContent = selectedDrone.getDistanceToDestination().toFixed(2);
    homeDistanceDisplay.textContent = selectedDrone.getDistanceToHome().toFixed(2);
    currentSpeedDisplay.textContent = selectedDrone.speed.toFixed(1);
    batteryLevelDisplay.textContent = selectedDrone.batteryLevel.toFixed(0);
    
    // Update lifetime statistics
    totalDistanceDisplay.textContent = selectedDrone.totalDistance.toFixed(2);
    flightTimeDisplay.textContent = selectedDrone.getFormattedFlightTime();
    
    // Update ETA
    const eta = selectedDrone.getETA();
    if (eta === Infinity) {
        etaDisplay.textContent = '--:--';
    } else {
        const minutes = Math.floor(eta);
        const seconds = Math.floor((eta - minutes) * 60);
        etaDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Update simulation state
function updateSimulation() {
    try {
        drones.forEach(drone => {
            // Update drone battery display even when not flying (for recharging)
            if (drone === selectedDrone) {
                batteryLevelDisplay.textContent = drone.batteryLevel.toFixed(0);
            }
            
            if (drone.isFlying) {
                // Update drone position
                const destinationReached = drone.update();
                
                // Update marker position
                const position = [drone.latitude, drone.longitude];
                drone.marker.setLatLng(position);
                
                // If map follow is active and this is the selected drone, center the map on it
                if (mapFollowActive && drone === selectedDrone) {
                    map.panTo(position, { animate: true, duration: 0.5 });
                }
                
                // Update path line
                drone.pathLine.addLatLng(position);
                
                // Update destination marker
                if (drone.destinationLat !== null && drone.destinationLng !== null) {
                    const destPosition = [drone.destinationLat, drone.destinationLng];
                    drone.destinationMarker.setLatLng(destPosition);
                    if (!map.hasLayer(drone.destinationMarker)) {
                        drone.destinationMarker.addTo(map);
                    }
                } else if (map.hasLayer(drone.destinationMarker)) {
                    map.removeLayer(drone.destinationMarker);
                }
                
                // If destination reached, handle it
                if (destinationReached) {
                    console.log(`${drone.name} reached destination`);
                    
                    // If this was a return home operation, land the drone
                    if (drone.isReturningHome) {
                        drone.land();
                        drone.isReturningHome = false;
                        
                        // Show a notification that the drone has returned home
                        const statusMessage = document.createElement('div');
                        statusMessage.className = 'status-message';
                        statusMessage.textContent = `${drone.name} has returned home and is now recharging`;
                        document.body.appendChild(statusMessage);
                        
                        // Remove message after 3 seconds
                        setTimeout(() => {
                            statusMessage.classList.add('fade-out');
                            setTimeout(() => {
                                if (document.body.contains(statusMessage)) {
                                    document.body.removeChild(statusMessage);
                                }
                            }, 500);
                        }, 3000);
                        
                        // Update UI
                        updateDroneList();
                    }
                }
            } else {
                // Still update the drone even when not flying (for battery recharging)
                drone.update();
            }
            
            // If this is the selected drone, update the UI
            if (drone === selectedDrone) {
                updateDroneDetails();
            }
        });
    } catch (error) {
        console.error("Error in simulation update:", error);
    }
}

// Set drone destination
function setDroneDestination(drone, lat, lng) {
    drone.setDestination(lat, lng);
    
    // Automatically start the drone if it's not flying
    if (!drone.isFlying) {
        drone.takeOff();
        updateDroneList();
    }
    
    // Update UI
    if (drone === selectedDrone) {
        document.getElementById('destination-lat').value = lat.toFixed(6);
        document.getElementById('destination-lng').value = lng.toFixed(6);
        updateDroneDetails();
    }
}

// Start a specific drone
function startDrone(drone) {
    drone.takeOff();
    updateDroneList();
}

// Pause a specific drone
function pauseDrone(drone) {
    drone.land();
    updateDroneList();
}

// Start all drones
function startAllDrones() {
    drones.forEach(drone => {
        drone.takeOff();
    });
    updateDroneList();
}

// Pause all drones
function pauseAllDrones() {
    drones.forEach(drone => {
        drone.land();
    });
    updateDroneList();
}

// Reset the simulation
function resetSimulation() {
    if (!selectedDrone) return;
    
    // Clear destination
    selectedDrone.destinationLat = null;
    selectedDrone.destinationLng = null;
    
    // Reset path
    selectedDrone.pathLine.setLatLngs([]);
    
    // Remove destination marker
    if (map.hasLayer(selectedDrone.destinationMarker)) {
        map.removeLayer(selectedDrone.destinationMarker);
    }
    
    // Update UI
    updateDroneDetails();
}

// Return drone to home
function returnDroneHome() {
    if (!selectedDrone) return;
    
    selectedDrone.returnHome();
    
    // Don't automatically start the drone
    // The user must explicitly click the start button
    
    // Update UI
    updateDroneDetails();
}

// Update drone speed from slider
function updateSpeed() {
    if (!selectedDrone) return;
    
    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speed-value');
    const speed = parseFloat(speedSlider.value);
    
    // Scale from 1-10 to km/h
    const speedKmh = speed * 5;
    selectedDrone.setSpeed(speedKmh);
    
    // Update display
    speedValue.textContent = speed.toFixed(1);
}

// Update destination from input fields
function updateDestination() {
    if (!selectedDrone) return;
    
    const destLat = parseFloat(document.getElementById('destination-lat').value);
    const destLng = parseFloat(document.getElementById('destination-lng').value);
    
    if (!isNaN(destLat) && !isNaN(destLng)) {
        setDroneDestination(selectedDrone, destLat, destLng);
    }
}

// Open drone naming modal
function openNameModal(drone = null) {
    const modal = document.getElementById('drone-name-modal');
    const nameInput = document.getElementById('drone-name-input');
    
    // If no drone specified, use selected drone
    const targetDrone = drone || selectedDrone;
    if (!targetDrone) return;
    
    // Set current name as default
    nameInput.value = targetDrone.name;
    nameInput.dataset.droneId = targetDrone.id;
    
    // Select current color
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.color === targetDrone.color) {
            option.classList.add('selected');
        }
    });
    
    // Show modal
    modal.style.display = 'flex';
    nameInput.focus();
}

// Close drone naming modal
function closeNameModal() {
    document.getElementById('drone-name-modal').style.display = 'none';
}

// Save drone name from modal
function saveDroneName() {
    const nameInput = document.getElementById('drone-name-input');
    const droneId = parseInt(nameInput.dataset.droneId);
    const name = nameInput.value.trim();
    
    if (!name) {
        alert("Please enter a name for your drone.");
        return;
    }
    
    if (name && !isNaN(droneId)) {
        const drone = drones.find(d => d.id === droneId);
        if (drone) {
            const oldName = drone.name;
            drone.setName(name);
            
            // Set color if selected
            const selectedColor = document.querySelector('.color-option.selected');
            if (selectedColor) {
                const color = selectedColor.dataset.color;
                drone.setColor(color);
                
                // Update drone marker with new color
                const droneIcon = L.divIcon({
                    className: 'drone-icon',
                    html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L8 6H16L12 2Z" fill="${color}"/>
                        <path d="M12 22L8 18H16L12 22Z" fill="${color}"/>
                        <path d="M2 12L6 8V16L2 12Z" fill="${color}"/>
                        <path d="M22 12L18 8V16L22 12Z" fill="${color}"/>
                        <circle cx="12" cy="12" r="4" fill="${color}"/>
                        <circle cx="12" cy="12" r="2" fill="white"/>
                    </svg>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
                drone.marker.setIcon(droneIcon);
                
                // Update home marker with new color
                const homeIcon = L.divIcon({
                    className: 'home-icon',
                    html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z" fill="#333" stroke="${color}" stroke-width="1.5"/>
                        <path d="M12 8C12.5523 8 13 7.55228 13 7C13 6.44772 12.5523 6 12 6C11.4477 6 11 6.44772 11 7C11 7.55228 11.4477 8 12 8Z" fill="${color}"/>
                    </svg>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                drone.homeMarker.setIcon(homeIcon);
                
                // Update destination marker with new color
                const destinationIcon = L.divIcon({
                    className: 'destination-icon',
                    html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="9" fill="white" stroke="${color}" stroke-width="2"/>
                        <circle cx="12" cy="12" r="3" fill="${color}"/>
                        <path d="M12 3V6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 18V21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                        <path d="M3 12H6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                        <path d="M18 12H21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                    </svg>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                drone.destinationMarker.setIcon(destinationIcon);
                
                // Update path line color
                drone.pathLine.setStyle({ color: color });
            }
            
            updateDroneList();
            
            // Ensure the drone is selected after naming
            selectDrone(drone);
            
            // Show confirmation message
            const statusMessage = document.createElement('div');
            statusMessage.className = 'status-message';
            statusMessage.textContent = `Drone renamed from "${oldName}" to "${name}"`;
            document.body.appendChild(statusMessage);
            
            // Remove message after 3 seconds
            setTimeout(() => {
                statusMessage.classList.add('fade-out');
                setTimeout(() => {
                    document.body.removeChild(statusMessage);
                }, 500);
            }, 3000);
        }
    }
    
    closeNameModal();
}

// Open rename modal for selected drone
function openRenameModal() {
    if (selectedDrone) {
        openNameModal(selectedDrone);
    } else {
        if (drones.length > 0) {
            // If no drone is selected but drones exist, select the first one
            selectDrone(drones[0]);
            openNameModal(selectedDrone);
        } else {
            alert("No drones available. Please add a drone first.");
        }
    }
}

// Setup color picker functionality
function setupColorPicker() {
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
        });
    });
}

// Open set home location modal
function openSetHomeModal() {
    if (!selectedDrone) return;
    
    const modal = document.getElementById('home-location-modal');
    const droneName = document.getElementById('home-drone-name');
    const homeLat = document.getElementById('home-lat');
    const homeLng = document.getElementById('home-lng');
    const useCurrentLocation = document.getElementById('use-current-location');
    
    // Set drone name
    droneName.textContent = selectedDrone.name;
    
    // Set current home location
    const home = selectedDrone.getHomePosition();
    homeLat.value = home.lat.toFixed(6);
    homeLng.value = home.lng.toFixed(6);
    
    // Reset checkbox
    useCurrentLocation.checked = false;
    
    // Show modal
    modal.style.display = 'flex';
}

// Close home location modal
function closeHomeModal() {
    document.getElementById('home-location-modal').style.display = 'none';
}

// Save home location from modal
function saveHomeLocation() {
    if (!selectedDrone) return;
    
    const useCurrentLocation = document.getElementById('use-current-location').checked;
    
    if (useCurrentLocation) {
        // Use drone's current position
        selectedDrone.setHome(selectedDrone.latitude, selectedDrone.longitude);
    } else {
        // Use entered coordinates
        const homeLat = parseFloat(document.getElementById('home-lat').value);
        const homeLng = parseFloat(document.getElementById('home-lng').value);
        
        if (!isNaN(homeLat) && !isNaN(homeLng)) {
            selectedDrone.setHome(homeLat, homeLng);
        }
    }
    
    // Update home marker
    const home = selectedDrone.getHomePosition();
    selectedDrone.homeMarker.setLatLng([home.lat, home.lng]);
    
    closeHomeModal();
}

// Toggle home coordinates input based on checkbox
function toggleHomeCoordinates() {
    const useCurrentLocation = document.getElementById('use-current-location').checked;
    const homeLat = document.getElementById('home-lat');
    const homeLng = document.getElementById('home-lng');
    
    homeLat.disabled = useCurrentLocation;
    homeLng.disabled = useCurrentLocation;
    
    if (useCurrentLocation && selectedDrone) {
        homeLat.value = selectedDrone.latitude.toFixed(6);
        homeLng.value = selectedDrone.longitude.toFixed(6);
    }
}

// Set current location as home
function setCurrentLocationAsHome() {
    if (!selectedDrone) {
        alert("Please select a drone first.");
        return;
    }
    
    if (!userLocation) {
        alert("User location is not available. Please allow location access.");
        return;
    }
    
    // Set the user's current location as home
    selectedDrone.setHome(userLocation.lat, userLocation.lng);
    
    // Update home marker
    const home = selectedDrone.getHomePosition();
    selectedDrone.homeMarker.setLatLng([home.lat, home.lng]);
    
    // Show confirmation message
    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message';
    statusMessage.textContent = `${selectedDrone.name}'s home location set to your current location`;
    document.body.appendChild(statusMessage);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        statusMessage.classList.add('fade-out');
        setTimeout(() => {
            if (document.body.contains(statusMessage)) {
                document.body.removeChild(statusMessage);
            }
        }, 500);
    }, 3000);
    
    // Update UI
    updateDroneDetails();
}

// Toggle follow mode
function toggleFollowMode() {
    if (!selectedDrone) {
        alert("Please select a drone first.");
        return;
    }
    
    if (!userLocation) {
        alert("User location is not available. Please allow location access.");
        return;
    }
    
    const followButton = document.getElementById('toggle-follow-btn');
    
    if (!followModeActive) {
        // Activate follow mode
        followModeActive = true;
        followButton.classList.add('active');
        followButton.textContent = 'Following Me';
        
        // Ensure the drone is flying
        if (!selectedDrone.isFlying) {
            selectedDrone.takeOff();
            updateDroneList();
        }
        
        // Set initial destination to user's current location
        updateDroneFollowPosition();
        
        // Show confirmation message
        const statusMessage = document.createElement('div');
        statusMessage.className = 'status-message';
        statusMessage.textContent = `${selectedDrone.name} is now following your location`;
        document.body.appendChild(statusMessage);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            statusMessage.classList.add('fade-out');
            setTimeout(() => {
                if (document.body.contains(statusMessage)) {
                    document.body.removeChild(statusMessage);
                }
            }, 500);
        }, 3000);
    } else {
        // Deactivate follow mode
        followModeActive = false;
        followButton.classList.remove('active');
        followButton.textContent = 'Follow Me';
        
        // Show confirmation message
        const statusMessage = document.createElement('div');
        statusMessage.className = 'status-message';
        statusMessage.textContent = `${selectedDrone.name} has stopped following your location`;
        document.body.appendChild(statusMessage);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            statusMessage.classList.add('fade-out');
            setTimeout(() => {
                if (document.body.contains(statusMessage)) {
                    document.body.removeChild(statusMessage);
                }
            }, 500);
        }, 3000);
    }
}

// Update drone position for follow mode
function updateDroneFollowPosition() {
    if (!followModeActive || !selectedDrone || !userLocation) return;
    
    // Set the drone's destination to the user's current location
    selectedDrone.setDestination(userLocation.lat, userLocation.lng);
    
    // Update UI
    if (selectedDrone === selectedDrone) {
        document.getElementById('destination-lat').value = userLocation.lat.toFixed(6);
        document.getElementById('destination-lng').value = userLocation.lng.toFixed(6);
        updateDroneDetails();
    }
}

// Toggle map follow mode
function toggleMapFollow(forceState) {
    if (!selectedDrone) {
        alert("Please select a drone first.");
        return;
    }
    
    const mapFollowButton = document.getElementById('toggle-map-follow-btn');
    
    // If forceState is provided, use it; otherwise toggle the current state
    const newState = forceState !== undefined ? forceState : !mapFollowActive;
    
    if (newState) {
        // Activate map follow mode
        mapFollowActive = true;
        mapFollowButton.classList.add('active');
        mapFollowButton.textContent = 'Tracking Drone';
        
        // Immediately center the map on the drone
        map.panTo([selectedDrone.latitude, selectedDrone.longitude], { animate: true });
        
        // Show confirmation message
        const statusMessage = document.createElement('div');
        statusMessage.className = 'status-message';
        statusMessage.textContent = `Map is now tracking ${selectedDrone.name}`;
        document.body.appendChild(statusMessage);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            statusMessage.classList.add('fade-out');
            setTimeout(() => {
                if (document.body.contains(statusMessage)) {
                    document.body.removeChild(statusMessage);
                }
            }, 500);
        }, 3000);
    } else {
        // Deactivate map follow mode
        mapFollowActive = false;
        mapFollowButton.classList.remove('active');
        mapFollowButton.textContent = 'Track Drone';
        
        // Only show a message if we're explicitly toggling off (not from a map click)
        if (forceState === undefined) {
            const statusMessage = document.createElement('div');
            statusMessage.className = 'status-message';
            statusMessage.textContent = `Map is no longer tracking ${selectedDrone.name}`;
            document.body.appendChild(statusMessage);
            
            // Remove message after 3 seconds
            setTimeout(() => {
                statusMessage.classList.add('fade-out');
                setTimeout(() => {
                    if (document.body.contains(statusMessage)) {
                        document.body.removeChild(statusMessage);
                    }
                }, 500);
            }, 3000);
        }
    }
}
