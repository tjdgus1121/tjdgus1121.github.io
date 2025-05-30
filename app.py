from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
from PIL import Image
import io
import base64

app = Flask(__name__)
model = tf.keras.models.load_model('mnist_model.h5')  # 사전 학습된 모델 파일 필요

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    img_b64 = data['image']
    img_bytes = base64.b64decode(img_b64)
    img = Image.open(io.BytesIO(img_bytes)).convert('L').resize((28, 28))
    arr = np.array(img).reshape(1, 28, 28, 1) / 255.0
    pred = model.predict(arr)[0]
    return jsonify({'result': int(np.argmax(pred)), 'probs': [float(x) for x in pred]})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)