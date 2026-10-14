czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    float x = materialInput.st.t;
    const float PI = 3.1415926;
    // 让 x 从 0.0 ~ 1.0 时完成三个周期
    float frequency = 3.0;
    float wave = cos(2.0 * PI * frequency * x);
    // 将 wave 从 [-1,1] 映射到 [0,1]
    float factor = wave * 0.5 + 0.5;

    vec3 colorA = vec3(1.0, 0.0, 0.0);
    vec3 colorB = vec3(0.0, 0.0, 1.0);
    material.diffuse = mix(colorA, colorB, factor);
    material.alpha = 1.0;

    return material;
}
