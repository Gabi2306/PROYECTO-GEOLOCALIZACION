import pymysql
from config import Config

def get_db_connection():
    return pymysql.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        port=Config.DB_PORT,
        cursorclass=pymysql.cursors.DictCursor
    )

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, params or ())
            
            if fetch_one:
                return cursor.fetchone()
            elif fetch_all:
                return cursor.fetchall()
            else:
                connection.commit()
                return cursor.lastrowid
    finally:
        connection.close()