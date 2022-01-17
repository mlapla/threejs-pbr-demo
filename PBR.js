import * as THREE from './build/three.module.js';

import {OrbitControls} from './js/jsm/controls/OrbitControls.js';
import { GUI } from '/js/jsm/libs/dat.gui.module.js';

const textureLoader = new THREE.TextureLoader();
const shaderLoader = new THREE.FileLoader();
let renderer, camera, scene;
const clock = new THREE.Clock();

let gui, guiAspect, guiIOR;
let guiLightFolder,guiMaterialFolder;

// NDF options
let ndfType = {value:0};
let ndfChoice = {'NDF':'None'};
let ndfTypeNames = [
	'None',
	'Blinn-Phong', 
	'Phong',
	'Beckmann',
	'Gaussien',
	'GGX',
	'Trowbridge-Reitz',
	'Trowbridge-Reitz (Anisotropic)',
	'Ward (Anisotropic)'
];
let ndfNameToIndex = {}; ndfTypeNames.forEach((name,idx)=>{ndfNameToIndex[name] = idx;})

// GSF ooptions
let gsfType = {value: 1};
let gsfChoice = {'GSF':'Implicit'};
let gsfTypeNames = [
	'None',
	'Implicit',
	'Ashikhmin-Shirley',
	'Ashikhmin-Premoze',
	'Duer',
	'Neumann',
	'Kelemen',
	'Modified Kelemen',
	'Cook-Torrance',
	'Ward',
	'Kurt',
	'Walter',
	'GGX',
	'Schlick',
	'Schlick-Beckmann',
	'Schlick-GGX'
];
let gsfNameToIndex = {}; gsfTypeNames.forEach((name,idx)=>{gsfNameToIndex[name] = idx;})

// Fresnel options
let ffType = {value: 1};
let ffChoice = {'Fresnel': 'None'};
let ffTypeNames = [
	'None',
	'Schlick',
	'Schlick (IoR)',
	'Spherical-Gaussian'
];
let ffNameToIndex = {}; ffTypeNames.forEach((name,idx)=>{ffNameToIndex[name] = idx;})

// Material Data
const SPHERE_HEIGHT = 3;
const SPHERE_RADIUS = 2;

let materialGUIColor = {color: 0xFFFFFF};
let materialGUISpecularColor = {specularColor: 0xFFFFFF}
let sphereMaterial = {
	value: {
		color:  colorHexToVec(materialGUIColor['color']),
		specularColor: colorHexToVec(materialGUISpecularColor['specularColor']),
		metalness : 0.1,
		glossiness : 0.5,
		aspect: 1.0,
		ior: 2.0
	}
};

// Env Map
let sphereEnvMapRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
});
let sphereEnvMapCamera = new THREE.CubeCamera(0.1, 100000, sphereEnvMapRenderTarget);
sphereEnvMapCamera.target = camera;

// Lighting
let directionalLight = {
	value: {
		pos: new THREE.Vector3(0, 500, 0),
		color: new THREE.Vector3(1.0,1.0,1.0)
	}
};
let spotLight;

let ambientLightColor = new THREE.Vector3(0.15,0.15,0.15);

function init() {

	// Init Camera
	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
	camera.position.set(8,8,8);
	
	// Init Scene
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);
	scene.fog = new THREE.Fog(0x000000, 1000, 5000);
	sphereEnvMapCamera.position.set(0, SPHERE_HEIGHT, 0);
	scene.add(sphereEnvMapCamera);
	
	// Init Renderer
	initRenderer();
	window.addEventListener('resize', onWindowResize);
	
	// Init Props
	addLights(scene);
	addWalls(scene);
	addProps(scene);
	addSphere(scene);

	// Init GUI
	initGUI();
}

function initGUI(){
	gui = new GUI()
	gui.add(ndfChoice,'NDF',ndfTypeNames).onChange(onNDFChoose);
	gui.add(gsfChoice, 'GSF', gsfTypeNames).onChange(onGSFChoose);
	gui.add(ffChoice, 'Fresnel', ffTypeNames).onChange(onFFChoose);

	guiMaterialFolder = gui.addFolder('Material');
	guiMaterialFolder.addColor(materialGUIColor,'color').onChange(onMaterialColoring);
	guiMaterialFolder.addColor(materialGUISpecularColor,'specularColor').onChange(onMaterialSpecularColoring);
	guiMaterialFolder.add(sphereMaterial.value,'metalness',0,1);
	guiMaterialFolder.add(sphereMaterial.value,'glossiness',0,1);
	// guiAspect = guiMaterialFolder.add(sphereMaterial.value,'aspect',0.1,5);
	// guiIOR = guiMaterialFolder.add(sphereMaterial.value,'ior',1.0,4.0);
	guiMaterialFolder.open();

	guiLightFolder = gui.addFolder('Light Position');
	guiLightFolder.add(spotLight.position, 'x', -10, 10).onChange(onLightRotation);
	guiLightFolder.add(spotLight.position, 'z', -10, 10).onChange(onLightRotation);
	guiLightFolder.open();
}

function initRenderer(){
	// Create renderer
	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	// Append to window
	const container = document.createElement('div');
	document.body.appendChild(container);
	container.appendChild(renderer.domElement);

	// Enable mouse control
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(0, SPHERE_HEIGHT, 0);
	controls.maxPolarAngle = Math.PI/2 - 0.1
	controls.minPolarAngle = 0
	controls.update();

}

