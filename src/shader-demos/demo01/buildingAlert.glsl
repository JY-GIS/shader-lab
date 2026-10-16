void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    float buildingHeight = fsInput.metadata.height;
    bool needsAlert = buildingHeight >= u_heightThreshold;

    float midHeightMix = smoothstep(30.0, 120.0, buildingHeight);
    float highHeightMix = smoothstep(120.0, 300.0, buildingHeight);

    vec3 lowColor = vec3(0.01, 0.03, 0.12);
    vec3 middleColor = vec3(0.0, 0.45, 0.75);
    vec3 highColor = vec3(0.45, 0.05, 0.75);

    vec3 baseColor = mix(lowColor, middleColor, midHeightMix);
    baseColor = mix(baseColor, highColor, highHeightMix);

    float pulseWave = sin(u_time * u_pulseSpeed + buildingHeight * 0.06);
    float pulse = smoothstep(0.15, 1.0, 0.5 + 0.5 * pulseWave);

    vec3 alertColor = mix(vec3(0.75, 0.02, 0.01), vec3(1.0, 0.55, 0.02), pulse);

    vec3 buildingColor = needsAlert ? alertColor : baseColor;

    // 扫描波
    float localUp = fsInput.attributes.positionMC.y;
    float localScanWave = 0.5 + 0.5 * sin(localUp * 0.18 - u_time * u_pulseSpeed * 2.0);
    float localScanBand = smoothstep(0.92, 1.0, localScanWave);
    float localScanStrength = needsAlert ? localScanBand : 0.0;

    vec3 localScanColor = vec3(1.0, 0.95, 0.45);
    buildingColor = mix(buildingColor, localScanColor, localScanStrength);

    // 扩散波
    bool receivesWorldScan = buildingHeight >= u_scanHeightThreshold;
    float distanceToCenter = distance(fsInput.attributes.positionWC, u_scanCenterWC);
    float scanRadius = mod(u_time * 260.0, 2600.0);
    float distanceToWave = abs(distanceToCenter - scanRadius);
    float worldScanBand = 1.0 - smoothstep(0.0, 90.0, distanceToWave);
    float worldScanStrength = receivesWorldScan ? worldScanBand : 0.0;

    vec3 worldScanColor = vec3(0.35, 1.0, 0.95);
    vec3 finalColor = mix(buildingColor, worldScanColor, worldScanStrength);

    material.diffuse = finalColor;
}
