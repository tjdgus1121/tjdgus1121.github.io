// 전역 변수 설정
const state = {
    image1: null,
    image2: null,
    grayImage1: [],
    grayImage2: [],
    resultImage: [],
    width: 100,
    height: 100,
    mode: 'mixed', // 'number', 'color', 'mixed'
    blendRatio: 0.5,
    cellSize: 24, // 셀 크기 기본값 (픽셀)
    zoomLevel: 1 // 확대/축소 수준 (1 = 100%)
};

// DOM 요소 초기화
document.addEventListener('DOMContentLoaded', function () {
    // 이미지 업로드 관련 요소
    const imageInput1 = document.getElementById('imageInput1');
    const imageInput2 = document.getElementById('imageInput2');
    const previewImage1 = document.getElementById('previewImage1');
    const previewImage2 = document.getElementById('previewImage2');

    // 컨트롤 관련 요소
    const blendSlider = document.getElementById('blendSlider');
    const sliderValue = document.getElementById('sliderValue');
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const resizeButton = document.getElementById('resizeButton');

    // 모드 버튼
    const numberMode = document.getElementById('numberMode');
    const colorMode = document.getElementById('colorMode');
    const mixedMode = document.getElementById('mixedMode');

    // 결과 관련 요소
    const resultCanvas = document.getElementById('resultCanvas');
    const matrixTable = document.getElementById('matrixTable');
    const matrixContainer = document.getElementById('matrixContainer');
    const pixelInfo = document.getElementById('pixelInfo');
    const downloadCSV = document.getElementById('downloadCSV');

    // 셀 크기 조절 요소
    const increaseSize = document.getElementById('increaseSize');
    const decreaseSize = document.getElementById('decreaseSize');
    const cellSizeValue = document.getElementById('cellSizeValue');

    // 확대/축소 조절 요소
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const zoomValue = document.getElementById('zoomValue');

    // 이벤트 리스너 등록
    imageInput1.addEventListener('change', (e) => handleImageUpload(e, 1));
    imageInput2.addEventListener('change', (e) => handleImageUpload(e, 2));

    blendSlider.addEventListener('input', handleSliderChange);
    resizeButton.addEventListener('click', applyResize);

    numberMode.addEventListener('click', () => setDisplayMode('number'));
    colorMode.addEventListener('click', () => setDisplayMode('color'));
    mixedMode.addEventListener('click', () => setDisplayMode('mixed'));

    downloadCSV.addEventListener('click', downloadMatrixAsCSV);

    // 셀 크기 조절 이벤트
    increaseSize.addEventListener('click', () => {
        showLoading(); // 로딩 시작
        if (state.cellSize < 100) {
            state.cellSize += 4;
            cellSizeValue.textContent = state.cellSize;
            // updateMatrixDisplay 함수 내에서 진행률 업데이트
            requestAnimationFrame(() => {
                updateMatrixDisplay(0, 100); // 전체 범위 (0-100) 사용
            });
        }
        updateCellSizeButtonStates(); // 버튼 상태 업데이트
        setTimeout(hideLoading, 1500); // 1.5초 후 로딩 숨김
    });

    decreaseSize.addEventListener('click', () => {
        showLoading(); // 로딩 시작
        if (state.cellSize > 12) {
            state.cellSize -= 4;
            cellSizeValue.textContent = state.cellSize;
            // updateMatrixDisplay 함수 내에서 진행률 업데이트
            requestAnimationFrame(() => {
                updateMatrixDisplay(0, 100); // 전체 범위 (0-100) 사용
            });
        }
        updateCellSizeButtonStates(); // 버튼 상태 업데이트
        setTimeout(hideLoading, 1500); // 1.5초 후 로딩 숨김
    });

    // 확대/축소 이벤트
    zoomIn.addEventListener('click', () => {
        showLoading(); // 로딩 시작
        if (state.zoomLevel < 2) {
            state.zoomLevel += 0.1;
            updateZoom(); // updateZoom은 DOM 조작이 크지 않음
            // updateMatrixDisplay 함수 내에서 진행률 업데이트
            requestAnimationFrame(() => {
                updateMatrixDisplay(0, 100); // 전체 범위 (0-100) 사용
            });
        }
        setTimeout(hideLoading, 1500); // 1.5초 후 로딩 숨김
    });

    zoomOut.addEventListener('click', () => {
        showLoading(); // 로딩 시작
        if (state.zoomLevel > 0.1) {
            state.zoomLevel -= 0.1;
            updateZoom(); // updateZoom은 DOM 조작이 크지 않음
            // updateMatrixDisplay 함수 내에서 진행률 업데이트
            requestAnimationFrame(() => {
                updateMatrixDisplay(0, 100); // 전체 범위 (0-100) 사용
            });
        }
        setTimeout(hideLoading, 1500); // 1.5초 후 로딩 숨김
    });

    // 드래그 앤 드롭 이벤트 설정
    setupDragDrop('preview1', 1);
    setupDragDrop('preview2', 2);

    // 초기 너비/높이 값 적용
    state.width = parseInt(widthInput.value);
    state.height = parseInt(heightInput.value);

    // 캔버스 초기화
    initializeCanvas();

    // 초기 셀 크기 버튼 상태 업데이트
    updateCellSizeButtonStates();
});

