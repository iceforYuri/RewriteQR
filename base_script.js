// base_script.js
// import jsQR from 'jsqr';
// import QRCode from 'qrcode';

// 假设我们有如下 DOM 元素用于交互和显示结果
const fileInput = document.getElementById("qr-file-input");
const uploadArea = document.getElementById("upload-area");
const statusArea = document.getElementById("status-area");
const messageContainer = document.getElementById("message-container");
const qrPlaceholder = document.getElementById("qr-placeholder");

// 绑定事件：点击上传区域触发文件选择
uploadArea.addEventListener("click", (e) => {
  // 阻止事件冒泡，避免触发隐藏input的默认行为
  e.stopPropagation();
  fileInput.click();
});

// 阻止隐藏的input元素的点击事件冒泡
fileInput.addEventListener("click", (e) => {
  e.stopPropagation();
});

// 绑定事件：文件选择后触发处理流程
fileInput.addEventListener("change", extendQRCodeDeadline);

async function extendQRCodeDeadline() {
  // 1. 获取用户上传的文件
  const file = fileInput.files[0];
  if (!file) {
    // 如果用户取消了文件选择，则不执行任何操作
    return;
  }

  clearResults();

  try {
    // 2. 读取文件并解码二维码
    const imageDataUrl = await readFileAsync(file);
    const originalText = await decodeQRCode(imageDataUrl);

    if (!originalText) {
      showError("无法识别二维码内容");
      return;
    }

    // 3. 核心逻辑：尝试修改文本内容
    const modifiedText = modifyCreateTime(originalText);

    // 4. 重新生成并显示二维码（无论内容是否被修改）
    await generateQRCode(modifiedText);

    // 5. 根据是否修改成功，展示不同的成功信息
    if (modifiedText !== originalText) {
      displaySuccess("成功延长有效期！");
    } else {
      displaySuccess("已重新生成二维码（未修改时间）");
    }
  } catch (error) {
    // 6. 统一的错误处理
    showError(`处理失败：${error.message}`);
    console.error(error);
  }
}

/**
 * 模块1: 文件读取服务
 * 将文件转为 DataURL，Promise 化
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * 模块2: 二维码解码服务
 * 利用 Canvas 和 jsQR 解码二维码
 * 支持高分辨率、大尺寸、透明 PNG、webp/gif
 * @param {string} imageDataUrl
 * @returns {Promise<string|null>}
 */
function decodeQRCode(imageDataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "Anonymous"; // 解决跨域/透明问题
    image.src = imageDataUrl;

    image.onload = () => {
      // 对大尺寸图片缩放，保持性能
      const maxSize = 1024;
      let scale = 1;
      if (image.width > maxSize || image.height > maxSize) {
        scale = Math.min(maxSize / image.width, maxSize / image.height);
      }

      const canvas = document.createElement("canvas");
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      try {
        // jsQR 库需要通过 CDN 或包管理器引入
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        resolve(code ? code.data : null);
      } catch (err) {
        // 捕获 jsQR 库可能抛出的异常
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
  });
}

/**
 * 模块3: 数据篡改服务
 * 只修改 createTime 参数，加1小时
 * @param {string} text
 * @returns {string} 修改后的文本
 */
function modifyCreateTime(text) {
  // 确保正则表达式的严谨性，匹配 T 或空格作为分隔符
  const regex =
    /createTime=([0-9]{4}-[0-9]{2}-[0-9]{2})([ T])([0-9]{2})(:[0-9]{2}:[0-9]{2})/;
  const match = text.match(regex);

  if (match) {
    const [fullMatch, datePart, sep, hourStr, rest] = match;
    const hourNum = (parseInt(hourStr, 10) + 1) % 24;
    const newHourStr = hourNum.toString().padStart(2, "0");
    const newTime = `${datePart}${sep}${newHourStr}${rest}`;

    displayDeadline(newTime.replace("T", " "));

    return text.replace(regex, `createTime=${newTime}`);
  }

  // 如果未匹配，返回原始文本，以便在主函数中判断是否修改成功
  return text;
}

/**
 * 模块4: 二维码生成服务
 * 生成并显示二维码
 * @param {string} text
 * @returns {Promise<void>}
 */
function generateQRCode(text) {
  return new Promise((resolve, reject) => {
    // qrcode.js 库需要通过 CDN 或包管理器引入
    QRCode.toDataURL(text, { width: 260, margin: 2 }, (err, url) => {
      if (err) {
        reject(new Error("二维码生成失败"));
        return;
      }
      // 清理占位符并显示新的二维码
      qrPlaceholder.style.display = "none";

      const qrImg = document.createElement("img");
      qrImg.classList.add("qr-image");
      qrImg.src = url;
      statusArea.appendChild(qrImg);
      resolve();
    });
  });
}

// ----------------------------------------------------
// UI/辅助函数（可以独立在另一个文件中）
// ----------------------------------------------------

/**
 * 清理上一次的结果
 */
function clearResults() {
  // 清空消息
  messageContainer.innerHTML = "";
  // 移除旧的二维码和截止时间
  const oldElements = statusArea.querySelectorAll(".qr-image, .deadline");
  oldElements.forEach((elem) => elem.remove());
  // 重新显示占位符
  qrPlaceholder.style.display = "block";
}

/**
 * 显示消息
 * @param {string} msg
 * @param {'success' | 'error'} type
 */
function showMessage(msg, type) {
  let elem = document.createElement("div");
  elem.classList.add("message", type);
  elem.textContent = msg;
  messageContainer.appendChild(elem);
  setTimeout(() => {
    if (elem.parentElement) {
      elem.parentElement.removeChild(elem);
    }
  }, 3500);
}

function displaySuccess(msg) {
  showMessage(msg, "success");
}

function showError(msg) {
  showMessage(msg, "error");
}

function displayDeadline(deadlineText) {
  let deadlineElem = document.createElement("div");
  deadlineElem.classList.add("deadline");
  deadlineElem.textContent = `新的截止时间：${deadlineText}`;
  statusArea.appendChild(deadlineElem);
}

/**
 * 打开二维码分析页面
 */
function openAnalysisPage() {
  // 在新标签页中打开分析工具
  window.open("qr_analyzer/qr_analyzer.html", "_blank");
}

// （其他辅助函数如 showError, displayDeadline 保持不变）

// 注册事件监听器
// fileInput.addEventListener("change", extendQRCodeDeadline); // 已在顶部定义
