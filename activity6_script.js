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
    cellSize: 24,
    zoomLevel: 1
};

// 가상 스크롤 상태
let matrixViewState = { firstRow: -1, lastRow: -1, firstCol: -1, lastCol: -1 };
const MATRIX_OVERSCAN = 3;

function getEffCellSize() {
    return Math.round(state.cellSize * state.zoomLevel);
}

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
    const downloadCSV = document.getElementById('downloadCSV');
    const copyToExcel = document.getElementById('copyToExcel');

    // 셀 크기 조절 요소
    const increaseSize = document.getElementById('increaseSize');
    const decreaseSize = document.getElementById('decreaseSize');
    const cellSizeValue = document.getElementById('cellSizeValue');

    // 이벤트 리스너 등록
    imageInput1.addEventListener('change', (e) => handleImageUpload(e, 1));
    imageInput2.addEventListener('change', (e) => handleImageUpload(e, 2));

    blendSlider.addEventListener('input', handleSliderChange);
    resizeButton.addEventListener('click', applyResize);

    numberMode.addEventListener('click', () => setDisplayMode('number'));
    colorMode.addEventListener('click', () => setDisplayMode('color'));
    mixedMode.addEventListener('click', () => setDisplayMode('mixed'));

    downloadCSV.addEventListener('click', downloadMatrixAsCSV);
    copyToExcel.addEventListener('click', copyMatrixToExcel);

    // 셀 크기 조절 이벤트
    increaseSize.addEventListener('click', () => {
        if (state.cellSize < 100) {
            state.cellSize += 4;
            cellSizeValue.textContent = state.cellSize;
            updateCellSizeButtonStates();
            updateMatrixDisplay();
        }
    });

    decreaseSize.addEventListener('click', () => {
        if (state.cellSize > 12) {
            state.cellSize -= 4;
            cellSizeValue.textContent = state.cellSize;
            updateCellSizeButtonStates();
            updateMatrixDisplay();
        }
    });

    // 가상 스크롤 이벤트
    document.getElementById('matrixWrapper').addEventListener('scroll', renderVisibleMatrix);

    // 셀 클릭 이벤트 위임
    document.getElementById('matrixWrapper').addEventListener('click', function (e) {
        const cell = e.target.closest('.vcell');
        if (!cell) return;
        document.getElementById('pixelInfo').textContent =
            `좌표: (${cell.dataset.x}, ${cell.dataset.y}), 밝기값: ${cell.dataset.value}`;
    });

    // 슬라이더 화살표 버튼 (클릭 + long press)
    let sliderHoldTimer = null;

    function stepSlider(dir) {
        const next = Math.min(100, Math.max(0, parseInt(blendSlider.value) + dir * parseInt(blendSlider.step)));
        if (next !== parseInt(blendSlider.value)) {
            blendSlider.value = next;
            blendSlider.dispatchEvent(new Event('input'));
        }
    }

    function startHold(dir) {
        stepSlider(dir);
        sliderHoldTimer = setInterval(() => stepSlider(dir), 110);
    }

    function stopHold() {
        clearInterval(sliderHoldTimer);
        sliderHoldTimer = null;
    }

    const sliderDec = document.getElementById('sliderDec');
    const sliderInc = document.getElementById('sliderInc');

    sliderDec.addEventListener('mousedown', () => startHold(-1));
    sliderInc.addEventListener('mousedown', () => startHold(1));
    document.addEventListener('mouseup', stopHold);

    sliderDec.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(-1); }, { passive: false });
    sliderInc.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(1); }, { passive: false });
    document.addEventListener('touchend', stopHold);

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

