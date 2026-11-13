uniform float u_progress;
uniform float u_repeat;
uniform float u_distanceScale;
uniform vec4 u_color;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    float s = materialInput.st.s;

    // 用屏幕空间的变化率换算沿线与横向的比例，圆头随缩放保持圆润。
    float t = materialInput.st.t;
    float sPerPixel = length(vec2(dFdx(s), dFdy(s)));
    float tPerPixel = length(vec2(dFdx(t), dFdy(t)));
    float phase = fract((u_progress - s) * u_repeat + 0.20) - 0.20;
    float headRadius = 0.43 * u_distanceScale;
    float headLength = min(headRadius * sPerPixel * u_repeat / max(tPerPixel, 0.00001), 0.20);
    float alongHead = min(phase, 0.0) * headRadius / max(headLength, 0.00001);

    float tailPosition = clamp(phase / (0.48 * u_distanceScale), 0.0, 1.0);
    float halfWidth = mix(headRadius, 0.0, tailPosition);
    float distanceToCenter = length(vec2(alongHead, t - 0.5));
    float edge = max(tPerPixel * 0.75, 0.001);
    float shape = 1.0 - smoothstep(halfWidth - edge, halfWidth + edge, distanceToCenter);
    float tailFade = 1.0 - smoothstep(0.05, 1.0, tailPosition);
    float endFade = smoothstep(0.0, 0.025, s) * (1.0 - smoothstep(0.975, 1.0, s));

    material.diffuse = u_color.rgb;
    material.alpha = u_color.a * shape * tailFade * endFade;
    return material;
}
