uniform float u_time;
uniform float u_speed;
uniform float u_repeat;
uniform vec4 u_color;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    float s = materialInput.st.s;

    // 相位从外圈向风眼推进，亮段头部清晰，尾部逐渐透明。
    float phase = fract((u_time * u_speed - s) * u_repeat);
    float streak = 1.0 - smoothstep(0.0, 0.36, phase);
    float widthFade = 1.0 - smoothstep(0.32, 0.5, abs(materialInput.st.t - 0.5));
    float endFade = smoothstep(0.0, 0.045, s) * (1.0 - smoothstep(0.955, 1.0, s));

    material.diffuse = u_color.rgb;
    material.alpha = u_color.a * mix(0.07, 1.0, streak) * widthFade * endFade;
    return material;
}
