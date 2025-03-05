precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D sampler;
uniform int u_mode;
uniform float u_para, u_height;
uniform vec3 u_c1, u_c2;

void main() {
	if (u_mode == 0) {
		float frac = gl_FragCoord.y / u_height;
		if (frac > 0.5)
			frac = 1.0 - frac;
		gl_FragColor = vec4(u_c1 + (u_c2 * frac), 1.0);
	} else {
		vec4 c = texture2D(sampler, v_texCoord);
		if (u_mode == 1) {
			c.rgba *= u_para;
		} else if (u_mode == 2) {
			c.a *= u_para;
			c.rgb = 1.0 - c.a + c.rgb * c.a;
		}
		gl_FragColor = c;
	}
}