// 셀 크기 조절 버튼 활성화/비활성화 상태 업데이트 함수
function updateCellSizeButtonStates() {
    const increaseSize = document.getElementById('increaseSize');
    const decreaseSize = document.getElementById('decreaseSize');

    if (state.cellSize >= 100) {
        increaseSize.setAttribute('disabled', 'true');
    } else {
        increaseSize.removeAttribute('disabled');
    }

    if (state.cellSize <= 12) {
        decreaseSize.setAttribute('disabled', 'true');
    } else {
        decreaseSize.removeAttribute('disabled');
    }
}

// 확대/축소 업데이트 함수
function updateZoom() {
    const matrixContainer = document.getElementById('matrixContainer');
    const zoomValue = document.getElementById('zoomValue');

    matrixContainer.style.transform = `scale(${state.zoomLevel})`;
    zoomValue.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

// 드래그 앤 드롭 설정 함수
function setupDragDrop(previewId, imageNumber) {
    const previewContainer = document.getElementById(previewId);

    previewContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        previewContainer.style.borderColor = '#4CAF50';
    });

    previewContainer.addEventListener('dragleave', () => {
        previewContainer.style.borderColor = '#ccc';
    });

    previewContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        previewContainer.style.borderColor = '#ccc';

        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type.match('image.*')) {
                showLoading();

                const reader = new FileReader();

                reader.onloadstart = function() {
                };

                reader.onprogress = function(e) {
                };

                reader.onload = function (e) {
                    const img = new Image();
                    img.onload = function () {
                        if (imageNumber === 1) {
                            state.image1 = img;
                        } else {
                            state.image2 = img;
                        }

                        // 미리보기 이미지 표시
                        const previewImage = document.getElementById(`previewImage${imageNumber}`);
                        previewImage.src = e.target.result;
                        previewImage.style.display = 'block';

                        // 드롭 텍스트 숨기기
                        const dropText = previewContainer.querySelector('.drop-text');
                        dropText.style.display = 'none';

                        // 두 이미지가 모두 선택되었을 때만 처리
                        if (state.image1 && state.image2) {
                            processImages();
                        } else {
                             // 이미지가 하나만 업로드된 경우 메시지 표시 후 숨김
                            updateLoadingMessage('이미지를 하나 더 선택해주세요.');
                            setTimeout(hideLoading, 2000); // 메시지 확인을 위해 2초 후 숨김
                        }
                    };
                    img.onerror = function() {
                        console.error('이미지 로드 중 오류 발생');
                        updateLoadingMessage('이미지 로드 중 오류 발생!');
                         setTimeout(hideLoading, 2000); // 오류 메시지 확인을 위해 2초 후 숨김
                         alert('이미지 로드 중 오류가 발생했습니다. 파일 형식을 확인하거나 다른 이미지를 시도해주세요.');
                    };
                    img.src = e.target.result;
                };
                reader.onerror = function() {
                    console.error('파일 읽기 중 오류 발생');
                    updateLoadingMessage('파일 읽기 중 오류 발생!');
                     setTimeout(hideLoading, 2000); // 오류 메시지 확인을 위해 2초 후 숨김
                     alert('파일 읽기 중 오류가 발생했습니다. 파일을 다시 선택해주세요.');
                };
                reader.readAsDataURL(file);
            }
        }
    });
}

