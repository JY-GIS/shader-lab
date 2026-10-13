czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 st = materialInput.st;
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = st - center;
    float dist = length(offset);
    float radius = 0.25;

    // 硬边界
    // float circleMask = 1.0 - step(radius, dist);

    //柔和边界
    float edgeWidth = 0.1;
    float circleMask = 1.0 - smoothstep(
        radius - edgeWidth,
        radius + edgeWidth,
        dist
    );

    vec3 outsideColor = vec3(0.0, 0.0, 1.0);
    vec3 insideColor = vec3(1.0, 0.0, 0.0);

    material.diffuse = mix(outsideColor, insideColor, circleMask);
    material.alpha = 1.0;

    return material;
}