function addWall(scene, x,y,z, rot, color){
	const wall = new THREE.Mesh(
		new THREE.PlaneGeometry(60, 60), 
		new THREE.MeshPhongMaterial({color: color, shininess: 10, depthWrite: true})
	);
	wall.position.x = x;
	wall.position.y = y;
	wall.position.z = z;
	wall.rotation.y = rot;
	wall.castShadow = true;
	wall.receiveShadow = true;

	const back = new THREE.Mesh(
		new THREE.PlaneGeometry(60, 60), 
		new THREE.MeshPhongMaterial({color: 0x333333, shininess: 10, depthWrite: true})
	);
	back.position.x = x;
	back.position.y = y;
	back.position.z = z;
	back.rotation.y = rot + Math.PI;
	back.castShadow = true;
	back.receiveShadow = true;

	scene.add(wall);
	scene.add(back);
}

function addWalls(scene){
	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(5000, 5000), 
		new THREE.MeshPhongMaterial({color: 0x100D1A + 0x101010, shininess: 10, depthWrite: true})
	);
	ground.rotation.x = - Math.PI/2;
	ground.castShadow = true;
	ground.receiveShadow = true;

	scene.add(ground);

	addWall(scene, 0,0,-30,0,0x33EE33);
	addWall(scene, 0,0,30,Math.PI,0xEEEEEE);
	addWall(scene, -30,0,0,Math.PI/2,0xEE3333);
	addWall(scene, 30,0,0,-Math.PI/2,0x3333EE);

	const grid = new THREE.GridHelper(200, 20, 0x000000, 0x000000);
	scene.add(grid);
}

function addLights(scene){
	//Add Ambient Light
	// const hemiLight = new THREE.HemisphereLight(ambientLightColor, ambientLightColor, 1.0);
	// hemiLight.position.set(0, 20, 0);
	// scene.add(hemiLight);
	const ambientlight = new THREE.AmbientLight('white', 1);
	scene.add(ambientlight);

	//Add Directional Light
	spotLight = new THREE.DirectionalLight(directionalLight.value.color, 1.0);
	spotLight.position.set(0, 10, 0);
	spotLight.target.position.set(0, SPHERE_HEIGHT, 0);
	spotLight.castShadow = true;
	scene.add(spotLight);
	scene.add(spotLight.target);
	directionalLight.value.pos.copy(spotLight.position);
}

function addSphere(scene) {
		
	const m = new THREE.ShaderMaterial({
		uniforms: {
			ndfType,
			gsfType,
			ffType,
			ambientLightColor: {value: ambientLightColor},
			material: sphereMaterial,
			light: directionalLight,
			envMapCube: {type: 't', value: sphereEnvMapRenderTarget.texture}
		},
	});
	shaderLoader.load('glsl/pbr.fs.glsl', function(data) {
		m.fragmentShader = data;
		m.needsUpdate = true;
	});

	shaderLoader.load('glsl/pbr.vs.glsl', function(data) {
		m.vertexShader = data;
		m.needsUpdate = true;
	});

	const g = new THREE.SphereGeometry(2, 64, 32);
	g.computeTangents();
	const sphere = new THREE.Mesh(g, m);
	sphere.position.set(0, SPHERE_HEIGHT, 0);
	sphere.castShadow = true
	sphere.receiveShadow = true
	scene.add(sphere);
}

function addCube(scene, x,y,z, color){
	const geometry = new THREE.BoxGeometry();
	const material = new THREE.MeshPhongMaterial( { color: color } );
	const cube = new THREE.Mesh( geometry, material );
	cube.castShadow = true;
	cube.receiveShadow = true;
	cube.position.set(x,y,z);
	scene.add(cube);
}

function addProps(scene){
	// addCube(scene,-4,3, 3,0x112233);
	// addCube(scene, 1,4, 7,0x223344);
	// addCube(scene, 5,2,-4,0x998877);
}

function colorHexToVec(hex){
	const color = new THREE.Color(hex);	
	return new THREE.Vector3(color.r,color.g,color.b);
}

function onMaterialColoring(){
	const c = colorHexToVec(materialGUIColor.color);
	sphereMaterial.value.color.copy(c);
}

function onMaterialSpecularColoring(){
	const c = colorHexToVec(materialGUISpecularColor.specularColor);
	sphereMaterial.value.specularColor.copy(c);
}

function onNDFChoose(){
	if (ndfNameToIndex[ndfChoice['NDF']] == 7 || ndfNameToIndex[ndfChoice['NDF']] == 8){
		if (guiAspect == undefined)
			guiAspect = guiMaterialFolder.add(sphereMaterial.value,'aspect',0.1,5)
	}
	else if (ndfNameToIndex[ndfChoice['NDF']] != 7 || ndfNameToIndex[ndfChoice['NDF']] != 8){
		if (guiAspect != undefined){
			guiMaterialFolder.remove(guiAspect);
			guiAspect = undefined;
		}
	}
	ndfType['value'] = ndfNameToIndex[ndfChoice['NDF']];
}

function onGSFChoose(){
	gsfType['value'] = gsfNameToIndex[gsfChoice['GSF']];
}

function onFFChoose(){
	if (ffNameToIndex[ffChoice['Fresnel']] == 2)
		guiIOR = guiMaterialFolder.add(sphereMaterial.value,'ior',1.0,4.0);
	else if (guiIOR != undefined){
		guiMaterialFolder.remove(guiIOR);
		guiIOR = undefined;
	}
	ffType['value'] = ffNameToIndex[ffChoice['Fresnel']];
}

function onLightRotation(){
	directionalLight.value.pos.copy(spotLight.position);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	requestAnimationFrame(animate);
	const delta = clock.getDelta();
	
    sphereEnvMapCamera.update(renderer, scene);
    sphereEnvMapCamera.lookAt(camera.position);
	renderer.render(scene, camera);
}

init();
animate();