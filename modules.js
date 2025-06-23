// modules.js
// 各モジュールクラス定義

class AudioModule {
    constructor(type, x, y, namePrefix = '', isCorrectAnswerModule = false) {
        this.id = nextModuleId++;
        this.type = type;
        this.name = `${namePrefix}${type.charAt(0).toUpperCase() + type.slice(1)} #${this.id}`;
        this.audioNode = null;
        this.connections = [];
        this.isCorrectAnswerModule = isCorrectAnswerModule;

        this.domElement = document.createElement('div');
        this.domElement.className = 'module';
        if (this.isCorrectAnswerModule) {
            this.domElement.classList.add('correct-answer-module');
        }
        this.domElement.id = `module-${this.id}`;
        this.domElement.style.left = `${x}px`;
        this.domElement.style.top = `${y}px`;
        const title = document.createElement('div');
        title.className = 'module-title';
        title.textContent = this.name;
        this.domElement.appendChild(title);
        this.paramContainer = document.createElement('div');
        this.domElement.appendChild(this.paramContainer);

        if (!this.isCorrectAnswerModule) {
            this.domElement.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('io-node')) return;
                draggingModule = this;
                const rect = this.domElement.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                this.domElement.style.cursor = 'grabbing';
                this.domElement.style.zIndex = 1000;
            });
            this.domElement.addEventListener('click', (e) => {
                if (e.target.classList.contains('io-node')) return;
                selectModule(this);
            });
        }
        this.createInputNodeDOM();
        this.createOutputNodeDOM();
        // workspace.appendChild(this.domElement); // ←削除
        // modules.push(this); // ←削除
    }
    initAudioNode() {}
    getEditorHTML() { return ''; }
    updateParams() {}
    createInputNodeDOM() {
        if (this.type === 'oscillator') return; // Oscillator has no input

        const inputNodeDOM = document.createElement('div');
        inputNodeDOM.className = 'io-node input-node';
        inputNodeDOM.dataset.moduleId = this.id;
        inputNodeDOM.dataset.nodeType = 'input';
        this.domElement.appendChild(inputNodeDOM);
        inputNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        inputNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo) {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule);
                }
                stopDrawingLine();
            }
        });
    }
    createOutputNodeDOM() {
        if (this.type === 'output') return; // Output has no output node

        const outputNodeDOM = document.createElement('div');
        outputNodeDOM.className = 'io-node output-node';
        outputNodeDOM.dataset.moduleId = this.id;
        outputNodeDOM.dataset.nodeType = 'output';
        this.domElement.appendChild(outputNodeDOM);
        outputNodeDOM.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            startDrawingLine(e, this.id, e.target);
        });
    }
    connectTo(targetModule) {
        if (!audioContext || !this.audioNode) return false;
        if (targetModule.type === 'output') {
            if (audioContext.destination) {
                try {
                    this.audioNode.connect(audioContext.destination);
                    return true;
                } catch (e) { return false; }
            } else { return false; }
        } else if (targetModule.audioNode instanceof AudioNode) {
            try {
                this.audioNode.connect(targetModule.audioNode);
                return true;
            } catch (e) { return false; }
        } else {
            return false;
        }
    }
    disconnectFrom(targetModule) {
        if (!this.audioNode) return;
        try {
            if (this.audioNode.disconnect && typeof this.audioNode.disconnect === 'function') {
                if (targetModule.type === 'output' && audioContext && audioContext.destination) {
                    this.audioNode.disconnect(audioContext.destination);
                } else if (targetModule.audioNode instanceof AudioNode) {
                    this.audioNode.disconnect(targetModule.audioNode);
                }
            }
        } catch (error) {}
    }
    destroy() {
        this.connections.forEach(connInfo => {
            const target = modules.find(m => m.id === connInfo.targetId);
            if (target) this.disconnectFrom(target);
        });
        connections.filter(c => c.targetId === this.id).forEach(connToThis => {
            const source = modules.find(m => m.id === connToThis.sourceId);
            if (source) source.disconnectFrom(this);
        });
        connections = connections.filter(c => c.sourceId !== this.id && c.targetId !== this.id);
        if (this.audioNode) {
            if (this.type === 'oscillator' && this.audioNode.stop) {
                try { if(this.isPlaying) this.audioNode.stop(); } catch (e) {}
            }
            try { this.audioNode.disconnect(); } catch (e) {}
        }
        if (this.domElement.parentElement) {
            this.domElement.parentElement.removeChild(this.domElement);
        }
        modules = modules.filter(m => m.id !== this.id);
        if (selectedModule === this) {
            selectedModule = null;
            clearParamEditor();
        }
        updateConnectionsSVG();
    }
}

class OscillatorModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('oscillator', x, y, 'Osc ', isCorrectAnswerModule);
        this.params = { type: 'sine', frequency: 440, detune: 0 };
        this.isPlaying = false;
        this.initAudioNode();
        this.updateParams();
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) {
            try { if(this.isPlaying) this.audioNode.stop(); } catch(e) {}
            try { this.audioNode.disconnect(); } catch(e) {}
        }
        this.audioNode = audioContext.createOscillator();
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.detune.setValueAtTime(this.params.detune, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Type: ${this.params.type}</label></div>
                <div class="mb-2"><label class="param-label">Frequency: ${this.params.frequency} Hz</label></div>
                <div class="mb-2"><label class="param-label">Detune: ${this.params.detune} Cents</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Type:
                    <select id="osc-type-${this.id}" class="custom-select">
                        <option value="sine">sine</option>
                        <option value="square">square</option>
                        <option value="sawtooth">sawtooth</option>
                        <option value="triangle">triangle</option>
                    </select>
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Frequency: <span id="freq-val-${this.id}">${this.params.frequency}</span> Hz
                    <input type="range" id="osc-freq-${this.id}" class="param-slider" min="20" max="2000" step="1" value="${this.params.frequency}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Detune: <span id="detune-val-${this.id}">${this.params.detune}</span> Cents
                    <input type="range" id="osc-detune-${this.id}" class="param-slider" min="-100" max="100" step="1" value="${this.params.detune}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !audioContext) return;
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.value = this.params.frequency;
        this.audioNode.detune.value = this.params.detune;
    }
}

class GainModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('gain', x, y, 'Gain ', isCorrectAnswerModule);
        this.params = { gain: 0.5 };
        this.initAudioNode();
        this.updateParams();
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        this.audioNode = audioContext.createGain();
        this.audioNode.gain.setValueAtTime(this.params.gain, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `<div class="mb-2"><label class="param-label">Gain: ${this.params.gain.toFixed(2)}</label></div>`;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Gain: <span id="gain-val-${this.id}">${this.params.gain.toFixed(2)}</span>
                    <input type="range" id="gain-amount-${this.id}" class="param-slider" min="0" max="1" step="0.01" value="${this.params.gain}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !audioContext) return;
        this.audioNode.gain.value = this.params.gain;
    }
}

class FilterModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('filter', x, y, 'Filter ', isCorrectAnswerModule);
        this.params = { type: 'lowpass', frequency: 350, q: 1 };
        this.initAudioNode();
        this.updateParams();
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        this.audioNode = audioContext.createBiquadFilter();
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.Q.setValueAtTime(this.params.q, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Type: ${this.params.type}</label></div>
                <div class="mb-2"><label class="param-label">Frequency: ${this.params.frequency} Hz</label></div>
                <div class="mb-2"><label class="param-label">Q: ${this.params.q.toFixed(2)}</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Type:
                    <select id="filter-type-${this.id}" class="custom-select">
                        <option value="lowpass">lowpass</option>
                        <option value="highpass">highpass</option>
                        <option value="bandpass">bandpass</option>
                        <option value="notch">notch</option>
                        <option value="peaking">peaking</option>
                    </select>
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Frequency: <span id="filter-freq-val-${this.id}">${this.params.frequency}</span> Hz
                    <input type="range" id="filter-freq-${this.id}" class="param-slider" min="20" max="10000" step="1" value="${this.params.frequency}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Q: <span id="filter-q-val-${this.id}">${this.params.q.toFixed(2)}</span>
                    <input type="range" id="filter-q-${this.id}" class="param-slider" min="0.0001" max="20" step="0.01" value="${this.params.q}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !audioContext) return;
        this.audioNode.type = this.params.type;
        this.audioNode.frequency.value = this.params.frequency;
        this.audioNode.Q.value = this.params.q;
    }
}

