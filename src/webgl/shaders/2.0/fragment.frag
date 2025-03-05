#version 300 es

precision mediump float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D sampler;
uniform int u_mode;
uniform float u_para, u_height;
uniform vec3 u_c1, u_c2;

void main() {
	if (u_mode == 0) {
		float frac = gl_FragCoord.y / u_height;
		if (frac > 0.5)
			frac = 1.0 - frac;
		outColor = vec4(u_c1 + (u_c2 * frac), 1.0);
	} else {
		vec4 c = texture(sampler, v_texCoord);
		if (u_mode == 1) {
			c.rgba *= u_para;
		} else if (u_mode == 2) {
			c.a *= u_para;
			c.rgb = 1.0 - c.a + c.rgb * c.a;
		}

		outColor = c;
	}
}
