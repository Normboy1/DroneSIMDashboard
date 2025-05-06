/**
 * Drone class for simulating a drone with GPS tracking capabilities
 */
class Drone {
    constructor(id, initialLat, initialLng, color = '#3388ff') {
        // Identifier
        this.id = id;
        this.name = `Drone ${id}`;
        this.color = color;
        
        // Position
        this.latitude = initialLat;
        this.longitude = initialLng;
        this.altitude = 100; // meters
        
        // Home position (starting point)
        this.homeLat = initialLat;
        this.homeLng = initialLng;
        
        // Movement
        this.speed = 0; // km/h
        this.heading = 0; // degrees (0 = North, 90 = East, etc.)
        this.maxSpeed = 50; // km/h
        
        // Status
        this.isFlying = false;
        this.batteryLevel = 100; // percentage
        this.batteryDrainRate = 0.05; // percentage per second
        this.isReturningHome = false;
        
        // Destination
        this.destinationLat = null;
        this.destinationLng = null;
        
        // Statistics
        this.totalDistance = 0; // Total distance traveled in kilometers
        this.flightTime = 0; // Total flight time in seconds
        this.lastPositionLat = initialLat; // Last position for distance calculation
        this.lastPositionLng = initialLng;
        
        // Internal
        this.lastUpdateTime = null;
    }
    
    /**
     * Set the drone's destination coordinates
     */
    setDestination(lat, lng) {
        this.destinationLat = lat;
        this.destinationLng = lng;
        this.isReturningHome = false;
        
        // Calculate initial heading to destination
        this.heading = this.calculateBearing(
            this.latitude, 
            this.longitude, 
            this.destinationLat, 
            this.destinationLng
        );
        
        return this;
    }
    
    /**
     * Command the drone to return to its home position
     */
    returnHome() {
        this.destinationLat = this.homeLat;
        this.destinationLng = this.homeLng;
        this.isReturningHome = true;
        
        // Calculate heading to home
        this.heading = this.calculateBearing(
            this.latitude,
            this.longitude,
            this.homeLat,
            this.homeLng
        );
        
        return this;
    }
    
    /**
     * Set a new home location
     */
    setHome(lat, lng) {
        this.homeLat = lat;
        this.homeLng = lng;
        return this;
    }
    
    /**
     * Get the home position
     */
    getHomePosition() {
        return {
            lat: this.homeLat,
            lng: this.homeLng
        };
    }
    
    /**
     * Get distance to home in kilometers
     */
    getDistanceToHome() {
        return this.calculateDistance(
            this.latitude,
            this.longitude,
            this.homeLat,
            this.homeLng
        );
    }
    
    /**
     * Start the drone's flight
     */
    takeOff() {
        if (!this.isFlying && this.batteryLevel > 10) {
            this.isFlying = true;
            this.lastUpdateTime = Date.now();
            
            // Reset last position for accurate distance tracking
            this.lastPositionLat = this.latitude;
            this.lastPositionLng = this.longitude;
        }
        return this;
    }
    
    /**
     * Land the drone
     */
    land() {
        this.isFlying = false;
        this.speed = 0;
        return this;
    }
    
    /**
     * Set the drone's speed (in km/h)
     */
    setSpeed(speed) {
        this.speed = Math.min(Math.max(0, speed), this.maxSpeed);
        return this;
    }
    
    /**
     * Update the drone's position based on elapsed time
     */
    update() {
        const now = Date.now();
        
        // If the drone is not flying, check if it's at home to recharge
        if (!this.isFlying) {
            if (this.lastUpdateTime !== null) {
                const elapsedTimeSeconds = (now - this.lastUpdateTime) / 1000;
                
                // If drone is at home (within 10 meters), recharge battery
                if (this.getDistanceToHome() < 0.01 && this.batteryLevel < 100) {
                    this.rechargeBattery(elapsedTimeSeconds);
                }
            }
            
            this.lastUpdateTime = now;
            return false;
        }
        
        if (this.lastUpdateTime === null) {
            this.lastUpdateTime = now;
            return false;
        }
        
        const elapsedTimeMs = now - this.lastUpdateTime;
        const elapsedTimeHours = elapsedTimeMs / 3600000; // Convert ms to hours
        const elapsedTimeSeconds = elapsedTimeMs / 1000; // Convert ms to seconds
        
        // Update flight time only when flying
        if (this.isFlying) {
            this.flightTime += elapsedTimeSeconds;
        }
        
        // Update battery level
        this.batteryLevel -= elapsedTimeSeconds * this.batteryDrainRate;
        if (this.batteryLevel <= 0) {
            this.batteryLevel = 0;
            this.land();
            return false;
        }
        
        // If battery is low (less than 20%), automatically return home
        if (this.batteryLevel < 20 && !this.isReturningHome) {
            this.returnHome();
        }
        
        // If we have a destination, adjust heading to point to it
        if (this.destinationLat !== null && this.destinationLng !== null) {
            this.heading = this.calculateBearing(
                this.latitude, 
                this.longitude, 
                this.destinationLat, 
                this.destinationLng
            );
            
            // Check if we've reached the destination (within 10 meters)
            if (this.getDistanceToDestination() < 0.01) {
                this.speed = 0;
                
                // If we were returning home, land the drone
                if (this.isReturningHome) {
                    this.land();
                    this.isReturningHome = false;
                }
                
                return true; // Destination reached
            }
        }
        
        // Calculate distance traveled in this time step
        const distanceKm = this.speed * elapsedTimeHours;
        
        // Update position based on heading and distance
        const result = this.calculateNewPosition(
            this.latitude, 
            this.longitude, 
            this.heading, 
            distanceKm
        );
        
        // Calculate actual distance traveled (using Haversine formula)
        const segmentDistance = this.calculateDistance(
            this.lastPositionLat,
            this.lastPositionLng,
            result.lat,
            result.lng
        );
        
        // Update total distance traveled
        this.totalDistance += segmentDistance;
        
        // Update position
        this.latitude = result.lat;
        this.longitude = result.lng;
        
        // Store last position for next distance calculation
        this.lastPositionLat = this.latitude;
        this.lastPositionLng = this.longitude;
        
        this.lastUpdateTime = now;
        return false; // Destination not reached yet
    }
    
