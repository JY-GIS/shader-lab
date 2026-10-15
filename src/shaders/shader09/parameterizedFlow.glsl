uniform float u_time;
uniform float u_period;
uniform float u_highlightHalfWidth;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    
    vec2 st = materialInput.st;
    float linePosition = st.s;
    float highlightCenter = fract(u_time / u_period);

    float softness = 0.05;
    float distanceToHighlight = abs(linePosition - highlightCenter);
    float highlightMask = 1.0 - smoothstep(
        u_highlightHalfWidth,
        u_highlightHalfWidth + softness,
        distanceToHighlight
    );

    vec3 baseColor = vec3(0.02, 0.08, 0.15);
    vec3 highlightColor = vec3(0.0, 1.0, 1.0);
    material.diffuse = mix(baseColor, highlightColor, highlightMask);
    material.alpha = 1.0;
    return material;
}
