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

    float strokeMask = 1.0 - smoothstep(0.04, 0.07, distanceToChevron);
    float widthMask = 1.0 - smoothstep(0.34, 0.42, across);
    float arrowMask = strokeMask * widthMask;

    material.diffuse = u_arrowColor.rgb;
    material.alpha = arrowMask;

    return material;
}
