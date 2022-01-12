// Adaptation of:
// https://www.jordanstevenstechart.com/physically-based-rendering
// for webgl and glsl

#define PI 3.1415926538
#define EPSILON 0.00000001

struct Material {
	vec3 color;
	vec3 specularColor;
	float metalness;	// 0 to 1
	float glossiness;	// 0 to 1
	float aspect;		// optional, for anisotropy
	float ior;
};

struct Light {
	vec3 pos;
	vec3 color;
};

uniform Material material;
uniform Light light;
uniform vec3 ambientLightColor;
uniform int ndfType;
uniform int gsfType;
uniform int ffType;
uniform samplerCube envMapCube;

// World coords:
varying vec3 worldPos;
varying vec3 worldNormal;

// View coords:
varying vec2 texCoord;
varying vec3 pos;
varying vec3 tangentDirection;
varying vec3 normalDirection;
varying vec3 bitangentDirection;

attribute vec3 tangent;

void main() {

	worldPos = position;
	worldNormal = normal;

	texCoord = uv;
	pos = (modelViewMatrix * vec4(position,1.0)).xyz;
	normalDirection = normalMatrix * normal;
	tangentDirection = normalMatrix * tangent;
	bitangentDirection = cross(tangentDirection, normalDirection);

	vec4 relativeVertexPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * relativeVertexPosition;
}
