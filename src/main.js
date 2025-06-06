import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameLogic } from './gameLogic.js';
import { AudioManager } from './audioManager.js';

class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.loader = new GLTFLoader();
    
    this.init();
  }

  init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    // Setup camera
    this.camera.position.set(0, 5, 10);
    
    // Create night sky
    this.createNightSky();

    // Add lights
    this.setupLights();
    
    // Setup controls (disabled for car follow camera)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;
    
    // Load models
    this.loadModels();
    
    // Initialize game logic and audio
    this.gameLogic = new GameLogic(this.scene);
    this.audioManager = new AudioManager();

    // Add click listener to initialize audio
    document.addEventListener('click', () => {
      this.audioManager.initialize();
    }, { once: true });
    
    // Start animation loop
    this.animate();
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  createNightSky() {
    // Create a dark gradient background
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
      }
    `;

    const uniforms = {
      topColor: { value: new THREE.Color(0x0a0a2a) },
      bottomColor: { value: new THREE.Color(0x000000) }
    };

    const skyGeo = new THREE.SphereGeometry(400, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: uniforms,
      side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Add stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      sizeAttenuation: true
    });

    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000);
      const y = THREE.MathUtils.randFloatSpread(2000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(starField);
  }

  setupLights() {
    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0x202040, 0.5);
    this.scene.add(ambientLight);
    
    // Moon light (directional)
    const moonLight = new THREE.DirectionalLight(0xc2d1ff, 1);
    moonLight.position.set(50, 100, 50);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 500;
    moonLight.shadow.camera.left = -100;
    moonLight.shadow.camera.right = 100;
    moonLight.shadow.camera.top = 100;
    moonLight.shadow.camera.bottom = -100;
    this.scene.add(moonLight);

    // Add car headlights
    this.headlights = {
      left: new THREE.SpotLight(0xffffff, 2),
      right: new THREE.SpotLight(0xffffff, 2)
    };

    Object.values(this.headlights).forEach(light => {
      light.angle = Math.PI / 6;
      light.penumbra = 0.3;
      light.decay = 2;
      light.distance = 100;
      light.castShadow = true;
      this.scene.add(light);
    });
  }

  loadModels() {
    // Load car model
    this.loader.load('/boltcar.glb', (gltf) => {
      this.car = gltf.scene;
      
      // Scale down the car model
      this.car.scale.set(0.2, 0.2, 0.2);
      
      this.car.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material.envMapIntensity = 0.5;
        }
      });
      
      // Position car at starting position - lower to ground and adjust for scale
      this.car.position.set(0, 0.02, 0); // Very close to ground but not intersecting
      this.scene.add(this.car);
      
      // Position headlights relative to car - adjust for new scale
      this.headlights.left.position.set(-0.1, 0.1, -0.2);
      this.headlights.right.position.set(0.1, 0.1, -0.2);
      this.car.add(this.headlights.left);
      this.car.add(this.headlights.right);
      
      this.gameLogic.initializeCarPhysics(this.car);
    });

    // Load racetrack model
    this.loader.load('/racetrack.glb', (gltf) => {
      this.track = gltf.scene;
      this.track.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true;
          child.material.envMapIntensity = 0.5;
        }
      });
      this.scene.add(this.track);
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    if (this.car && this.track) {
      this.gameLogic.update();
      this.audioManager.update(this.gameLogic.getCarState());
      
      // Update camera to follow car from behind
      const carDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.car.quaternion);
      const idealOffset = new THREE.Vector3(0, 1.5, 4); // Height and distance behind car
      idealOffset.applyQuaternion(this.car.quaternion);
      idealOffset.add(this.car.position);
      
      this.camera.position.lerp(idealOffset, 0.1);
      const lookAtPos = this.car.position.clone().add(carDirection.multiplyScalar(10));
      this.camera.lookAt(lookAtPos);
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the game
new Game();