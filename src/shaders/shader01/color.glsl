// czm_material ：函数返回值类型。它是 Cesium 定义的材质结构，不是通用 GLSL 内置类型。
// czm_getMaterial ：Cesium Fabric 规定的材质入口函数名。Cesium 会调用它获取材质结果。
// czm_materialInput ：Cesium 定义的输入类型
// materialInput ：参数变量名
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    // czm_getDefaultMaterial(materialInput) ：创建一份带有默认初始值的 Cesium 材质。这样后续只需要修改关心的属性。
    czm_material material = czm_getDefaultMaterial(materialInput);

    /**
     * // diffuse ：Cesium 的 czm_material 提供的属性，表示材质表面的 RGB 基础颜色。
     * // vec3 ：GLSL 的三分量向量类型，是通用 GLSL 类型。它可以保存三个浮点数，三个分量 RGB 依次表示红、绿、蓝。
     * material.diffuse = vec3(0.0, 1.0, 1.0);   // ( 0.0 ~ 1.0 )
     * material.alpha = 0.1;
     * // 替换成以下内容 ：
     */
    vec4 color = vec4(0.0, 1.0, 1.0, 0.6);
    material.diffuse = color.rgb;
    material.alpha = color.a;

    return material;
}