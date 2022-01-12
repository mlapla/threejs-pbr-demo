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
// NDF Type:
// 0 : None
// 1 : Blinn-Phong
// 2 : Phong
// 3 : Beckman
// 4 : Gaussien
// 5 : GGX
// 6 : Trowbridge-Reitz
// 7 : Trowbridge-Reitz (Anisotropic)
// 8 : Ward (Anisotropic)
uniform int gsfType;
// GSF Type:
// 0 : None
// 1 : Implicit
// 2 : Ashikhmin-Shirley
// 3 : Ashikhmin-Premoze
// 4 : Duer
// 5 : Neumann
// 6 : Kelemen
// 7 : Modified Kelemen
// 8 : Cook-Torrance
// 9 : Ward
// 10: Kurt
// 11: Walter
// 12: GGX
// 13: Schlick
// 14: Schlick-Beckmann
// 15: Schlick-GGX
uniform int ffType;
// Fresnel Type:
// 0 : None
// 1 : Schlick (Color)
// 2 : Schlick (IOR)
// 3 : Spherical-Gaussian
uniform samplerCube envMapCube;

// World Coords:
in vec3 worldPos;
in vec3 worldNormal;

// View Coords:
in vec2 texCoord;
in vec3 pos;
in vec3 tangentDirection;
in vec3 normalDirection;
in vec3 bitangentDirection;

float distance2(in vec3 a, in vec3 b){
	vec3 c = a - b;
	return dot(c,c);
}

vec3 worldToView(in vec3 v){
	return (viewMatrix * vec4(v,1.0)).xyz;
}

///////////////////////////////////
/* Normal Distribution functions */
///////////////////////////////////
float powerNDF(in float x, in float A, in float b){
	return A * pow(x, b);
}

float blinnPhongNDF(in float NdotH, in float A, in float b){
	return powerNDF(NdotH, A, b);
}

float phongNDF(in float RdotV, in float A, in float b){
	return powerNDF(RdotV, A, b);
}

float beckmannNDF(in float NdotH, in float A, in float b){
	float NdotH2 = max(EPSILON, NdotH*NdotH); // For safe divisions
	return A * exp((1.0 - (1.0/NdotH2))/b) / (NdotH2*NdotH2);
}

float gaussienNDF(in float NdotH, in float A, in float b){
	float angle = acos(NdotH);
	return A * exp(- b * angle*angle);
}

float ggxNDF(in float NdotH, in float A, in float b){
	return A / sqrt(1.0 + b*NdotH*NdotH);
}

float trowbridgeReitzNDF(in float NdotH, in float A, in float b){
	float d = 1.0 + b*NdotH*NdotH;
	return A / (d*d);
}

float trowbridgeReitzAnisotropicNDF(in float NdotH, in float TdotH, in float BdotH, 
									in float A, in float x, in float y){	//TODO Verify
	float anisotropy = sqrt(TdotH / x) + sqrt(BdotH / y);
	return A / max(EPSILON, sqrt(anisotropy + NdotH*NdotH));
}

float wardAnisotropicNDF(in float NdotL, in float NdotV,
						in float NdotH, in float TdotH, in float BdotH, 
						in float A, in float x, in float y){	//TODO Verify
	float anisotropy = sqrt(TdotH / x) + sqrt(BdotH / y);
	float amplitude = A / max(EPSILON, sqrt(NdotL * NdotV));
	return amplitude * exp(-anisotropy/max(EPSILON,sqrt(NdotH)));
}

///////////////////////////////////
/* Geometric Shadowing functions */
///////////////////////////////////
float implicitGSF(in float NdotL, in float NdotV){
	return NdotL*NdotV;
}

float ashikhminShirleyGSF(in float NdotL, in float NdotV, in float LdotH){
	return NdotL * NdotV / (LdotH * max(NdotL,NdotV));
}

float ashikhminPremozeGSF(in float NdotL, in float NdotV){
	return NdotL * NdotV / (NdotL+NdotV - NdotL*NdotV);
}

float duerGSF(in vec3 lightDirection, in vec3 viewDirection, in vec3 normalDirection){
	vec3 lv = lightDirection + viewDirection;	// TODO Verify
	return dot(lv,lv)/(dot(lv, normalDirection)*dot(lv, normalDirection));
}

float neumannGSF(in float NdotL, in float NdotV){
	return NdotL * NdotV /max(NdotL, NdotV);
}

float kelemenGSF(in float NdotL, in float NdotV, in float VdotH){
	return NdotL * NdotV / (VdotH * VdotH);	// TODO Verify
}

float modKelemenGSF(in float NdotL, in float NdotV, in float strength){
	float g = 1.0 - strength + strength*NdotV;
	return NdotL * g*g;
}

float cookTorranceGSF(in float NdotL, in float NdotV, in float NdotH, in float VdotH){
	return 2.0 * min(NdotV,NdotL) * NdotH / VdotH;
}

