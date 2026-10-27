czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;

    // 多段流光沿折线纹理坐标前进，保留一条低亮度连接弧。
    float phase = fract(st.s * 2.0 - u_time * u_speed);
    float tail = smoothstep(0.53, 0.92, phase);
    float head = 1.0 - smoothstep(0.92, 1.0, phase);
    float pulse = tail * head;
    float edge = 1.0 - smoothstep(0.22, 0.5, abs(st.t - 0.5));

    material.diffuse = u_color.rgb * (0.45 + 0.55 * pulse);
    material.emission = u_color.rgb * pulse * 0.6;
    material.alpha = u_color.a * edge * (0.26 + 0.74 * pulse);
    return material;
}
