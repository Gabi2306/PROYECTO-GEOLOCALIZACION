import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'tu-clave-secreta-super-segura-2025')
    
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'geotrack_db')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    
    ALERT_SPEED_THRESHOLD = 15
    ALERT_INACTIVE_TIME = 3600
    GPS_UPDATE_INTERVAL = 30