// (zoom은 핸들러에서 직접 처리, 별도 함수 불필요)

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
                            document.querySelectorAll('.upload-card').forEach(c => c.classList.remove('needs-image'));
                            processImages();
                        } else {
                            const otherNum = imageNumber === 1 ? 2 : 1;
                            const otherCard = document.getElementById(`preview${otherNum}`).closest('.upload-card');
                            otherCard.classList.add('needs-image');
                            updateLoadingMessage('이미지를 하나 더 선택해주세요.');
                            setTimeout(hideLoading, 2000);
                        }
                    };
                    img.onerror = function() {
                        updateLoadingMessage('이미지 로드 중 오류 발생!');
                        setTimeout(hideLoading, 2000);
                        alert('이미지 로드 중 오류가 발생했습니다. 파일 형식을 확인하거나 다른 이미지를 시도해주세요.');
                    };
                    img.src = e.target.result;
                };
                reader.onerror = function() {
                    updateLoadingMessage('파일 읽기 중 오류 발생!');
                    setTimeout(hideLoading, 2000);
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
                document.querySelectorAll('.upload-card').forEach(c => c.classList.remove('needs-image'));
                processImages();
            } else {
                const otherNum = imageNumber === 1 ? 2 : 1;
                const otherCard = document.getElementById(`preview${otherNum}`).closest('.upload-card');
                otherCard.classList.add('needs-image');
                updateLoadingMessage('두 이미지를 모두 선택해주세요.');
                updateLoadingProgress(0);
                setTimeout(hideLoading, 2000);
            }
        };
        img.onerror = function() {
            updateLoadingMessage('이미지 로드 중 오류 발생!');
            updateLoadingProgress(0);
            setTimeout(hideLoading, 2000);
            alert('이미지 로드 중 오류가 발생했습니다. 파일 형식을 확인하거나 다른 이미지를 시도해주세요.');
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        updateLoadingMessage('파일 읽기 중 오류 발생!');
        updateLoadingProgress(0);
        setTimeout(hideLoading, 2000);
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
    document.getElementById('blend1Value').textContent = value;
    document.getElementById('blend2Value').textContent = 100 - value;

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
    document.getElementById('numberMode').classList.remove('active');
    document.getElementById('colorMode').classList.remove('active');
    document.getElementById('mixedMode').classList.remove('active');
    document.getElementById(`${mode}Mode`).classList.add('active');
    matrixViewState.firstRow = matrixViewState.lastRow = matrixViewState.firstCol = matrixViewState.lastCol = -1;
    renderVisibleMatrix();
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
    // 두 이미지가 모두 선택되었는지 확인
    if (!state.image1 || !state.image2) {
        updateLoadingMessage('두 이미지를 모두 선택해주세요.'); // 메시지 업데이트
        updateLoadingProgress(0); // 진행률 초기화
        setTimeout(hideLoading, 2000); // 메시지 확인을 위해 2초 후 숨김
        return;
    }

    // 이미지 처리가 시작될 때 메시지 다시 설정
    updateLoadingMessage('이미지 처리 중...');

    // 비동기 처리를 위해 Promise 사용
    Promise.resolve().then(async () => {
        try {
            // 파일 읽기 및 이미지 로딩 (0% - 40%)는 handleImageUpload/setupDragDrop에서 처리

            // 그레이스케일 변환 시작 (40%부터 시작)
            state.grayImage1 = await convertToGrayscale(state.image1, 40, 65); // 40% -> 65%

            state.grayImage2 = await convertToGrayscale(state.image2, 65, 80); // 65% -> 80%

            // 이미지 혼합 시작 (80%부터 시작)
            await blendImages(80, 95); // 80% -> 95%

            // 결과 표시 업데이트 (95%부터 시작)
            await updateResultsDisplay(95, 100); // 95% -> 100%

            updateLoadingMessage('처리 완료!');

            // 진행률과 완료 메시지를 볼 수 있도록 약간의 지연 후 로딩 인디케이터 숨김
            setTimeout(hideLoading, 1000);
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
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 캔버스 크기 설정
            canvas.width = state.width;
            canvas.height = state.height;

            // 이미지를 캔버스 크기에 맞게 그리기
            ctx.drawImage(image, 0, 0, state.width, state.height);

            // 픽셀 데이터 가져오기
            const imageData = ctx.getImageData(0, 0, state.width, state.height);
            const pixels = imageData.data;

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

            resolve(grayMatrix);
        } catch (error) {
            console.error('그레이스케일 변환 중 오류 발생:', error);
            reject(error); // Promise 실패 처리
        }
    });
}

// 이미지 혼합 함수 - 진행률 범위 인자 추가
function blendImages(startProgress, endProgress) {
    return new Promise((resolve, reject) => {
        if (!state.grayImage1.length || !state.grayImage2.length) {
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

        resolve();
    });
}

// 결과 표시 업데이트 함수 - 진행률 범위 인자 추가
function updateResultsDisplay(startProgress, endProgress) {
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

        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.1);
        resultCanvas.width = state.width;
        resultCanvas.height = state.height;

        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.2);
        const imageData = ctx.createImageData(state.width, state.height);
        const pixels = imageData.data;

        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.6);
        for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
                const i = (y * state.width + x) * 4;
                const gray = state.resultImage[y][x];
                pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
                pixels[i + 3] = 255;
            }
        }

        updateLoadingProgress(startProgress + (endProgress - startProgress) * 0.9);
        ctx.putImageData(imageData, 0, 0);

        updateLoadingProgress(endProgress);
        updateMatrixDisplay();
        resolve();
    });
}

// 행렬 표시 업데이트 — 스페이서 크기 갱신 후 가상 스크롤 렌더링
function updateMatrixDisplay() {
    if (!state.resultImage || !state.resultImage.length) return;
    const cs = getEffCellSize();
    const spacer = document.getElementById('matrixSpacer');
    spacer.style.width  = (state.width  * cs) + 'px';
    spacer.style.height = (state.height * cs) + 'px';
    matrixViewState.firstRow = matrixViewState.lastRow = matrixViewState.firstCol = matrixViewState.lastCol = -1;
    renderVisibleMatrix();
}