// 이미지 업로드 처리 함수
function handleImageUpload(event, imageNumber) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading();

    const reader = new FileReader();

    reader.onloadstart = function() {
    };

    reader.onprogress = function(e) {
    };

    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            if (imageNumber === 1) {
                state.image1 = img;
            } else {
                state.image2 = img;
            }

            // 미리보기 이미지 표시
            const previewImage = document.getElementById(`previewImage${imageNumber}`);
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';

            // 드롭 텍스트 숨기기
            const previewContainer = document.getElementById(`preview${imageNumber}`);
            const dropText = previewContainer.querySelector('.drop-text');
            dropText.style.display = 'none';

            // updateLoadingMessage('미리보기 설정 완료...'); // 메시지 제거
            // 미리보기 설정 완료 (40%)
            updateLoadingProgress(40);

            // 두 이미지가 모두 선택되었을 때만 처리
            if (state.image1 && state.image2) {
                processImages();
            } else {
                 // 이미지가 하나만 업로드된 경우 메시지 표시 후 숨김
                 updateLoadingMessage('두 이미지를 모두 선택해주세요.');
                 updateLoadingProgress(0); // 진행률 초기화
                 setTimeout(hideLoading, 2000); // 메시지 확인을 위해 2초 후 숨김
            }
        };
         img.onerror = function() {
             console.error('이미지 로드 중 오류 발생');
             updateLoadingMessage('이미지 로드 중 오류 발생!');
             updateLoadingProgress(0); // 진행률 초기화
             setTimeout(hideLoading, 2000); // 오류 메시지 확인을 위해 2초 후 숨김
             alert('이미지 로드 중 오류가 발생했습니다. 파일 형식을 확인하거나 다른 이미지를 시도해주세요.');
         };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        console.error('파일 읽기 중 오류 발생');
        updateLoadingMessage('파일 읽기 중 오류 발생!');
        updateLoadingProgress(0); // 진행률 초기화
        setTimeout(hideLoading, 2000); // 오류 메시지 확인을 위해 2초 후 숨김
        alert('파일 읽기 중 오류가 발생했습니다. 파일을 다시 선택해주세요.');
    };
    reader.readAsDataURL(file);
}

// 로딩 인디케이터 제어 함수
function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'flex';
    updateLoadingProgress(0);
    updateLoadingMessage('이미지 처리 중...'); // 초기 메시지 설정
}

function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

function updateLoadingProgress(progress) {
    const progressElement = document.getElementById('loadingProgress');
    if (progressElement) {
        progressElement.textContent = Math.round(progress);
    }
}

function updateLoadingMessage(message) {
    const loadingContent = document.querySelector('.loading-content p');
    if (loadingContent) {
        // 현재 메시지에서 퍼센트 부분만 추출하여 유지
        const currentText = loadingContent.textContent;
        const progressMatch = currentText.match(/\d+%$/);
        const progressText = progressMatch ? ' ' + progressMatch[0] : '';
        // 메시지 부분만 업데이트하고 퍼센트 부분은 그대로 둡니다.
        loadingContent.textContent = message + progressText;
    }
}

// 슬라이더 변경 처리 함수
function handleSliderChange(event) {
    const value = event.target.value;
    state.blendRatio = value / 100;

    // 슬라이더 값 표시 업데이트
    document.getElementById('sliderValue').textContent = value + '%';

    showLoading();

    // 비동기 처리를 위해 setTimeout 사용
    setTimeout(() => {
        // 이미지 처리
        blendImages();
        updateResultsDisplay();

        hideLoading();
    }, 0);
}

// 리사이즈 적용 함수
function applyResize() {
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');

    state.width = parseInt(widthInput.value);
    state.height = parseInt(heightInput.value);

    showLoading();

    // 비동기 처리를 위해 setTimeout 사용
    setTimeout(() => {
        // 캔버스 크기 조정
        initializeCanvas();

        // 이미지 처리
        processImages();

        hideLoading();
    }, 0);
}

