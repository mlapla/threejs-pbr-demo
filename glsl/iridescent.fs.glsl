/*
Uniforms already defined by THREE.js
------------------------------------------------------
uniform mat4 viewMatrix; = camera.matrixWorldInverse
uniform vec3 cameraPosition; = camera position in world space
------------------------------------------------------
*/

uniform sampler2D textureMask; //Texture mask, color is different depending on whether this mask is white or black.
uniform sampler2D textureNumberMask; //Texture containing the billard ball's number, the final color should be black when this mask is black.
uniform vec3 maskLightColor; //Ambient/Diffuse/Specular Color when textureMask is white
uniform vec3 materialDiffuseColor; //Diffuse color when textureMask is black (You can assume this is the default color when you are not using textures)
uniform vec3 materialSpecularColor; //Specular color when textureMask is black (You can assume this is the default color when you are not using textures)
uniform vec3 materialAmbientColor; //Ambient color when textureMask is black (You can assume this is the default color when you are not using textures)
uniform float shininess; //Shininess factor

uniform float iridescence;
uniform float iridescenceGradientSpeed;
uniform sampler2D rainbowTexture;
uniform sampler2D iridescentNormalTexture;

uniform vec3 lightDirection; //Direction of directional light in world space
uniform vec3 lightColor; //Color of directional light
uniform vec3 ambientLightColor; //Color of ambient light

in vec2 texCoord;
in vec3 n;
in vec3 pos;
in vec3 cam;

vec3 ambientShading(in vec3 ka, in vec3 ia){
	return ka * ia;
}

vec3 diffuseShading(in vec3 kd, in vec3 lColor){
	vec3 l = -normalize( (viewMatrix * vec4(lightDirection,1.0)).xyz );
	return kd * lColor * dot( normalize(n), l);
}

vec3 specularBlinnPhongShading(in vec3 ks, in vec3 lColor, in float ns){
	vec3 l = -normalize( (viewMatrix * vec4(lightDirection,1.0)).xyz );
	vec3 v = normalize( cam - pos );
	vec3 h = ( l + v ) / 2.0;
	
	return ks * lColor * pow( dot(h, normalize(n)), ns ); // / (4.0 * 3.1415926 * dot(lDir,lDir));
}

vec3 iridescentShading(in vec3 ki, in vec3 lColor, in float ni, in float speed, in vec3 iNormalMap){
	// fondé sur les conseils donnés :
	// https://medium.com/@sunnless/iridescent-shader-breakdown-c87ec5fe1e2a
	vec3 l = -normalize( lightDirection );
	vec3 v = normalize( cam - pos );
	vec3 h = normalize(( l + v ) / 2.0);
	vec3 r = reflect( -l, normalize(n) );

	vec3 fullNormal = normalize(normalize(n) + iNormalMap);
	vec3 iColor = texture2D(rainbowTexture, vec2(speed*dot(fullNormal,h)),0.0).xyz;


	vec3 shade = lColor * iColor * pow( dot(h, n), ni );

	return max(vec3(0.0),shade);
}

void main() {
	//TODO: BLINN-PHONG SHADING
	//Use Blinn-Phong reflection model
	//Hint: Similar to Phong shader, but use halfway vector instead.
	
	//Before applying textures, assume that materialDiffuseColor/materialSpecularColor/materialAmbientColor are the default diffuse/specular/ambient color.
	//For textures, you can first use texture2D(textureMask, uv) as the billard balls' color to verify correctness, then use mix(...) to re-introduce color.
	//Finally, mix textureNumberMask too so numbers appear on the billard balls and are black.

	vec3 texMask = texture2D( textureMask, texCoord ).xyz;

	vec3 ka = mix( materialAmbientColor, maskLightColor , texMask.x );
	vec3 kd = mix( materialDiffuseColor, maskLightColor , texMask.x );
	vec3 ks = mix( materialSpecularColor, maskLightColor , texMask.x );
	vec3 ki = materialSpecularColor;

	vec3 texNumberMask = texture2D( textureNumberMask, texCoord ).xyz;
	vec3 number = mix( vec3(0.0), maskLightColor, texNumberMask.x);

	ka = ka * number;
	kd = kd * number;
	ks = ks * number;

	vec3 ambient = ambientShading( ka, ambientLightColor );
	vec3 diffuse = diffuseShading( kd, lightColor );
	vec3 specular = specularBlinnPhongShading( ks, lightColor, shininess );

	vec3 iridescentNormalMap = texture2D(iridescentNormalTexture, texCoord).xyz; //
	vec3 iris = iridescentShading( ki, lightColor, iridescence, iridescenceGradientSpeed, iridescentNormalMap);

	vec3 color = ambient + diffuse + iris;

	//Placeholder color
	gl_FragColor = vec4(color,1.0);
}