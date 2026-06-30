import os

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://wpgateway_user:wpgateway_password@localhost:5432/wpgateway_db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    JWT_SECRET: str = os.getenv("JWT_SECRET", "wpgateway_super_secret_key_12345")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours
    
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Internal Node.js WhatsApp Microservice URL
    WHATSAPP_SERVICE_URL: str = os.getenv("WHATSAPP_SERVICE_URL", "http://whatsapp_service:3000")

settings = Settings()
