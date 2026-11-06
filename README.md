# 이미지 수학 수업 사이트

2026-10-30에 실제 활동 파일 37개를 주제별 폴더로 정리했습니다. 시작 페이지는 기존 `index.html`, 이미지 단원 모음은 `indeximage.html`입니다. 홈페이지와 각 활동의 메뉴는 새 경로를 사용합니다.

| 폴더 | 활동 수 | 수업 내용 |
|---|---:|---|
| [01_이미지와_RGB](01_이미지와_RGB/index.html) | 9 | 픽셀·행렬 추출, RGB 탐구·퀴즈, 채널, RGB 엑셀 |
| [02_행렬과_이미지변환](02_행렬과_이미지변환/index.html) | 6 | 이미지 합성, 블렌딩, 행렬 곱셈, 회전 |
| [03_숫자인식과_유사도](03_숫자인식과_유사도/index.html) | 4 | MNIST, 인식 단계, 데이터셋, 해밍 거리 |
| [04_이미지확대와_복원](04_이미지확대와_복원/index.html) | 3 | 보간법, 확대·축소, Real-ESRGAN |
| [05_객체탐지_YOLO](05_객체탐지_YOLO/index.html) | 2 | 객체 탐지 체험, 직접 라벨링·학습 |
| [06_스타일전이](06_스타일전이/index.html) | 2 | 지정 화풍·임의 화풍 변환 |
| [07_CNN과_합성곱](07_CNN과_합성곱/index.html) | 7 | 커널 필터, CNN 시각화, 인식, 배경 제거 |
| [08_색군집화](08_색군집화/index.html) | 1 | K-means·SVD 이미지 탐구 |
| [09_기초연습](09_기초연습/index.html) | 3 | 이진법 게임·연습, 엑셀 기초 |
| [예측과 최적화](예측과%20최적화/index.html) | 기존 구성 유지 | 경사하강법 실습과 해설 |

## 수정할 파일

앞으로는 **주제 폴더 안의 HTML·JS**를 수정합니다. 같은 이름이 여러 곳에 보이는 혼동을 줄이기 위해 루트의 기존 주소용 연결 HTML 39개는 삭제했습니다. 실제 활동 주소는 주제 폴더 안의 경로입니다. 폴더별 `index.html`은 각 주제의 목록이므로 유지합니다.

현재 작업하던 YOLO 학습 실험실은 [05_객체탐지_YOLO/activity14_yolo_lab.html](05_객체탐지_YOLO/activity14_yolo_lab.html)입니다. 화면·그래프·학습 머리·워커 JS도 같은 폴더에 있습니다. 샘플은 `samples/`, 배포용 ZIP은 `downloads/`, 예시 사진은 `images/`에 있습니다.

## 자료와 공용 파일

- `assets/home/`: 홈페이지 썸네일과 대표 이미지. 현재 메인 카드의 대표 이미지 4장은 `gallery-v2/*-v2.webp`입니다. 생성 프롬프트·원본 기록은 [PROMPTS.md](assets/home/gallery-v2/PROMPTS.md)에 있습니다.
- `assets/branding/`: 공용 브랜드 이미지
- `assets/samples/`: 여러 단원에서 함께 쓰는 예시 이미지. `pixels/`에는 숫자·행렬 변환의 작은 픽셀 이미지가 있습니다.
- `assets/interpolation/`: 보간 실습용 기존 샘플
- `04_이미지확대와_복원/samples/realesrgan/`: 복원 실습 샘플
- `05_객체탐지_YOLO/samples/`: YOLO 학습 샘플과 `labels.json`
- `models/`, `model/`, `onnx_models/`: 공용 모델. 고정 모델 주소와의 호환 때문에 기존 폴더명을 유지했습니다. Real-ESRGAN 모델은 `models/super-resolution/`에 있습니다.
- 루트의 `nav.js`, `nav.css`, `backguard.js`, `quiz-theme.css`, `stylefooter.css`, `favicon.ico`, `thumbnail.png`: 공용 UI·기존 공개 이미지 주소
- `docs/notes/`: 과거 작업 메모
- `tests/`, `firebase/`: 로컬 검사·Firebase 개발 자료

## 로컬 실행과 업로드

메인 배경은 사용자 요청으로 변경 전 별 애니메이션을 복원했습니다. 이후 카드 디자인을 수정할 때 `skyLayer`·`starField`·`createStarHero`와 관련 배경 스타일은 유지합니다. `tests/home-background-baseline.json`과 캐러셀 검사에서 원본 일치를 확인합니다.

정적 HTTP 서버 또는 VS Code Live Server에서 **사이트 루트의 `index.html`**을 엽니다. Worker·모델·샘플 요청이 있어 `file://` 직접 실행보다 HTTP 서버를 사용합니다.

9개 주제 폴더, 기존 ‘예측과 최적화’, 이미지·모델·공용 파일을 함께 배포합니다. 이미 게시한 사이트를 갱신할 때는 루트의 옛 연결 HTML 39개도 게시 원본에서 삭제하고, 배포 완료 후 삭제가 반영됐는지 확인합니다. 예전 루트 주소로 된 외부 링크·북마크는 새 주제 주소로 바꿉니다. `tests/`, `firebase/tests/node_modules/`, 디버그 로그와 작업 메모는 수업 페이지 실행에 필요하지 않은 개발 자료입니다. Firebase 규칙 배포는 정적 사이트 업로드와 별개입니다.

로컬 정리 작업만 수행했으며 공개 사이트에는 배포하지 않았습니다. 외부 CDN·실제 모델 추론·Firebase 서버 동작은 이번 파일 정리 검증의 범위가 아닙니다.

## 배포 안내

[전체 배포방법](배포방법.md)에 GitHub Pages 최초 배포, 부분 업데이트, 모델 파일 업로드와 배포 후 확인 절차를 정리했습니다. 각 주제 폴더의 `배포방법.md`에는 해당 활동의 필수 파일과 확인 항목이 있습니다. [Firebase 규칙 배포](firebase/배포방법.md)는 정적 사이트 배포와 별도로 진행합니다.

## 검사와 원본

```powershell
python tests/verify-organization.py
node tests/verify-site-scripts.cjs
node --test tests/activity12-alignment.test.cjs
```

- [폴더 정리 기록](docs/폴더정리-2026-10-30.md)
- [파일 이동표](tests/site-organization.json), [검사 결과](tests/site-organization-check.json)
- 원본 텍스트 백업: 작업공간의 `99_보관/image-math-site-before-topic-sort-20261030-212020/`

백업과 검사 결과는 이전 버전을 복원하거나 파일의 최종 위치를 확인하기 위한 개발 자료입니다.
