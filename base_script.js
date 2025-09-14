// base_script.js
// import jsQR from 'jsqr';
// import QRCode from 'qrcode';

// 假设我们有如下 DOM 元素用于交互和显示结果
const fileInput = document.getElementById("qr-file-input");
const rightPanel = document.getElementById("right-panel");
const uploadButton = document.getElementById("upload-btn");

// 绑定事件：点击按钮触发文件选择
uploadButton.addEventListener("click", () => {
  fileInput.click();
});

// 绑定事件：文件选择后触发处理流程
fileInput.addEventListener("change", extendQRCodeDeadline);

async function extendQRCodeDeadline() {
  // 1. 获取用户上传的文件
  const file = fileInput.files[0];
  if (!file) {
    showError("请先选择一个二维码文件");
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

    // 3. 核心逻辑：修改文本内容
    const modifiedText = modifyCreateTime(originalText);
    if (modifiedText === originalText) {
      showError("未检测到可修改的createTime参数");
      return;
    }

    // 4. 重新生成并显示二维码
    await generateQRCode(modifiedText);

    // 5. 任务完成，展示成功信息
    displaySuccess("成功生成新的二维码！");
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
 * @param {string} imageDataUrl
 * @returns {Promise<string|null>}
 */
function decodeQRCode(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageDataUrl;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      try {
        // jsQR 库需要通过 CDN 或包管理器引入
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        resolve(code ? code.data : null);
      } catch (err) {
        // 捕获 jsQR 库可能抛出的异常
        reject(new Error("二维码解码失败"));
      }
    };

    image.onerror = () => reject(new Error("图片加载失败"));
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
      // 清理旧的二维码并显示新的
      const oldQR = document.querySelector(".qr-image");
      if (oldQR) oldQR.remove();

      const qrImg = document.createElement("img");
      qrImg.classList.add("qr-image");
      qrImg.src = url;
      rightPanel.appendChild(qrImg);
      resolve();
    });
  });
}

// ----------------------------------------------------
// UI/辅助函数（可以独立在另一个文件中）
// ----------------------------------------------------

/**
 * 显示成功消息
 * @param {string} msg
 */
function clearResults() {
  const messages = rightPanel.querySelectorAll(
    ".message, .deadline, .qr-image"
  );
  messages.forEach((elem) => elem.remove());
  rightPanel.innerHTML = "<p>处理结果将在这里显示...</p>";
}

function displaySuccess(msg) {
  let elem = document.createElement("div");
  elem.classList.add("message", "success");
  elem.textContent = msg;
  rightPanel.appendChild(elem);
  setTimeout(() => elem.remove(), 3500);
}

function showError(msg) {
  let elem = document.createElement("div");
  elem.classList.add("message", "error");
  elem.textContent = msg;
  rightPanel.appendChild(elem);
  setTimeout(() => elem.remove(), 3500);
}

function displayDeadline(deadlineText) {
  let deadlineElem = document.createElement("div");
  deadlineElem.classList.add("deadline");
  deadlineElem.textContent = `新的截止时间：${deadlineText}`;
  rightPanel.appendChild(deadlineElem);
}

// （其他辅助函数如 showError, displayDeadline 保持不变）

// 注册事件监听器
fileInput.addEventListener("change", extendQRCodeDeadline);
