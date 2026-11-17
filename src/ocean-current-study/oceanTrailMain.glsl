// 画布的 CSS 像素宽高，以及当前视角的线宽、线长缩放比例。
uniform vec2 oceanTrailViewport;
uniform vec2 oceanTrailScale;

void main() {
    // 每个粒子对应一个纹理位置；读取当前位置、移动向量和重生标记。
    vec2 particleIndex = vec2(st.x, 1.0 - st.y);
    vec4 current = texture(currentParticlesPosition, particleIndex);
    float respawned = current.a
        + texture(previousParticlesPosition, particleIndex).a
        + texture(postProcessingPosition, particleIndex).a;
    speed = texture(particlesSpeed, particleIndex);
    textureCoordinate = st;

    // 每条尾迹由四个顶点组成，normal 中保存头尾和左右两侧的标记。
    // 默认放到裁剪范围外；下面遇到无法绘制的情况时直接 return。
    bool isHead = normal.x < 0.0;
    v_segmentPosition = isHead ? 1.0 : 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

    // 重生时位置会跳变，跳过这段；零向量也无法提供有效的朝向。
    vec2 velocity = speed.rg;
    float velocitySquared = dot(velocity, velocity);
    if (respawned > 0.0 || !(velocitySquared > 0.0)) {
        return;
    }

    // 沿移动向量取一个方向参考点，再将当前位置和参考点投影。
    // 0.002 是经纬度坐标中的参考步长，用于减少极短位移导致的方向抖动。
    vec4 head = calculateProjectedCoordinate(current.xy);
    vec2 probePosition = current.xy + velocity * (0.002 * inversesqrt(velocitySquared));
    vec4 probe = calculateProjectedCoordinate(probePosition);
    if (!(head.w > 0.0 && probe.w > 0.0)) {
        return;
    }

    // 透视除法得到屏幕坐标；如果两点投影后过于接近，就跳过这条尾迹。
    vec2 screenDelta = (probe.xy / probe.w - head.xy / head.w) * oceanTrailViewport;
    float screenDeltaSquared = dot(screenDelta, screenDelta);
    if (!(screenDeltaSquared > 0.000001)) {
        return;
    }

    // direction 是屏幕上的流向，perpendicular 是与流向垂直的方向。
    vec2 direction = screenDelta * inversesqrt(screenDeltaSquared);
    vec2 perpendicular = vec2(-direction.y, direction.x);
    // 将流速映射到 0～1，并在最小、最大线长和线宽之间插值。
    // 最后乘以相机高度对应的缩放比例，得到以像素为单位的尺寸。
    float flow = clamp((speed.b - domain.x) / max(domain.y - domain.x, 0.000001), 0.0, 1.0);
    float lengthPx = mix(lineLength.x, lineLength.y, flow) * oceanTrailScale.y;
    float widthPx = mix(lineWidth.x, lineWidth.y, flow) * oceanTrailScale.x;

    // 顶点向流向两侧偏移形成宽度；尾部较窄，并沿流向反方向延伸。
    vec2 offsetPx = perpendicular * normal.y * widthPx * (isHead ? 0.5 : 0.25);
    if (!isHead) {
        offsetPx -= direction * lengthPx;
    }

    // 把像素偏移换算到裁剪坐标，使线条以指定的屏幕尺寸显示。
    gl_Position = head;
    gl_Position.xy += (2.0 * offsetPx / oceanTrailViewport) * head.w;
}
