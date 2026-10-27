czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float height = st.t;
    float phase = fract(u_time * u_speed + u_phase);
    float secondPhase = fract(phase + 0.5);

    // 两道上升光带共享柱体高度坐标；柔和尾光让它像信号脉冲而非实体柱。
    float firstDelta = phase - height;
    float secondDelta = secondPhase - height;
    float firstHead = exp(-firstDelta * firstDelta * 1300.0);
    float secondHead = exp(-secondDelta * secondDelta * 1300.0);
    float firstTail = exp(-max(firstDelta, 0.0) * 23.0) * step(0.0, firstDelta);
    float secondTail = exp(-max(secondDelta, 0.0) * 23.0) * step(0.0, secondDelta);
    float pulse = max(firstHead + firstTail * 0.35, secondHead + secondTail * 0.35);

    // 柱体只有稀疏纵向细丝，避免半透明多面几何叠加后挡住后面的建筑。
    float filament = pow(0.5 + 0.5 * cos(st.s * 6.28318530718 * 8.0), 18.0);
    float flicker = 0.8 + 0.2 * sin(u_time * 3.0 + height * 35.0 + u_phase * 6.28318530718);
    float endFade = smoothstep(0.015, 0.08, height) * (1.0 - smoothstep(0.82, 1.0, height));
    float strength = clamp(u_glowStrength, 0.2, 2.0);
    float energy = (0.018 + filament * 0.055 + pulse * 0.28) * endFade * flicker;

    vec3 color = mix(u_color.rgb, vec3(0.8, 0.98, 1.0), pulse * 0.3);
    material.diffuse = color * 0.55;
    material.emission = color * (0.35 + pulse * 0.55) * strength;
    material.alpha = min(energy * strength, 0.42) * u_color.a;
    return material;
}
