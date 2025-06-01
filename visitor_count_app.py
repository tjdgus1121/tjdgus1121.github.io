# app.py
import sqlite3
import os
import datetime # 날짜/시간 처리를 위해 임포트
from flask import Flask, jsonify, request, current_app, _app_ctx_stack
from flask_cors import CORS # Cross-Origin Resource Sharing 허용을 위해 필요

app = Flask(__name__)
CORS(app) # 모든 Origin에서의 요청을 허용합니다. (필요에 따라 보안 강화 필요)

# 데이터베이스 파일 경로 설정
# Render에서는 환경 변수를 사용하여 데이터베이스 파일 경로를 설정하는 것이 좋습니다.
# 여기서는 예시로 'visitors.db' 파일을 사용합니다.
DATABASE = 'visitors.db'

def get_db():
    """데이터베이스 연결을 얻거나 새로 생성합니다."""
    # 요청 컨텍스트에 연결된 g 객체를 통해 데이터베이스 연결을 저장하고 가져옵니다.
    # _app_ctx_stack.top.g 는 current_app.g 와 동일
    db = getattr(_app_ctx_stack.top, '_database', None)
    if db is None:
        # DATABASE 환경 변수가 설정되어 있으면 해당 경로 사용
        db_path = os.environ.get('DATABASE_PATH', DATABASE)
        # check_same_thread=False 옵션은 SQLite가 여러 스레드에서 사용될 때 발생할 수 있는 문제를 방지합니다.
        # Flask와 Gunicorn 환경에서는 필요할 수 있습니다.
        db = _app_ctx_stack.top._database = sqlite3.connect(db_path, check_same_thread=False)
        # 결과 행을 딕셔너리처럼 접근할 수 있도록 설정
        db.row_factory = sqlite3.Row
        print("데이터베이스 연결 생성됨.") # 디버깅을 위해 추가
    return db

@app.teardown_appcontext
def close_db(error):
    """애플리케이션 컨텍스트 종료 시 데이터베이스 연결을 닫습니다."""
    # _app_ctx_stack.top 에서 g 객체에 접근하여 데이터베이스 연결 닫기
    db = getattr(_app_ctx_stack.top, '_database', None)
    if db is not None:
        db.close()
        print("데이터베이스 연결 종료됨.") # 디버깅을 위해 추가

def init_db():
    """데이터베이스 테이블이 없으면 생성합니다."""
    with app.app_context():
        db = get_db()
        # 'visits' 테이블 생성: timestamp 컬럼에 방문 시간 기록
        db.execute('''
            CREATE TABLE IF NOT EXISTS visits (
                timestamp TEXT NOT NULL
            )
        ''')
        db.commit()
    print("데이터베이스 초기화 완료 또는 이미 존재합니다.")


# 초기화 함수는 CLI 명령어로 만들겠습니다. Render 빌드 시 실행하기 위함입니다.
import click
from flask.cli import with_appcontext

@click.command('init-db')
@with_appcontext
def init_db_command():
    """데이터베이스 테이블을 생성합니다."""
    init_db()
    click.echo('Initialized the database.')

app.cli.add_command(init_db_command)


# 방문자 수를 증가시키고 현재 총 방문자 수 및 오늘 방문자 수를 반환하는 엔드포인트
@app.route('/count', methods=['GET'])
def visitor_count():
    """
    GET 요청 시 방문 기록을 추가하고 현재 총 방문자 수 및 오늘 방문자 수를 반환합니다.
    """
    print("'/count' 엔드포인트 호출됨") # 디버깅을 위해 추가
    db = get_db() # 요청 컨텍스트 안에서 호출되므로 'g' (또는 _app_ctx_stack.top.g) 사용 가능
    cursor = db.cursor()

    try:
        # 1. 현재 UTC 시간 기록 (Render 서버는 UTC를 사용할 가능성이 높음)
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        timestamp_str = now_utc.isoformat() # ISO 8601 형식 문자열로 저장

        # 2. visits 테이블에 방문 기록 삽입
        cursor.execute('INSERT INTO visits (timestamp) VALUES (?)', (timestamp_str,))
        db.commit() # 변경사항 커밋

        # 3. 총 방문자 수 계산 (visits 테이블의 전체 레코드 수)
        cursor.execute('SELECT COUNT(*) FROM visits')
        total_count = cursor.fetchone()[0]

        # 4. 오늘 방문자 수 계산 (오늘 00:00:00 UTC 이후의 레코드 수)
        # 오늘 00:00:00 UTC 타임스탬프 계산
        today_start_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_timestamp_str = today_start_utc.isoformat()

        cursor.execute('SELECT COUNT(*) FROM visits WHERE timestamp >= ?', (today_start_timestamp_str,))
        today_count = cursor.fetchone()[0]

        # 응답 데이터 (JSON 형식) - 오늘 방문자 수 추가
        response_data = {
            'today_visitors': today_count,
            'total_visitors': total_count,
            'message': 'Visitor count incremented successfully.'
        }
        print(f"오늘 방문자 수: {today_count}, 총 방문자 수: {total_count}") # 디버깅을 위해 추가
        return jsonify(response_data), 200

    except Exception as e:
        db.rollback() # 오류 발생 시 롤백
        print(f"데이터베이스 오류: {e}")
        return jsonify({'error': 'Failed to update visitor count', 'details': str(e)}), 500

# 서버 상태 확인을 위한 기본 엔드포인트 (선택 사항)
@app.route('/')
def index():
    print("기본 '/' 엔드포인트 호출됨") # 디버깅을 위해 추가
    return "Visitor Counter Backend is running!"

# 이 부분은 로컬에서 실행할 때 사용합니다.
# Render에서는 Gunicorn과 같은 WSGI 서버를 사용하여 실행합니다.
# if __name__ == '__main__':
#     # 로컬 개발 환경을 위해 데이터베이스 초기화 및 앱 실행
#     init_db() # 로컬에서 실행 시 DB 파일 생성 및 초기화
#     app.run(debug=True) # debug=True는 개발 중에만 사용하세요.