// 가상 스크롤 렌더러 — 보이는 셀만 생성
function renderVisibleMatrix() {
    if (!state.resultImage || !state.resultImage.length) return;
    const wrapper = document.getElementById('matrixWrapper');
    const cells   = document.getElementById('matrixCells');
    const cs = getEffCellSize();

    const scrollTop  = wrapper.scrollTop;
    const scrollLeft = wrapper.scrollLeft;
    const vw = wrapper.clientWidth;
    const vh = wrapper.clientHeight;

    const firstRow = Math.max(0, Math.floor(scrollTop  / cs) - MATRIX_OVERSCAN);
    const lastRow  = Math.min(state.height, Math.ceil((scrollTop  + vh) / cs) + MATRIX_OVERSCAN);
    const firstCol = Math.max(0, Math.floor(scrollLeft / cs) - MATRIX_OVERSCAN);
    const lastCol  = Math.min(state.width,  Math.ceil((scrollLeft + vw) / cs) + MATRIX_OVERSCAN);

    if (matrixViewState.firstRow === firstRow && matrixViewState.lastRow === lastRow &&
        matrixViewState.firstCol === firstCol && matrixViewState.lastCol === lastCol) return;

    matrixViewState = { firstRow, lastRow, firstCol, lastCol };

    const cols = lastCol - firstCol;
    cells.style.top  = (firstRow * cs) + 'px';
    cells.style.left = (firstCol * cs) + 'px';
    cells.style.gridTemplateColumns = `repeat(${cols}, ${cs}px)`;
    cells.style.gridAutoRows = cs + 'px';

    const frag = document.createDocumentFragment();
    const fontSize = Math.max(8, Math.min(16, cs * 0.4));

    for (let r = firstRow; r < lastRow; r++) {
        for (let c = firstCol; c < lastCol; c++) {
            const div = document.createElement('div');
            div.className = 'vcell';
            div.style.fontSize = fontSize + 'px';
            const gray = state.resultImage[r][c];

            if (state.mode === 'color' || state.mode === 'mixed') {
                div.style.backgroundColor = `rgb(${gray},${gray},${gray})`;
                div.style.color = gray < 128 ? '#fff' : '#000';
            }
            if (state.mode === 'number' || state.mode === 'mixed') {
                div.textContent = gray;
            }

            div.dataset.x = c;
            div.dataset.y = r;
            div.dataset.value = gray;
            frag.appendChild(div);
        }
    }
    cells.innerHTML = '';
    cells.appendChild(frag);
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

// Excel 복사 함수
function copyMatrixToExcel() {
    if (!state.resultImage || state.resultImage.length === 0) {
        alert('복사할 데이터가 없습니다.');
        return;
    }

    try {
        // 탭으로 구분된 텍스트 생성 (Excel 형식)
        const excelData = state.resultImage
            .map(row => row.join('\t'))
            .join('\n');

        // 클립보드에 복사
        navigator.clipboard.writeText(excelData)
            .then(() => {
                showCopySuccessMessage();
            })
            .catch(err => {
                // 구형 브라우저 대체 방법
                fallbackCopyToClipboard(excelData);
            });
    } catch (error) {
        console.error('Excel 복사 중 오류:', error);
        alert('클립보드 복사에 실패했습니다.');
    }
}

function showCopySuccessMessage() {
    const existingMessage = document.getElementById('copySuccessMessage');
    if (existingMessage) {
        existingMessage.remove();
    }

    const message = document.createElement('div');
    message.id = 'copySuccessMessage';
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 1.5rem 3rem;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        z-index: 10000;
        font-size: 1.1rem;
        font-weight: 600;
        text-align: center;
        animation: fadeInOut 2s ease-in-out;
    `;
    message.innerHTML = `
        <i class="fa fa-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
        Excel 형식으로 복사되었습니다!<br>
        <small style="font-size: 0.9rem; opacity: 0.9;">Excel에서 Ctrl+V로 붙여넣기하세요</small>
    `;

    if (!document.getElementById('copySuccessAnimation')) {
        const style = document.createElement('style');
        style.id = 'copySuccessAnimation';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -60%); }
                15% { opacity: 1; transform: translate(-50%, -50%); }
                85% { opacity: 1; transform: translate(-50%, -50%); }
                100% { opacity: 0; transform: translate(-50%, -40%); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(message);
    setTimeout(() => {
        message.remove();
    }, 2000);
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 1px;
        height: 1px;
        padding: 0;
        border: none;
        outline: none;
        boxShadow: none;
        background: transparent;
    `;
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccessMessage();
        } else {
            alert('클립보드 복사에 실패했습니다. 브라우저가 이 기능을 지원하지 않습니다.');
        }
    } catch (err) {
        console.error('Fallback 복사 실패:', err);
        alert('클립보드 복사에 실패했습니다.');
    }

    document.body.removeChild(textArea);
}

// 푸터 연도 업데이트
document.getElementById('current-year').textContent = new Date().getFullYear();