// 디스플레이 모드 설정 함수
function setDisplayMode(mode) {
    state.mode = mode;

    // 모드 버튼 활성화 상태 업데이트
    document.getElementById('numberMode').classList.remove('active');
    document.getElementById('colorMode').classList.remove('active');
    document.getElementById('mixedMode').classList.remove('active');

    document.getElementById(`${mode}Mode`).classList.add('active');

    // 행렬 표시 업데이트
    updateMatrixDisplay();
}

// 캔버스 초기화 함수
function initializeCanvas() {
    const resultCanvas = document.getElementById('resultCanvas');
    const ctx = resultCanvas.getContext('2d');

    resultCanvas.width = state.width;
    resultCanvas.height = state.height;

    // 캔버스 초기화 (검은색)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, state.width, state.height);
}

// 이미지 처리 메인 함수
function processImages() {
    console.log('processImages 시작');
    // 두 이미지가 모두 선택되었는지 확인
    if (!state.image1 || !state.image2) {
        console.log('processImages 중단: 두 이미지를 모두 선택해주세요.');
        updateLoadingMessage('두 이미지를 모두 선택해주세요.'); // 메시지 업데이트
        updateLoadingProgress(0); // 진행률 초기화
        setTimeout(hideLoading, 2000); // 메시지 확인을 위해 2초 후 숨김
        return;
    }

    // 이미지 처리가 시작될 때 메시지 다시 설정
    updateLoadingMessage('이미지 처리 중...');
    console.log('이미지 처리 시작');

    // 비동기 처리를 위해 Promise 사용
    Promise.resolve().then(async () => {
        try {
            console.log('Promise 실행 시작');
            // 파일 읽기 및 이미지 로딩 (0% - 40%)는 handleImageUpload/setupDragDrop에서 처리

            // 그레이스케일 변환 시작 (40%부터 시작)
            console.log('첫 번째 이미지 그레이스케일 변환 시작 (40%)');
            state.grayImage1 = await convertToGrayscale(state.image1, 40, 65); // 40% -> 65%
            console.log('첫 번째 이미지 그레이스케일 변환 완료 (65%)');

            console.log('두 번째 이미지 그레이스케일 변환 시작 (65%)');
            state.grayImage2 = await convertToGrayscale(state.image2, 65, 80); // 65% -> 80%
            console.log('두 번째 이미지 그레이스케일 변환 완료 (80%)');

            // 이미지 혼합 시작 (80%부터 시작)
            console.log('이미지 혼합 시작 (80%)');
            await blendImages(80, 95); // 80% -> 95%
            console.log('이미지 혼합 완료 (95%)');
            console.log('state.resultImage populated:', state.resultImage.length > 0);

            // 결과 표시 업데이트 (95%부터 시작)
            console.log('결과 표시 업데이트 시작 (95%)');
            await updateResultsDisplay(95, 100); // 95% -> 100%
            console.log('결과 표시 업데이트 완료 (100%)');

            updateLoadingMessage('처리 완료!');

            // 진행률과 완료 메시지를 볼 수 있도록 약간의 지연 후 로딩 인디케이터 숨김
            setTimeout(hideLoading, 1000);
            console.log('처리 완료, 로딩 숨김 타이머 시작');
        } catch (error) {
            console.error('이미지 처리 중 오류 발생:', error);
            updateLoadingMessage('처리 중 오류 발생!');
            updateLoadingProgress(0); // 진행률 초기화
            setTimeout(hideLoading, 2000); // 오류 메시지 확인을 위해 더 오래 표시
        }
    });
}

