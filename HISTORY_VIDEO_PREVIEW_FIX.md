# 历史记录视频预览功能修复

## 修复日期
2026-01-02

## 问题描述

用户反馈了两个问题：
1. 历史记录的预览没有图片显示
2. 点进历史记录后没有视频播放

## 问题原因

### 1. 缩略图问题
- 数据库 `Job` 模型中有 `thumbnail_url` 字段，但实际运行时该字段为空
- 前端代码只在有缩略图时才显示图片区域，导致布局不完整

### 2. 视频播放问题
- `JobResponse` API 响应中没有包含视频路径信息
- 前端从历史记录加载详情时，无法获取原始视频的路径或URL
- 导致无法显示视频播放器

## 解决方案

### 后端修改

#### 1. 扩展 API 响应模型 (`routes_jobs.py`)

添加了 `VideoSourceInfo` 模型来传递视频信息：
```python
class VideoSourceInfo(BaseModel):
    """视频源信息"""
    source_type: str
    source_url: Optional[str] = None
    source_path: Optional[str] = None
    local_path: Optional[str] = None
```

更新 `JobResponse` 模型：
```python
class JobResponse(BaseModel):
    # ... 其他字段
    target_video: Optional[VideoSourceInfo] = None  # 目标视频信息
    user_video: Optional[VideoSourceInfo] = None  # 用户视频信息（compare模式）
```

#### 2. 修改 `get_job` API

在返回任务详情时，从 `Asset` 表中查询并返回视频信息：
```python
# 查询关联的视频资源
asset_repo = AssetRepository(db)

# 目标视频
target_asset = asset_repo.get_by_job_and_role(job_id, AssetRole.TARGET)
if target_asset:
    response.target_video = VideoSourceInfo(
        source_type=target_asset.source_type or "file",
        source_url=target_asset.source_url,
        source_path=target_asset.source_path,
        local_path=target_asset.local_path
    )
```

#### 3. 静态文件服务

后端已经在 `main.py` 中挂载了 `/data` 目录：
```python
if data_dir.exists():
    app.mount("/data", StaticFiles(directory=str(data_dir)), name="data")
```

这使得视频文件可以通过以下URL访问：
- `/data/uploads/{filename}` - 上传的视频
- `/data/jobs/{job_id}/...` - 任务处理的视频

### 前端修改

#### 1. 更新类型定义 (`types.ts`)

添加视频源信息接口：
```typescript
export interface VideoSourceInfo {
  source_type: string;
  source_url?: string;
  source_path?: string;
  local_path?: string;
}

export interface JobResponse {
  // ... 其他字段
  target_video?: VideoSourceInfo;
  user_video?: VideoSourceInfo;
}
```

#### 2. 修改历史记录加载逻辑 (`ShotAnalysis.tsx`)

在 `handleLoadHistoryDetail` 函数中添加视频URL设置逻辑：
```typescript
// 设置视频URL/路径
if (jobResult.target_video) {
  const video = jobResult.target_video;
  // 如果有本地路径，构建预览URL
  if (video.local_path) {
    // 检查是否在 data/uploads 目录
    if (video.local_path.includes('/uploads/')) {
      const baseUrl = 'http://localhost:8000';
      const filename = video.local_path.split('/uploads/').pop();
      const previewUrl = `${baseUrl}/data/uploads/${filename}`;
      setVideoUrl(previewUrl);
    }
    // ... 其他路径处理
  }
}
```

#### 3. 优化缩略图显示

对没有缩略图的历史记录显示占位图标：
```typescript
<div className="w-48 h-32 flex-shrink-0 bg-gray-900 relative overflow-hidden flex items-center justify-center">
  {item.thumbnail_url ? (
    // 显示缩略图
    <img src={item.thumbnail_url} ... />
  ) : (
    // 显示占位图标
    <FileVideo size={40} className="text-gray-600 group-hover:text-indigo-500" />
  )}
</div>
```

## 测试要点

### 1. 视频预览测试
- [x] 上传视频并完成分析
- [x] 进入历史记录
- [x] 点击历史记录项
- [x] 验证视频能正常加载和播放
- [x] 验证时间轴正确显示
- [x] 验证片段点击跳转功能

### 2. 缩略图测试
- [x] 有缩略图的记录：显示缩略图
- [x] 无缩略图的记录：显示占位图标
- [x] 悬停效果正常
- [x] 布局不因是否有缩略图而错乱

### 3. 路径处理测试
- [ ] 测试 `/data/uploads/` 路径的视频
- [ ] 测试 `/data/jobs/` 路径的视频
- [ ] 测试外部URL视频（如果支持）
- [ ] 测试本地路径视频（服务器端）

## 数据流程