    /**
     * Get the current position of the drone
     */
    getPosition() {
        return {
            lat: this.latitude,
            lng: this.longitude,
            alt: this.altitude
        };
    }
    
    /**
     * Get the distance to the destination in kilometers
     */
    getDistanceToDestination() {
        if (this.destinationLat === null || this.destinationLng === null) {
            return Infinity;
        }
        
        return this.calculateDistance(
            this.latitude, 
            this.longitude, 
            this.destinationLat, 
            this.destinationLng
        );
    }
    
    /**
     * Get the estimated time of arrival in minutes
     */
    getETA() {
        if (this.speed === 0 || this.destinationLat === null || this.destinationLng === null) {
            return Infinity;
        }
        
        const distanceKm = this.getDistanceToDestination();
        return (distanceKm / this.speed) * 60; // Convert hours to minutes
    }
    
    /**
     * Get formatted flight time as HH:MM:SS
     */
    getFormattedFlightTime() {
        const hours = Math.floor(this.flightTime / 3600);
        const minutes = Math.floor((this.flightTime % 3600) / 60);
        const seconds = Math.floor(this.flightTime % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Calculate the distance between two points using the Haversine formula
     * Returns distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
            
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    /**
     * Calculate the bearing between two points
     * Returns bearing in degrees (0 = North, 90 = East, etc.)
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const startLat = this.toRadians(lat1);
        const startLng = this.toRadians(lon1);
        const destLat = this.toRadians(lat2);
        const destLng = this.toRadians(lon2);
        
        const y = Math.sin(destLng - startLng) * Math.cos(destLat);
        const x = Math.cos(startLat) * Math.sin(destLat) -
                Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
        let brng = Math.atan2(y, x);
        brng = this.toDegrees(brng);
        return (brng + 360) % 360;
    }
    
    /**
     * Calculate a new position given a starting point, bearing, and distance
     * Returns {lat, lng} object
     */
    calculateNewPosition(lat, lng, bearing, distanceKm) {
        const R = 6371; // Earth's radius in km
        const d = distanceKm;
        
        const lat1 = this.toRadians(lat);
        const lon1 = this.toRadians(lng);
        const brng = this.toRadians(bearing);
        
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d/R) + 
            Math.cos(lat1) * Math.sin(d/R) * Math.cos(brng)
        );
        
        const lon2 = lon1 + Math.atan2(
            Math.sin(brng) * Math.sin(d/R) * Math.cos(lat1),
            Math.cos(d/R) - Math.sin(lat1) * Math.sin(lat2)
        );
        
        return {
            lat: this.toDegrees(lat2),
            lng: this.toDegrees(lon2)
        };
    }
    
    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }
    
    /**
     * Convert radians to degrees
     */
    toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
    
    /**
     * Set the drone name
     */
    setName(name) {
        this.name = name;
        return this;
    }
    
    /**
     * Set the drone color
     */
    setColor(color) {
        this.color = color;
        return this;
    }
    
    /**
     * Recharge the drone's battery
     * @param {number} elapsedTimeSeconds - Time elapsed in seconds
     */
    rechargeBattery(elapsedTimeSeconds) {
        // Recharge rate: 5% per second (20 seconds to fully recharge)
        const rechargeRate = 5;
        this.batteryLevel += elapsedTimeSeconds * rechargeRate;
        
        // Cap battery level at 100%
        if (this.batteryLevel > 100) {
            this.batteryLevel = 100;
        }
        
        return this;
    }
}