float wardGSF(in float NdotL, in float NdotV){
	return sqrt(NdotL*NdotV);
}

float kurtGSF(in float NdotL, in float NdotV, in float VdotH, in float roughness){
	return NdotL*NdotV / (VdotH * pow(NdotL*NdotV, roughness));
}

float smithGSF(in float x, in float alpha){
	return 2.0 / (1.0 + sqrt(1.0 + alpha*(1.0 - x*x)/(x*x)));
}

float walterGSF(in float NdotL, in float NdotV, in float roughness){
	float smithL = smithGSF(NdotL, roughness*roughness);
	float smithV = smithGSF(NdotV, roughness*roughness);
	return smithL * smithV;
}

float smithReducedGSF(in float x, in float alpha){
	return 2.0 * x / (x + sqrt(alpha + (1.0 - alpha) * x*x));
}

float ggxGSF(in float NdotL, in float NdotV, in float roughness){
	float smithL = smithReducedGSF(NdotL,roughness*roughness);
	float smithV = smithReducedGSF(NdotV,roughness*roughness);
	return smithL * smithV;
}

float smithApproxGSF(in float x, in float alpha){
	return x / (x * (1.0 - alpha) + alpha);
}

float schlickGSF(in float NdotL, in float NdotV, in float roughness){
	float smithL = smithApproxGSF(NdotL, roughness*roughness);
	float smithV = smithApproxGSF(NdotV, roughness*roughness);
	return smithL * smithV;
}

float schlickBeckmannGSF(in float NdotL, in float NdotV, in float roughness){
	float k = 0.797885*roughness*roughness;
	float smithL = smithApproxGSF(NdotL, k);
	float smithV = smithApproxGSF(NdotV, k);
	return smithL * smithV;
}

float schlickGgxGSF(in float NdotL, in float NdotV, in float roughness){
	float k = roughness / 2.0;
	float smithL = smithApproxGSF(NdotL, k);
	float smithV = smithApproxGSF(NdotV, k);
	return smithL * smithV;
}

///////////////////////////////////
/* Fresnel						 */
///////////////////////////////////

float schlickApprox(in float x){
	return x + (1.0 - x) * pow(1.0 - x, 5.0);
}

// float schlickFF(in float NdotL, in float NdotV, in float LdotH, in float roughness){
// 	float schlickL = schlickApprox(NdotL);
// 	float schlickV = schlickApprox(NdotV);
// 	float grazing = 0.5 + 2.0 * roughness * LdotH*LdotH;
// 	return mix(1.0, grazing, schlickL) * mix(1.0, grazing, schlickV);
// }

vec3 schlickFF(in float LdotH, in vec3 color){
	return color + (1.0 - color)*schlickApprox(LdotH);
}

vec3 schlickIoRFF(in float LdotH, in float ior){
	float k = (ior - 1.0)*(ior - 1.0) / ((ior + 1.0)*(ior + 1.0));
	return vec3(k + (1.0 - k)*schlickApprox(LdotH));
}

vec3 gaussSphericalFF(in float LdotH, in vec3 color){
	float b = -5.5473 * LdotH*LdotH - 6.98316 * LdotH;
	return color + (1.0 - color) * pow(LdotH, b);
}

