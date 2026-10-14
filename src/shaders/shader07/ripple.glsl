uniform float u_time;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 st = materialInput.st;
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(st, center);
    float period = 3.0;
    float progress = fract(u_time / period);
    float maxRadius = 0.7;
    float radius = progress * maxRadius;
    float fade = 1.0 - progress;

    float ringDistance = abs(dist - radius);
    float halfWidth = 0.02;
    float softness = 0.01;
    float ringMask = 1.0 - smoothstep(halfWidth, halfWidth + softness, ringDistance);

    vec3 outsideColor = vec3(0.0, 0.0, 1.0);
    vec3 insideColor = vec3(1.0, 0.0, 0.0);
    material.diffuse = mix(outsideColor, insideColor, ringMask);
    material.alpha = mix(1.0, fade, ringMask);

    return material;
}
