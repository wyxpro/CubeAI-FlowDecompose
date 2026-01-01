// ========== 配置 ==========
const API_BASE_URL = 'http://localhost:8000';

// ========== 状态管理 ==========
const state = {
    mode: 'learn',
    targetFile: null,
    userFile: null,
    targetFileURL: null,
    currentJobId: null,
    analysisResult: null,
    zoom: 1,
    isPlaying: false,
    duration: 0,
    isStreaming: false,
    streamingSegments: []
};

// ========== DOM元素 ==========
const elements = {
    // 模式切换
    navTabs: document.querySelectorAll('.nav-tab'),
    userVideoCard: document.getElementById('user-video-card'),
    
    // 文件上传
    targetUpload: document.getElementById('target-upload'),
    targetFile: document.getElementById('target-file'),
    userUpload: document.getElementById('user-upload'),
    userFile: document.getElementById('user-file'),
    
    // 选项
    fpsInput: document.getElementById('fps'),
    maxFramesInput: document.getElementById('max-frames'),
    showCamera: document.getElementById('show-camera'),
    showLighting: document.getElementById('show-lighting'),
    showColor: document.getElementById('show-color'),
    
    // 按钮
    btnAnalyze: document.getElementById('btn-analyze'),
    
    // 状态显示
    emptyState: document.getElementById('empty-state'),
    loadingState: document.getElementById('loading-state'),
    loadingProgress: document.getElementById('loading-progress'),
    progressFill: document.getElementById('progress-fill'),
    
    // 时间轴
    timelineContainer: document.getElementById('timeline-container'),
    timelineSubtitle: document.getElementById('timeline-subtitle'),
    timelineRuler: document.getElementById('timeline-ruler'),
    videoSegments: document.getElementById('video-segments'),
    cameraTrack: document.getElementById('camera-track'),
    lightingTrack: document.getElementById('lighting-track'),
    colorTrack: document.getElementById('color-track'),
    
    // 详情面板
    detailPanel: document.getElementById('detail-panel'),
    detailContent: document.getElementById('detail-content'),
    btnCloseDetail: document.getElementById('btn-close-detail')
};

// ========== 初始化 ==========
function init() {
    // 模式切换
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => handleModeSwitch(tab.dataset.mode));
    });
    
    // 文件上传
    setupFileUpload(elements.targetUpload, elements.targetFile, 'target');
    setupFileUpload(elements.userUpload, elements.userFile, 'user');
    
    // 开始分析按钮
    elements.btnAnalyze.addEventListener('click', handleAnalyze);
    
    // 详情面板关闭
    elements.btnCloseDetail.addEventListener('click', closeDetailPanel);
    
    // 导出按钮
    document.getElementById('btn-export').addEventListener('click', handleExport);
    
    // 测试播放头按钮
    const btnTestPlayhead = document.getElementById('btn-test-playhead');
    if (btnTestPlayhead) {
        btnTestPlayhead.addEventListener('click', () => {
            updatePlayheadPosition(50); // 测试50%位置
            alert('播放头已设置到50%位置，请检查轨道区域是否可见红色竖线');
        });
    }
    
    // 缩放按钮
    document.getElementById('btn-zoom-in').addEventListener('click', () => handleZoom(1.2));
    document.getElementById('btn-zoom-out').addEventListener('click', () => handleZoom(0.8));
    
    // 播放控制
    setupVideoPlayer();
    
    // 轨道显示/隐藏控制
    setupTrackVisibility();
    
    // 时间标尺点击跳转
    setupTimelineRulerClick();
    
    // 监听窗口调整大小，更新播放头位置
    window.addEventListener('resize', () => {
        const video = document.getElementById('preview-video');
        if (video && video.duration) {
            const currentTime = video.currentTime * 1000;
            const duration = video.duration * 1000;
            const progress = (currentTime / duration) * 100;
            updatePlayheadPosition(progress);
        }
    });
}

// ========== 模式切换 ==========
function handleModeSwitch(mode) {
    state.mode = mode;
    
    // 更新UI
    elements.navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // 显示/隐藏用户视频卡片
    elements.userVideoCard.style.display = mode === 'compare' ? 'block' : 'none';
    
    // 更新按钮状态
    updateAnalyzeButton();
}

