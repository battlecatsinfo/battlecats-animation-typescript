## Battle Cats Animation

Battle Cats animation in TypeScript.

Supports WebGL, WebGPU, and 2D Canvas API.

<div align="center">
  <figure class="image">
    <img src="https://github.com/user-attachments/assets/b17915e6-b6b8-4e67-abf7-51a40c578871" alt="Screenshot">
    <figcaption>Rendering with WebGPU on Firefox Nightly</figcaption>
  </figure>
</div>

## Install

```sh
$ npm install
```

## Run in browser

Run the following command to build.

```sh
$ npm run build    # for testing, no optimization.
$ npm run deploy   # enables optimization.
```

## Run in Node.js

```sh
$ npm run node
```

## Notes

WebCodecs and WebGPU API are only available in secure contexts, so remember to run in localhost or https.

WebGPU API are not fully supported in all browser and platforms right now. You may need to use [Firefox Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/).
