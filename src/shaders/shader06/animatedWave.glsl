// uniform ：该变量由 Shader 外部提供
uniform float u_time;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    float time = u_time;

    float x = materialInput.st.s;
    const float PI = 3.1415926;
    float frequency = 10.0;
    float spatialPhase = 2.0 * PI * frequency * x;
    // speed ：时间相位每秒变化多少弧度
    float speed = 10.0;
    // speed * time ：从开始运行到当前累计移动的相位
    // spatialPhase - speed * time ：同一个片元的位置不变，但总相位会随时间持续变化
    float phase = spatialPhase - speed * time;
    float wave = cos(phase);
    float factor = wave * 0.5 + 0.5;

    vec3 colorA = vec3(1.0, 0.0, 0.0);
    vec3 colorB = vec3(0.0, 0.0, 1.0);
    material.diffuse = mix(colorA, colorB, factor);
    material.alpha = 1.0;

    return material;
}
