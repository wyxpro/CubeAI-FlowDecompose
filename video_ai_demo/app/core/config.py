"""核心配置模块"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional
import os


class Settings(BaseSettings):
    """应用配置"""
    
    # 多模态LLM配置
    mm_llm_base_url: str = "https://www.sophnet.com/api/open-apis/v1"
    mm_llm_api_key: str = ""
    mm_llm_model: str = "Qwen2.5-VL-7B-Instruct"
    
    # 图生视频配置
    img2video_base_url: Optional[str] = None
    img2video_api_key: Optional[str] = None
    img2video_model: Optional[str] = None
    
    # 数据存储
    data_dir: Path = Path("./data")
    sqlite_path: str = "./data/demo.db"
    
    # FFmpeg
    ffmpeg_bin: str = "ffmpeg"
    ffprobe_bin: str = "ffprobe"
    
    # 服务配置
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    class Config:
        case_sensitive = False
        extra = "ignore"


# 尝试加载配置，如果.env文件无法访问则使用环境变量或默认值
try:
    if os.path.exists(".env") and os.access(".env", os.R_OK):
        # 可以读取.env文件
        Settings.Config.env_file = ".env"
        Settings.Config.env_file_encoding = "utf-8"
    settings = Settings()
except Exception as e:
    # .env文件访问失败，仅使用环境变量和默认值
    settings = Settings()

# 确保数据目录存在
settings.data_dir.mkdir(parents=True, exist_ok=True)

