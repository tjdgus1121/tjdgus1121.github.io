# app.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64
import os
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

app = Flask(__name__)
CORS(app)  # 모든 도메인 허용

# 1. 모델 로드 (서버 시작 시 최초 1회만)
model = None
model_path = 'mnist_model.h5'

def load_or_create_model():
    """
    mnist_model.h5 파일이 존재하면 로드하고, 없으면 임시 모델을 생성합니다.
    """
    global model
    if os.path.exists(model_path):
        try:
            # 모델 로드 시 compile=False로 로드 후 명시적으로 컴파일
            model = tf.keras.models.load_model(model_path, compile=False)
            # 모델 로드 후 컴파일 설정 (피드백 학습에 필요한 설정)
            model.compile(optimizer='adam',
                          loss='categorical_crossentropy', # One-Hot 라벨에 맞춤
                          metrics=['accuracy'])
            print(f"모델 로드 성공 및 재컴파일 완료: {model_path}")
        except Exception as e:
            print(f"모델 로드 또는 재컴파일 실패 ({model_path}): {e}")
            print("모델 파일이 손상되었거나 호환되지 않을 수 있습니다. 임시 모델을 생성합니다.")
            model = create_simple_model() # 에러 시 임시 모델 생성
    else:
        print(f"모델 파일 찾을 수 없음: {model_path}")
        print("임시 모델을 생성합니다. 학습이 필요합니다.")
        model = create_simple_model() # 파일 없을 시 임시 모델 생성

def create_simple_model():
    """
    모델 파일이 없을 때 사용하는 임시 모델 (실제 사용 시에는 학습된 모델로 교체해야 함).
    """
    print("임시 모델 생성 중...")
    temp_model = tf.keras.models.Sequential([
        tf.keras.layers.Input((28, 28, 1)),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dense(10, activation='softmax')
    ])
    # 임시 모델도 컴파일 필요 (fit/predict 호출 가능하도록)
    temp_model.compile(optimizer='adam',
                       loss='categorical_crossentropy', # <-- 이 부분을 수정했습니다!
                       metrics=['accuracy'])
    print("임시 모델 생성 완료.")
    return temp_model

# 서버 시작 시 모델 로드 또는 생성 시도
load_or_create_model()

# 2. 이미지 전처리 함수
def preprocess_image(image_b64):
    """
    Base64 문자열 이미지 데이터를 28x28 numpy 배열로 전처리.
    """
    if not isinstance(image_b64, str):
        print("preprocess_image: 입력이 base64 문자열이 아닙니다.")
        return None

    try:
        # base64 디코딩
        image_bytes = base64.b64decode(image_b64)
        # 이미지 열기 및 흑백 변환
        image = Image.open(io.BytesIO(image_bytes)).convert('L')
    except Exception as e:
        print(f"preprocess_image: 이미지 디코딩 또는 열기 중 오류 발생: {e}")
        return None

    try:
        # 크기 조정 및 numpy 배열 변환
        image = image.resize((28, 28))
        img_array = np.array(image)
        # 배경 흰색(255), 글씨 검은색(0) -> 모델 입력(0-1)에 맞게 변환 (보통 배경 0, 글씨 1)
        img_array = 255 - img_array # 색 반전
        img_array = img_array / 255.0 # 0-1 범위로 정규화
        # CNN 모델 입력 형태 [배치_크기, 높이, 너비, 채널] 에 맞게 변환
        img_array = img_array.reshape(1, 28, 28, 1)
    except Exception as e:
        print(f"preprocess_image: 이미지 처리 중 오류 발생: {e}")
        return None

    return img_array

# 3. 예측 API
@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        print("/predict: 모델이 로드되지 않았습니다.")
        return jsonify({'error': 'Model not loaded'}), 503 # Service Unavailable

    data = request.get_json()
    if not data or 'image' not in data:
        print("/predict: 이미지 데이터 누락")
        return jsonify({'error': 'No image data provided'}), 400

    image_b64 = data['image']
    img_array = preprocess_image(image_b64)

    if img_array is None:
        print("/predict: 이미지 전처리 실패")
        return jsonify({'error': 'Image preprocessing failed'}), 500

    try:
        # 모델 예측 수행
        preds = model.predict(img_array) # [1, 10] 형태의 numpy 배열 반환
        preds_list = preds[0].tolist() # 첫 번째 배치 결과 (실제로는 1개)를 리스트로 변환
        pred_digit = int(np.argmax(preds[0])) # 확률이 가장 높은 클래스 선택

        print(f"/predict: 예측 완료 -> 숫자: {pred_digit}, 확률: {preds_list}")

        return jsonify({'result': pred_digit, 'probs': preds_list})

    except Exception as e:
        print(f"/predict: 예측 중 오류 발생: {e}")
        # 오류 발생 시 디버깅을 위해 img_array 형태 출력
        print(f"/predict: 에러 발생 시 img_array 형태: {img_array.shape if img_array is not None else 'None'}")
        return jsonify({'error': 'Prediction failed', 'details': str(e)}), 500 # 오류 상세 정보 포함

