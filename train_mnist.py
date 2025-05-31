import tensorflow as tf
from tensorflow.keras.datasets import mnist
from tensorflow.keras import layers, models

print("==> MNIST 학습 스크립트 시작")

# 1. 데이터 불러오기 및 전처리
print("-> 데이터 로드 및 전처리 중...")
(x_train, y_train), (x_test, y_test) = mnist.load_data()
# 이미지를 0-1 범위로 정규화
x_train = x_train / 255.0
x_test = x_test / 255.0
# CNN 모델에 맞게 채널 차원 추가
x_train = x_train[..., tf.newaxis]
x_test = x_test[..., tf.newaxis]
print("-> 데이터 전처리 완료")

# 2. 더 좋은 CNN 모델 정의 (예시, 필요시 복잡성 추가 가능)
print("-> 모델 정의 중...")
model = models.Sequential([
    layers.Input((28, 28, 1)),
    layers.Conv2D(32, 3, activation='relu', padding='same'),
    layers.BatchNormalization(),
    layers.Conv2D(32, 3, activation='relu', padding='same'),
    layers.BatchNormalization(),
    layers.MaxPooling2D(),
    layers.Dropout(0.25),

    layers.Conv2D(64, 3, activation='relu', padding='same'),
    layers.BatchNormalization(),
    layers.Conv2D(64, 3, activation='relu', padding='same'),
    layers.BatchNormalization(),
    layers.MaxPooling2D(),
    layers.Dropout(0.25),

    layers.Flatten(),
    layers.Dense(128, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.5), # 과적합 방지 위해 더 높은 드롭아웃
    layers.Dense(10, activation='softmax')
])
print("-> 모델 정의 완료")

# 3. 모델 컴파일
print("-> 모델 컴파일 중...")
model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy',
              metrics=['accuracy'])
print("-> 모델 컴파일 완료")

# 4. 모델 학습
print("-> 모델 학습 시작...")
# Validation set을 사용하여 학습 과정 모니터링
history = model.fit(x_train, y_train,
                    epochs=10, # 에포크 수 증가
                    batch_size=128,
                    validation_data=(x_test, y_test)) # 테스트 데이터로 검증
print("-> 모델 학습 완료")

# 5. 모델 평가 (선택 사항)
print("-> 모델 평가 중...")
loss, acc = model.evaluate(x_test, y_test, verbose=0)
print(f"-> 테스트 데이터셋 정확도: {acc*100:.2f}%")
print("-> 모델 평가 완료")

# 6. 학습된 모델 파일로 저장
model_filename = 'mnist_model.h5'
print(f"-> 모델 저장 중: {model_filename}")
model.save(model_filename)
print(f"==> 모델 저장 완료: {model_filename}")

print("==> MNIST 학습 스크립트 종료")