void main() {

	// View Orientations
	vec3 normalDirection = normalize(normalDirection);
	vec3 lightDirection = normalize( worldToView(light.pos) - pos);
	vec3 lightReflectionDirection = reflect( -lightDirection, normalDirection );
	vec3 viewDirection = normalize( worldToView(cameraPosition) - pos);
	vec3 viewReflectionDirection = reflect( -viewDirection, normalDirection );
	vec3 halfDirection = normalize(viewDirection + lightDirection);

	// World Orientations
	// vec3 worldViewReflectionDirection = reflect( -normalize(cameraPosition - worldPos), normalize(worldNormal) );

	// Dot Products
	float NdotL = max(0.0, dot(normalDirection, lightDirection));
	float NdotV = max(0.0, dot(normalDirection, viewDirection));
	float NdotH = max(0.0, dot(normalDirection, halfDirection));
	float TdotH = max(0.0, dot(tangentDirection, halfDirection));
	float BdotH = max(0.0, dot(bitangentDirection, halfDirection));

	float LdotV = max(0.0, dot(lightDirection, viewDirection));
	float LdotH = max(0.0, dot(lightDirection, halfDirection));
	float RdotV = max(0.0, dot(lightReflectionDirection, viewDirection));
	
	float VdotH = max(0.0, dot(viewDirection, halfDirection));

	// Env Map
	vec3 env = textureCube(envMapCube, viewReflectionDirection).rgb; 

	// Material properties
	float roughness = 1.0 - (material.glossiness * material.glossiness);
	roughness = roughness*roughness;

	vec3 diffuseColor = (1.0 - material.metalness) * material.color + material.metalness * env;
	vec3 specularColor = mix( material.specularColor, material.color, 0.5*material.metalness);


	// Normal Distribution Functions
	float NDF = 1.0;

	if (ndfType == 1){	//TODO: change these to subroutines?
		float A = material.glossiness * (2.0 + material.glossiness) / (2.0 * PI);
		float b = max(1.0,40.0*material.glossiness);
		NDF = blinnPhongNDF(NdotH, A, b);
	}
	else if (ndfType == 2){
		float A = material.glossiness * (2.0 + material.glossiness) / (2.0 * PI);
		float b = max(1.0,40.0*material.glossiness);
		NDF = phongNDF(RdotV, A, b);
	}
	else if (ndfType == 3){
		float A = 1.0/(PI * roughness*roughness);
		float b = roughness*roughness;
		NDF = beckmannNDF(NdotH, A, b);
	}
	else if (ndfType == 4){
		float A = 1.0;
		float b = 1.0/(roughness*roughness);
		NDF = gaussienNDF(NdotH, A, b);
	}
	else if (ndfType == 5){
		float A = sqrt(roughness)/PI;
		float b = roughness*roughness - 1.0;
		NDF = ggxNDF(NdotH, A, b);
	}
	else if (ndfType == 6){
		float A = roughness*roughness / PI;
		float b = roughness*roughness - 1.0;
		NDF = trowbridgeReitzNDF(NdotH, A, b);
	}
	else if (ndfType == 7){
		float A = 1.0 / (PI * (1.0 - material.glossiness));
		float x = max(EPSILON, 5.0 * sqrt(1.0 - material.glossiness) / material.aspect);
		float y = max(EPSILON, 5.0 * sqrt(1.0 - material.glossiness) * material.aspect);
		NDF = trowbridgeReitzAnisotropicNDF(NdotH, TdotH, BdotH, A, x, y);
	}
	else if (ndfType == 8){
		float A = 1.0 / (4.0*PI * (1.0 - material.glossiness));
		float x = max(EPSILON, 5.0 * sqrt(1.0 - material.glossiness) / material.aspect);
		float y = max(EPSILON, 5.0 * sqrt(1.0 - material.glossiness) * material.aspect);
		NDF = wardAnisotropicNDF(NdotL, NdotV, NdotH, TdotH, BdotH, A, x, y);
	}

	// Geometric Shadowing Functions
	float GSF = 1.0;

	if (gsfType == 1){
		GSF = implicitGSF(NdotL,NdotV);
	}
	else if (gsfType == 2){
		GSF = ashikhminShirleyGSF(NdotL, NdotV, LdotH);
	}
	else if (gsfType == 3){
		GSF = ashikhminPremozeGSF(NdotL, NdotV);	
	}
	else if (gsfType == 4){
		GSF = duerGSF(lightDirection, viewDirection, normalDirection);
	}
	else if (gsfType == 5){
		GSF = neumannGSF(NdotL,NdotV);
	}
	else if (gsfType == 6){
		GSF = kelemenGSF(NdotL, NdotV, VdotH);
	}
	else if (gsfType == 7){
		float strength = sqrt(2.0/PI) * roughness*roughness;
		GSF = modKelemenGSF(NdotL, NdotV, strength);
	}
	else if (gsfType == 8){
		GSF = cookTorranceGSF(NdotL, NdotV, NdotH, VdotH);
	}
	else if (gsfType == 9){
		GSF = wardGSF(NdotL, NdotV);
	}
	else if (gsfType == 10){
		GSF = kurtGSF(NdotL, NdotV, NdotH, VdotH);
	}
	else if (gsfType == 11){
		GSF = walterGSF(NdotL, NdotV, roughness);
	}
	else if (gsfType == 12){
		GSF = ggxGSF(NdotL, NdotV, roughness);
	}
	else if (gsfType == 13){
		GSF = schlickGSF(NdotL, NdotV, roughness);
	}
	else if (gsfType == 14){
		GSF = schlickBeckmannGSF(NdotL, NdotV, roughness);
	}
	else if (gsfType == 15){
		GSF = schlickGgxGSF(NdotL, NdotV, roughness);
	}

	// Fresnel Function
	vec3 FF = vec3(1.0);

	if (ffType == 1){
		FF = schlickFF(LdotH, specularColor);
	}
	else if (ffType == 2){
		FF = schlickIoRFF(LdotH, material.ior);
	}
	else if (ffType == 3){
		FF = gaussSphericalFF(LdotH, specularColor);
	}

	// Lighting
	float lightAttenuation = 4.0*3.1415*distance2(light.pos,pos);

	vec3 specularity = NDF * GSF * FF / (4.0 * NdotL*NdotV);
	vec3 color = (diffuseColor + specularity) * NdotL * light.color;

	//Placeholder color

	gl_FragColor = vec4( color, 1.0 );
}