// ========== 文件上传 ==========
function setupFileUpload(uploadArea, fileInput, type) {
    // 点击上传
    uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-remove')) {
            fileInput.click();
        }
    });
    
    // 文件选择
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file, type, uploadArea);
        }
    });
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--color-primary)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'var(--color-border)';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--color-border)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            handleFileSelect(file, type, uploadArea);
        }
    });
    
    // 移除文件
    const removeBtn = uploadArea.querySelector('.btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleFileRemove(type, uploadArea, fileInput);
        });
    }
}

function handleFileSelect(file, type, uploadArea) {
    if (type === 'target') {
        state.targetFile = file;
        // 创建视频URL用于预览
        if (state.targetFileURL) {
            URL.revokeObjectURL(state.targetFileURL);
        }
        state.targetFileURL = URL.createObjectURL(file);
    } else {
        state.userFile = file;
    }
    
    // 更新UI
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const fileInfo = uploadArea.querySelector('.file-info');
    const fileName = fileInfo.querySelector('.file-name');
    
    placeholder.style.display = 'none';
    fileInfo.style.display = 'flex';
    fileName.textContent = file.name;
    
    updateAnalyzeButton();
}

function handleFileRemove(type, uploadArea, fileInput) {
    if (type === 'target') {
        state.targetFile = null;
    } else {
        state.userFile = null;
    }
    
    fileInput.value = '';
    
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const fileInfo = uploadArea.querySelector('.file-info');
    
    placeholder.style.display = 'block';
    fileInfo.style.display = 'none';
    
    updateAnalyzeButton();
}

function updateAnalyzeButton() {
    const canAnalyze = state.targetFile && 
        (state.mode === 'learn' || state.userFile);
    elements.btnAnalyze.disabled = !canAnalyze;
}

// ========== 开始分析 ==========
async function handleAnalyze() {
    showLoading();
    
    try {
        // 创建Job
        const jobId = await createJob();
        state.currentJobId = jobId;
        
        // 轮询状态
        await pollJobStatus(jobId);
        
    } catch (error) {
        console.error('分析失败:', error);
        alert('分析失败: ' + error.message);
        showEmpty();
    }
}

