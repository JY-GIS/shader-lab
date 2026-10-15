// fragmentMain ：(每个像素输入运行一次) Cesium CustomShader 约定的片元阶段入口，由 Cesium 的主 Shader 调用。
// FragmentInput fsInput ：Cesium 传给这个片元的“输入信息包”，默认是只读的。
// inout ：GLSL 的参数限定符，表示“既可读，也可写”。普通参数默认像 in，只读。
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    // fsInput.attributes ：里面放的是从顶点阶段插值到当前片元的数据。
    vec3 positionMC = fsInput.attributes.positionMC;
    float localZ = positionMC.z;

    float heightStart = 0.0;
    float heightEnd = 300.0;

    float heightRatio = clamp(
        (localZ - heightStart) / (heightEnd - heightStart),
        0.0,
        1.0
    );

    float heightMask = smoothstep(0.0, 1.0, heightRatio);

    vec3 bottomColor = vec3(0.0, 0.2, 1.0);
    vec3 topColor = vec3(1.0, 0.1, 0.0);

    vec3 finalColor = mix(bottomColor, topColor, heightMask);
    material.diffuse = finalColor;
}
