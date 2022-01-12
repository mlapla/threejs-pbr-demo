import * as THREE from './build/three.module.js';

import {OrbitControls} from './js/jsm/controls/OrbitControls.js';
import { GUI } from '/js/jsm/libs/dat.gui.module.js'

const textureLoader = new THREE.TextureLoader();
const shaderLoader = new THREE.FileLoader();
let renderer, camera, scene;
const clock = new THREE.Clock();

let gui;
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
const SPHERE_HEIGHT = 1.9;
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

let ambientLightColor = new THREE.Vector3(0.3,0.3,0.3);

function init() {

	// Init Camera
	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
	camera.position.set(8,8, 8);
	
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
	addFloor(scene);
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
	guiMaterialFolder.add(sphereMaterial.value,'aspect',0.1,5);
	guiMaterialFolder.add(sphereMaterial.value,'ior',1.0,4.0);
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
	
	// Append to window
	const container = document.createElement('div');
	document.body.appendChild(container);
	container.appendChild(renderer.domElement);

	// Enable mouse control
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(0, 0, 0);
	controls.update();

}

function addFloor(scene){
	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(100000, 100000), 
		new THREE.MeshPhongMaterial({color: 0x100D1A + 0x101010, shininess: 10, depthWrite: true})
	);
	ground.rotation.x = - Math.PI / 2;
	ground.position.y = -1;
	ground.castShadow = true
	ground.receiveShadow = true
	scene.add(ground);

	const grid = new THREE.GridHelper(200, 20, 0x000000, 0x000000);
	scene.add(grid);
}

function addLights(scene){
	//Add Ambient Light
	const hemiLight = new THREE.HemisphereLight(ambientLightColor, ambientLightColor, 1.0);
	hemiLight.position.set(0, 200, 0);
	scene.add(hemiLight);

	//Add Directional Light
	spotLight = new THREE.DirectionalLight(directionalLight.value.color, 1.0);
	spotLight.position.set(0, 10, 0);
	spotLight.target.position.set(0, 0, 0);
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
	console.log(m)
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
	scene.add(sphere);
}

function addProps(scene){
	const geometry = new THREE.BoxGeometry();
	const material = new THREE.MeshPhongMaterial( { color: 0x334455 } );
	const cube1 = new THREE.Mesh( geometry, material );
	const cube2 = new THREE.Mesh( geometry, material );
	const cube3 = new THREE.Mesh( geometry, material );
	cube1.castShadow = true
	cube1.receiveShadow = true
	cube2.castShadow = true
	cube2.receiveShadow = true
	cube3.castShadow = true
	cube3.receiveShadow = true
	cube1.position.set(4,0,3);
	cube2.position.set(1,1,7);
	cube3.position.set(5,2,4);
	scene.add( cube1 );
	scene.add( cube2 );
	scene.add( cube3 );
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
	ndfType['value'] = ndfNameToIndex[ndfChoice['NDF']];
}

function onGSFChoose(){
	gsfType['value'] = gsfNameToIndex[gsfChoice['GSF']];
}

function onFFChoose(){
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