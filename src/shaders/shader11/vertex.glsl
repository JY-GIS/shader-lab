// vertexMain() ：Cesium Model 渲染管线提供的顶点扩展入口
// VertexInput vsInput ：当前顶点的只读输入
// czm_modelVertexOutput vsOutput ：Cesium 提供的可修改顶点输出
void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput)
{
    vec3 positionMC = vsInput.attributes.positionMC;
    v_localHeight = positionMC.z;

    vsOutput.positionMC = positionMC;

    vsOutput.positionMC.z += 2.0;
}