async function createJob() {
    const formData = {
        mode: state.mode,
        target_video: {
            source: {
                type: 'file',
                path: state.targetFile.path || `/Users/tang/Documents/${state.targetFile.name}`
            }
        },
        options: {
            scene_detection: {
                use_cv: true,
                threshold: 27.0,
                min_scene_len: 15
            },
            frame_extract: {
                fps: parseFloat(elements.fpsInput.value),
                max_frames: parseInt(elements.maxFramesInput.value)
            },
            llm: {
                enabled_modules: ['camera_motion', 'lighting', 'color_grading']
            }
        }
    };
    
    if (state.mode === 'compare' && state.userFile) {
        formData.user_video = {
            source: {
                type: 'file',
                path: state.userFile.path || `/Users/tang/Documents/${state.userFile.name}`
            }
        };
    }
    
    const response = await fetch(`${API_BASE_URL}/v1/video-analysis/jobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
        throw new Error('创建Job失败');
    }
    
    const data = await response.json();
    return data.job_id;
}

async function pollJobStatus(jobId) {
    const maxAttempts = 120; // 最多2分钟
    let attempts = 0;
    let hasShownInitialTimeline = false;
    
    while (attempts < maxAttempts) {
        const response = await fetch(`${API_BASE_URL}/v1/video-analysis/jobs/${jobId}`);
        const data = await response.json();
        
        if (data.status === 'succeeded') {
            state.analysisResult = data.result;
            showTimeline(data.result, false); // 最终结果，不显示加载动画
            return;
        } else if (data.status === 'failed') {
            throw new Error(data.error.message);
        } else if (data.status === 'running') {
            updateProgress(data.progress);
            
            // 如果有部分结果，实时显示
            if (data.partial_result) {
                if (!hasShownInitialTimeline) {
                    // 第一次显示时间轴
                    showTimeline(data.partial_result, true); // 显示加载动画
                    hasShownInitialTimeline = true;
                } else {
                    // 更新已有的时间轴
                    updateTimeline(data.partial_result);
                }
            }
        }
        
        await sleep(1000);
        attempts++;
    }
    
    throw new Error('分析超时');
}

function updateProgress(progress) {
    const percent = progress.percent || 0;
    const message = progress.message || '处理中...';
    const stage = progress.stage || '';
    
    elements.loadingProgress.textContent = `${stage} ${Math.round(percent)}%`;
    elements.progressFill.style.width = `${percent}%`;
}

// ========== 显示时间轴 ==========
function showTimeline(result, isStreaming = false) {
    elements.emptyState.style.display = 'none';
    elements.loadingState.style.display = 'none';
    elements.timelineContainer.style.display = 'flex';
    
    const segments = result.target?.segments || [];
    const totalDuration = segments.length > 0 
        ? segments[segments.length - 1].end_ms 
        : 0;
    
    state.duration = totalDuration;
    state.isStreaming = isStreaming;
    state.streamingSegments = segments;
    
    // 更新标题
    const analyzingText = isStreaming ? ' (分析中...)' : '';
    elements.timelineSubtitle.textContent = 
        `${segments.length}个镜头 · ${(totalDuration / 1000).toFixed(1)}秒${analyzingText}`;
    
    // 加载视频到预览轨道
    loadVideoPreview();
    
    // 渲染时间标尺
    renderTimeRuler(totalDuration);
    
    // 渲染所有轨道（带加载状态）
    renderVideoSegments(segments, totalDuration, isStreaming);
    renderFeatureTrack(segments, totalDuration, 'camera_motion', elements.cameraTrack, isStreaming);
    renderFeatureTrack(segments, totalDuration, 'lighting', elements.lightingTrack, isStreaming);
    renderFeatureTrack(segments, totalDuration, 'color_grading', elements.colorTrack, isStreaming);
    
    // 根据复选框状态显示/隐藏轨道
    updateTrackVisibility();
    
    // 显示测试按钮
    const btnTestPlayhead = document.getElementById('btn-test-playhead');
    if (btnTestPlayhead) {
        btnTestPlayhead.style.display = 'inline-block';
    }
}

// ========== 更新时间轴 ==========
function updateTimeline(result) {
    const segments = result.target?.segments || [];
    const totalDuration = segments.length > 0 
        ? segments[segments.length - 1].end_ms 
        : 0;
    
    const isAnalyzing = result.target?.analyzing || false;
    state.isStreaming = isAnalyzing;
    state.streamingSegments = segments;
    
    // 更新标题
    const analyzingText = isAnalyzing ? ' (分析中...)' : '';
    elements.timelineSubtitle.textContent = 
        `${segments.length}个镜头 · ${(totalDuration / 1000).toFixed(1)}秒${analyzingText}`;
    
    // 更新轨道内容
    renderVideoSegments(segments, totalDuration, isAnalyzing);
    renderFeatureTrack(segments, totalDuration, 'camera_motion', elements.cameraTrack, isAnalyzing);
    renderFeatureTrack(segments, totalDuration, 'lighting', elements.lightingTrack, isAnalyzing);
    renderFeatureTrack(segments, totalDuration, 'color_grading', elements.colorTrack, isAnalyzing);
}

function renderTimeRuler(totalDuration) {
    const ruler = elements.timelineRuler;
    ruler.innerHTML = '';
    
    const intervals = 10;
    for (let i = 0; i <= intervals; i++) {
        const time = (totalDuration / intervals) * i;
        const mark = document.createElement('div');
        mark.style.position = 'absolute';
        mark.style.left = `${(i / intervals) * 100}%`;
        mark.style.height = '100%';
        mark.style.borderLeft = '1px solid var(--color-border)';
        mark.style.fontSize = '11px';
        mark.style.paddingLeft = '4px';
        mark.style.paddingTop = '4px';
        mark.style.color = 'var(--color-text-secondary)';
        mark.textContent = formatTime(time);
        ruler.appendChild(mark);
    }
}

function renderVideoSegments(segments, totalDuration, isStreaming = false) {
    const container = elements.videoSegments;
    container.innerHTML = '';
    
    segments.forEach(segment => {
        const analyzing = segment.analyzing || false;
        const div = createSegmentElement(
            segment,
            totalDuration,
            'video',
            segment.segment_id,
            `${(segment.duration_ms / 1000).toFixed(1)}s`,
            null,
            analyzing
        );
        
        // 点击视频segment显示完整分析
        if (!analyzing) {
            div.addEventListener('click', () => {
                console.log('点击segment:', segment);
                showSegmentDetail(segment);
            });
        }
        
        container.appendChild(div);
    });
}

function renderFeatureTrack(segments, totalDuration, category, container, isStreaming = false) {
    container.innerHTML = '';
    
    segments.forEach(segment => {
        const analyzing = segment.analyzing || false;
        const features = segment.features.filter(f => f.category === category);
        
        if (features.length > 0) {
            features.forEach(feature => {
                const div = createSegmentElement(
                    segment,
                    totalDuration,
                    getCategoryClass(category),
                    feature.type,
                    feature.value,
                    feature.confidence,
                    false
                );
                
                div.addEventListener('click', () => showFeatureDetail(feature, segment));
                container.appendChild(div);
            });
        } else if (analyzing) {
            // 显示加载占位符
            const div = createSegmentElement(
                segment,
                totalDuration,
                getCategoryClass(category) + ' analyzing',
                'analyzing',
                '分析中...',
                null,
                true
            );
            container.appendChild(div);
        }
    });
}

function createSegmentElement(segment, totalDuration, className, label, value, confidence = null, analyzing = false) {
    const div = document.createElement('div');
    div.className = `segment segment-${className}${analyzing ? ' segment-analyzing' : ''}`;
    
    const left = (segment.start_ms / totalDuration) * 100;
    const width = (segment.duration_ms / totalDuration) * 100;
    
    div.style.left = `${left}%`;
    div.style.width = `${width}%`;
    
    if (analyzing) {
        div.innerHTML = `
            <div class="segment-content">
                <div class="segment-value">
                    <span class="loading-spinner"></span>
                    ${value}
                </div>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="segment-content">
                <div class="segment-label">${label}</div>
                <div class="segment-value">${value}</div>
                ${confidence ? `<div class="segment-confidence">${(confidence * 100).toFixed(0)}%</div>` : ''}
            </div>
        `;
    }
    
    return div;
}

function getCategoryClass(category) {
    const map = {
        'camera_motion': 'camera',
        'lighting': 'lighting',
        'color_grading': 'color'
    };
    return map[category] || 'camera';
}

// ========== 详情面板 ==========
function showSegmentDetail(segment) {
    console.log('showSegmentDetail 被调用:', segment);
    
    if (!elements.detailPanel) {
        console.error('detailPanel 元素未找到');
        return;
    }
    
    elements.detailPanel.classList.add('open');
    
    // 聚焦到该segment
    focusOnSegment(segment);
    
    // 构建详细内容
    const cameraFeatures = segment.features?.filter(f => f.category === 'camera_motion') || [];
    const lightingFeatures = segment.features?.filter(f => f.category === 'lighting') || [];
    const colorFeatures = segment.features?.filter(f => f.category === 'color_grading') || [];
    
    console.log('特征数量:', {camera: cameraFeatures.length, lighting: lightingFeatures.length, color: colorFeatures.length});
    
    try {
        elements.detailContent.innerHTML = `
            <div class="detail-section">
                <h4 class="section-title">📹 镜头信息</h4>
                <div class="info-item">
                    <span class="info-label">片段ID</span>
                    <span class="info-value">${segment.segment_id}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">时间范围</span>
                    <span class="info-value">${formatTime(segment.start_ms)} - ${formatTime(segment.end_ms)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">时长</span>
                    <span class="info-value">${(segment.duration_ms / 1000).toFixed(2)}秒</span>
                </div>
            </div>
            
            ${cameraFeatures.length > 0 ? renderCameraAnalysis(cameraFeatures) : '<div class="detail-section"><p>无运镜特征</p></div>'}
            ${lightingFeatures.length > 0 ? renderLightingAnalysis(lightingFeatures) : '<div class="detail-section"><p>无光线特征</p></div>'}
            ${colorFeatures.length > 0 ? renderColorAnalysis(colorFeatures) : '<div class="detail-section"><p>无调色特征</p></div>'}
        `;
        console.log('详情内容已更新');
    } catch (error) {
        console.error('渲染详情内容时出错:', error);
        elements.detailContent.innerHTML = `
            <div class="detail-section">
                <p>加载详情时出错: ${error.message}</p>
            </div>
        `;
    }
}

function showFeatureDetail(feature, segment) {
    elements.detailPanel.classList.add('open');
    
    // 聚焦到该segment
    focusOnSegment(segment);
    
    elements.detailContent.innerHTML = `
        <div class="detail-section">
            <h4 class="section-title">📹 镜头信息</h4>
            <div class="info-item">
                <span class="info-label">片段ID</span>
                <span class="info-value">${segment.segment_id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">时间范围</span>
                <span class="info-value">${formatTime(segment.start_ms)} - ${formatTime(segment.end_ms)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h4 class="section-title">${getCategoryIcon(feature.category)} ${getCategoryName(feature.category)}特征</h4>
            ${renderFeatureDetail(feature)}
        </div>
    `;
}

function closeDetailPanel() {
    elements.detailPanel.classList.remove('open');
}

function getCategoryName(category) {
    const names = {
        'camera_motion': '运镜',
        'lighting': '光线',
        'color_grading': '调色'
    };
    return names[category] || category;
}

function getCategoryIcon(category) {
    const icons = {
        'camera_motion': '📹',
        'lighting': '💡',
        'color_grading': '🎨'
    };
    return icons[category] || '📌';
}

function focusOnSegment(segment) {
    // 让视频跳转到该segment的起始时间
    const video = document.getElementById('preview-video');
    if (video && video.duration) {
        video.currentTime = segment.start_ms / 1000;
        updatePlayheadPosition((segment.start_ms / state.duration) * 100);
    }
}

function renderCameraAnalysis(features) {
    console.log('renderCameraAnalysis 调用，特征数量:', features.length);
    
    let html = '<div class="detail-section"><h4 class="section-title">📹 运镜分析</h4>';
    
    features.forEach(f => {
        const detailed = f.detailed_description || {};
        
        html += `
            <div class="feature-card">
                <div class="feature-header">
                    <span class="feature-badge">${f.value}</span>
                    <span class="confidence-badge">${(f.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="feature-body">
                    ${detailed.summary ? `
                        <div class="feature-summary">${detailed.summary}</div>
                    ` : ''}
                    
                    ${detailed.technical_terms && detailed.technical_terms.length > 0 ? `
                        <div class="feature-terms">
                            <div class="terms-label">专业术语：</div>
                            <div class="terms-list">
                                ${detailed.technical_terms.map(term => `<span class="term-badge">${term}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${detailed.purpose ? `
                        <div class="feature-meaning">
                            <strong>镜头意义：</strong>${detailed.purpose}
                        </div>
                    ` : (typeof getMovementMeaning === 'function' ? `
                        <div class="feature-meaning">
                            ${getMovementMeaning(f.type) || ''}
                        </div>
                    ` : '')}
                    
                    ${detailed.parameters && Object.keys(detailed.parameters).length > 0 ? `
                        <div class="feature-params">
                            <div class="params-label">技术参数：</div>
                            ${Object.entries(detailed.parameters).map(([key, val]) => `
                                <div class="param-item">
                                    <span class="param-key">${key}:</span>
                                    <span class="param-value">${val}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderLightingAnalysis(features) {
    console.log('renderLightingAnalysis 调用，特征数量:', features.length);
    
    if (features.length === 0) {
        return '<div class="detail-section"><h4 class="section-title">💡 光线分析</h4><p>无光线特征</p></div>';
    }
    
    let html = '<div class="detail-section"><h4 class="section-title">💡 光线分析</h4>';
    
    features.forEach(f => {
        const detailed = f.detailed_description || {};
        
        html += `
            <div class="feature-card">
                <div class="feature-header">
                    <span class="feature-badge">${f.value}</span>
                    <span class="confidence-badge">${(f.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="feature-body">
                    ${detailed.summary ? `
                        <div class="feature-summary">${detailed.summary}</div>
                    ` : ''}
                    
                    ${detailed.technical_terms && detailed.technical_terms.length > 0 ? `
                        <div class="feature-terms">
                            <div class="terms-label">专业术语：</div>
                            <div class="terms-list">
                                ${detailed.technical_terms.map(term => `<span class="term-badge">${term}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${detailed.diagram ? `
                        <div class="lighting-diagram">
                            <div class="diagram-label">光路图：</div>
                            <div class="diagram-content">${detailed.diagram}</div>
                        </div>
                    ` : (typeof getLightingDiagram === 'function' ? getLightingDiagram(f.type) : '')}
                    
                    ${detailed.purpose ? `
                        <div class="feature-meaning">
                            <strong>光线效果：</strong>${detailed.purpose}
                        </div>
                    ` : (typeof getLightingMeaning === 'function' ? `
                        <div class="feature-meaning">
                            ${getLightingMeaning(f.type) || ''}
                        </div>
                    ` : '')}
                    
                    ${detailed.parameters && Object.keys(detailed.parameters).length > 0 ? `
                        <div class="feature-params">
                            <div class="params-label">光源配置：</div>
                            ${Object.entries(detailed.parameters).map(([key, val]) => `
                                <div class="param-item">
                                    <span class="param-key">${key}:</span>
                                    <span class="param-value">${val}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderColorAnalysis(features) {
    console.log('renderColorAnalysis 调用，特征数量:', features.length);
    
    if (features.length === 0) {
        return '<div class="detail-section"><h4 class="section-title">🎨 调色分析</h4><p>无调色特征</p></div>';
    }
    
    let html = '<div class="detail-section"><h4 class="section-title">🎨 调色分析</h4>';
    
    features.forEach(f => {
        const detailed = f.detailed_description || {};
        
        html += `
            <div class="feature-card">
                <div class="feature-header">
                    <span class="feature-badge">${f.value}</span>
                    <span class="confidence-badge">${(f.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="feature-body">
                    ${detailed.summary ? `
                        <div class="feature-summary">${detailed.summary}</div>
                    ` : ''}
                    
                    ${detailed.technical_terms && detailed.technical_terms.length > 0 ? `
                        <div class="feature-terms">
                            <div class="terms-label">专业术语：</div>
                            <div class="terms-list">
                                ${detailed.technical_terms.map(term => `<span class="term-badge">${term}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${detailed.purpose ? `
                        <div class="feature-meaning">
                            <strong>整体氛围：</strong>${detailed.purpose}
                        </div>
                    ` : (typeof getColorMeaning === 'function' ? `
                        <div class="feature-meaning">
                            ${getColorMeaning(f.type) || ''}
                        </div>
                    ` : '')}
                    
                    ${detailed.parameters && Object.keys(detailed.parameters).length > 0 ? `
                        <div class="feature-params color-params">
                            <div class="params-label">调色参数：</div>
                            ${Object.entries(detailed.parameters).map(([key, val]) => `
                                <div class="param-item">
                                    <span class="param-key">${key}:</span>
                                    <span class="param-value">${val}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : (typeof getColorParameters === 'function' ? getColorParameters(f.type) : '')}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderFeatureDetail(feature) {
    return `
        <div class="feature-card">
            <div class="feature-header">
                <span class="feature-badge">${feature.type}</span>
                <span class="confidence-badge">${(feature.confidence * 100).toFixed(0)}%</span>
            </div>
            <div class="feature-body">
                <div class="feature-value">${feature.value}</div>
                <div class="feature-meaning">
                    ${getFeatureMeaning(feature.category, feature.type)}
                </div>
            </div>
        </div>
    `;
}

function getFeatureMeaning(category, type) {
    if (category === 'camera_motion') {
        return getShotMeaning(type) || getMovementMeaning(type) || getAngleMeaning(type);
    } else if (category === 'lighting') {
        return getLightingMeaning(type);
    } else if (category === 'color_grading') {
        return getColorMeaning(type);
    }
    return '';
}

// ========== 导出结果 ==========
function handleExport() {
    if (!state.analysisResult) return;
    
    const dataStr = JSON.stringify(state.analysisResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis_${state.currentJobId}.json`;
    link.click();
}

// ========== 缩放 ==========
function handleZoom(factor) {
    state.zoom *= factor;
    state.zoom = Math.max(0.5, Math.min(state.zoom, 3));
    // TODO: 实现时间轴缩放
}

// ========== 工具函数 ==========
function showEmpty() {
    elements.emptyState.style.display = 'flex';
    elements.loadingState.style.display = 'none';
    elements.timelineContainer.style.display = 'none';
}

function showLoading() {
    elements.emptyState.style.display = 'none';
    elements.loadingState.style.display = 'flex';
    elements.timelineContainer.style.display = 'none';
    elements.progressFill.style.width = '0%';
}

function formatTime(ms) {
    const seconds = ms / 1000;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== 视频播放器 ==========
function setupVideoPlayer() {
    const video = document.getElementById('preview-video');
    const btnPlay = document.getElementById('btn-play');
    const timeDisplay = document.getElementById('time-display');
    const timeTotal = document.getElementById('time-total');
    const playbackSlider = document.getElementById('playback-slider');
    const playbackProgress = document.getElementById('playback-progress');
    const playbackHandle = document.getElementById('playback-handle');
    const playhead = document.getElementById('playhead');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnToggleVideo = document.getElementById('btn-toggle-video');
    const videoPreviewContent = document.getElementById('video-preview-content');
    
    // 播放/暂停
    btnPlay.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            btnPlay.textContent = '⏸';
            state.isPlaying = true;
        } else {
            video.pause();
            btnPlay.textContent = '▶';
            state.isPlaying = false;
        }
    });
    
    // 视频时间更新
    video.addEventListener('timeupdate', () => {
        const currentTime = video.currentTime * 1000; // 转换为毫秒
        const duration = video.duration * 1000;
        
        // 更新时间显示
        timeDisplay.textContent = formatTime(currentTime);
        
        // 更新进度条
        const progress = (currentTime / duration) * 100;
        playbackProgress.style.width = `${progress}%`;
        playbackHandle.style.left = `${progress}%`;
        
        // 更新播放头位置
        if (playhead && !isNaN(progress)) {
            updatePlayheadPosition(progress);
            console.log('更新播放头:', progress.toFixed(2) + '%');
        }
    });
    
    // 视频加载完成
    video.addEventListener('loadedmetadata', () => {
        const duration = video.duration * 1000;
        timeTotal.textContent = formatTime(duration);
        state.duration = duration;
        
        // 初始化播放头位置
        updatePlayheadPosition(0);
        console.log('视频加载完成，初始化播放头');
    });
    
    // 视频结束
    video.addEventListener('ended', () => {
        btnPlay.textContent = '▶';
        state.isPlaying = false;
    });
    
    // 进度条点击
    playbackSlider.addEventListener('click', (e) => {
        const rect = playbackSlider.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = (video.duration * percent);
    });
    
    // 进度条拖拽
    let isDragging = false;
    playbackHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = playbackSlider.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        
        video.currentTime = video.duration * percent;
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // 全屏
    btnFullscreen.addEventListener('click', () => {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        }
    });
    
    // 显示/隐藏视频
    btnToggleVideo.addEventListener('click', () => {
        if (videoPreviewContent.style.display === 'none') {
            videoPreviewContent.style.display = 'flex';
            btnToggleVideo.textContent = '👁️';
        } else {
            videoPreviewContent.style.display = 'none';
            btnToggleVideo.textContent = '👁️‍🗨️';
        }
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                btnPlay.click();
                break;
            case 'ArrowLeft':
                video.currentTime = Math.max(0, video.currentTime - 1);
                break;
            case 'ArrowRight':
                video.currentTime = Math.min(video.duration, video.currentTime + 1);
                break;
            case 'KeyF':
                btnFullscreen.click();
                break;
        }
    });
}

function loadVideoPreview() {
    const video = document.getElementById('preview-video');
    if (state.targetFileURL) {
        video.src = state.targetFileURL;
        video.load();
    }
}

function updatePlayheadPosition(progress) {
    const playhead = document.getElementById('playhead');
    const tracksContainer = document.getElementById('tracks-container');
    
    if (!playhead || !tracksContainer) {
        console.log('播放头元素未找到', {playhead: !!playhead, container: !!tracksContainer});
        return;
    }
    
    // 获取轨道容器的宽度（减去padding和轨道标题宽度）
    const containerRect = tracksContainer.getBoundingClientRect();
    const trackHeaderWidth = 120; // 轨道标题宽度
    const padding = 16; // padding
    const trackContentWidth = containerRect.width - trackHeaderWidth - padding * 2;
    
    // 计算播放头的位置（相对于轨道容器）
    // 基准位置是轨道标题宽度 + padding
    const baseLeft = trackHeaderWidth + padding;
    const offsetLeft = (trackContentWidth * progress / 100);
    const playheadLeft = baseLeft + offsetLeft;
    
    console.log('播放头位置:', {
        progress: progress.toFixed(2),
        trackContentWidth,
        playheadLeft: playheadLeft.toFixed(2)
    });
    
    playhead.style.left = `${playheadLeft}px`;
    playhead.style.display = 'block';
}

// ========== 轨道显示控制 ==========
function setupTrackVisibility() {
    // 为每个复选框添加事件监听
    elements.showCamera.addEventListener('change', updateTrackVisibility);
    elements.showLighting.addEventListener('change', updateTrackVisibility);
    elements.showColor.addEventListener('change', updateTrackVisibility);
    
    // 注意：不在这里调用 updateTrackVisibility()
    // 因为轨道还没有渲染，会在 showTimeline() 中调用
}

// ========== 时间标尺点击跳转 ==========
function setupTimelineRulerClick() {
    const timelineRuler = document.getElementById('timeline-ruler');
    const tracksContainer = document.getElementById('tracks-container');
    const video = document.getElementById('preview-video');
    
    if (!timelineRuler) return;
    
    // 给时间标尺和轨道容器都添加点击事件
    [timelineRuler, tracksContainer].forEach(element => {
        if (!element) return;
        
        element.addEventListener('click', (e) => {
            if (!video || !video.duration) return;
            
            // 如果点击的是轨道标题区域，忽略
            if (e.target.closest('.track-header')) return;
            
            // 计算点击位置对应的时间
            const rect = element.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            
            // 减去左侧轨道标题宽度和padding
            const trackHeaderWidth = 120;
            const padding = 16;
            const adjustedClickX = clickX - trackHeaderWidth - padding;
            const trackContentWidth = rect.width - trackHeaderWidth - padding * 2;
            
            if (adjustedClickX < 0) return; // 点击在标题区域
            
            const progress = Math.max(0, Math.min(1, adjustedClickX / trackContentWidth));
            const targetTime = progress * video.duration;
            
            // 跳转到指定时间
            video.currentTime = Math.max(0, Math.min(targetTime, video.duration));
            
            // 立即更新播放头位置
            updatePlayheadPosition(progress * 100);
        });
    });
}

function updateTrackVisibility() {
    // 获取轨道元素（.track）
    const cameraTrack = elements.cameraTrack.closest('.track');
    const lightingTrack = elements.lightingTrack.closest('.track');
    const colorTrack = elements.colorTrack.closest('.track');
    
    // 根据复选框状态显示/隐藏轨道
    if (cameraTrack) {
        cameraTrack.style.display = elements.showCamera.checked ? 'flex' : 'none';
    }
    if (lightingTrack) {
        lightingTrack.style.display = elements.showLighting.checked ? 'flex' : 'none';
    }
    if (colorTrack) {
        colorTrack.style.display = elements.showColor.checked ? 'flex' : 'none';
    }
    
    console.log('轨道显示状态更新:', {
        camera: elements.showCamera.checked,
        lighting: elements.showLighting.checked,
        color: elements.showColor.checked
    });
}

// ========== 启动 ==========
console.log('App.js 加载完成');
console.log('feature-meanings.js 函数检查:', {
    getShotMeaning: typeof getShotMeaning,
    getMovementMeaning: typeof getMovementMeaning,
    getAngleMeaning: typeof getAngleMeaning,
    getLightingMeaning: typeof getLightingMeaning,
    getColorMeaning: typeof getColorMeaning
});

init();

