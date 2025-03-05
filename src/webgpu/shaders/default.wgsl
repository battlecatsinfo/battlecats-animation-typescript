@group(0) @binding(0)
var<uniform> u_mat: mat4x4<f32>;

@group(0) @binding(1)
var samp: sampler;

struct Uniforms {
	c1: vec3f,
	mode: u32,
	c2: vec3f,
	opacity: f32,
};

@group(0) @binding(2)
var<uniform> u_uniforms: Uniforms;

@group(0) @binding(3)
var<uniform> u_height: f32;

@group(1) @binding(0)
var texture: texture_2d<f32>;

struct VertexOutput {
	@builtin(position) position: vec4f,
	@location(0) texCoord: vec2f,
};

@vertex
fn vs(
	@location(0) position: vec2f,
	@location(1) texCoord: vec2f
) -> VertexOutput {
	var output: VertexOutput;
	output.position = u_mat * vec4f(position, 0.0, 1.0);
	output.texCoord = texCoord;
	return output;
}

@fragment
fn fs(
	@builtin(position) fragCoord: vec4f,
	@location(0) texCoord: vec2f
) -> @location(0) vec4f {
	if (u_uniforms.mode == 0) {
		var frac: f32 = fragCoord.y / u_height;
		if (frac > 0.5) {
			frac = 1.0 - frac;
		}
		return vec4f(u_uniforms.c1 + (u_uniforms.c2 * frac), 1.0);
	} else {
		var c: vec4f = textureSample(texture, samp, texCoord);
		if (u_uniforms.mode == 1) {
			c *= u_uniforms.opacity;
		} else if (u_uniforms.mode == 2) {
			c.a *= u_uniforms.opacity;
			c = vec4f(vec3f(1.0 - c.a) + c.rgb * c.a, c.a);
		}
		return c;
	}
}
