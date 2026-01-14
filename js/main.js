// Main game script for 3D city builder
class CityBuilderGame {
    constructor() {
        // Initialize core properties
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Grid settings
        this.gridWidth = 20;
        this.gridDepth = 20;
        this.gridSize = 1;
        this.gridHelper = null;
        
        // Building system
        this.buildings = [];
        this.selectedBuildingType = 'residential';
        this.showGrid = true;
        
        // Raycasting for mouse interactions
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Initialize the game
        this.init();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Create isometric camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        
        // Set isometric angle (45 degrees from top-down, 35.264 degrees from horizontal)
        this.camera.position.set(this.gridWidth, this.gridWidth * 0.7, this.gridDepth);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('container').appendChild(this.renderer.domElement);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 15);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);
        
        // Create ground plane
        const groundGeometry = new THREE.PlaneGeometry(
            this.gridWidth * this.gridSize * 2, 
            this.gridDepth * this.gridSize * 2
        );
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2E8B57, // Green
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Create grid helpers (disabled by default)
        this.showGrid = false; // Start with grid hidden
        this.createGrid();
        
        // Setup orbit controls for camera movement
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    createGrid() {
        // Remove existing grid if present
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        
        // Create new grid helper
        if (this.showGrid) {
            this.gridHelper = new THREE.GridHelper(
                this.gridWidth * this.gridSize, 
                this.gridWidth, 
                0x444444, 
                0x222222
            );
            this.gridHelper.position.y = 0.01; // Slightly above ground to avoid z-fighting
            this.gridHelper.rotation.x = -Math.PI / 2;
            this.scene.add(this.gridHelper);
        }
    }

    setupEventListeners() {
        // Window resize handling
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Mouse move for raycasting
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // Mouse click for placing buildings
        this.renderer.domElement.addEventListener('click', (event) => {
            this.handleMouseClick(event);
        });

        // UI Controls
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetGrid();
        });

        document.getElementById('toggle-grid-btn').addEventListener('click', () => {
            this.toggleGrid();
        });

        document.getElementById('update-grid-btn').addEventListener('click', () => {
            this.updateGridSize();
        });

        // Building tool selection
        const buildingTools = document.querySelectorAll('.building-tool');
        buildingTools.forEach(tool => {
            tool.addEventListener('click', () => {
                // Remove active class from all tools
                buildingTools.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tool
                tool.classList.add('active');
                // Set selected building type
                this.selectedBuildingType = tool.getAttribute('data-type');
            });
        });
    }

    handleMouseClick(event) {
        // Calculate mouse position in normalized device coordinates
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.scene.children);

        // Find intersection with ground plane
        for (let i = 0; i < intersects.length; i++) {
            // Check if we're clicking on the ground plane (not a building)
            if (intersects[i].object.geometry.type === 'PlaneGeometry') {
                // Snap to grid
                const point = intersects[i].point;
                const x = Math.round(point.x / this.gridSize) * this.gridSize;
                const z = Math.round(point.z / this.gridSize) * this.gridSize;
                
                // Check if there's already a building at this position
                const existingBuilding = this.buildings.find(building => 
                    Math.abs(building.position.x - x) < 0.1 && 
                    Math.abs(building.position.z - z) < 0.1
                );
                
                if (existingBuilding) {
                    // Remove existing building if right-click or shift-click
                    if (event.shiftKey || event.button === 2) {
                        this.removeBuilding(existingBuilding);
                    }
                } else {
                    // Place new building
                    this.placeBuilding(x, 0, z);
                }
                
                break;
            }
        }
    }

    // Function to create low-quality sprite textures programmatically
    createBuildingTexture(type) {
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 64; // Low resolution for "low quality" effect
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Fill background based on building type
        switch(type) {
            case 'residential':
                ctx.fillStyle = '#FFB6C1'; // Light pink background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw simple house features
                ctx.fillStyle = '#8B4513'; // Brown roof
                ctx.beginPath();
                ctx.moveTo(0, canvas.height/3);
                ctx.lineTo(canvas.width/2, 0);
                ctx.lineTo(canvas.width, canvas.height/3);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#A52A2A'; // Darker brown door
                ctx.fillRect(canvas.width/2 - 8, canvas.height/2, 16, canvas.height/2);
                break;
                
            case 'commercial':
                ctx.fillStyle = '#E0FFFF'; // Light cyan background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw simple windows pattern
                ctx.fillStyle = '#696969';
                for(let i = 0; i < 4; i++) {
                    for(let j = 0; j < 3; j++) {
                        ctx.fillRect(i * 15 + 5, j * 15 + 10, 8, 10);
                    }
                }
                break;
                
            case 'industrial':
                ctx.fillStyle = '#C0C0C0'; // Silver background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw factory-like elements
                ctx.fillStyle = '#A9A9A9';
                ctx.fillRect(5, 5, canvas.width - 10, 10); // Chimney base
                ctx.fillRect(10, 0, 5, 5); // Chimney top
                ctx.fillRect(canvas.width - 15, 5, 10, 15); // Second chimney
                
                // Draw pipes
                ctx.fillStyle = '#2F4F4F';
                ctx.fillRect(20, canvas.height - 20, canvas.width - 40, 5);
                break;
                
            case 'road':
                ctx.fillStyle = '#696969'; // Dark gray background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw road markings
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(canvas.width/2 - 2, canvas.height/2 - 15, 4, 10); // Dashed line segment
                ctx.fillRect(canvas.width/2 - 2, canvas.height/2 + 5, 4, 10);
                break;
                
            case 'park':
                ctx.fillStyle = '#98FB98'; // Light green background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw simple tree
                ctx.fillStyle = '#228B22'; // Forest green leaves
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/3, canvas.width/4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#8B4513'; // Tree trunk
                ctx.fillRect(canvas.width/2 - 3, canvas.height/3, 6, canvas.height/3);
                break;
                
            default:
                ctx.fillStyle = '#D3D3D3'; // Light gray background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                break;
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter; // Low quality filter
        texture.minFilter = THREE.NearestFilter;
        
        return texture;
    }

    placeBuilding(x, y, z) {
        let geometry, material;
        
        switch(this.selectedBuildingType) {
            case 'residential':
                geometry = new THREE.BoxGeometry(0.8, 1, 0.8);
                const resTexture = this.createBuildingTexture('residential');
                material = new THREE.MeshStandardMaterial({ 
                    map: resTexture,
                    roughness: 0.7,
                    metalness: 0.3
                });
                break;
            case 'commercial':
                geometry = new THREE.BoxGeometry(0.8, 1.5, 0.8);
                const commTexture = this.createBuildingTexture('commercial');
                material = new THREE.MeshStandardMaterial({ 
                    map: commTexture,
                    roughness: 0.7,
                    metalness: 0.3
                });
                break;
            case 'industrial':
                geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                const indTexture = this.createBuildingTexture('industrial');
                material = new THREE.MeshStandardMaterial({ 
                    map: indTexture,
                    roughness: 0.8,
                    metalness: 0.2
                });
                break;
            case 'road':
                geometry = new THREE.BoxGeometry(0.9, 0.1, 0.9);
                const roadTexture = this.createBuildingTexture('road');
                material = new THREE.MeshStandardMaterial({ 
                    map: roadTexture,
                    roughness: 0.9,
                    metalness: 0.1
                });
                break;
            case 'park':
                geometry = new THREE.BoxGeometry(0.8, 0.2, 0.8);
                const parkTexture = this.createBuildingTexture('park');
                material = new THREE.MeshStandardMaterial({ 
                    map: parkTexture,
                    roughness: 0.8,
                    metalness: 0.1
                });
                break;
            default:
                geometry = new THREE.BoxGeometry(0.8, 1, 0.8);
                const defTexture = this.createBuildingTexture('default');
                material = new THREE.MeshStandardMaterial({ 
                    map: defTexture,
                    roughness: 0.7,
                    metalness: 0.3
                });
        }
        
        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, y + geometry.parameters.height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { type: this.selectedBuildingType };
        
        this.scene.add(building);
        this.buildings.push(building);
    }

    removeBuilding(building) {
        this.scene.remove(building);
        this.buildings = this.buildings.filter(b => b !== building);
        building.geometry.dispose();
        building.material.dispose();
    }

    resetGrid() {
        // Remove all buildings
        while(this.buildings.length > 0) {
            const building = this.buildings.pop();
            this.scene.remove(building);
            building.geometry.dispose();
            building.material.dispose();
        }
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.createGrid();
    }

    updateGridSize() {
        const newWidth = parseInt(document.getElementById('grid-width').value);
        const newDepth = parseInt(document.getElementById('grid-depth').value);
        
        if (newWidth && newDepth && newWidth > 0 && newDepth > 0) {
            this.gridWidth = newWidth;
            this.gridDepth = newDepth;
            
            // Update camera position based on new grid size
            this.camera.position.set(this.gridWidth, this.gridWidth * 0.7, this.gridDepth);
            this.camera.lookAt(0, 0, 0);
            
            // Recreate grid
            this.createGrid();
            
            // Update ground plane
            const ground = this.scene.children.find(child => child.geometry && child.geometry.type === 'PlaneGeometry');
            if (ground) {
                ground.geometry.dispose(); // Dispose old geometry
                ground.geometry = new THREE.PlaneGeometry(
                    this.gridWidth * this.gridSize * 2, 
                    this.gridDepth * this.gridSize * 2
                );
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        this.controls.update();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new CityBuilderGame();
});