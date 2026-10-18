// Exercise the actual browser controller with deterministic media adapters.
// The VM hook exposes private functions only inside this test process.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(savedState) {
    const nodes = new Map();
    class Element {
        constructor() {
            this.listeners = {}; this.style = {}; this.dataset = {}; this.children = [];
            this.src = ''; this.currentTime = 0; this.duration = 30; this.paused = true;
            this.classes = new Set();
            this.classList = {
                add: (...names) => names.forEach(n => this.classes.add(n)),
                remove: (...names) => names.forEach(n => this.classes.delete(n)),
                contains: name => this.classes.has(name),
                toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
            };
        }
        addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
        emit(name, payload = {}) { for (const fn of this.listeners[name] || []) fn(payload); }
        appendChild(child) { this.children.push(child); }
        querySelectorAll() { return []; }
        setAttribute(name, value) { this[name] = value; }
        remove() {}
        focus() {}
        pause() { this.paused = true; this.emit('pause'); }
        play() { this.paused = false; this.emit('play'); return Promise.resolve(); }
    }
    const document = {
        readyState: 'complete',
        getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
        createElement() { return new Element(); },
        querySelectorAll() { return []; },
        addEventListener() {},
    };
    const context = vm.createContext({
        document, console, URL, AbortController,
        localStorage: {getItem: () => savedState ? JSON.stringify(savedState) : null, setItem() {}},
        setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
        YT: {PlayerState: {PLAYING: 1, PAUSED: 2, ENDED: 0}},
        window: {location: {origin: 'http://localhost'}, addEventListener() {}, scrollTo() {}},
    });
    const source = fs.readFileSync(path.join(__dirname, '../static/js/music.js'), 'utf8');
    const hook = `globalThis.controller = {
        state, el, cacheElements, initLocalAudio, loadSavedState, playTrack, resumePlayback,
        onYTPlayerReady, onYTPlayerStateChange, hideVideoDock, setupSearch,
        setYT(player, ready) { ytPlayer = player; isYtReady = ready; }
    };`;
    vm.runInContext(source.replace(/\}\)\(\);\s*$/, hook + '\n})();'), context);
    const controller = context.controller;
    controller.cacheElements(); controller.initLocalAudio();
    return {controller, audio: document.getElementById('localAudioPlayer')};
}

const local = {id: 'local_1', source: 'local', title: 'Local song', filename: 'song.mp3', url: '/api/music/file/song.mp3'};
const youtube = {id: 'jNQXAC9IVRw', source: 'youtube', title: 'YouTube song', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'};
function youtubeAdapter() {
    return {loaded: [], paused: false, setVolume() {},
        loadVideoById(id) { this.loaded.push(id); }, pauseVideo() { this.paused = true; }, playVideo() {}};
}

test('restored local queue loads its media before resuming', () => {
    const {controller: c, audio} = harness({queue: [local], currentQueueIndex: 0});
    c.loadSavedState(); c.resumePlayback();
    assert.equal(audio.src, local.url);
    assert.equal(audio.paused, false);
});

test('first YouTube selection waits for API readiness and starts only the latest selection', () => {
    const {controller: c} = harness();
    const player = youtubeAdapter();
    c.playTrack(youtube);
    c.playTrack({...youtube, id: 'M7lc1UVf-VE'});
    c.setYT(player, false); c.onYTPlayerReady();
    assert.deepEqual(player.loaded, ['M7lc1UVf-VE']);
});

test('switching to local cancels pending YouTube playback and ignores late YouTube events', () => {
    const {controller: c, audio} = harness();
    const player = youtubeAdapter();
    c.playTrack(youtube); c.playTrack(local);
    c.setYT(player, false); c.onYTPlayerReady();
    c.onYTPlayerStateChange({data: 2});
    assert.equal(player.loaded.length, 0);
    assert.equal(c.state.isPlaying, true);
    assert.equal(audio.paused, false);
    assert.equal(c.el.videoDock.classList.contains('is-hidden'), true);
});

test('late local pause does not overwrite active YouTube playback', () => {
    const {controller: c, audio} = harness();
    c.setYT(youtubeAdapter(), true); c.playTrack(youtube);
    c.onYTPlayerStateChange({data: 1}); audio.emit('pause');
    assert.equal(c.state.isPlaying, true);
});

test('closing YouTube dock pauses playback and resume reveals it', () => {
    const {controller: c} = harness();
    const player = youtubeAdapter();
    c.setYT(player, true); c.playTrack(youtube); c.onYTPlayerStateChange({data: 1});
    c.hideVideoDock();
    assert.equal(player.paused, true);
    assert.equal(c.state.isPlaying, false);
    c.resumePlayback();
    assert.equal(c.el.videoDock.classList.contains('is-hidden'), false);
});

test('malformed persisted tracks and non-finite settings cannot break the player', () => {
    const {controller: c} = harness({queue: [null, {}, {...local, url: 'https://evil.example/file'}],
        currentQueueIndex: 0, volume: 'bad'});
    c.loadSavedState();
    assert.equal(c.state.queue.length, 1);
    assert.equal(c.state.queue[0].url, '/api/music/file/song.mp3');
    assert.equal(c.state.currentQueueIndex, -1);
    assert.equal(c.state.volume, 0.8);
});
