# app.py
import sqlite3
import os
from flask import Flask, jsonify, request
from flask_cors import CORS # Cross-Origin Resource Sharing 허용을 위해 필요

app = Flask(__name__)
CORS(app) # 모든 Origin에서의 요청을 허용합니다. (필요에 따라 보안 강화 필요)

# 데이터베이스 파일 경로 설정
# Render에서는 환경 변수를 사용하여 데이터베이스 파일 경로를 설정하는 것이 좋습니다.
# 여기서는 예시로 'visitors.db' 파일을 사용합니다.
DATABASE = 'visitors.db'

def get_db():
    """데이터베이스 연결을 얻거나 새로 생성합니다."""
    db = getattr(g, '_database', None)
    if db is None:
        # DATABASE 환경 변수가 설정되어 있으면 해당 경로 사용
        db_path = os.environ.get('DATABASE_PATH', DATABASE)
        db = g._database = sqlite3.connect(db_path)
        # 결과 행을 딕셔너리처럼 접근할 수 있도록 설정
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(error):
    """애플리케이션 컨텍스트 종료 시 데이터베이스 연결을 닫습니다."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    """데이터베이스 테이블이 없으면 생성합니다."""
    with app.app_context():
        db = get_db()
        # 'counts' 테이블 생성: name(카운트 종류, 예: 'total'), value(값)
        db.execute('''
            CREATE TABLE IF NOT EXISTS counts (
                name TEXT PRIMARY KEY,
                value INTEGER NOT NULL DEFAULT 0
            )
        ''')
        # 'total' 카운트 항목이 없으면 0으로 초기화
        db.execute('INSERT OR IGNORE INTO counts (name, value) VALUES (?, ?)', ('total', 0))
        db.commit()
    print("데이터베이스 초기화 완료 또는 이미 존재합니다.")

# 애플리케이션 시작 시 데이터베이스 초기화
# Render 배포 시에는 Entrypoint 스크립트 등에서 호출하는 것이 더 안정적일 수 있습니다.
# 여기서는 간단하게 앱 시작 시 호출하도록 합니다.
# (주의: 여러 워커가 실행되는 환경에서는 경쟁 조건이 발생할 수 있으므로,
# 프로덕션 환경에서는 데이터베이스 마이그레이션 도구를 사용하는 것이 권장됩니다.)
# 일단 개발/간단 배포용으로 이렇게 진행합니다.
# Render 환경에서 초기화 스크립트를 따로 만드는 것을 추천합니다. (예: init_db.sh)

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


# 방문자 수를 증가시키고 현재 총 방문자 수를 반환하는 엔드포인트
@app.route('/count', methods=['GET'])
def visitor_count():
    """
    GET 요청 시 방문자 수를 증가시키고 현재 총 방문자 수를 반환합니다.
    동일 클라이언트의 짧은 시간 내 반복 요청은 카운트하지 않도록 로직 추가 필요 (TODO)
    현재는 모든 GET 요청마다 1씩 증가합니다.
    """
    db = get_db()
    cursor = db.cursor()

    try:
        # 'total' 카운트 값을 1 증가시키고 가져오기
        cursor.execute('UPDATE counts SET value = value + 1 WHERE name = ?', ('total',))
        db.commit() # 변경사항 커밋

        cursor.execute('SELECT value FROM counts WHERE name = ?', ('total',))
        total_count = cursor.fetchone()['value']

        # 응답 데이터 (JSON 형식)
        response_data = {
            'total_visitors': total_count,
            'message': 'Visitor count incremented successfully.'
        }
        return jsonify(response_data), 200

    except Exception as e:
        db.rollback() # 오류 발생 시 롤백
        print(f"데이터베이스 오류: {e}")
        return jsonify({'error': 'Failed to update visitor count', 'details': str(e)}), 500

# 서버 상태 확인을 위한 기본 엔드포인트 (선택 사항)
@app.route('/')
def index():
    return "Visitor Counter Backend is running!"

# 이 부분은 로컬에서 실행할 때 사용합니다.
# Render에서는 Gunicorn과 같은 WSGI 서버를 사용하여 실행합니다.
# if __name__ == '__main__':
#     # 로컬 개발 환경을 위해 데이터베이스 초기화 및 앱 실행
#     init_db() # 로컬에서 실행 시 DB 파일 생성 및 초기화
#     app.run(debug=True) # debug=True는 개발 중에만 사용하세요.