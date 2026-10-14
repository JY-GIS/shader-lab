uniform float u_time;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    // st.s 预计沿坐标数组的起点向终点变化
    // st.t 预计横跨折线宽度变化
    vec2 st = materialInput.st;

    float linePosition = st.s;
    float period = 3.0;
    float highlightCenter = fract(u_time / period);
    float highlightHalfWidth = 0.01;
    float softness = 0.05;
    float distanceToHighlight = abs(linePosition - highlightCenter);
    float highlightMask = 1.0 - smoothstep(
        highlightHalfWidth,
        highlightHalfWidth + softness,
        distanceToHighlight
    );

    vec3 baseColor = vec3(0.02, 0.08, 0.15);
    vec3 highlightColor = vec3(0.0, 1.0, 1.0);
    material.diffuse = mix(baseColor, highlightColor, highlightMask);
    material.alpha = 1.0;

    return material;
}