// 2 维输入 → 1 个浮点数输出
float hash21(vec2 value)
{
    // dot() ：把二维行列编号混合成一个数
    float mixedValue = sin(dot(value, vec2(127.1, 311.7)));
    return fract(mixedValue * 43758.5453);
}

void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    vec3 positionMC = fsInput.attributes.positionMC;
    vec3 originalColor = material.diffuse;

    // ground_elev ：建筑所在地的椭球地面高程
    float groundElevation = fsInput.metadata.ground_elev;
    // min_height ：墙体相对地面抬高的距离，普通建筑通常为零
    float minimumHeight = fsInput.metadata.min_height;

    float heightAboveBase = max(positionMC.y - groundElevation - minimumHeight, 0.0);

    float verticalRepeat = fract(heightAboveBase / u_floorHeight);

    float lowerEdge = step(0.2, verticalRepeat);
    float upperEdge = 1.0 - step(0.8, verticalRepeat);
    float floorBand = lowerEdge * upperEdge;

    vec3 wallColor = vec3(0.02, 0.04, 0.08);
    vec3 windowOffColor = vec3(0.15, 0.15, 0.2);
    vec3 warmLightColor = vec3(1.0, 0.72, 0.25);
    vec3 whiteLightColor = vec3(0.82, 0.90, 1.0);
    vec3 blueLightColor = vec3(0.30, 0.65, 1.0);

    vec3 normalMC = normalize(v_normalMC);

    float horizontal = abs(normalMC.x) > abs(normalMC.z)
        ? positionMC.z
        : positionMC.x;

    float horizontalRepeat = fract(horizontal / u_windowWidth);

    float columnId = floor(horizontal / u_windowWidth);
    float rowId = floor(heightAboveBase / u_floorHeight);
    vec2 cellId = vec2(columnId, rowId);

    float leftEdge = step(0.2, horizontalRepeat);
    float rightEdge = 1.0 - step(0.8, horizontalRepeat);
    float columnBand = leftEdge * rightEdge;

    float facadeMask = 1.0 - step(0.5, abs(normalMC.y));
    float windowMask = floorBand * columnBand * facadeMask;

    float randomValue = hash21(cellId);
    float colorRandom = hash21(cellId + vec2(17.0, 43.0));

    vec3 lightColor = mix(warmLightColor, whiteLightColor, step(0.7, colorRandom));
    lightColor = mix(lightColor, blueLightColor, step(0.9, colorRandom));

    float animationChoice = hash21(cellId + vec2(73.0, 19.0));
    float animationPhase = hash21(cellId + vec2(31.0, 97.0)) * 6.283185;

    float pulse = 0.5 + 0.5 * sin(u_time * 0.35 + animationPhase);
    float animatedMask = step(0.8, animationChoice);
    float brightnessFactor = mix(1.0, mix(0.65, 1.0, pulse), animatedMask);

    float lightOn = 1.0 - step(u_windowDensity, randomValue);
    float litWindowMask = windowMask * lightOn;

    vec3 windowBaseColor = mix(wallColor, windowOffColor, windowMask);
    vec3 adjustedLightColor = lightColor * u_windowBrightness * brightnessFactor;
    vec3 finalColor = mix(windowBaseColor, adjustedLightColor, litWindowMask);

    material.diffuse = u_nightEnabled ? finalColor : originalColor;
}
