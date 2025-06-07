from flask import Flask, request, jsonify
import base64
import io
from PIL import Image
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
# from basicsr.utils.download_util import load_file_from_url
# from basicsr.utils.registry import ARCH_REGISTRY
from flask_cors import CORS
import os
import numpy as np

app = Flask(__name__)
CORS(app)

# ESRGAN 모델 로드 (로컬 파일 사용)
try:
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32)
    model_path = 'weights/RealESRGAN_x4plus.pth' # 로컬 모델 파일 경로
    model.load_state_dict(torch.load(model_path, map_location='cpu'))
    model.eval()
    print("Real-ESRGAN 모델이 로컬 파일에서 성공적으로 로드되었습니다.")
except Exception as e:
    print(f"Real-ESRGAN 모델 로드 중 오류 발생: {e}")
    model = None # 모델 로드 실패 시 None으로 설정

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({'message': 'pong'}), 200

@app.route('/upscale_esrgan', methods=['POST'])
def upscale_esrgan():
    if model is None: # 모델이 로드되지 않았다면 오류 반환
        return jsonify({'error': 'AI 모델이 서버에서 로드되지 않았습니다.'}), 500
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': '이미지 데이터가 없습니다.'}), 400

        # Base64 이미지 데이터 디코딩
        image_data = base64.b64decode(data['image'].split(',')[1])
        # PIL Image로 변환 (RGB로 강제 변환하여 4채널 이미지 문제 방지)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        # 이미지 업스케일링
        with torch.no_grad():
            # NumPy 배열로 변환 후 PyTorch Tensor로 변환 및 정규화
            img_np = np.array(image).astype(np.float32) / 255.0
            # (H, W, C) -> (C, H, W)로 변환하고 배치 차원 추가
            input_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0)

            output_tensor = model(input_tensor)

            # (N, C, H, W) -> (H, W, C)로 변환하고 0-255 범위로 재정규화 후 NumPy 배열로
            output_image_np = (output_tensor.squeeze(0).permute(1, 2, 0).clamp(0, 1).numpy() * 255).astype(np.uint8)
            output_image = Image.fromarray(output_image_np)

        # 업스케일된 이미지를 Base64로 인코딩
        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return jsonify({'upscaled_image': f'data:image/png;base64,{img_str}'})

    except Exception as e:
        print(f"ESRGAN 업스케일링 중 오류 발생: {e}")
        return jsonify({'error': f'ESRGAN 업스케일링 중 오류가 발생했습니다: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)