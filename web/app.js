const params = new URLSearchParams(window.location.search);
const room = params.get("room");
const username = params.get("username");

const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const box = document.getElementById('messages');

box.innerHTML = '';

function formatTime(timestamp) {
    let ts = timestamp;
    // Если сервер прислал время в секундах — переводим в миллисекунды
    if (ts && ts < 1e12) ts *= 1000;
    const date = ts ? new Date(ts) : new Date();
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function getColorForUsername(name) {
    const colors = [
        '#5b60ff', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function addMessage(text, type = 'incoming', author = '', timestamp = null) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    if (type === 'incoming' && author) {
        const header = document.createElement('div');
        header.className = 'message-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author';
        authorSpan.textContent = author;
        authorSpan.style.color = getColorForUsername(author);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(timestamp);

        header.appendChild(authorSpan);
        header.appendChild(timeSpan);
        textDiv.appendChild(header);
    } else if (type === 'outgoing') {
        const header = document.createElement('div');
        header.className = 'message-header';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(timestamp);

        header.appendChild(timeSpan);
        textDiv.appendChild(header);
    }

    const content = document.createElement('span');
    content.className = 'message-content';
    content.textContent = text;
    textDiv.appendChild(content);

    msg.appendChild(textDiv);
    box.appendChild(msg);

    box.scrollTop = box.scrollHeight;
}

if (!room || !username) {
    addMessage('⚠️ Не указан room или username. Добавьте ?room=имя_комнаты&username=ваш_ник к URL', 'system');
    input.disabled = true;
    sendBtn.disabled = true;
} else {
    const ws = new WebSocket(`ws://localhost:8080/ws/${room}?username=${username}`);

    ws.onopen = () => {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        addMessage(`Подключено к комнате «${room}». Вы вошли как ${username}.`, 'system');
    };

3
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            // Пришёл не JSON — выводим как есть
            addMessage(event.data, 'incoming');
            return;
        }

        let text = data.text ?? data.message ?? '';

        // ⬇️ ГЛАВНЫЙ ФИКС: сервер положил весь наш JSON в поле text —
        // распаковываем вложенный JSON и берём только внутренний text
        if (typeof text === 'string' && text.trim().startsWith('{')) {
            try {
                const inner = JSON.parse(text);
                if (inner && typeof inner === 'object' && typeof inner.text === 'string') {
                    text = inner.text;
                    data.username = data.username || inner.username;
                    data.timestamp = data.timestamp || inner.timestamp;
                }
            } catch { /* это просто текст, начинающийся с "{" */ }
        }

        // Системные сообщения сервера
        if (data.type === 'system' || data.system) {
            addMessage(text, 'system');
            return;
        }

        const type = data.username === username ? 'outgoing' : 'incoming';
        addMessage(text, type, data.username || '', data.timestamp);
    };

    ws.onerror = () => {
        addMessage('Ошибка соединения с сервером', 'system');
    };

    ws.onclose = (event) => {
        addMessage(`Соединение закрыто (код: ${event.code})`, 'system');
        input.disabled = true;
        sendBtn.disabled = true;
    };

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        if (ws.readyState === WebSocket.OPEN) {
            // Отправляем чистый текст: сервер сам добавит
            // username и timestamp из контекста соединения
            ws.send(text);
            input.value = '';
            input.focus();
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}
