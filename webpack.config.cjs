const path = require('path');
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

const config = {
	entry: './src/battlecatsinfo/main.ts',
	devtool: 'source-map',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: 'ts-loader',
				exclude: /node_modules/,
				options: {
					configFile: path.resolve(__dirname, 'tsconfig.browser.json')
				}
			},
			{
				test: /\.(glsl|frag|vert|wgsl)$/,
				use: [
					{
						loader: 'raw-loader',
						options: {
							esModule: false,
						},
					},
				]
			}
		],
		/*parser: {
			javascript: {
				importMeta: false,
			},
		},*/
	},
	output: {
		filename: 'anim.min.js',
		path: path.resolve(__dirname, 'dist'),
		chunkLoading: false,
	},
	plugins: [
		new webpack.DefinePlugin({
			"import.meta.url": JSON.stringify("/")
		}),
		new CopyPlugin({
			patterns: [{
				from: "node_modules/mp4-wasm/build/mp4.wasm*",
				to: "[name][ext]"
			}]
		}),
	],
	resolve: {
		fallback: {
			crypto: false,
			fs: false,
			path: false
		},
		extensions: ['.ts'],
	},
	experiments: {
		outputModule: true,
	},
	externalsType: 'module',
	externals: {
		'./common.mjs': './common.mjs',
	},
};

module.exports = (env, argv) => {
	config.mode = argv.mode;

	if (argv.mode === 'production') {
		config.plugins.push(
			new webpack.DefinePlugin({
				"Float32Array.BYTES_PER_ELEMENT": 4,
			})
		);
	}

	return config;
};
