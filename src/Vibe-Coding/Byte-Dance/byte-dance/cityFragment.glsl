float thinGridLine(float coordinate, float spacing, float width)
{
    float cell = fract(coordinate / spacing);
    float edgeDistance = min(cell, 1.0 - cell) * spacing;
    float softness = max(fwidth(coordinate), 0.1);
    return 1.0 - smoothstep(width, width + softness, edgeDistance);
}

void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    vec3 p = v_cityPositionMC;
    vec3 normalMC = normalize(v_cityNormalMC);
    vec3 sourceColor = material.diffuse;
    float height = max(p.y, 0.0);
    float roof = smoothstep(0.65, 0.95, normalMC.y);
    float facade = 1.0 - roof;
    float horizontal = abs(normalMC.x) > abs(normalMC.z) ? p.z : p.x;
    float sideLight = 0.78 + 0.22 * max(dot(normalMC, normalize(vec3(-0.5, 0.4, 0.8))), 0.0);

    // 原始材质仅承担分类，几何和时间驱动真正的建筑颜色。
    bool isTower = sourceColor.r > 0.6 && sourceColor.g < 0.5;
    bool isLandmark = sourceColor.r > 0.6 && sourceColor.g > 0.6;
    vec3 finalColor;

    if (isTower)
    {
        float towerHeight = smoothstep(0.0, 460.0, height);
        finalColor = mix(vec3(1.0, 0.035, 0.005), vec3(1.0, 0.94, 0.015), towerHeight);
        finalColor *= 0.9 + 0.1 * sin(height * 0.045 - u_time * 1.2);
    }
    else if (isLandmark)
    {
        float glassHeight = smoothstep(0.0, 450.0, height);
        vec3 glassColor = mix(vec3(0.045, 0.20, 0.33), vec3(0.74, 0.98, 1.0), glassHeight);
        float windowColumns = thinGridLine(horizontal, 5.5, 0.18);
        float floorLines = thinGridLine(height, 7.0, 0.16);
        float frame = max(windowColumns * 0.64, floorLines * 0.36) * facade;
        finalColor = mix(glassColor * sideLight, vec3(0.77, 0.95, 1.0), frame);
        finalColor = mix(finalColor, vec3(0.72, 0.94, 0.98), roof * 0.8);
    }
    else
    {
        float heightMix = 1.0 - exp(-height / 55.0);
        finalColor = mix(vec3(0.015, 0.13, 0.36), vec3(0.075, 0.95, 1.0), heightMix);
        float floorLines = thinGridLine(height, 18.0, 0.24) * facade;
        float windowColumns = thinGridLine(horizontal, 13.0, 0.15) * facade;
        finalColor = finalColor * sideLight + vec3(0.05, 0.25, 0.3) * (floorLines * 0.2 + windowColumns * 0.08);
        finalColor = mix(finalColor, vec3(0.12, 0.92, 0.98), roof * 0.7);
    }

    // 高度扫描保留一根锐利亮边，后面跟随较淡的光尾与第二道回声。
    float scanHeight = mod(u_time * 39.0, 620.0) - 20.0;
    float heightDelta = scanHeight - height;
    float heightCore = 1.0 - smoothstep(0.8, 3.8, abs(heightDelta));
    float heightTrail = exp(-max(heightDelta, 0.0) / 17.0) * step(0.0, heightDelta);
    float heightEcho = (1.0 - smoothstep(0.6, 2.0, abs(heightDelta - 22.0))) * 0.28;

    // 与地面光环共用城市中轴原点。径向波只照亮正在经过的楼群。
    float groundRadius = length(p.xz);
    float radialFront = mod(u_time * 230.0, 2250.0);
    float radialDelta = radialFront - groundRadius;
    float radialCore = 1.0 - smoothstep(8.0, 24.0, abs(radialDelta));
    float radialTrail = exp(-max(radialDelta, 0.0) / 72.0) * step(0.0, radialDelta);
    float radialFade = (1.0 - smoothstep(1950.0, 2250.0, radialFront)) * smoothstep(0.0, 90.0, radialFront);

    // 一束窄角雷达扫光缓慢转动，利用楼层与列网格带出数据细节。
    float azimuth = atan(-p.z, p.x) / 6.28318530718 + 0.5;
    float angularAge = fract(u_time * 0.055 - azimuth);
    float angularSweep = exp(-angularAge * 34.0);
    float dataRows = thinGridLine(height, 9.0, 0.15);
    float dataColumns = thinGridLine(horizontal, 7.0, 0.15);
    float dataCell = floor(horizontal / 7.0) + floor(height / 9.0) * 3.7;
    float dataBlink = step(0.76, fract(sin(dataCell * 13.17 + floor(u_time * 3.0)) * 43758.5453));
    float dataGlint = max(dataRows * 0.45, dataColumns * dataBlink) * facade;

    float scanCore = max(heightCore + heightEcho, radialCore * radialFade * 0.72);
    float scanTrail = heightTrail * 0.12 + radialTrail * radialFade * 0.16;
    float scanStrength = clamp(scanCore * 0.78 + scanTrail + angularSweep * 0.07, 0.0, 0.88);
    scanStrength *= u_scanEnabled * (isTower ? 0.22 : 1.0);
    vec3 scanColor = mix(vec3(0.12, 0.9, 1.0), vec3(0.72, 1.0, 1.0), scanCore);
    finalColor = mix(finalColor, scanColor, scanStrength);
    finalColor += vec3(0.12, 0.40, 0.42) * dataGlint * angularSweep * u_scanEnabled * (isTower ? 0.0 : 0.38);

    material.diffuse = finalColor * u_glowStrength;
    material.emissive = finalColor * max(u_glowStrength - 1.0, 0.0) * 0.12
        + scanColor * scanStrength * 0.08;
    material.alpha = 1.0;
}
