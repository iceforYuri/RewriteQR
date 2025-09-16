/**
 * 二维码分析工具 JavaScript
 * 功能：批量读取二维码图片，解析内容，进行详细对比分析
 */

class QRAnalyzer {
    constructor() {
        this.qrData = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('qr-files');
        const analyzeBtn = document.getElementById('analyze-btn');
        const statusArea = document.getElementById('status-area');

        analyzeBtn.addEventListener('click', () => {
            const files = fileInput.files;
            if (files.length === 0) {
                this.showStatus('请先选择至少一个二维码图片文件', 'warning');
                return;
            }
            this.analyzeFiles(Array.from(files));
        });
    }

    async analyzeFiles(files) {
        this.showStatus('正在分析二维码，请稍候...', 'warning');
        this.qrData = [];
        const resultsArea = document.getElementById('results-area');
        resultsArea.innerHTML = '';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.showStatus(`正在处理第 ${i + 1}/${files.length} 个文件: ${file.name}`, 'warning');
            
            try {
                const imageDataUrl = await this.readFileAsync(file);
                const qrContent = await this.decodeQRCode(imageDataUrl);
                
                if (qrContent) {
                    const parsedData = this.parseQRContent(qrContent, file.name);
                    this.qrData.push(parsedData);
                } else {
                    this.qrData.push({
                        fileName: file.name,
                        error: '无法识别二维码内容',
                        rawContent: null,
                        params: {}
                    });
                }
            } catch (error) {
                this.qrData.push({
                    fileName: file.name,
                    error: error.message,
                    rawContent: null,
                    params: {}
                });
            }
        }

