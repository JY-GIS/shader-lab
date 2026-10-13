czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    // vec2 ：通用 GLSL 二分量向量类型。
    // materialInput.st ：Cesium 提供的当前片元纹理坐标。
    vec2 st = materialInput.st;

    /**
     * // st.s ：作为红色 R 通道 ; st.t ：作为绿色 G 通道
     * material.diffuse = vec3(st.s, st.t, 0.0);
     */

    vec3 colorA = vec3(1.0, 0.0, 0.0);
    vec3 colorB = vec3(0.0, 0.0, 1.0);
    // mix(起始值, 结束值, 混合比例（B占多少）)
    vec3 color = mix(colorA, colorB, st.t);
    material.diffuse = color;

    material.alpha = 1.0;

    return material;
}