# 4. 피드백 API (모델 추가 학습)
@app.route('/feedback', methods=['POST'])
def feedback():
    if model is None:
        print("/feedback: 모델이 로드되지 않았습니다.")
        return jsonify({'error': 'Model not loaded'}), 503 # Service Unavailable

    data = request.get_json()
    # 'label' 키의 존재 여부와 값 유효성 검사 강화
    if not data or 'image' not in data or 'label' not in data or not isinstance(data['label'], (int, str)):
         print("/feedback: 잘못된 피드백 데이터 형식")
         return jsonify({'error': 'Invalid feedback data provided. Requires "image" (base64) and "label" (int/str)'}), 400

    try:
        # 레이블을 정수형으로 변환 (클라이언트에서 문자열로 보낼 수도 있으므로)
        label = int(data['label'])
        if label < 0 or label > 9:
            print(f"/feedback: 유효하지 않은 레이블 값: {label}")
            return jsonify({'error': 'Label must be between 0 and 9'}), 400
    except ValueError:
        print(f"/feedback: 레이블을 숫자로 변환할 수 없습니다: {data['label']}")
        return jsonify({'error': 'Label must be a valid integer'}), 400


    image_b64 = data['image']
    img_array = preprocess_image(image_b64)

    if img_array is None:
        print("/feedback: 이미지 전처리 실패")
        return jsonify({'error': 'Image preprocessing failed for feedback'}), 500

    try:
        # 레이블을 one-hot 인코딩 (tf.keras.utils.to_categorical 사용)
        y_onehot = tf.keras.utils.to_categorical([label], num_classes=10)
        y_tensor = tf.constant(y_onehot, dtype=tf.float32) # NumPy 배열을 텐서플로우 텐서로 변환
        img_tensor = tf.constant(img_array, dtype=tf.float32) # NumPy 배열을 텐서플로우 텐서로 변환

    except Exception as e:
        print(f"/feedback: 레이블 또는 이미지 텐서 변환 중 오류 발생: {e}")
        return jsonify({'error': 'Label or image tensor conversion failed', 'details': str(e)}), 500


    try:
        # 모델 추가 학습 (1 에포크)
        print(f"/feedback: 피드백 학습 시작: 레이블 {label}")
        # img_tensor와 y_tensor는 이미 텐서플로우 텐서입니다.
        history = model.fit(img_tensor, y_tensor, epochs=1, verbose=0) # verbose=0으로 학습 과정 출력 비활성화
        print("/feedback: 피드백 학습 완료")
        print(f"/feedback: 학습 결과 - Loss: {history.history['loss'][0]:.4f}") # 학습 결과 간단히 로그

        # 학습된 모델 저장
        try:
            model.save(model_path)
            print(f"/feedback: 모델 저장 성공: {model_path}")
        except Exception as save_e:
            print(f"/feedback: 모델 저장 실패 ({model_path}): {save_e}")
            # 파일 쓰기 권한 문제일 수 있습니다. Render 설정 확인 필요.
            print("경고: 모델이 업데이트되었지만 파일로 저장되지 않았습니다. 다음 재시작 시 변경 사항이 유실될 수 있습니다.")


        return jsonify({'message': f'모델이 피드백({label})을 반영해 추가 학습했습니다!'})

    except Exception as e:
        print(f"/feedback: 피드백 학습 중 오류 발생: {e}")
        return jsonify({'error': 'Feedback learning failed', 'details': str(e)}), 500


# 5. 루트 경로 (선택 사항)
@app.route('/')
def home():
    """
    서버 상태 확인을 위한 간단한 루트 페이지.
    """
    status = "실행 중" if model else "모델 로드 실패 또는 로딩 중"
    return f'MNIST AI 서버 상태: {status}'


if __name__ == '__main__':
    # Render는 PORT 환경변수를 사용합니다. 로컬 테스트 시 기본값 10000 사용.
    port = int(os.environ.get('PORT', 10000))
    # 개발 서버 경고 제거 및 프로덕션 WSGI 서버 권장 메시지 추가는 Render 로그에서 자동으로 처리됨
    print(f"==> Flask 앱 실행 시작: http://0.0.0.0:{port}")
    # debug=True는 개발 시 유용하지만, 프로덕션 환경에서는 비활성화해야 합니다.
    app.run(host='0.0.0.0', port=port, debug=False)