class DelayModule extends AudioModule {
    constructor(x,y, isCorrectAnswerModule = false) {
        super('delay', x, y, 'Delay ', isCorrectAnswerModule);
        this.params = { delayTime: 0.3, feedback: 0.4 };
        this.feedbackNode = null;
        this.initAudioNode();
        this.updateParams();
    }
    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) {
            try { this.audioNode.disconnect(); } catch(e) {}
            if(this.feedbackNode) { try { this.feedbackNode.disconnect(); } catch(e) {} }
        }
        this.audioNode = audioContext.createDelay(5.0);
        this.feedbackNode = audioContext.createGain();
        this.audioNode.connect(this.feedbackNode);
        this.feedbackNode.connect(this.audioNode);
        this.audioNode.delayTime.setValueAtTime(this.params.delayTime, audioContext.currentTime);
        this.feedbackNode.gain.setValueAtTime(this.params.feedback, audioContext.currentTime);
    }
    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Delay Time: ${this.params.delayTime.toFixed(2)} s</label></div>
                <div class="mb-2"><label class="param-label">Feedback: ${this.params.feedback.toFixed(2)}</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Delay Time: <span id="delay-time-val-${this.id}">${this.params.delayTime.toFixed(2)}</span> s
                    <input type="range" id="delay-time-${this.id}" class="param-slider" min="0" max="2" step="0.01" value="${this.params.delayTime}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Feedback: <span id="delay-feedback-val-${this.id}">${this.params.feedback.toFixed(2)}</span>
                    <input type="range" id="delay-feedback-${this.id}" class="param-slider" min="0" max="1" step="0.01" value="${this.params.feedback}">
                </label>
            </div>
        `;
    }
    updateParams() {
        if (!this.audioNode || !this.feedbackNode || !audioContext) return;
        this.audioNode.delayTime.value = this.params.delayTime;
        this.feedbackNode.gain.value = this.params.feedback;
    }
    connectTo(targetModule) {
        if (!this.audioNode) return false;
        return super.connectTo(targetModule);
    }
    connectInput(sourceModuleAudioNode) {
        if (!this.audioNode || !sourceModuleAudioNode) return false;
        try {
            sourceModuleAudioNode.connect(this.audioNode);
            return true;
        } catch (error) { return false; }
    }
    disconnectInput(sourceModuleAudioNode) {
        if (!this.audioNode || !this.feedbackNode || !sourceModuleAudioNode) return;
        try { sourceModuleAudioNode.disconnect(this.audioNode); } catch(e) {}
    }
}

class OutputModule extends AudioModule {
    constructor(x,y, isCorrectAnswerModule = false) {
        super('output', x, y, 'Output ', isCorrectAnswerModule);
        this.initAudioNode();
    }
    initAudioNode() {
        if (!audioContext) return; // audioContextがなければ何もしない
        this.audioNode = audioContext.destination;
    }
    createInputNodeDOM() {
        const inputNodeDOM = document.createElement('div');
        inputNodeDOM.className = 'io-node input-node';
        inputNodeDOM.dataset.moduleId = this.id;
        inputNodeDOM.dataset.nodeType = 'input';
        this.domElement.appendChild(inputNodeDOM);
        inputNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        inputNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo) {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule);
                }
                stopDrawingLine();
            }
        });
    }
    createOutputNodeDOM() {
        // Output module has no output
        return;
    }
    getEditorHTML() {
        return `<p class="text-xs text-gray-500">マスター出力。他のモジュールの出力をここに接続してください。</p>`;
    }
}