// 그레이스케일 변환 함수 - 진행률 범위 인자 추가
function convertToGrayscale(image, startProgress, endProgress) {
    console.log(`convertToGrayscale 시작 for image: ${image.src.substring(0, 30)}...`);
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            console.log('그레이스케일: 캔버스 생성 및 크기 설정');
            // 캔버스 크기 설정
            canvas.width = state.width;
            canvas.height = state.height;

            console.log('그레이스케일: 이미지 그리기');
            // 이미지를 캔버스 크기에 맞게 그리기
            ctx.drawImage(image, 0, 0, state.width, state.height);

            console.log('그레이스케일: 픽셀 데이터 가져오기');
            // 픽셀 데이터 가져오기
            const imageData = ctx.getImageData(0, 0, state.width, state.height);
            const pixels = imageData.data;

            console.log('그레이스케일: 행렬 생성 및 픽셀 변환 시작');
            // 그레이스케일 행렬 생성
            const grayMatrix = Array(state.height).fill().map(() => Array(state.width).fill(0));

            // 픽셀 단위로 그레이스케일 변환
            const totalPixels = state.width * state.height;
            let processedPixels = 0;
            // 픽셀 처리 범위는 주어진 범위의 90%를 사용하고, 나머지 10%는 초기화 및 기타 작업에 할당
            const pixelProcessingRange = (endProgress - startProgress) * 0.9;
            const initialProgress = startProgress + (endProgress - startProgress) * 0.1; // 초기화 및 데이터 준비에 10% 할당

            const updateInterval = Math.max(1, Math.floor(totalPixels / 100)); // 최소 100단계로 나누어 업데이트 시도

            // 초기 진행률 업데이트
            updateLoadingProgress(initialProgress);

            for (let y = 0; y < state.height; y++) {
                for (let x = 0; x < state.width; x++) {
                    const i = (y * state.width + x) * 4;

                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];

                    const gray = Math.round(
                        0.299 * r +
                        0.587 * g +
                        0.114 * b
                    );

                    grayMatrix[y][x] = gray;

                    // 진행률 업데이트
                    processedPixels++;
                    if (processedPixels % updateInterval === 0) {
                         const progress = initialProgress + (processedPixels / totalPixels) * pixelProcessingRange; // 주어진 범위 내에서 픽셀 처리 진행률 반영
                         updateLoadingProgress(progress);
                    }
                }
            }
             // 픽셀 처리 완료 후 남은 범위까지 진행률 업데이트
            updateLoadingProgress(endProgress); // 그레이스케일 변환 완료 시점

            console.log(`convertToGrayscale 완료, 행렬 크기: ${grayMatrix.length}x${grayMatrix[0].length}`);
            resolve(grayMatrix);
        } catch (error) {
            console.error('그레이스케일 변환 중 오류 발생:', error);
            reject(error); // Promise 실패 처리
        }
    });
}

// 이미지 혼합 함수 - 진행률 범위 인자 추가
function blendImages(startProgress, endProgress) {
    console.log('blendImages 시작');
    return new Promise((resolve, reject) => {
        if (!state.grayImage1.length || !state.grayImage2.length) {
             console.log('blendImages 중단: grayImage1 또는 grayImage2가 비어 있습니다.');
            resolve();
            return;
        }

        const alpha = state.blendRatio;
        const totalPixels = state.width * state.height;
        let processedPixels = 0;
        // 픽셀 처리 범위는 주어진 범위의 90%를 사용
        const pixelProcessingRange = (endProgress - startProgress) * 0.9;
         const initialProgress = startProgress + (endProgress - startProgress) * 0.1; // 초기화에 10% 할당
        const updateInterval = Math.max(1, Math.floor(totalPixels / 100)); // 최소 100단계로 나누어 업데이트 시도

         // 초기 진행률 업데이트
         updateLoadingProgress(initialProgress);

        // 결과 행렬 초기화
        state.resultImage = Array(state.height).fill().map(() => Array(state.width).fill(0));

        console.log('blendImages: 픽셀 혼합 시작');
        // 픽셀 단위로 혼합
        for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
                const value1 = state.grayImage1[y][x];
                const value2 = state.grayImage2[y][x];

                const blendedValue = Math.round(
                    alpha * value1 +
                    (1 - alpha) * value2
                );

                state.resultImage[y][x] = blendedValue;

                // 진행률 업데이트
                processedPixels++;
                if (processedPixels % updateInterval === 0) {
                     const progress = initialProgress + (processedPixels / totalPixels) * pixelProcessingRange; // 주어진 범위 내에서 픽셀 처리 진행률 반영
                     updateLoadingProgress(progress);
                }
            }
        }
         // 픽셀 처리 완료 후 남은 범위까지 진행률 업데이트
         updateLoadingProgress(endProgress); // 혼합 완료 시점

        console.log('blendImages 완료');
        resolve();
    });
}

