// 전역 변수들
let upscaler = null;
let originalImageData = null;
let upscaledCanvas = null;
let isDragging = false;

// AI 업스케일러 초기화
async function initializeUpscaler() {
    try {
        console.log('AI 업스케일러 초기화 시작...');
        
        // 필요한 라이브러리들이 로드될 때까지 대기
        await waitForLibraries();
        
        // 모델 로딩 시작 알림
        document.getElementById('upscaleBtn').textContent = '🧠 AI 모델 준비중...';
        console.log('TensorFlow.js 백엔드 준비 중...');
        
        // TensorFlow.js 백엔드 설정
        await tf.setBackend('wasm', { enableSimd: true, initialMemory: 128 }); // WASM 백엔드 및 메모리 설정
        await tf.ready();
        console.log('TensorFlow.js 준비 완료');
        
        // Upscaler 인스턴스 생성
        console.log('Upscaler 인스턴스 생성 중...');
        upscaler = new Upscaler({
            model: ESRGANMedium4x,
            // executionProviders: ["webgl", "wasm"] // WASM을 명시적으로 설정했으므로 제거
        });
        
        console.log('AI 업스케일러 초기화 완료!');
        
        // 초기화 완료 상태 표시
        document.getElementById('upscaleBtn').style.opacity = '1';
        document.getElementById('upscaleBtn').textContent = '🚀 업스케일 시작';
        document.getElementById('upscaleBtn').style.cursor = 'pointer';
        
        // 성공 메시지
        console.log('✅ AI 업스케일러가 준비되었습니다!');
        
    } catch (error) {
        console.error('업스케일러 초기화 실패:', error);
        
        // 사용자에게 더 자세한 오류 정보 제공
        document.getElementById('upscaleBtn').textContent = '❌ 로딩 실패';
        document.getElementById('upscaleBtn').style.background = '#dc3545';
        
        alert(`AI 모델 로딩에 실패했습니다.\n\n오류 내용: ${error.message}\n\n해결 방법:\n1. 인터넷 연결을 확인해주세요\n2. 브라우저를 최신 버전으로 업데이트해주세요\n3. 페이지를 새로고침해주세요\n4. 다른 브라우저에서 시도해보세요`);
    }
}

// 라이브러리 로딩 대기 함수
function waitForLibraries() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 300; // 최대 30초 대기 (100ms * 300)
        
        function checkLibraries() {
            attempts++;
            
            // 진행률 표시 (5초마다)
            if (attempts % 50 === 0) {
                const seconds = Math.floor(attempts / 10);
                document.getElementById('upscaleBtn').textContent = `🔄 AI 모델 로딩중... (${seconds}초)`;
                console.log(`라이브러리 로딩 중... ${seconds}초 경과`);
            }
            
            if (typeof tf !== 'undefined' && 
                typeof Upscaler !== 'undefined' && 
                typeof ESRGANMedium4x !== 'undefined') {
                console.log('모든 라이브러리 로딩 완료');
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('라이브러리 로딩 타임아웃 (30초 초과). 인터넷 연결을 확인하고 페이지를 새로고침해주세요.'));
            } else {
                setTimeout(checkLibraries, 100);
            }
        }
        
        checkLibraries();
    });
}

// 페이지 로드 완료 후 약간의 지연을 두고 초기화
window.addEventListener('load', () => {
    // 초기화 중임을 표시
    document.getElementById('upscaleBtn').style.opacity = '0.5';
    document.getElementById('upscaleBtn').textContent = '🔄 AI 모델 로딩중...';
    
    // 약간의 지연 후 초기화 시작
    setTimeout(initializeUpscaler, 500);
});

// 파일 업로드 관련 이벤트
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

// uploadArea에 대한 클릭 이벤트 리스너 추가 (명시적 호출)
uploadArea.addEventListener('click', (e) => {
    console.log('Upload Area Clicked!'); // 디버깅용 로그 추가
    e.preventDefault(); // 기본 동작 방지
    e.stopPropagation(); // 이벤트 전파 중단
    fileInput.click();
});

// 파일 선택 이벤트
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadImageFile(file);
    }
});

// 드래그 앤 드롭 이벤트
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            loadImageFile(file);
        } else {
            alert('이미지 파일만 업로드 가능합니다.');
        }
    }
});

