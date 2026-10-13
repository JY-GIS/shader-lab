
czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 st = materialInput.st;
    vec3 colorA = vec3(1.0, 0.0, 0.0);
    vec3 colorB = vec3(0.0, 0.0, 1.0);
    // step(edge, x) ：x < edge 返回 0.0 ; x ≥ edge 返回 1.0
    // float mask = step(0.5, st.s);
    // smoothstep(edge0, edge1, x) ：edge0过渡开始的位置 ; edge1过渡结束的位置 ; smoothstep 两端变化慢，中间变化快
    float mask = smoothstep(0.3, 0.7, st.s);
    material.diffuse = mix(colorA, colorB, mask);
    material.alpha = 1.0;

    return material;
}