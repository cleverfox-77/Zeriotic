import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import EventEmitter from '../utils/EventEmitter.js';

/**
 * Resources.js — asset loading on a LoadingManager.
 *
 * The whole scene is procedural except three tiny sculptures (~55 KB total):
 * the chrome Z centerpiece plus the studio's crystal and ribbon forms, which
 * the particle field re-forms into as you scroll. All plain GLBs — no decoder
 * workers needed at this size.
 */
const ASSETS = [
  { key: 'heroZ',   type: 'gltf', url: './models/zeriotic-z.glb' },
  { key: 'crystal', type: 'gltf', url: './models/crystal.glb' },
  { key: 'ribbon',  type: 'gltf', url: './models/ribbon.glb' },
];

export default class Resources extends EventEmitter {
  constructor() {
    super();
    this.items = {};
    this.toLoad = ASSETS.length;
    this.loaded = 0;

    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = () => {
      this.emit('progress', this.loaded / this.toLoad);
    };
    this.gltf = new GLTFLoader(this.manager);
  }

  load() {
    for (const asset of ASSETS) {
      const onLoad = (file) => this._done(asset.key, file);
      const onErr = (e) => { console.error('[Resources] failed', asset.url, e); this._done(asset.key, null); };
      const onProg = (ev) => {
        if (ev.lengthComputable) {
          const frac = (this.loaded + ev.loaded / ev.total) / this.toLoad;
          this.emit('progress', Math.min(frac, 0.999));
        }
      };
      this.gltf.load(asset.url, onLoad, onProg, onErr);
    }
  }

  _done(key, file) {
    this.items[key] = file;
    this.loaded++;
    this.emit('progress', this.loaded / this.toLoad);
    if (this.loaded === this.toLoad) this.emit('ready', this.items);
  }
}
