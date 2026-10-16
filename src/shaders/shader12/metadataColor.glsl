// Shader 12B：使用 GPU Structural Metadata 进行片元分类着色
// FragmentInput fsInput：当前片元的只读输入，包含 attributes、featureIds 和 metadata 等数据
// czm_modelMaterial material：Cesium 已生成的模型材质；inout 表示可以在此基础上修改并交回管线
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    // Feature ID Texture 决定 Property Table 的行，Cesium 再将该行的 yearBuilt 暴露到 metadata
    // Schema 中 yearBuilt 是 SCALAR / INT16，因此这里使用 GLSL int
    int yearBuilt = fsInput.metadata.yearBuilt;

    // 以 1990 年为界进行两档分类；UNLIT 模式使颜色不受场景光照影响
    vec3 olderColor = vec3(0.1, 0.35, 1.0);
    vec3 newerColor = vec3(1.0, 0.2, 0.1);
    bool isNewer = yearBuilt >= 1990;
    material.diffuse = isNewer ? newerColor : olderColor;
}
