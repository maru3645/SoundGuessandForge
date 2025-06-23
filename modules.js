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
        }
        this.domElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('io-node')) return;
            selectModule(this);
        });
        this.createInputNodeDOM();
        this.createOutputNodeDOM();
    }
    initAudioNode() {}
    getEditorHTML() { return ''; }
    updateParams() {}
    createInputNodeDOM() {
        if (this.type === 'oscillator' || this.type === 'lfo') return; // Oscillator/LFO has no audio input

        const inputNodeDOM = document.createElement('div');
        inputNodeDOM.className = 'io-node input-node';
        inputNodeDOM.dataset.moduleId = this.id;
        inputNodeDOM.dataset.nodeType = 'input';
        this.domElement.appendChild(inputNodeDOM);
        inputNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        inputNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo && lineStartNodeInfo.connectionType === 'audio') {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule, null);
                }
            }
            stopDrawingLine();
        });
    }

    createParamInputNodeDOM(paramName, topPosition) {
        const paramNodeDOM = document.createElement('div');
        paramNodeDOM.className = 'io-node param-input-node';
        paramNodeDOM.style.top = topPosition;
        paramNodeDOM.dataset.moduleId = this.id;
        paramNodeDOM.dataset.paramName = paramName;
        this.domElement.appendChild(paramNodeDOM);
        paramNodeDOM.addEventListener('mousedown', (e) => e.stopPropagation());
        paramNodeDOM.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            if (drawingLine && lineStartNodeInfo && lineStartNodeInfo.connectionType === 'param') {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule, paramName);
                }
            }
            stopDrawingLine();
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
            const connectionType = this.type === 'lfo' ? 'param' : 'audio';
            startDrawingLine(e, this.id, e.target, connectionType);
        });
    }
    connectTo(targetModule, targetParam = null) {
        if (!audioContext || !this.audioNode || !targetModule) return false;
        
        if (targetParam) { // Parameter connection
            const targetAudioParam = targetModule.getAudioParam(targetParam);
            if (targetAudioParam instanceof AudioParam) {
                try {
                    this.audioNode.connect(targetAudioParam);
                    return true;
                } catch (e) { console.error(`Failed to connect ${this.name} to ${targetModule.name}.${targetParam}`, e); return false; }
            }
        } else { // Audio connection
            if (targetModule.audioNode instanceof AudioNode) {
                try {
                    this.audioNode.connect(targetModule.audioNode);
                    return true;
                } catch (e) { console.error(`Failed to connect ${this.name} to ${targetModule.name}`, e); return false; }
            }
        }
        return false;
    }
    disconnectFrom(targetModule, targetParam = null) {
        if (!this.audioNode || !targetModule) return;
        try {
            if (targetParam) {
                const targetAudioParam = targetModule.getAudioParam(targetParam);
                if (targetAudioParam instanceof AudioParam) {
                    this.audioNode.disconnect(targetAudioParam);
                }
            } else if (targetModule.audioNode) {
                if (this.audioNode.disconnect && typeof this.audioNode.disconnect === 'function') {
                    this.audioNode.disconnect(targetModule.audioNode);
                }
            }
        } catch (error) {}
    }
    destroy() {
        // Disconnect all connections related to this module
        connections = connections.filter(c => {
            if (c.sourceId === this.id) {
                const target = getModuleById(c.targetId);
                if (target) this.disconnectFrom(target, c.param);
                return false; // remove connection
            }
            if (c.targetId === this.id) {
                const source = getModuleById(c.sourceId);
                if (source) source.disconnectFrom(this, c.param);
                return false; // remove connection
            }
            return true; // keep connection
        });

        if (this.audioNode) {
            if (this.type === 'oscillator' && this.audioNode.stop) {
                try { if(this.isPlaying) this.audioNode.stop(); } catch (e) {}
            }
            // LFOは常に再生されているため、destroy時にstopしない
            if (this.type === 'lfo' && this.lfoNode && this.lfoNode.stop) {
                 try { if(this.isPlaying) this.lfoNode.stop(); } catch (e) {}
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
    getAudioParam(paramName) {
        if (this.audioNode && this.audioNode[paramName] instanceof AudioParam) {
            return this.audioNode[paramName];
        }
        return null;
    }
}

class OscillatorModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('oscillator', x, y, 'Osc ', isCorrectAnswerModule);
        this.params = { type: 'sine', frequency: 440, detune: 0 };
        this.isPlaying = false;
        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('frequency', '75%');
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
        this.params = { gain: 0.25 };
        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('gain', '75%');
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
        this.createParamInputNodeDOM('frequency', '75%');
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
        this.createParamInputNodeDOM('delayTime', '75%');
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
    connectTo(targetModule, targetParam = null) {
        if (!this.audioNode) return false;
        return super.connectTo(targetModule, targetParam);
    }
    getAudioParam(paramName) {
        if (paramName === 'delayTime' && this.audioNode) {
            return this.audioNode.delayTime;
        }
        if (paramName === 'feedback' && this.feedbackNode) {
            return this.feedbackNode.gain;
        }
        return super.getAudioParam(paramName);
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

class ReverbModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('reverb', x, y, 'Reverb ', isCorrectAnswerModule);
        this.params = { mix: 0.5, time: 1.5 };
        
        this.wetGain = null;
        this.dryGain = null;
        this.convolver = null;
        this.outputMix = null; // This will be the actual output node

        this.initAudioNode();
        this.updateParams();
        this.createParamInputNodeDOM('mix', '75%');
    }

    initAudioNode() {
        if (!audioContext) return;
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        if (this.wetGain) { try { this.wetGain.disconnect(); } catch(e) {} }
        if (this.dryGain) { try { this.dryGain.disconnect(); } catch(e) {} }
        if (this.convolver) { try { this.convolver.disconnect(); } catch(e) {} }
        if (this.outputMix) { try { this.outputMix.disconnect(); } catch(e) {} }

        this.audioNode = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.convolver = audioContext.createConvolver();
        this.outputMix = audioContext.createGain();

        this.audioNode.connect(this.dryGain);
        this.dryGain.connect(this.outputMix);
        this.audioNode.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.outputMix);

        this.buildImpulse();
    }

    buildImpulse() {
        if (!audioContext || !this.convolver) return;
        const rate = audioContext.sampleRate;
        const length = Math.max(1, rate * this.params.time);
        const impulse = audioContext.createBuffer(2, length, rate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);
        const decay = this.params.time > 0 ? Math.max(1, this.params.time) : 1;

        for (let i = 0; i < length; i++) {
            const n = length - i;
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        }
        this.convolver.buffer = impulse;
    }

    updateParams() {
        if (!audioContext || !this.wetGain || !this.dryGain) return;
        this.dryGain.gain.setValueAtTime(1 - this.params.mix, audioContext.currentTime);
        this.wetGain.gain.setValueAtTime(this.params.mix, audioContext.currentTime);
        this.buildImpulse();
    }

    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Mix: ${this.params.mix.toFixed(2)}</label></div>
                <div class="mb-2"><label class="param-label">Time: ${this.params.time.toFixed(2)} s</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Mix (Wet): <span id="reverb-mix-val-${this.id}">${this.params.mix.toFixed(2)}</span>
                    <input type="range" id="reverb-mix-${this.id}" class="param-slider" min="0" max="1" step="0.01" value="${this.params.mix}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Time: <span id="reverb-time-val-${this.id}">${this.params.time.toFixed(2)}</span> s
                    <input type="range" id="reverb-time-${this.id}" class="param-slider" min="0.1" max="4" step="0.1" value="${this.params.time}">
                </label>
            </div>
        `;
    }

    connectTo(targetModule, targetParam = null) {
        if (!this.outputMix || !targetModule || !targetModule.audioNode) return false;
        // Reverb can only connect to audio inputs, not params.
        if (targetParam) return false;

        if (targetModule.audioNode instanceof AudioNode) {
            try {
                this.outputMix.connect(targetModule.audioNode);
                return true;
            } catch (e) { 
                console.error(`Failed to connect ${this.name} to ${targetModule.name}`, e);
                return false; 
            }
        }
        return false;
    }

    disconnectFrom(targetModule, targetParam = null) {
        if (!this.outputMix || !targetModule || !targetModule.audioNode) return;
        if (targetParam) return;
        try {
            if (this.outputMix.disconnect && typeof this.outputMix.disconnect === 'function') {
                this.outputMix.disconnect(targetModule.audioNode);
            }
        } catch (error) {}
    }
    
    destroy() {
        if (this.audioNode) { try { this.audioNode.disconnect(); } catch(e) {} }
        if (this.wetGain) { try { this.wetGain.disconnect(); } catch(e) {} }
        if (this.dryGain) { try { this.dryGain.disconnect(); } catch(e) {} }
        if (this.convolver) { try { this.convolver.disconnect(); } catch(e) {} }
        if (this.outputMix) { try { this.outputMix.disconnect(); } catch(e) {} }
        super.destroy();
    }

    getAudioParam(paramName) {
        if (paramName === 'mix') {
            // LFOでwetGainを直接コントロールすることでmixを擬似的に変化させます
            return this.wetGain.gain;
        }
        return super.getAudioParam(paramName);
    }
}

class LFOModule extends AudioModule {
    constructor(x, y, isCorrectAnswerModule = false) {
        super('lfo', x, y, 'LFO ', isCorrectAnswerModule);
        this.params = { type: 'sine', frequency: 5, amount: 100 };
        this.lfoNode = null; // The actual oscillator
        this.isPlaying = false;
        this.initAudioNode();
        this.updateParams();
    }

    createOutputNodeDOM() {
        const outputNodeDOM = document.createElement('div');
        outputNodeDOM.className = 'io-node param-output-node';
        outputNodeDOM.dataset.moduleId = this.id;
        outputNodeDOM.dataset.nodeType = 'output';
        this.domElement.appendChild(outputNodeDOM);
        outputNodeDOM.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (this.isCorrectAnswerModule) return;
            // LFO output is always for parameters
            startDrawingLine(e, this.id, e.target, 'param');
        });
    }

    initAudioNode() {
        if (!audioContext) return;
        if (this.lfoNode) {
            try { if(this.isPlaying) this.lfoNode.stop(); } catch(e) {}
            try { this.lfoNode.disconnect(); } catch(e) {}
        }
        if (this.audioNode) { // audioNode is the Gain (amount)
            try { this.audioNode.disconnect(); } catch(e) {}
        }

        this.lfoNode = audioContext.createOscillator();
        this.audioNode = audioContext.createGain(); // This is the output node

        this.lfoNode.connect(this.audioNode);
        this.lfoNode.type = this.params.type;
        this.lfoNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.gain.setValueAtTime(this.params.amount, audioContext.currentTime);
        
        this.lfoNode.start(0);
        this.isPlaying = true;
    }

    getEditorHTML() {
        if (this.isCorrectAnswerModule) {
            return `
                <div class="mb-2"><label class="param-label">Type: ${this.params.type}</label></div>
                <div class="mb-2"><label class="param-label">Frequency: ${this.params.frequency} Hz</label></div>
                <div class="mb-2"><label class="param-label">Amount: ${this.params.amount}</label></div>
            `;
        }
        return `
            <div class="mb-2">
                <label class="param-label">Type:
                    <select id="lfo-type-${this.id}" class="custom-select">
                        <option value="sine">sine</option>
                        <option value="square">square</option>
                        <option value="sawtooth">sawtooth</option>
                        <option value="triangle">triangle</option>
                    </select>
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Frequency: <span id="lfo-freq-val-${this.id}">${this.params.frequency}</span> Hz
                    <input type="range" id="lfo-freq-${this.id}" class="param-slider" min="0.1" max="20" step="0.1" value="${this.params.frequency}">
                </label>
            </div>
            <div class="mb-2">
                <label class="param-label">Amount: <span id="lfo-amount-val-${this.id}">${this.params.amount}</span>
                    <input type="range" id="lfo-amount-${this.id}" class="param-slider" min="0" max="1000" step="1" value="${this.params.amount}">
                </label>
            </div>
        `;
    }

    updateParams() {
        if (!this.lfoNode || !this.audioNode || !audioContext) return;
        this.lfoNode.type = this.params.type;
        this.lfoNode.frequency.setValueAtTime(this.params.frequency, audioContext.currentTime);
        this.audioNode.gain.setValueAtTime(this.params.amount, audioContext.currentTime);
    }

    destroy() {
        if (this.lfoNode) {
            try {
                if (this.isPlaying) this.lfoNode.stop();
            } catch (e) {}
            try {
                this.lfoNode.disconnect();
            } catch (e) {}
        }
        super.destroy();
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
            if (drawingLine && lineStartNodeInfo && lineStartNodeInfo.connectionType === 'audio') {
                const sourceModule = getModuleById(lineStartNodeInfo.sourceModuleId);
                const targetModule = getModuleById(this.id);
                if (sourceModule && targetModule) {
                    connectModules(sourceModule, targetModule, null);
                }
            }
            stopDrawingLine();
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
