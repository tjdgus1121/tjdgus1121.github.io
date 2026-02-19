// Image Upscaling Web Worker
// 이미지 업스케일링 처리를 백그라운드에서 수행

function performUpscaling(originalData, scaledData, interpolation) {
    const srcWidth = originalData.width;
    const srcHeight = originalData.height;
    const dstWidth = scaledData.width;
    const dstHeight = scaledData.height;
    const scaleX = srcWidth / dstWidth;
    const scaleY = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            const srcX = x * scaleX;
            const srcY = y * scaleY;
            let r, g, b, a;

            switch (interpolation) {
                case 'nearest':
                    [r, g, b, a] = nearestNeighbor(originalData, srcX, srcY);
                    break;
                case 'bilinear':
                    [r, g, b, a] = bilinearInterpolation(originalData, srcX, srcY);
                    break;
                case 'bicubic':
                    [r, g, b, a] = bicubicInterpolation(originalData, srcX, srcY);
                    break;
            }

            const index = (y * dstWidth + x) * 4;
            scaledData.data[index] = r;
            scaledData.data[index + 1] = g;
            scaledData.data[index + 2] = b;
            scaledData.data[index + 3] = a;
        }

        // 진행률 업데이트 (10줄마다)
        if (y % 10 === 0) {
            const progress = Math.round((y / dstHeight) * 100);
            self.postMessage({ type: 'progress', progress: progress });
        }
    }
}

function nearestNeighbor(imageData, x, y) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    return getPixel(imageData, ix, iy);
}

function bilinearInterpolation(imageData, x, y) {
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = x1 + 1;
    const y2 = y1 + 1;
    const dx = x - x1;
    const dy = y - y1;

    const p11 = getPixel(imageData, x1, y1);
    const p12 = getPixel(imageData, x1, y2);
    const p21 = getPixel(imageData, x2, y1);
    const p22 = getPixel(imageData, x2, y2);

    const result = [];
    for (let i = 0; i < 4; i++) {
        const top = p11[i] * (1 - dx) + p21[i] * dx;
        const bottom = p12[i] * (1 - dx) + p22[i] * dx;
        result[i] = Math.round(top * (1 - dy) + bottom * dy);
    }
    return result;
}

function bicubicInterpolation(imageData, x, y) {
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const dx = x - x1;
    const dy = y - y1;

    const result = [];
    for (let i = 0; i < 4; i++) {
        let value = 0;
        for (let m = -1; m <= 2; m++) {
            for (let n = -1; n <= 2; n++) {
                const pixel = getPixel(imageData, x1 + n, y1 + m);
                const weight = cubicWeight(dx - n) * cubicWeight(dy - m);
                value += pixel[i] * weight;
            }
        }
        result[i] = Math.max(0, Math.min(255, Math.round(value)));
    }
    return result;
}

function cubicWeight(t) {
    const a = -0.5;
    const absT = Math.abs(t);
    if (absT <= 1) {
        return (a + 2) * absT * absT * absT - (a + 3) * absT * absT + 1;
    } else if (absT <= 2) {
        return a * absT * absT * absT - 5 * a * absT * absT + 8 * a * absT - 4 * a;
    }
    return 0;
}

function getPixel(imageData, x, y) {
    x = Math.max(0, Math.min(imageData.width - 1, x));
    y = Math.max(0, Math.min(imageData.height - 1, y));
    const index = (y * imageData.width + x) * 4;
    return [
        imageData.data[index],
        imageData.data[index + 1],
        imageData.data[index + 2],
        imageData.data[index + 3]
    ];
}

// Worker 메시지 핸들러
self.onmessage = function(e) {
    const { imageData, scale, interpolation } = e.data;
    const dstWidth = Math.floor(imageData.width * scale);
    const dstHeight = Math.floor(imageData.height * scale);
    const scaledData = new ImageData(dstWidth, dstHeight);

    performUpscaling(imageData, scaledData, interpolation);

    // 완료된 이미지 데이터 전송 (명시적 구조로 전송)
    self.postMessage({
        type: 'complete',
        data: scaledData.data.buffer,
        width: scaledData.width,
        height: scaledData.height
    }, [scaledData.data.buffer]); // Transferable object로 성능 향상
};
