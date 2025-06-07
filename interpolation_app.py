from flask import Flask, request, jsonify
import base64
import io
from PIL import Image
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from basicsr.utils.download_util import load_file_from_url
from basicsr.utils.registry import ARCH_REGISTRY

app = Flask(__name__)

# ESRGAN 모델 로드
model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32)
model_url = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
model_path = load_file_from_url(model_url, model_dir='weights')
model.load_state_dict(torch.load(model_path, map_location='cpu'))
model.eval()

@app.route('/upscale_esrgan', methods=['POST'])
def upscale_esrgan():
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': '이미지 데이터가 없습니다.'}), 400

        # Base64 이미지 데이터 디코딩
        image_data = base64.b64decode(data['image'].split(',')[1])
        image = Image.open(io.BytesIO(image_data))

        # 이미지 업스케일링
        with torch.no_grad():
            input_tensor = torch.from_numpy(np.array(image)).permute(2, 0, 1).unsqueeze(0).float() / 255.0
            output_tensor = model(input_tensor)
            output_image = (output_tensor.squeeze().permute(1, 2, 0).numpy() * 255).astype(np.uint8)
            output_image = Image.fromarray(output_image)

        # 업스케일된 이미지를 Base64로 인코딩
        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return jsonify({'upscaled_image': f'data:image/png;base64,{img_str}'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)