// 결과 표시 업데이트 함수 - 진행률 범위 인자 추가
function updateResultsDisplay(startProgress, endProgress) {
    console.log('updateResultsDisplay 시작');
     return new Promise((resolve) => {
        // 결과 이미지 캔버스에 그리기
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas) {
             console.error('결과 캔버스를 찾을 수 없습니다.');
             // reject(new Error('결과 캔버스를 찾을 수 없습니다.')); // 필요시 에러 처리
             resolve(); // 일단 성공으로 처리
             return;
         }
        const ctx = resultCanvas.getContext('2d');
         if (!ctx) {
             console.error('캔버스 컨텍스트를 가져올 수 없습니다.');
             // reject(new Error('캔버스 컨텍스트를 가져올 수 없습니다.')); // 필요시 에러 처리
             resolve(); // 일단 성공으로 처리
             return;
         }

        console.log('updateResultsDisplay: 캔버스 크기 설정');
        // 캔버스 크기 설정 (범위의 10%)
        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.1);
        resultCanvas.width = state.width;
        resultCanvas.height = state.height;

        console.log('updateResultsDisplay: 이미지 데이터 생성');
        // 이미지 데이터 생성 (범위의 20%)
        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.2);
        const imageData = ctx.createImageData(state.width, state.height);
        const pixels = imageData.data;

        console.log('updateResultsDisplay: 픽셀 데이터 설정');
        // 픽셀 데이터 설정 (범위의 60%)
        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.6);
        for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
                const i = (y * state.width + x) * 4;
                const gray = state.resultImage[y][x];
                pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
                pixels[i + 3] = 255;
            }
        }

        console.log('updateResultsDisplay: 이미지 데이터를 캔버스에 그리기');
        // 이미지 데이터를 캔버스에 그리기 (범위의 90%)
        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.9);
        ctx.putImageData(imageData, 0, 0);

        console.log('updateResultsDisplay: 행렬 표시 업데이트 시작');
        // 행렬 표시 업데이트 (범위의 100%)
        updateLoadingProgress(endProgress);
        updateMatrixDisplay(0, 100); // 행렬 자체 업데이트는 0-100% 범위로

        console.log('updateResultsDisplay 완료');
        resolve();
    });
}

