precision mediump float;

attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform mat4 u_mat;

varying vec2 v_texCoord;

void main() {
	v_texCoord = a_texCoord;
	gl_Position = u_mat * vec4(a_position, 0.0, 1.0);
}
