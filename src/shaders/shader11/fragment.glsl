
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    float heightMask = smoothstep(0.0, 300.0, v_localHeight);

    vec3 bottomColor = vec3(0.05, 0.2, 0.8);
    vec3 topColor = vec3(1.0, 0.8, 0.1);

    material.diffuse = mix(bottomColor, topColor, heightMask);
}