// 행렬 표시 업데이트 함수
function updateMatrixDisplay(startProgress = 0, endProgress = 100) {
    console.log('updateMatrixDisplay 시작');
    if (!state.resultImage || !state.resultImage.length || !state.resultImage[0] || !state.resultImage[0].length) {
        console.error('updateMatrixDisplay 중단: resultImage 데이터가 유효하지 않습니다.', state.resultImage);
        return;
    }

    try {
        const matrixTable = document.getElementById('matrixTable');
        if (!matrixTable) {
            console.error('updateMatrixDisplay 오류: 행렬 테이블 요소를 찾을 수 없습니다.');
            return;
        }

        const matrixContainer = document.getElementById('matrixContainer');
         if (!matrixContainer) {
             console.error('updateMatrixDisplay 오류: 행렬 컨테이너 요소를 찾을 수 없습니다.');
             return;
         }

        console.log('updateMatrixDisplay: 테이블 초기화');
        // 테이블 초기화
        matrixTable.innerHTML = '';
        console.log('updateMatrixDisplay: 테이블 초기화 완료');

        // 컨테이너 최소 크기 설정 (테이블이 공간을 확보하도록)
         matrixContainer.style.minWidth = `${state.width * state.cellSize}px`;
         matrixContainer.style.minHeight = `${state.height * state.cellSize}px`;
         matrixContainer.style.display = 'block'; // 혹시 모를 display 설정 문제 방지
        console.log(`updateMatrixDisplay: matrixContainer 최소 크기 설정 - minWidth: ${matrixContainer.style.minWidth}, minHeight: ${matrixContainer.style.minHeight}`);


        console.log('updateMatrixDisplay: 행렬 데이터로 테이블 생성 시작');
        // 행렬 데이터로 테이블 생성
        const totalCells = state.width * state.height;
        let processedCells = 0;
        const updateInterval = Math.max(1, Math.floor(totalCells / 100)); // 최소 100단계로 나누어 업데이트 시도

        for (let y = 0; y < state.height; y++) {
            const row = document.createElement('tr');

            for (let x = 0; x < state.width; x++) {
                const cell = document.createElement('td');
                const gray = state.resultImage[y][x];

                // 셀 크기 설정
                cell.style.width = `${state.cellSize}px`;
                cell.style.height = `${state.cellSize}px`;

                // 셀 내용 설정 (모드에 따라)
                if (state.mode === 'number' || state.mode === 'mixed') {
                    cell.textContent = gray;
                }

                // 셀 배경색 설정 (모드에 따라)
                if (state.mode === 'color' || state.mode === 'mixed') {
                    cell.style.backgroundColor = `rgb(${gray}, ${gray}, ${gray})`;

                    // 밝기에 따라 텍스트 색상 조정 (가독성 향상)
                    if (gray < 128) {
                        cell.style.color = 'white';
                    } else {
                        cell.style.color = 'black';
                    }
                }

                // 폰트 크기 조정 (셀 크기에 비례)
                const fontSize = Math.max(10, Math.min(16, state.cellSize / 3));
                cell.style.fontSize = `${fontSize}px`;

                // 셀 클릭 이벤트 추가
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.dataset.value = gray;
                cell.addEventListener('click', showPixelInfo);

                row.appendChild(cell);

                // !!! 디버깅 로그 추가 !!!
                if (x === 0 && y === 0) { // 첫 번째 셀 정보만 출력하여 너무 많은 로그가 찍히는 것을 방지
                    console.log(`updateMatrixDisplay: 첫 번째 셀 (0,0) 생성 및 스타일 적용됨`);
                    console.log(`  - 설정된 크기: width=${cell.style.width}, height=${cell.style.height}`);
                    // DOM에 추가되기 전이라 offsetWidth/Height는 0일 수 있습니다.
                    // console.log(`  - 계산된 크기: offsetWidth=${cell.offsetWidth}, offsetHeight=${cell.offsetHeight}`);
                    console.log(`  - display 스타일: ${cell.style.display}`); // 비어 있거나 'table-cell'이 예상됨
                    console.log(`  - textContent: ${cell.textContent}`);
                    console.log(`  - backgroundColor: ${cell.style.backgroundColor}`);
                }


                // 진행률 업데이트
                processedCells++;
                if (processedCells % updateInterval === 0) {
                     const progress = startProgress + (processedCells / totalCells) * (endProgress - startProgress);
                     // updateLoadingProgress(progress); // updateMatrixDisplay 자체는 로딩과 별개로 진행
                }
            }
            // 각 행이 끝날 때마다도 진행률 업데이트 (작은 매트릭스에서 빠르게 진행되므로 빈번하게 업데이트)
            const progress = startProgress + (processedCells / totalCells) * (endProgress - startProgress);
            // updateLoadingProgress(progress); // updateMatrixDisplay 자체는 로딩과 별개로 진행
            matrixTable.appendChild(row); // 행이 완성될 때마다 테이블에 추가
        }
         // 최종 완료 후 진행률 100% (주어진 범위의 endProgress)로 업데이트
        // updateLoadingProgress(endProgress); // updateMatrixDisplay 자체는 로딩과 별개로 진행

        console.log('updateMatrixDisplay 완료');

    } catch (error) {
        console.error('행렬 표시 업데이트 중 오류 발생:', error);
    }
}

// 픽셀 정보 표시 함수
function showPixelInfo(event) {
    const cell = event.target;
    const x = cell.dataset.x;
    const y = cell.dataset.y;
    const value = cell.dataset.value;

    const pixelInfo = document.getElementById('pixelInfo');
    pixelInfo.textContent = `좌표: (${x}, ${y}), 밝기값: ${value}`;
}

// CSV 다운로드 함수
function downloadMatrixAsCSV() {
    if (!state.resultImage.length) return;

    // CSV 데이터 생성
    let csvContent = '';

    // 행렬 데이터를 CSV 형식으로 변환
    for (let y = 0; y < state.height; y++) {
        const row = state.resultImage[y].join(',');
        csvContent += row + '\n';
    }

    // CSV 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'image_matrix.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 푸터 연도 업데이트
document.getElementById('current-year').textContent = new Date().getFullYear(); 