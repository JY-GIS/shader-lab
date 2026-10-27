czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    float cycle = fract(u_time * u_speed + u_phase);
    float arrivalPhase = 1.08 / u_headRange;
    float age = fract(cycle - arrivalPhase);
    float lifetime = 0.23;
    float progress = age / lifetime;
    float radius = length(materialInput.st - vec2(0.5)) * 2.0;

    // 与飞线光头抵达末端的时刻对齐；只有到达后的短窗口出现冲击波。
    float impactActive = 1.0 - step(lifetime, age);
    float fade = pow(1.0 - clamp(progress, 0.0, 1.0), 1.4);
    float outerRadius = mix(0.06, 0.95, progress);
    float innerRadius = mix(0.02, 0.67, progress);
    float outerRing = 1.0 - smoothstep(0.012, 0.035, abs(radius - outerRadius));
    float innerRing = 1.0 - smoothstep(0.009, 0.026, abs(radius - innerRadius));
    float centerFlash = exp(-radius * radius * 110.0) * exp(-progress * 11.0);
    float energy = max(outerRing, innerRing * 0.55) * fade + centerFlash * 0.7;

    material.diffuse = u_color.rgb * 0.6;
    material.emission = mix(u_color.rgb, vec3(0.83, 0.98, 1.0), centerFlash * 0.5)
        * clamp(u_glowStrength, 0.0, 3.0) * 0.7;
    material.alpha = min(energy * impactActive * u_glowStrength, 0.9) * u_color.a;
    return material;
}