        this.displayResults();
        this.showStatus(`分析完成！共处理 ${files.length} 个文件，识别成功 ${this.qrData.filter(d => !d.error).length} 个`, 'success');
    }

    readFileAsync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    decodeQRCode(imageDataUrl) {
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = "Anonymous";
            image.src = imageDataUrl;

            image.onload = () => {
                // 对大尺寸图片缩放，保持性能
                const maxSize = 1024;
                let scale = 1;
                if (image.width > maxSize || image.height > maxSize) {
                    scale = Math.min(maxSize / image.width, maxSize / image.height);
                }

                const canvas = document.createElement('canvas');
                canvas.width = image.width * scale;
                canvas.height = image.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, canvas.width, canvas.height);
                    resolve(code ? code.data : null);
                } catch (err) {
                    resolve(null);
                }
            };

            image.onerror = () => resolve(null);
        });
    }

    parseQRContent(content, fileName) {
        const result = {
            fileName: fileName,
            rawContent: content,
            params: {},
            error: null
        };

        // 解析URL参数
        try {
            if (content.includes('?')) {
                const urlParts = content.split('?');
                const paramString = urlParts[1];
                const params = new URLSearchParams(paramString);
                
                for (const [key, value] of params) {
                    result.params[key] = value;
                }
            } else if (content.includes('=')) {
                // 处理简单的key=value格式
                const pairs = content.split('&');
                for (const pair of pairs) {
                    if (pair.includes('=')) {
                        const [key, value] = pair.split('=', 2);
                        result.params[decodeURIComponent(key)] = decodeURIComponent(value);
                    }
                }
            }

            // 特别解析时间相关参数
            if (result.params.createTime) {
                result.parsedTime = this.parseTimeString(result.params.createTime);
            }

        } catch (error) {
            result.error = `参数解析失败: ${error.message}`;
        }

        return result;
    }

    parseTimeString(timeString) {
        try {
            // 处理不同的时间格式
            const cleanTime = timeString.replace(/[TZ]/g, ' ').trim();
            const date = new Date(cleanTime);
            
            if (isNaN(date.getTime())) {
                return {
                    original: timeString,
                    parsed: null,
                    error: '无法解析时间格式'
                };
            }

            return {
                original: timeString,
                parsed: date,
                formatted: date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                timestamp: date.getTime()
            };
        } catch (error) {
            return {
                original: timeString,
                parsed: null,
                error: error.message
            };
        }
    }

    displayResults() {
        const resultsArea = document.getElementById('results-area');
        
        // 显示各个二维码的详细信息
        const individualResults = this.createIndividualResults();
        
        // 显示对比分析
        const comparisonResults = this.createComparisonResults();
        
        resultsArea.innerHTML = individualResults + comparisonResults;
    }

    createIndividualResults() {
        let html = '<div class="results"><h2>📋 各二维码详细信息</h2>';
        
        this.qrData.forEach((data, index) => {
            html += `
                <div class="qr-item">
                    <h3>🏷️ ${data.fileName}</h3>
                    
                    ${data.error ? 
                        `<div class="status error">❌ ${data.error}</div>` : 
                        `<div class="status success">✅ 识别成功</div>`
                    }
                    
                    ${data.rawContent ? `
                        <div class="qr-content">
                            <strong>原始内容：</strong><br>
                            ${this.escapeHtml(data.rawContent)}
                        </div>
                        
                        <div class="qr-params">
                            ${Object.keys(data.params).length > 0 ? 
                                Object.entries(data.params).map(([key, value]) => `
                                    <div class="param-item">
                                        <div class="param-key">${key}</div>
                                        <div class="param-value">${this.escapeHtml(value)}</div>
                                        ${key === 'createTime' && data.parsedTime ? `
                                            <div style="font-size: 11px; color: #666; margin-top: 5px;">
                                                📅 ${data.parsedTime.formatted || '解析失败'}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('') : 
                                '<div class="param-item"><div class="param-key">无参数</div></div>'
                            }
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    createComparisonResults() {
        if (this.qrData.length < 2) {
            return '<div class="results"><h2>📊 对比分析</h2><p>需要至少2个二维码才能进行对比分析</p></div>';
        }

        let html = '<div class="comparison"><h2>📊 详细对比分析</h2>';
        
        // 获取所有参数的并集
        const allParams = new Set();
        this.qrData.forEach(data => {
            Object.keys(data.params).forEach(key => allParams.add(key));
        });

        if (allParams.size > 0) {
            html += `
                <table class="diff-table">
                    <thead>
                        <tr>
                            <th>参数名</th>
                            ${this.qrData.map((data, index) => 
                                `<th>${data.fileName}</th>`
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody>
            `;

            Array.from(allParams).sort().forEach(param => {
                const values = this.qrData.map(data => data.params[param] || '');
                const isUniform = values.every(v => v === values[0]);
                
                html += `
                    <tr ${isUniform ? '' : 'class="highlight"'}>
                        <td><strong>${param}</strong></td>
                        ${values.map(value => `
                            <td>${this.escapeHtml(value || '—')}</td>
                        `).join('')}
                    </tr>
                `;
            });

            html += '</tbody></table>';
        }

        // 时间差异分析
        const timeAnalysis = this.analyzeTimeDifferences();
        if (timeAnalysis) {
            html += timeAnalysis;
        }

        html += '</div>';
        return html;
    }

    analyzeTimeDifferences() {
        const timesData = this.qrData
            .filter(data => data.parsedTime && data.parsedTime.parsed)
            .map(data => ({
                fileName: data.fileName,
                time: data.parsedTime
            }));

        if (timesData.length < 2) {
            return '<h3>⏰ 时间分析</h3><p>没有足够的有效时间数据进行分析</p>';
        }

        let html = '<h3>⏰ 时间差异分析</h3>';
        
        // 排序
        timesData.sort((a, b) => a.time.timestamp - b.time.timestamp);
        
        html += '<ul>';
        for (let i = 0; i < timesData.length - 1; i++) {
            const current = timesData[i];
            const next = timesData[i + 1];
            const diffMs = next.time.timestamp - current.time.timestamp;
            const diffMinutes = Math.round(diffMs / 60000);
            const diffHours = Math.round(diffMs / 3600000);
            
            html += `
                <li>
                    <strong>${current.fileName}</strong> → <strong>${next.fileName}</strong>: 
                    相差 ${diffHours > 0 ? diffHours + '小时' : diffMinutes + '分钟'}
                    <br>
                    <small style="opacity: 0.8;">
                        ${current.time.formatted} → ${next.time.formatted}
                    </small>
                </li>
            `;
        }
        html += '</ul>';
        
        return html;
    }

    showStatus(message, type) {
        const statusArea = document.getElementById('status-area');
        statusArea.innerHTML = `<div class="status ${type}">${message}</div>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化分析器
document.addEventListener('DOMContentLoaded', () => {
    new QRAnalyzer();
});