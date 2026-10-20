uniform sampler2D colorTexture;

uniform float u_time;
uniform float u_outlineSpeed;
uniform float u_outlineBandWidth;
uniform vec4 u_outlineColor;

in vec2 v_textureCoordinates;

void main()
{
    vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
    // 计算一个像素在 UV 坐标系下的步长（偏移量）
    // czm_pixelRatio ：Cesium 内置变量，表示屏幕的像素比
    // czm_viewport.zw ：视口的像素宽度和高度
    vec2 pixelStep = vec2(czm_pixelRatio) / czm_viewport.zw;

    // 分别得到了中心、左、右、下、上五个点的“是否被选中”的状态
    // czm_selected() ： Cesium 内置的 GLSL 函数
    bool center = czm_selected();
    bool left = czm_selected(vec2(-pixelStep.x, 0.0));
    bool right = czm_selected(vec2(pixelStep.x, 0.0));
    bool bottom = czm_selected(vec2(0.0, -pixelStep.y));
    bool top = czm_selected(vec2(0.0, pixelStep.y));

    // 只要上下左右的任何一个邻居，跟中心点的“身份”不一样，就说明中心点踩在了边界线上
    bool isEdge = center != left || center != right || center != bottom || center != top;

    float phase = fract(v_textureCoordinates.y + u_time * u_outlineSpeed);
    float distanceToBand = abs(phase - 0.5);

    float movingBand = 1.0 - smoothstep(
        u_outlineBandWidth,
        u_outlineBandWidth + 0.05,
        distanceToBand
    );

    vec3 baseOutline = u_outlineColor.rgb * 0.4;
    vec3 movingOutline = mix(baseOutline, vec3(1.0), movingBand);
    vec3 finalColor = isEdge ? movingOutline : sceneColor.rgb;

    out_FragColor = vec4(finalColor, sceneColor.a);
}