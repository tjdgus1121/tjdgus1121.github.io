# 예측과 최적화

홈페이지 `../index.html`의 「예측과 최적화」 카드 → `index.html` → `경사하강법/index.html` 순서로 접속합니다. 사이트 전체를 정적 서버 또는 GitHub Pages에서 열면 됩니다. 폴더 이름의 공백은 링크에서 `%20`으로 표기할 수 있습니다.

## 수록 활동

| 경사하강법 폴더 안의 경로 | 용도 | 기존 위치 |
|---|---|---|
| `gradient_descent_lab.html` | 추세선·예측·오차·제곱오차·MSE·AI 추세선 비교의 7단계 실습 | `02_해설모션/gradient_descent_lab.html` |
| `gradient_descent_slope.html` | `y=ax`의 손실 곡선, 기울기, 학습률과 반복 학습 | `02_해설모션/gradient_descent_slope.html` |
| `squared-error.html` | 양수·음수 오차의 상쇄와 오차제곱 보충 실습 | `01_수업사이트/text_mining/squared-error.html` |
| `gradient-descent-motion/index.html` | 경사하강법 계산 과정의 모션 해설 | `02_해설모션/gradient-descent-motion/index.html` |
| `loss-excel-motion/index.html` | 엑셀 계산 → 손실함수 → 최솟값의 모션 해설 | `02_해설모션/loss-excel-motion/index.html` |

핵심 실습은 추세선과 오차 → 기울기 하나로 배우는 경사하강법 순서입니다. 두 파일은 상대 링크와 데이터 전달용 URL 해시를 사용하므로 같은 폴더에 둡니다. 이전 실습 위치에는 검색 매개변수와 해시를 보존하는 이동 페이지를 남겼습니다.

`squared-error.html`은 기존 KaTeX CDN과 Firebase 수업방 기능을 포함합니다. 이번 정리는 파일 위치와 메뉴 연결을 바꾸며, 해당 서비스 설정은 기존 파일 그대로입니다.

## 원본과 재생성

조립용 소스와 영상 제작 파일은 배포 폴더에 넣지 않고 기존 해설 폴더에 유지합니다. 아래 명령은 작업공간 루트 `C:\artificial-intelligence`에서 실행합니다.

```powershell
node "02_해설모션/_src/katex-single-file/assemble-guided.cjs"
node "02_해설모션/_src/katex-single-file/assemble-slope.cjs"
python "02_해설모션/gradient-descent-motion/build.py"
python "02_해설모션/loss-excel-motion/build.py"
node "02_해설모션/_src/katex-single-file/slope-check.cjs"
```

두 조립 스크립트는 이 폴더의 실제 실습 파일에 출력합니다. 두 모션 빌드는 해설 폴더의 완성본과 이 폴더의 배포본을 함께 갱신합니다. 별도 원본인 루트 `gradient-descent-lab`은 이전 최소제곱 준비 앱이어서 현재 실습과 중복 수록하지 않았습니다. `06_작업용/test`의 실험본과 백업 파일도 수업 목록에서 제외했습니다.

## GitHub Pages 반영

자세한 파일 구성과 확인 순서는 [이 폴더의 배포방법](배포방법.md)을 참고합니다.

기존 홈페이지에 `index.html`, `sitemap.xml`과 이 「예측과 최적화」 폴더 전체를 함께 반영합니다. 홈페이지의 다른 카드와 기존 활동 파일도 계속 유지합니다. 이 작업공간의 사이트 폴더는 Git 저장소와 연결되어 있지 않으므로 로컬 수정만으로 공개 사이트가 갱신되지는 않습니다.
