import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';


let camera, scene, renderer, stats, mixer, character;
const clock = new THREE.Clock();
const assets = ['Idle', 'Walking', 'Soccer Header', 'Goalkeeper Drop Kick', 'Goalkeeper Diving Save', 'Scissor Kick'];
const actions = {};
const params = { action: 'Idle' };
const keys = {
    'W': false,
    'A': false,
    'S': false,
    'D': false,
    '1': false,
    '2': false,
    '3': false,
    '4': false,
    '5': false,
    '6': false,
    'R': false, // Tecla R para mover la cámara a la derecha
    'T': false  // Tecla T para mover la cámara a la izquierda
};

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

const groundMaterial = new CANNON.Material('groundMaterial');
const characterMaterial = new CANNON.Material('characterMaterial');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, characterMaterial, {
    friction: 0.4,
    restitution: 0.3,
});
world.addContactMaterial(contactMaterial);

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfa3123);
    scene.fog = new THREE.Fog(0xfa3123, 150, 1200);

    const hemiLight = new THREE.HemisphereLight(0x77f6f7, 0x444444, 5);
    hemiLight.position.set(22, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 900;
    dirLight.shadow.camera.bottom = -900;
    dirLight.shadow.camera.left = -900;
    dirLight.shadow.camera.right = 900;
    scene.add(dirLight);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const numCubes = Math.floor(Math.random() * 36) + 30;
    const cubeSize = 80;

    for (let i = 0; i < numCubes; i++) {
        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const cubeColor = new THREE.Color(Math.random(), Math.random(), Math.random());
        const cubeMaterial = new THREE.MeshPhongMaterial({ color: cubeColor });

        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

        cube.position.x = Math.random() * 1800 - 900;
        cube.position.z = Math.random() * 1800 - 900;
        cube.position.y = cubeSize / 2;

        cube.castShadow = true;
        cube.receiveShadow = true;

        scene.add(cube);

        const cubeShape = new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, cubeSize / 2));
        const cubeBody = new CANNON.Body({ mass: 1 });
        cubeBody.addShape(cubeShape);
        cubeBody.position.set(cube.position.x, cube.position.y, cube.position.z);

        world.addBody(cubeBody);

        cube.userData.physicsBody = cubeBody;
    }

    const loader = new FBXLoader();
    loader.load('models/fbx/Idle.fbx', function (object) {
        mixer = new THREE.AnimationMixer(object);
        character = object;

        const characterShape = new CANNON.Box(new CANNON.Vec3(15, 15, 15));
        const characterBody = new CANNON.Body({ mass: 1, material: characterMaterial });
        characterBody.addShape(characterShape);
        characterBody.position.set(0, 15, 0);

        characterBody.fixedRotation = true;
        characterBody.updateMassProperties();

        world.addBody(characterBody);

        character.userData.physicsBody = characterBody;

        assets.forEach(asset => {
            loader.load(`models/fbx/${asset}.fbx`, function (anim) {
                const action = mixer.clipAction(anim.animations[0]);
                actions[asset] = action;
                if (asset === 'Idle') {
                    action.play();
                }
            }, undefined, function (error) {
                console.error(`Error loading ${asset}:`, error);
            });
        });

        object.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(object);
    }, undefined, function (error) {
        console.error('Error loading Idle:', error);
    });

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);

    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'action', assets).onChange(function (value) {
        if (actions[params.action]) {
            actions[params.action].stop();
        }
        params.action = value;
        actions[params.action].play();
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    world.step(1 / 60);

    scene.traverse(function (object) {
        if (object.userData.physicsBody) {
            object.position.copy(object.userData.physicsBody.position);
            object.quaternion.copy(object.userData.physicsBody.quaternion);
        }
    });

    if (character) updateCharacterMovement();
    updateCameraPosition(); // Actualizar la posición de la cámara según las teclas R y T

    renderer.render(scene, camera);
    stats.update();
}

function updateCharacterMovement() {
    const moveDistance = 2;
    const characterBody = character.userData.physicsBody;

    if (keys['S']) {
        characterBody.position.z -= moveDistance;
    }
    if (keys['W']) {
        characterBody.position.z += moveDistance;
    }
    if (keys['D']) {
        characterBody.position.x -= moveDistance;
    }
    if (keys['A']) {
        characterBody.position.x += moveDistance;
    }
}

function updateCameraPosition() {
    const moveDistance = 5;

    if (keys['R']) {
        camera.position.x += moveDistance;
    }
    if (keys['T']) {
        camera.position.x -= moveDistance;
    }
}

function onKeyDown(event) {
    switch (event.key) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
            keys[event.key] = true;
            changeAnimation(assets[event.key - 1]);
            break;
        case 'S':
        case 'D':
        case 'W':
        case 'A':
        case 'R':
        case 'T':
            keys[event.key] = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.key) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
            keys[event.key] = false;
            break;
        case 'S':
        case 'D':
        case 'W':
        case 'A':
        case 'R':
        case 'T':
            keys[event.key] = false;
            break;
    }
}

function changeAnimation(actionName) {
    if (params.action !== actionName) {
        if (actions[params.action]) {
            actions[params.action].stop();
        }
        params.action = actionName;
        actions[params.action].play();
    }
}

init();
animate();
