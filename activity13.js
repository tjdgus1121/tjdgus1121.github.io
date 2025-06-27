// activity13.js

class RealESRGANUpscaler {
    constructor() {
      this.worker = null;
      this.scale = 4;
      this.tileSize = 128;
      this.totalTiles = 0;
      this.tilesCompleted = 0;
      this.startTime = 0;
  
      this.elements = {};
      this.initElements();
      this.bindEvents();
    }
  
    initElements() {
      const ids = [
        'imageInput', 'sampleBtn', 'processBtn', 'status', 'progressOverlay',
        'progressText', 'progressFill', 'eta',
        'originalCanvas', 'upscaledCanvas', 'originalSize',
        'upscaledSize', 'downloadBtn', 'imagesContainer'
      ];
      ids.forEach(id => this.elements[id] = document.getElementById(id));
      this.elements.downloadBtn.disabled = true;
    }
  
    bindEvents() {
      this.elements.imageInput.addEventListener('change', e => this.onSelect(e));
      this.elements.sampleBtn.addEventListener('click', () => this.loadSample());
      this.elements.processBtn.addEventListener('click', () => this.processImage());
      this.elements.downloadBtn.addEventListener('click', () => this.downloadImage());
    }
  
    initWorker() {
      this.worker = new Worker('activity13worker.js');
      this.worker.onmessage = e => this.handleWorkerMessage(e.data);
      this.showStatus('워커 초기화 중...', 'info');
      this.worker.postMessage({ type: 'init' });
    }
  
    handleWorkerMessage(msg) {
      if (msg.type === 'inited') {
        this.showStatus('모델 로드 완료. 업스케일링 준비 완료', 'success');
        this.elements.processBtn.disabled = false;
      }
      else if (msg.type === 'tileDone') {
        const { x, y, ow, oh, imageData } = msg;
        const ctx = this.elements.upscaledCanvas.getContext('2d');
        const imgData = new ImageData(new Uint8ClampedArray(imageData), ow, oh);
        ctx.putImageData(imgData, x * this.scale, y * this.scale);
  
        this.tilesCompleted++;
        const pct = Math.round(this.tilesCompleted / this.totalTiles * 100);
        this.elements.progressText.textContent = `${pct}%`;
        this.elements.progressFill.style.width = `${pct}%`;
  
        const elapsed = (Date.now() - this.startTime) / 1000;
        const avg = elapsed / this.tilesCompleted;
        const remain = Math.round(avg * (this.totalTiles - this.tilesCompleted));
        this.elements.eta.textContent = `예상 남은 시간: ${remain}초`;
  
        if (this.tilesCompleted === this.totalTiles) {
          this.showStatus('업스케일링 완료', 'success');
          this.elements.downloadBtn.disabled = false;
          setTimeout(() => this.elements.progressOverlay.style.display = 'none', 500);
        }
      }
    }
  
    onSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showStatus('⚠️ 파일 크기는 5MB 이하만 지원합니다.', 'error');
        this.elements.processBtn.disabled = true;
        return;
      }
      this.loadImage(URL.createObjectURL(file));
    }
  
    loadSample() {
      const idx = Math.floor(Math.random() * 100) + 1;
      const filename = String(idx).padStart(4, '0') + '.png';
      const url = `activity13-image/${filename}`;
      this.loadImage(url);
    }
  
    loadImage(url) {
      const img = new Image();
      img.onload = () => {
        const { originalCanvas, originalSize, imagesContainer, processBtn, downloadBtn } = this.elements;
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        originalCanvas.getContext('2d').drawImage(img, 0, 0);
        originalSize.textContent = `${img.width} × ${img.height}`;
        imagesContainer.style.display = 'grid';
        processBtn.disabled = !this.worker;
        downloadBtn.disabled = true;
        this.showStatus('', 'info');
      };
      img.onerror = () => {
        this.showStatus('⚠️ 이미지 로드 실패', 'error');
      };
      img.src = url;
    }
  
    async processImage() {
      const { originalCanvas, upscaledCanvas, progressOverlay } = this.elements;
      const W = originalCanvas.width;
      const H = originalCanvas.height;
      upscaledCanvas.width = W * this.scale;
      upscaledCanvas.height = H * this.scale;
  
      const cols = Math.ceil(W / this.tileSize);
      const rows = Math.ceil(H / this.tileSize);
      this.totalTiles = cols * rows;
      this.tilesCompleted = 0;
      this.startTime = Date.now();
  
      progressOverlay.style.display = 'flex';
  
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const tx = x * this.tileSize;
          const ty = y * this.tileSize;
          const tw = Math.min(this.tileSize, W - tx);
          const th = Math.min(this.tileSize, H - ty);
          const tileBitmap = await createImageBitmap(originalCanvas, tx, ty, tw, th);
          this.worker.postMessage({
            type: 'processTile',
            imageBitmap: tileBitmap,
            x: tx,
            y: ty,
            w: tw,
            h: th,
            scale: this.scale
          }, [tileBitmap]);
        }
      }
    }
  
    downloadImage() {
      const link = document.createElement('a');
      link.download = 'upscaled.png';
      link.href = this.elements.upscaledCanvas.toDataURL('image/png');
      link.click();
    }
  
    showStatus(msg, cls) {
      const el = this.elements.status;
      el.textContent = msg;
      el.className = `status ${cls}`;
      el.style.display = msg ? 'inline-block' : 'none';
    }
  }
  
  window.addEventListener('DOMContentLoaded', () => {
    const upscaler = new RealESRGANUpscaler();
    upscaler.initWorker();
  });
  