// 인터페이스 초기화 (이 함수는 새 이미지가 로드되거나 UI를 초기 상태로 되돌릴 때 호출됩니다)
function resetInterface() {
    document.getElementById('downloadSection').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
    
    // 업스케일 버튼 상태 재설정 (모델 로딩 상태는 initializeUpscaler가 관리)
    // 이 부분은 initializeUpscaler와 loadImageFile/loadSampleImage에서 명확히 설정되므로, 여기서 직접 텍스트 변경은 지양
    const upscaleBtn = document.getElementById('upscaleBtn');
    if (upscaler) { // 모델이 로드되었다면 '업스케일 시작'
        upscaleBtn.disabled = false;
        upscaleBtn.textContent = '🚀 업스케일 시작';
        upscaleBtn.style.opacity = '1';
        upscaleBtn.style.cursor = 'pointer';
    } else { // 모델 로딩 중이라면 'AI 모델 로딩중...'
        upscaleBtn.disabled = true;
        upscaleBtn.textContent = '🔄 AI 모델 로딩중...';
        upscaleBtn.style.opacity = '0.5';
        upscaleBtn.style.cursor = 'not-allowed';
    }

    // 비교 슬라이더 및 이미지 초기화
    const originalImageElement = document.getElementById('originalImage');
    const upscaledImageElement = document.getElementById('upscaledImage');
    const slider = document.getElementById('slider');
    const comparisonSection = document.getElementById('comparisonSection');

    // 이미지가 없을 때는 비교 섹션을 숨김
    if (!originalImageData) {
        comparisonSection.style.display = 'none';
    }
    originalImageElement.src = originalImageData || ''; // 원본 이미지 데이터가 없으면 src를 비웁니다.
    upscaledImageElement.src = originalImageData || ''; // 업스케일된 이미지를 원본으로 초기화

    // 슬라이더 초기 위치 및 클립 패스 재설정 (원본 이미지 전체가 보이도록)
    if (slider && upscaledImageElement) {
        slider.style.left = '100%'; 
        upscaledImageElement.style.clipPath = 'polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)';
    }
}

// 이미지 파일 로드 함수
function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImageData = e.target.result;
        
        // 원본 이미지를 즉시 표시
        const originalImageElement = document.getElementById('originalImage');
        originalImageElement.src = originalImageData;
        
        // 업스케일된 이미지도 일단 원본으로 설정 (처리 전까지)
        const upscaledImageElement = document.getElementById('upscaledImage');
        upscaledImageElement.src = originalImageData;

        // 비교 섹션을 보이게 하여 원본 이미지가 표시되도록 함
        document.getElementById('comparisonSection').style.display = 'block';

        resetInterface(); // UI 상태 초기화 (download, loading 숨기고 버튼 활성화 등)
        console.log('이미지 로드 완료');
    };
    reader.readAsDataURL(file);
}

// 샘플 이미지 로드 함수 (loadImageFile과 유사하게 수정)
async function loadSampleImage(url) {
    try {
        console.log('샘플 이미지 로딩 중...');
        const img = new Image();
        img.crossOrigin = 'anonymous'; // CORS 문제 해결

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => {
                console.error('샘플 이미지 로드 실패');
                alert('샘플 이미지를 불러올 수 없습니다.');
                reject(new Error('샘플 이미지 로드 실패'));
            };
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        originalImageData = canvas.toDataURL('image/png');
        
        // 원본 이미지를 즉시 표시
        const originalImageElement = document.getElementById('originalImage');
        originalImageElement.src = originalImageData;
        
        // 업스케일된 이미지도 일단 원본으로 설정 (처리 전까지)
        const upscaledImageElement = document.getElementById('upscaledImage');
        upscaledImageElement.src = originalImageData;

        // 비교 섹션을 보이게 하여 원본 이미지가 표시되도록 함
        document.getElementById('comparisonSection').style.display = 'block';

        resetInterface();
        console.log('샘플 이미지 로드 완료');

    } catch (error) {
        console.error('샘플 이미지 로드 오류:', error);
        alert('샘플 이미지를 불러올 수 없습니다.');
    }
}

