import * as THREE from 'three';

class BasicPhysicsSimulation {
  constructor() {
    this.velocity = new THREE.Vector3();
    this.angularVelocity = 0;
    this.acceleration = 0.008;
    this.deceleration = 0.99;
    this.brakingDeceleration = 0.95;
    this.maxSpeed = 0.5;
    this.turnSpeed = 0.03;
    this.grip = 0.7;
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.wheelRotation = 0;
    this.suspensionHeight = 0;
    this.lastCollisionTime = 0;
  }

  initializeVehicle(carModel) {
    this.position.copy(carModel.position);
    this.rotation.copy(carModel.quaternion);
  }

  update(input) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rotation);
    
    // Calculate current speed
    const speed = this.velocity.length();
    const normalizedVelocity = this.velocity.clone().normalize();
    
    // Handle acceleration/braking
    if (input.throttle !== 0) {
      const accelerationForce = forward.multiplyScalar(input.throttle * this.acceleration);
      this.velocity.add(accelerationForce);
    }
    
    // Apply grip and sliding physics
    const dotProduct = forward.dot(normalizedVelocity);
    const slideAmount = 1 - Math.abs(dotProduct);
    
    // Apply deceleration based on surface grip
    const currentDeceleration = input.throttle === 0 ? this.brakingDeceleration : this.deceleration;
    this.velocity.multiplyScalar(currentDeceleration - (slideAmount * (1 - this.grip)));
    
    // Handle steering
    if (input.steering !== 0 && speed > 0.001) {
      const steeringAmount = input.steering * this.turnSpeed * (1 - (speed / this.maxSpeed) * 0.5);
      this.angularVelocity += steeringAmount;
    }
    
    // Apply angular velocity decay
    this.angularVelocity *= 0.95;
    
    // Update rotation
    const rotationChange = new THREE.Quaternion();
    rotationChange.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.angularVelocity);
    this.rotation.multiply(rotationChange);
    
    // Limit speed
    if (speed > this.maxSpeed) {
      this.velocity.setLength(this.maxSpeed);
    }
    
    // Update position
    this.position.add(this.velocity);
    
    // Simulate suspension
    const groundHeight = 0;
    const suspensionStrength = 0.1;
    const suspensionDamping = 0.3;
    const heightDifference = this.position.y - groundHeight;
    this.suspensionHeight = Math.sin(Date.now() * 0.01) * 0.02 * speed;
    this.position.y = groundHeight + Math.abs(this.suspensionHeight);
    
    // Detect collisions (simplified)
    const now = Date.now();
    const hasCollision = false; // In a real implementation, check for collisions here
    const isCollisionNew = hasCollision && (now - this.lastCollisionTime > 500);
    if (isCollisionNew) {
      this.lastCollisionTime = now;
    }
    
    // Calculate wheel rotation based on speed
    this.wheelRotation += speed * 0.5;
    
    return {
      position: this.position,
      rotation: this.rotation,
      speed: speed,
      isSkidding: slideAmount > 0.5 && speed > 0.1,
      isSuspensionActive: Math.abs(this.suspensionHeight) > 0.01,
      hasCollision: isCollisionNew,
      wheelRotation: this.wheelRotation
    };
  }
}

export class GameLogic {
  constructor(scene) {
    this.scene = scene;
    this.physics = new BasicPhysicsSimulation();
    this.carState = {
      speed: 0,
      isSkidding: false,
      isSuspensionActive: false,
      hasCollision: false,
      wheelRotation: 0
    };
    
    this.setupControls();
  }

  setupControls() {
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      Space: false
    };

    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = false;
        e.preventDefault();
      }
    });
  }

  initializeCarPhysics(carModel) {
    this.carModel = carModel;
    this.physics.initializeVehicle(carModel);
  }

  update() {
    if (!this.carModel) return;

    // Update physics based on input
    const input = {
      throttle: this.keys.ArrowUp ? 1 : (this.keys.ArrowDown ? -1 : 0),
      steering: this.keys.ArrowLeft ? -1 : (this.keys.ArrowRight ? 1 : 0),
      brake: this.keys.Space
    };

    // Update physics simulation
    const physicsState = this.physics.update(input);

    // Update car model position and rotation
    this.carModel.position.copy(physicsState.position);
    this.carModel.quaternion.copy(physicsState.rotation);

    // Update wheels (assuming the car model has wheel meshes named appropriately)
    this.carModel.traverse((child) => {
      if (child.name.toLowerCase().includes('wheel')) {
        child.rotation.x = physicsState.wheelRotation;
      }
    });

    // Update car state for audio
    this.carState = {
      speed: physicsState.speed,
      isSkidding: physicsState.isSkidding,
      isSuspensionActive: physicsState.isSuspensionActive,
      hasCollision: physicsState.hasCollision
    };
  }

  getCarState() {
    return this.carState;
  }
}