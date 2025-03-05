#version 300 es

precision mediump float;

in vec2 a_position;
in vec2 a_texCoord;

uniform mat4 u_mat;

out vec2 v_texCoord;

void main(){
	v_texCoord = a_texCoord;
	gl_Position = u_mat * vec4(a_position, 0.0, 1.0);
}
