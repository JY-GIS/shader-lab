void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput)
{
    // 添加 city 前缀，避免与 Cesium 内置的 v_positionMC 等 Varying 重名。
    // 保留 glTF 的 Y-up 局部坐标，立面计算不受地球坐标数值大小影响。
    v_cityPositionMC = vsInput.attributes.positionMC;
    v_cityNormalMC = vsInput.attributes.normalMC;
}