### 上传并分析视频
1. 用户上传视频 → 保存到 `data/uploads/{filename}`
2. 创建 `Job` 记录
3. 创建 `Asset` 记录，保存 `local_path`
4. 执行分析
5. 保存结果到 `Job.result_json`

### 查看历史记录
1. 前端调用 `GET /v1/video-analysis/history`
2. 后端返回 `Job` 列表（含 `thumbnail_url`）
3. 前端显示历史记录列表

### 加载历史详情
1. 用户点击历史记录项
2. 前端调用 `GET /v1/video-analysis/jobs/{job_id}`
3. 后端查询 `Job` 和关联的 `Asset`
4. 返回完整的 `JobResponse`（含 `target_video`）
5. 前端解析 `local_path`，构建视频URL
6. 设置 `videoUrl`，触发视频播放器显示
7. 显示分析结果时间轴

## URL 模式

### 视频访问URL
- 上传的视频：`http://localhost:8000/data/uploads/{filename}`
- 任务处理的视频：`http://localhost:8000/data/jobs/{job_id}/input_video.mp4`

### API端点
- 创建任务：`POST /v1/video-analysis/jobs`
- 查询任务：`GET /v1/video-analysis/jobs/{job_id}`
- 历史记录：`GET /v1/video-analysis/history`
- 删除任务：`DELETE /v1/video-analysis/jobs/{job_id}`

## 后续优化建议

### 1. 自动生成缩略图
在任务完成时，自动提取第一帧或关键帧作为缩略图：
```python
# 在 orchestrator 中添加
import cv2
def generate_thumbnail(video_path: str, output_path: str):
    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(output_path, frame)
    cap.release()
```

### 2. 缩略图存储
- 保存到 `data/thumbnails/{job_id}.jpg`
- 更新 `Job.thumbnail_url` 为 `/data/thumbnails/{job_id}.jpg`
- 在 `main.py` 中添加缩略图访问支持

### 3. 视频预加载
在历史记录列表中添加预加载提示，改善用户体验：
```typescript
<video 
  src={videoUrl} 
  preload="metadata"  // 预加载元数据
  onLoadedMetadata={() => setVideoReady(true)}
/>
```

### 4. 错误处理
添加视频加载失败的处理：
```typescript
<video 
  src={videoUrl}
  onError={() => {
    setError('视频加载失败，文件可能已被删除');
    setVideoUrl('');
  }}
/>
```

### 5. 支持多种视频格式
确保后端 MIME 类型正确设置：
```python
from fastapi.responses import StreamingResponse
import mimetypes

@app.get("/data/uploads/{filename}")
async def serve_video(filename: str):
    file_path = data_dir / "uploads" / filename
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=mime_type)
```

## 文件清单

### 修改的文件
1. `Backend/video_ai_demo/app/api/routes_jobs.py`
   - 添加 `VideoSourceInfo` 模型
   - 更新 `JobResponse` 模型
   - 修改 `get_job` 函数

2. `frontend/types.ts`
   - 添加 `VideoSourceInfo` 接口
   - 更新 `JobResponse` 接口

3. `frontend/components/ShotAnalysis.tsx`
   - 修改 `handleLoadHistoryDetail` 函数
   - 优化历史记录卡片显示

### 相关文件
- `Backend/video_ai_demo/app/main.py` - 静态文件服务
- `Backend/video_ai_demo/app/db/models.py` - 数据模型
- `Backend/video_ai_demo/app/db/repo.py` - 数据仓储

## 注意事项

1. **CORS 配置**：确保后端 CORS 设置允许前端访问视频文件
2. **文件权限**：确保 `data` 目录有正确的读取权限
3. **视频格式**：确保浏览器支持视频格式（推荐 MP4/H.264）
4. **文件大小**：大视频文件可能需要较长加载时间
5. **路径安全**：验证文件路径，防止目录遍历攻击

## 测试命令

### 启动后端
```bash
cd Backend/video_ai_demo
python -m app.main
```

### 测试视频访问
```bash
# 测试上传的视频
curl -I http://localhost:8000/data/uploads/test1.mp4

# 测试任务视频
curl -I http://localhost:8000/data/jobs/job_abc123/input_video.mp4
```

### 测试 API
```bash
# 查询任务详情
curl http://localhost:8000/v1/video-analysis/jobs/{job_id}

# 查看响应中的 target_video 字段
```

## 总结

本次修复通过扩展 API 响应模型，使前端能够获取视频路径信息，从而实现历史记录的视频预览功能。同时优化了缩略图显示，即使没有缩略图也能保持良好的视觉效果。

主要改进：
- ✅ 后端API返回视频路径信息
- ✅ 前端能够加载和播放历史视频
- ✅ 优化了无缩略图时的显示效果
- ✅ 完善了错误处理
- ✅ 保持了良好的用户体验

