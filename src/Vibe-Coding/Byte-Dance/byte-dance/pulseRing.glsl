float twinRingStroke(float radius, float target, float width, float feather)
{
    return 1.0 - smoothstep(width, width + feather, abs(radius - target));
}

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 centered = (materialInput.st - vec2(0.5)) * 2.0;
    float radius = length(centered);
    float turn = atan(centered.y, centered.x) / 6.28318530718 + 0.5;
    float feather = max(fwidth(radius) * 1.2, 0.0015);
    float phase = fract(u_time * u_speed + u_phase);
    float secondPhase = fract(phase + 0.48);

    // 锐利波头与低透明度拖影独立计算，避免叠成厚重实心圆。
    float front = 0.15 + phase * 0.86;
    float secondFront = 0.15 + secondPhase * 0.86;
    float firstFade = smoothstep(0.0, 0.08, phase) * (1.0 - smoothstep(0.72, 1.0, phase));
    float secondFade = smoothstep(0.0, 0.08, secondPhase) * (1.0 - smoothstep(0.72, 1.0, secondPhase));
    float firstCore = twinRingStroke(radius, front, 0.003, feather) * firstFade;
    float dash = smoothstep(0.08, 0.18, fract(turn * 32.0 + u_time * 0.07 + u_phase));
    float secondCore = twinRingStroke(radius, secondFront, 0.002, feather) * secondFade * dash;
    float firstTrail = exp(-max(front - radius, 0.0) / 0.028) * step(radius, front) * firstFade;
    float secondTrail = exp(-max(secondFront - radius, 0.0) / 0.018) * step(radius, secondFront) * secondFade;

    // 固定细刻度向相反方向缓转，让站点小圈与城市大圈都具有仪表感。
    float tickAngle = fract(turn * 60.0 - u_time * 0.11 + u_phase);
    float tickMask = 1.0 - smoothstep(0.07, 0.15, abs(tickAngle - 0.5));
    float tickLength = mix(0.014, 0.035, step(0.82, fract(turn * 10.0 - u_time * 0.018333333 + u_phase / 6.0)));
    float ticks = tickMask * (1.0 - smoothstep(tickLength, tickLength + feather, abs(radius - 0.89)));
    float rimDash = smoothstep(0.07, 0.14, fract(turn * 12.0 + u_time * 0.035 + u_phase));
    float outerRim = twinRingStroke(radius, 0.93, 0.0015, feather) * rimDash;
    float innerDash = step(0.28, fract(turn * 24.0 - u_time * 0.08));
    float innerRim = twinRingStroke(radius, 0.53, 0.001, feather) * innerDash;

    // 扫扇保持很淡，只给透明圆盘一层运动方向；中心和外边界完全淡出。
    float sweepAge = fract(u_time * 0.055 + u_phase - turn);
    float sweep = exp(-sweepAge * 34.0);
    float annulus = smoothstep(0.16, 0.35, radius) * (1.0 - smoothstep(0.86, 0.98, radius));
    float sweepRay = exp(-sweepAge * 360.0) * annulus;
    float cores = max(firstCore, secondCore * 0.75);
    float ornaments = ticks * 0.26 + outerRim * 0.25 + innerRim * 0.13;
    float alpha = cores * 0.72 + (firstTrail + secondTrail * 0.65) * 0.09
        + ornaments + sweep * annulus * 0.021 + sweepRay * 0.10;
    alpha *= smoothstep(0.11, 0.19, radius) * (1.0 - smoothstep(0.965, 1.0, radius));

    float strength = clamp(u_glowStrength, 0.2, 2.0);
    vec3 energyColor = mix(u_color.rgb, vec3(0.82, 1.0, 1.0), cores * 0.25);
    material.diffuse = energyColor * (0.8 + strength * 0.2);
    material.emission = energyColor * (cores * 0.22 + sweepRay * 0.08) * strength;
    material.alpha = u_color.a * min(alpha * (0.72 + strength * 0.28), 0.9);
    return material;
}