// 업스케일링 시작 함수
async function startUpscaling() {
    if (!originalImageData) {
        alert('먼저 이미지를 선택해주세요.');
        return;
    }

    if (!upscaler) {
        alert('AI 모델이 아직 로딩중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    try {
        // UI 상태 변경
        const upscaleBtn = document.getElementById('upscaleBtn');
        upscaleBtn.disabled = true;
        upscaleBtn.textContent = '처리중...';
        document.getElementById('loading').style.display = 'block';
        document.getElementById('downloadSection').style.display = 'none';

        // 업스케일된 이미지를 처리 전까지는 원본으로 다시 설정하거나 비웁니다.
        const upscaledImageElement = document.getElementById('upscaledImage');
        upscaledImageElement.src = originalImageData; // 또는 '';
        // 슬라이더를 원본이 보이도록 100%로 설정
        document.getElementById('slider').style.left = '100%';
        upscaledImageElement.style.clipPath = 'polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)';

        console.log('업스케일링 시작...');

        const originalImg = new Image();
        originalImg.src = originalImageData;
        await new Promise((resolve) => { originalImg.onload = resolve; });

        // 원본 이미지를 텐서로 변환하고 0-1 범위로 정규화 (값을 0과 1 사이로 고정)
        const tfImage = tf.browser.fromPixels(originalImg).toFloat().div(tf.scalar(255)).clipByValue(0, 1);
        console.log('Max value of tfImage after clipping:', tfImage.max().dataSync()[0]); // 디버깅 로그 추가

        const scale = parseInt(document.getElementById('scaleSelect').value);
        
        const upscaledImgTensor = await upscaler.upscale(tfImage, {
            scale: scale,
            output: 'tensor'
        });

        console.log('Min value of upscaledImgTensor:', upscaledImgTensor.min().dataSync()[0]);
        console.log('Max value of upscaledImgTensor:', upscaledImgTensor.max().dataSync()[0]);

        // 업스케일된 텐서도 0-1 범위로 클리핑하여 toPixels 오류 방지
        const finalUpscaledTensor = upscaledImgTensor.clipByValue(0, 1);
        console.log('Upscaled Tensor Shape:', finalUpscaledTensor.shape); // 업스케일된 텐서의 차원 로그 추가

        console.log('업스케일링 완료');

        upscaledCanvas = document.createElement('canvas');
        const ctx = upscaledCanvas.getContext('2d');
        
        const imageData = await tf.browser.toPixels(finalUpscaledTensor); // 클리핑된 텐서 사용
        upscaledCanvas.width = finalUpscaledTensor.shape[1];
        upscaledCanvas.height = finalUpscaledTensor.shape[0];
        
        const canvasImageData = ctx.createImageData(upscaledCanvas.width, upscaledCanvas.height);
        canvasImageData.data.set(imageData);
        ctx.putImageData(canvasImageData, 0, 0);

        // 메모리 정리: 클리핑된 텐서와 입력 텐서를 해제합니다.
        finalUpscaledTensor.dispose(); 
        tfImage.dispose();

        // 비교 이미지 설정 (업스케일된 이미지 로드 후 슬라이더 재설정)
        setupComparison(originalImg, upscaledCanvas);

        // 다운로드 버튼 설정
        setupDownload();

    } catch (error) {
        console.error('업스케일링 오류:', error);
        alert(`업스케일링 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        // UI 상태 복원
        document.getElementById('loading').style.display = 'none';
        const upscaleBtn = document.getElementById('upscaleBtn');
        upscaleBtn.disabled = false;
        upscaleBtn.textContent = '🚀 업스케일 시작';
    }
}

// 비교 슬라이더 설정
function setupComparison(originalImg, upscaledCanvas) {
    const originalImageElement = document.getElementById('originalImage');
    const upscaledImageElement = document.getElementById('upscaledImage');
    
    // 원본 이미지 설정 (이미 loadImageFile/loadSampleImage에서 설정됨)
    // originalImageElement.src = originalImageData; 
    
    // 업스케일된 이미지 설정
    upscaledImageElement.src = upscaledCanvas.toDataURL('image/png');
    
    // 비교 섹션 표시 (이미 loadImageFile/loadSampleImage에서 설정됨)
    // document.getElementById('comparisonSection').style.display = 'block';
    
    // 슬라이더 이벤트 설정
    setupSlider();

    // 업스케일 완료 후 슬라이더를 50% 위치로 이동하여 비교를 시작
    const slider = document.getElementById('slider');
    if (slider && upscaledImageElement) {
        slider.style.left = '50%';
        upscaledImageElement.style.clipPath = 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)';
    }
}

// 슬라이더 이벤트 설정
function setupSlider() {
    const slider = document.getElementById('slider');
    const comparisonWrapper = document.getElementById('comparisonWrapper');
    const upscaledImage = document.getElementById('upscaledImage');

    // 마우스 이벤트
    slider.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);

    // 터치 이벤트 (모바일 지원)
    slider.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', endDrag);

    function startDrag(e) {
        isDragging = true;
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const rect = comparisonWrapper.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        
        slider.style.left = percentage + '%';
        upscaledImage.style.clipPath = `polygon(${percentage}% 0%, 100% 0%, 100% 100%, ${percentage}% 100%)`;
    }

    function endDrag() {
        isDragging = false;
    }
}

// 다운로드 버튼 설정
function setupDownload() {
    const downloadBtn = document.getElementById('downloadBtn');
    const dataURL = upscaledCanvas.toDataURL('image/png');
    
    downloadBtn.href = dataURL;
    downloadBtn.download = `upscaled-image-${Date.now()}.png`;
    
    document.getElementById('downloadSection').style.display = 'block';
}

// 전역 드래그 방지 (브라우저 기본 동작 방지)
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
});

// upscaleBtn 클릭 이벤트 리스너 추가
document.getElementById('upscaleBtn').addEventListener('click', startUpscaling); 