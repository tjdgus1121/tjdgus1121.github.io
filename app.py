from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64

app = Flask(__name__)
CORS(app)  # 모든 도메인 허용

# 1. 모델 로드 (최초 1회만)
model = tf.keras.models.load_model('mnist_model.h5')  # 모델 파일명에 맞게 수정

# 2. 이미지 전처리 함수
def preprocess_image(image_b64):
    # base64 디코딩
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert('L')  # 흑백
    image = image.resize((28, 28))
    img_array = np.array(image)
    img_array = 255 - img_array  # 흰 배경/검은 글씨로 맞추기
    img_array = img_array / 255.0
    img_array = img_array.reshape(1, 28, 28, 1)
    return img_array

# 3. 예측 API
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    image_b64 = data['image']
    img_array = preprocess_image(image_b64)
    preds = model.predict(img_array)[0]
    pred_digit = int(np.argmax(preds))
    return jsonify({'result': pred_digit, 'probs': preds.tolist()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)