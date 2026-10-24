uniform float u_time;
uniform float u_repeat;
uniform float u_speed;
uniform vec4 u_arrowColor;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 st = materialInput.st;
    float phase = fract(st.s * u_repeat - u_time * u_speed);

    float across = abs(st.t - 0.5);
    float chevronCenter = 0.72 - across * 0.95;
    float distanceToChevron = abs(phase - chevronCenter);

    float strokeMask = 1.0 - smoothstep(0.055, 0.085, distanceToChevron);
    float widthMask = 1.0 - smoothstep(0.34, 0.42, across);
    float arrowMask = strokeMask * widthMask;

    vec4 routeColor = vec4(0.063, 0.333, 0.427, 0.78);

    float middleMask = 1.0 - step(8.0 / 24.0, across);
    routeColor = mix(routeColor, vec4(0.055, 0.553, 0.698, 1.0), middleMask);

    float guideMask = 1.0 - step(1.5 / 24.0, across);
    routeColor = mix(routeColor, vec4(0.267, 0.808, 0.925, 1.0), guideMask);

    // 箭头拥有最高优先级，箭头区域覆盖下面的路线颜色。
    vec4 finalColor = mix(routeColor, u_arrowColor, arrowMask);

    material.diffuse = finalColor.rgb;
    material.alpha = finalColor.a;

    return material;
}
