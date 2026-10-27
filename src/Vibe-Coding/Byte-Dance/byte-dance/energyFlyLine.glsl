czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float cycle = fract(u_time * u_speed + u_phase);
    float headPosition = cycle * u_headRange - 0.08;
    float distanceBehind = headPosition - st.s;
    float tailLength = max(u_tailLength, 0.02);

    // 开放弧线的尾部只出现在光头后方，不能 fract(distanceBehind) 把尾巴绕到另一端。
    float tail = step(0.0, distanceBehind)
        * pow(1.0 - smoothstep(0.0, tailLength, distanceBehind), 1.35);
    float headDistance = distanceBehind / 0.012;
    float glowDistance = distanceBehind / 0.034;
    float head = exp(-headDistance * headDistance);
    float headGlow = exp(-glowDistance * glowDistance);
    float widthPosition = abs(st.t - 0.5) * 2.0;
    float core = exp(-pow(widthPosition / 0.32, 2.0));
    float shoulder = exp(-pow(widthPosition / 0.65, 2.0));
    float softHalo = exp(-widthPosition * widthPosition * 4.0)
        * (1.0 - smoothstep(0.78, 1.0, widthPosition));

    // 细小能量包沿光尾闪动，保留连续的主光芯，避免变成整条实心色带。
    float packets = pow(0.5 + 0.5 * sin(
        (st.s * 43.0 - u_time * u_speed * 9.0 + u_phase) * 6.283185
    ), 9.0);
    float energy = tail * (0.72 + packets * 0.28);
    float strength = clamp(u_glowStrength, 0.0, 3.0);
    vec3 color = mix(u_color.rgb, u_accentColor.rgb, smoothstep(0.05, 0.98, st.s));
    vec3 hotColor = mix(color, vec3(0.91, 0.98, 1.0), head * 0.88);

    // 两层线使用相同时间/相位：宽线只负责柔光，窄线负责清晰的亮头与细芯。
    float haloAlpha = softHalo * (energy * 0.52 + headGlow * 0.42);
    float guide = core * 0.16 + shoulder * 0.018;
    float coreAlpha = guide + energy * (core * 0.86 + shoulder * 0.3)
        + head * (core * 0.75 + shoulder * 0.22);
    float alpha = mix(coreAlpha, haloAlpha, u_halo);

    material.diffuse = hotColor * mix(0.62, 0.36, u_halo);
    material.emission = hotColor * strength * mix(
        0.32 + energy * 0.32 + head * 0.48,
        0.65 + headGlow * 0.2,
        u_halo
    );
    material.alpha = min(alpha * strength, 0.96) * u_color.a;
    return material;
}
